import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs, getDoc, doc } from "firebase/firestore";
import { startOfMonth, endOfMonth, eachDayOfInterval, format } from "date-fns";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import "../assets/MyDutySchedule.css"

function getShiftName(code) {
  switch (code) {
    case "M": return "Morning Shift";
    case "E": return "Evening Shift";
    case "N": return "Night Shift";
    case "G": return "General Shift";
    case "W":
    case "WO":
    case "W/O": return "Weekly Off";
    default: return "Unknown";
  }
}

function formatDutyDisplay(mainShift, otShift, replacedName, cl) {
  let text = "";

  if (cl) {
    text = "CL";
  } else if (mainShift) {
    text = getShiftName(mainShift);
  }

  if (otShift) {
    text += text ? " + " : "";
    text += `"OT" > ${getShiftName(otShift)}`;
    if (replacedName) text += ` (Replacing: ${replacedName})`;
  }

  return text || "No Duty";
}


async function getAllUsersMap() {
  const snap = await getDocs(collection(db, "users"));
  const map = {};
  snap.forEach(d => map[d.id] = d.data().name);
  return map;
}


export default function MyDutySchedule({ currentUser }) {
  const [myDays, setMyDays] = useState([]);
  const navigate = useNavigate();
  const [summary, setSummary] = useState({ totalCL: 0, totalOT: 0 });
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [weekdayTemplate, setWeekdayTemplate] = useState(null);
  const [userMap, setUserMap] = useState({});
  const [allRosterDocs, setAllRosterDocs] = useState([]);

  /** permissions */
  const isAdmin =
    currentUser?.role === "Super Admin" ||
    currentUser?.role === "Admin" ||
    currentUser.isAdminAssigned ||
    // isAdminAssignmentValid(userData) ||
    currentUser?.designation === "Vertiv Site Infra Engineer" ||
    currentUser?.designation === "Vertiv CIH" ||
    currentUser?.designation === "Vertiv ZM";


  // async function loadWeekdayTemplate(siteId) {
  //   const ref = doc(db, "dutyRosterTemplate", siteId);
  //   const snap = await getDoc(ref);
  //   return snap.exists() ? snap.data() : null;
  // }

  useEffect(() => {
    if (!currentUser?.site) return;

    async function loadTemplate() {
      const ref = doc(db, "dutyRosterTemplate", currentUser.site);
      const snap = await getDoc(ref);
      setWeekdayTemplate(snap.exists() ? snap.data() : null);
    }

    loadTemplate();
  }, [currentUser?.site]);

  useEffect(() => {
    async function loadUsers() {
      const snap = await getDocs(collection(db, "users"));
      const map = {};
      snap.forEach(d => {
        const u = d.data();
        map[d.id] = {
          name: u.name || "Unknown",
          mobile: u.mobileNo || "-"
        };
      });
      setUserMap(map);
    }

    loadUsers();
  }, []);

  useEffect(() => {
    if (!currentUser?.site) return;

    async function loadRoster() {
      const rosterSnap = await getDocs(collection(db, "dutyRoster"));
      setAllRosterDocs(rosterSnap.docs);
    }

    loadRoster();
  }, [currentUser?.site]);

  useEffect(() => {
    if (!currentUser?.site || !currentUser?.uid) return;
    if (!allRosterDocs.length) return;

    async function load() {
      const start = startOfMonth(selectedMonth);
      const end = endOfMonth(selectedMonth);

      const days = eachDayOfInterval({ start, end });

      const allUserNames = await getAllUsersMap(); // load once

      // const rosterSnap = await getDocs(collection(db, "dutyRoster"));
      // setAllRosterDocs(rosterSnap.docs);

      const list = [];

      for (let day of days) {
        const iso = format(day, "yyyy-MM-dd");
        const docId = `${currentUser.site}_${iso}`;

        // find roster doc
        const docSnap = allRosterDocs.find(d => d.id === docId);
        if (!docSnap) continue;

        const data = docSnap.data();

        // find user's shift (if assigned)
        const shift = Object.keys(data.shifts || {}).find(s =>
          (data.shifts[s] || []).includes(currentUser.uid)
        );

        // if (!shift) continue;

        // Detect OT shift separately
        let otShift = null;
        if (data.ot) {
          for (const s of Object.keys(data.ot)) {
            if ((data.ot[s] || []).includes(currentUser.uid)) {
              otShift = s; // This is the OT shift (can be different from main shift)
              break;
            }
          }
        }


        // find replaced person
        let isCL = false;
        let replacedUserId = null;
        let replacedUserName = null;

        if (data.replacements) {
          for (const originalUid of Object.keys(data.replacements)) {
            const r = data.replacements[originalUid];

            // ✔ user is the one who applied CL (so user won't appear in shift)
            if (originalUid === currentUser.uid && r.type === "CL") {
              isCL = true;
            }

            // ✔ user is backup replacing someone
            if (r.replacedBy === currentUser.uid) {
              replacedUserId = originalUid;
              replacedUserName = allUserNames[originalUid] || null;
            }
          }
        }

        // if user has neither duty nor CL → skip
        if (!shift && !isCL) continue;

        list.push({
          date: iso,
          mainShift: shift || null,
          otShift: otShift || null,
          cl: isCL,
          replacedUserId,
          replacedUserName
        });
      }

      setMyDays(list);

      // ---- SUMMARY CALCULATION ----
      let totalCL = 0;
      let totalOT = 0;

      list.forEach(d => {
        if (d.cl) totalCL++;
        if (d.otShift) totalOT++;
      });

      setSummary({
        totalCL,
        totalOT
      });

    }


    load();
  }, [currentUser, selectedMonth, allRosterDocs]);


  const monthlyUserShiftSummary = useMemo(() => {
    if (!currentUser?.site) return {};

    const summary = {};

    const start = startOfMonth(selectedMonth);
    const end = endOfMonth(selectedMonth);

    const days = eachDayOfInterval({ start, end });

    // loop all roster docs (you already fetched earlier)
    days.forEach(day => {
      const iso = format(day, "yyyy-MM-dd");
      const docId = `${currentUser.site}_${iso}`;

      const docSnap = allRosterDocs?.find(d => d.id === docId);
      if (!docSnap) return;

      const data = docSnap.data();

      // ✅ LOOP ALL SHIFTS
      Object.keys(data.shifts || {}).forEach(shift => {
        (data.shifts[shift] || []).forEach(uid => {

          if (!summary[uid]) {
            summary[uid] = { G: 0, M: 0, E: 0, N: 0, WO: 0 };
          }

          const normalizedShift = shift === "W" ? "WO" : shift;

          summary[uid][normalizedShift] += 1;
        });
      });

    });

    return summary;
  }, [selectedMonth, currentUser, allRosterDocs]);

  const total = { G: 0, M: 0, E: 0, N: 0, WO: 0 };

  Object.values(monthlyUserShiftSummary).forEach(u => {
    total.G += u.G;
    total.M += u.M;
    total.E += u.E;
    total.N += u.N;
    total.WO += u.WO;
  });

  const calendarCells = useMemo(() => {
    const start = startOfMonth(selectedMonth);
    const end = endOfMonth(selectedMonth);
    const dutyByDate = new Map(
      myDays.map(duty => [duty.date, duty])
    );

    const cells = Array.from(
      { length: start.getDay() },
      () => null
    );

    eachDayOfInterval({ start, end }).forEach(day => {
      const date = format(day, "yyyy-MM-dd");
      cells.push({
        date,
        dayNumber: format(day, "d"),
        duty: dutyByDate.get(date) || null,
      });
    });

    while (cells.length % 7 !== 0) {
      cells.push(null);
    }

    return cells;
  }, [selectedMonth, myDays]);

  const today = format(new Date(), "yyyy-MM-dd");

  return (
    <div className="daily-log-container">
      <h2>My Duty Schedule</h2>
      <div className="mds-user-card" style={{ marginBottom: "5px" }}>
        {currentUser?.role === "Super Admin" && <span>Hi, 👑 <strong>{currentUser?.name || "Team Member"}</strong></span>}
        {currentUser?.role === "Admin" && <span>Hi, 🔑 <strong>{currentUser?.name || "Team Member"}</strong></span>}
        {currentUser?.role === "Super User" && <span>Hi, 🦸 <strong>{currentUser?.name || "Team Member"}</strong></span>}
        {currentUser?.role === "User" && <span>Hi, 👤 <strong>{currentUser?.name || "Team Member"}</strong></span>}
        <p>Emp.🆔: <strong>{currentUser.empId}</strong></p>
        <p>Designation: <strong>{currentUser.designation}</strong></p>
      </div>

      {weekdayTemplate && (
        <div className="mds-weekly-template">
          <h2 style={{ color: "#092353" }}>📅 Weekly Duty Template</h2>

          <table className="mds-weekly-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>General</th>
                <th>Morning</th>
                <th>Evening</th>
                <th>Night</th>
                <th>Weekly Off</th>
              </tr>
            </thead>
            <tbody>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => (
                <tr key={day}>
                  <td><strong>{day}</strong></td>

                  {["G", "M", "E", "N", "WO"].map(shift => (
                    <td key={shift}>
                      {(weekdayTemplate?.[day]?.[shift] || []).length > 0 ? (
                        <div className="mds-user-cell">
                          {weekdayTemplate[day][shift].map((uid, idx) => (
                            <div key={uid} className="mds-user-line">
                              <strong>({idx + 1}) {userMap[uid]?.name || uid.slice(0, 6)}</strong>
                              <span className="mds-user-mobile">
                                📞 {userMap[uid]?.mobile || "-"}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : "-"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isAdmin ? (
        <div className="mds-summary-box" style={{ background: "#08091b" }}>
          <h2>📊 Manpower-wise Monthly Shift Count</h2>

          <table className="mds-summary-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>G</th>
                <th>M</th>
                <th>E</th>
                <th>N</th>
                <th>W/O</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(monthlyUserShiftSummary)
                .sort((a, b) =>
                  (userMap[a]?.name || "").localeCompare(userMap[b]?.name || "")
                )
                .map(uid => (
                  <tr key={uid}>
                    <td>
                      <strong>{userMap[uid]?.name || uid.slice(0, 6)}</strong>
                    </td>
                    <td>{monthlyUserShiftSummary[uid].G}</td>
                    <td>{monthlyUserShiftSummary[uid].M}</td>
                    <td>{monthlyUserShiftSummary[uid].E}</td>
                    <td>{monthlyUserShiftSummary[uid].N}</td>
                    <td>{monthlyUserShiftSummary[uid].WO}</td>
                  </tr>
                ))}
              <tr style={{ fontWeight: "bold", background: "#f3f4f6" }}>
                <td>Total</td>
                <td>{total.G}</td>
                <td>{total.M}</td>
                <td>{total.E}</td>
                <td>{total.N}</td>
                <td>{total.WO}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mds-summary-box" style={{ background: "#08091b" }}>
          <h2>📊 Monthly Shift Count</h2>

          <table className="mds-summary-table">
            <thead>

              <tr>
                <th>Name</th>
                <th>G</th>
                <th>M</th>
                <th>E</th>
                <th>N</th>
                <th>W/O</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(monthlyUserShiftSummary)
                .filter(uid => uid === currentUser.uid)
                .map(uid => (
                  <tr key={uid}>
                    <td>
                      <strong>{userMap[uid]?.name || uid.slice(0, 6)}</strong>
                    </td>
                    <td>{monthlyUserShiftSummary[uid].G}</td>
                    <td>{monthlyUserShiftSummary[uid].M}</td>
                    <td>{monthlyUserShiftSummary[uid].E}</td>
                    <td>{monthlyUserShiftSummary[uid].N}</td>
                    <td>{monthlyUserShiftSummary[uid].WO}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mds-month-box">
        <label>Select Month:</label>
        <input
          type="month"
          value={format(selectedMonth, "yyyy-MM")}
          onChange={(e) => setSelectedMonth(new Date(e.target.value + "-01"))}
          className="mds-month-input"
        />
      </div>

      <div className="mds-summary-box" style={{ background: "#0c1024" }}>
        <h2 className="mds-summary-title">Monthly Summary</h2>

        <table className="mds-summary-table">
          <thead>
            <tr>
              <th style={{ padding: "8px", borderBottom: "1px solid #e5e7eb" }}>Month</th>
              <th style={{ padding: "8px", borderBottom: "1px solid #e5e7eb" }}>Total CL</th>
              <th style={{ padding: "8px", borderBottom: "1px solid #e5e7eb" }}>Total OT</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: "8px", borderBottom: "1px solid #e5e7eb" }}>
                {format(selectedMonth, "MMMM yyyy")}
              </td>
              <td style={{ padding: "8px", borderBottom: "1px solid #e5e7eb" }}>
                {summary.totalCL}
              </td>
              <td style={{ padding: "8px", borderBottom: "1px solid #e5e7eb" }}>
                {summary.totalOT}
              </td>
            </tr>
          </tbody>
        </table>
      </div>


      <div className="mds-duty-list">
        <div className="mds-calendar-heading">
          <div>
            <span className="mds-calendar-eyebrow">Duty calendar</span>
            <h2>{format(selectedMonth, "MMMM yyyy")}</h2>
          </div>

          <div className="mds-calendar-legend" aria-label="Shift legend">
            <span><i className="mds-legend-dot mds-dot-general" /> General</span>
            <span><i className="mds-legend-dot mds-dot-morning" /> Morning</span>
            <span><i className="mds-legend-dot mds-dot-evening" /> Evening</span>
            <span><i className="mds-legend-dot mds-dot-night" /> Night</span>
            <span><i className="mds-legend-dot mds-dot-off" /> Weekly Off</span>
          </div>
        </div>

        {myDays.length === 0 && (
          <div className="mds-calendar-empty">
            No duty has been assigned for this month.
          </div>
        )}

        <div className="mds-calendar-scroll">
          <div className="mds-calendar-grid">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
              <div className="mds-calendar-weekday" key={day}>
                {day}
              </div>
            ))}

            {calendarCells.map((cell, index) => {
              if (!cell) {
                return (
                  <div
                    className="mds-calendar-day mds-calendar-day-outside"
                    key={`blank-${index}`}
                    aria-hidden="true"
                  />
                );
              }

              const d = cell.duty;
              const dutyClass = !d
                ? "mds-calendar-no-duty"
                : d.cl
                  ? "mds-calendar-cl"
                  : d.otShift
                    ? "mds-calendar-ot"
                    : `mds-calendar-shift-${d.mainShift || "none"}`;

              return (
                <div
                  key={cell.date}
                  className={
                    `mds-calendar-day ${dutyClass}` +
                    (cell.date === today ? " mds-calendar-today" : "")
                  }
                >
                  <div className="mds-calendar-date-row">
                    <span className="mds-calendar-date">
                      {cell.dayNumber}
                    </span>

                    {cell.date === today && (
                      <span className="mds-today-label">Today</span>
                    )}
                  </div>

                  {d ? (
                    <>
                      <div className="mds-calendar-duty">
                        <span className="mds-shift-code">
                          {d.cl ? "CL" : d.mainShift || "OT"}
                        </span>
                        <span className="mds-shift-name">
                          {formatDutyDisplay(
                            d.mainShift,
                            d.otShift,
                            d.replacedUserName,
                            d.cl
                          )}
                        </span>
                      </div>

                      {d.otShift && (
                        <span className="mds-duty-tag">
                          Overtime
                        </span>
                      )}

                      {!d.otShift && !d.cl && (
                        <button
                          type="button"
                          className="mds-apply-cl"
                          onClick={() =>
                            navigate("/cl-application", {
                              state: { date: d.date },
                            })
                          }
                        >
                          Apply for CL
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="mds-no-duty-label">No duty</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
