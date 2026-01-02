// DutyTracker.jsx
// React component (single-file) implementing the Combined View: Calendar + Date Editor
// Prerequisites:
// 1) Firebase v9 (modular) initialized in ../firebase.js exporting `auth`, `firestore` (db)
// 2) Tailwind CSS configured in the project (optional)
// 3) User object available from context/provider with fields: { uid, role, emailVerified, region, circle, site }
// 4) Install framer-motion if you want animations: `npm i framer-motion`

import React, { useEffect, useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, set } from "date-fns";
import { motion } from "framer-motion";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
  serverTimestamp,
  runTransaction,
  addDoc,
  getDoc
} from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { writeBatch } from "firebase/firestore";
import "../assets/DutyTracker.css"; // optional


// ---------- Helper utils ----------
const SITE_DOC_ID = (siteId, date) => `${siteId}_${date}`; // use siteId slug + 2025-11-30

function formatISODate(date) {
  // returns YYYY-MM-DD
  return format(date, "yyyy-MM-dd");
}

// Small UI atoms
function Button({ children, onClick, className = "" }) {
  return (
    <button
      onClick={onClick}
      className={`button ${className}`}
    >
      {children}
    </button>
  );
}


function Badge({ children }) {
  return (
    <span className="px-2 py-0.5 rounded bg-slate-200 text-sm">{children}</span>
  );
}

async function notifyAssignedMembers(shifts, date) {
  for (let shiftName of Object.keys(shifts)) {
    const userList = shifts[shiftName]; // all users in this shift

    const readableShift =
      shiftName === "G" ? "General Shift" :
        shiftName === "E" ? "Evening Shift" :
          shiftName === "M" ? "Morning Shift" :
            shiftName === "N" ? "Night Shift" :
              shiftName === "WO" || shiftName === "W/O" || shiftName === "W" ? "Weekly Off" :
                "Unknown Shift";

    for (let uid of userList) {
      await addDoc(collection(db, "notifications", uid, "items"), {
        title: "Duty Assigned",
        message: `You are assigned to ${readableShift} on ${date}.`,
        date,
        read: false,
        createdAt: serverTimestamp(),
        actionType: "duty_assigned",
        shift: shiftName
      });
    }
  }
}


// ---------- useDutyRoster hook ----------
function useDutyRoster(siteId, monthDate) {
  const [loading, setLoading] = useState(true);
  const [rosters, setRosters] = useState({}); // key: YYYY-MM-DD -> roster doc

  useEffect(() => {
    if (!siteId) return;
    const start = formatISODate(startOfMonth(monthDate));
    const end = formatISODate(endOfMonth(monthDate));

    const q = collection(db, "dutyRoster");
    const unsub = onSnapshot(
      q,
      (snap) => {
        const map = {};
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          const id = docSnap.id;
          if (!id.startsWith(siteId + "_")) return;
          const datePart = id.replace(siteId + "_", "");
          if (datePart >= start && datePart <= end) {
            map[datePart] = { id, ...data };
          }
        });
        setRosters(map);
        setLoading(false);
      },
      (err) => {
        console.error("dutyRoster listen error", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [siteId, monthDate]);

  function saveRosterForDate(dateISO, rosterDoc, user) {
    const docId = SITE_DOC_ID(siteId, dateISO);
    const docRef = doc(db, "dutyRoster", docId);

    return runTransaction(db, async (tx) => {
      const snap = await tx.get(docRef);
      const newData = {
        ...rosterDoc,
        updatedAt: serverTimestamp(),
        createdBy: rosterDoc.createdBy || user.uid
      };

      // Validate max 2 per shift
      for (const s of ["M", "E", "N", "G", "WO"]) {
        const arr = newData.shifts?.[s] || [];
        if (arr.length > 2) throw new Error(`Max 2 users allowed for shift ${s}`);
      }

      if (snap.exists()) {
        tx.update(docRef, newData);
      } else {
        tx.set(docRef, { ...newData, createdAt: serverTimestamp() });
      }
    });
  }

  return { rosters, loading, saveRosterForDate };
}

// Save weekday template for shifts
async function saveWeekdayTemplate(siteId, template) {
  await setDoc(
    doc(db, "dutyRosterTemplate", siteId),
    {
      ...template,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

// Load weekday template when siteId changes
async function loadWeekdayTemplate(siteId) {
  const ref = doc(db, "dutyRosterTemplate", siteId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}


async function getAllUsersMap() {
  const snap = await getDocs(collection(db, "users"));
  const map = {};
  snap.forEach(d => map[d.id] = d.data().name);
  return map;
}
// ---------- Main Page Component ----------
export default function DutyTrackerPage({ currentUser }) {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [regionList, setRegionList] = useState([]);
  const [circleList, setCircleList] = useState([]);
  const [siteList, setSiteList] = useState([]);
  const [applingTemplate, setApplingTemplate] = useState(false);
  const navigate = useNavigate();

  const [selectedRegion, setSelectedRegion] = useState(currentUser?.region || "");
  const [selectedCircle, setSelectedCircle] = useState(currentUser?.circle || "");
  const [selectedSite, setSelectedSite] = useState(currentUser?.site || "");

  const { rosters, loading: rosterLoading, saveRosterForDate } = useDutyRoster(
    selectedSite,
    selectedMonth
  );

  const [calendarDays, setCalendarDays] = useState([]);
  const [activeDateISO, setActiveDateISO] = useState(formatISODate(new Date()));
  const [activeRoster, setActiveRoster] = useState(null);
  const [siteUsers, setSiteUsers] = useState([]);
  const [leaveMap, setLeaveMap] = useState({});

  const [weekdayTemplate, setWeekdayTemplate] = useState({
    Mon: { M: [], E: [], N: [], G: [], WO: [] },
    Tue: { M: [], E: [], N: [], G: [], WO: [] },
    Wed: { M: [], E: [], N: [], G: [], WO: [] },
    Thu: { M: [], E: [], N: [], G: [], WO: [] },
    Fri: { M: [], E: [], N: [], G: [], WO: [] },
    Sat: { M: [], E: [], N: [], G: [], WO: [] },
    Sun: { M: [], E: [], N: [], G: [], WO: [] },
  });

  useEffect(() => {
    const start = startOfMonth(selectedMonth);
    const end = endOfMonth(selectedMonth);

    const days = eachDayOfInterval({ start, end });

    const blanks = [];
    const startWeekday = start.getDay(); // 0 = Sun, 1 = Mon ...

    for (let i = 0; i < startWeekday; i++) {
      blanks.push(null); // empty cells
    }

    setCalendarDays([...blanks, ...days]);
  }, [selectedMonth]);

  useEffect(() => {
    if (!selectedSite) return;
    (async () => {
      const q = query(collection(db, "users"), where("site", "==", selectedSite));
      const snap = await getDocs(q);
      const arr = [];
      snap.forEach((d) => arr.push({ uid: d.id, ...d.data() }));
      setSiteUsers(arr);
    })();
  }, [selectedSite]);

  useEffect(() => {
    const r = rosters[activeDateISO];
    if (r) setActiveRoster(r);
    else
      setActiveRoster({
        siteId: selectedSite,
        date: activeDateISO,
        shifts: { M: [], E: [], N: [], G: [], WO: [] },
        remarks: ""
      });

    if (selectedSite) {
      loadWeekdayTemplate(selectedSite).then((data) => {
        if (data) setWeekdayTemplate(data);
      });
    }
  }, [rosters, activeDateISO, selectedSite]);

  async function handleSaveRoster(roster) {
    if (!currentUser) return alert("Not authenticated");
    try {
      await saveRosterForDate(activeDateISO, roster, currentUser);
      alert("Saved");
    } catch (err) {
      console.error(err);
      alert("Save failed: " + err.message);
    }
  }

  function getNewlyAssignedUsers(oldRoster, newRoster) {
    const result = [];

    ["M", "E", "N", "G", "WO"].forEach(shift => {
      const oldArr = oldRoster?.shifts?.[shift] || [];
      const newArr = newRoster?.shifts?.[shift] || [];

      const added = newArr.filter(uid => !oldArr.includes(uid));

      added.forEach(uid => {
        result.push({ uid, shift });
      });
    });

    return result;
  }


  async function handleSaveAndNotify() {
    if (!currentUser) return alert("Not authenticated");

    const dateISO = activeDateISO;

    // old roster from Firestore
    const oldRoster = rosters[dateISO] || { shifts: { M: [], E: [], N: [], G: [], WO: [] } };

    // new roster being edited
    const newRoster = activeRoster;

    try {
      // 1️⃣ Save roster first
      await saveRosterForDate(dateISO, newRoster, currentUser);

      // 2️⃣ Detect new assignments
      const newlyAssigned = getNewlyAssignedUsers(oldRoster, newRoster);

      // 3️⃣ Create notifications for each added user
      for (const item of newlyAssigned) {
        await addDoc(
          collection(db, "notifications", item.uid, "items"),
          {
            title: "New Duty Assigned",
            message: `You have been assigned to ${item.shift === "M" ? "Morning" : item.shift === "E" ? "Evening" : item.shift === "N" ? "Night" : item.shift === "G" ? "General" : "W/O"} shift on ${dateISO}.`,
            date: dateISO,
            shift: item.shift,
            site: selectedSite,
            read: false,
            createdAt: serverTimestamp()
          }
        );
      }

      alert("Saved & notifications sent!");

    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
    }
  }

  async function applyTemplateToMonth(currentUser, selectedMonth, template) {
    if (!template) return alert("No template saved!");
    setApplingTemplate(true);
    const start = startOfMonth(selectedMonth);
    const end = endOfMonth(selectedMonth);
    const days = eachDayOfInterval({ start: start, end: end });
    // const batch = writeBatch(db);

    const templateShifts = template; // shifts to be applied

    for (let d of days) {
      const iso = format(d, "yyyy-MM-dd");
      const id = `${currentUser.site}_${iso}`;
      const docRef = doc(db, "dutyRoster", id);

      await runTransaction(db, async (tx) => {
        const snap = await tx.get(docRef);
        const existing = snap.exists() ? snap.data() : {};

        // weekday to be stored or reused
        const weekday = format(d, "EEEE").slice(0, 3);

        // merge shifts from template
        const merged = {
          ...existing,
          id,
          site: currentUser.site,
          date: iso,
          weekday,
          createdBy: existing.createdBy || currentUser.uid,
          createdAt: existing.createdAt || serverTimestamp(),

          shifts: {
            ...(existing.shifts || {}),
            ...(templateShifts[weekday] || {}) // apply selected template shifts
          },

          updatedAt: serverTimestamp(),
        };

        tx.set(docRef, merged, { merge: true });

        // ADD NOTIFICATIONS FOR THIS DATE
        notifyAssignedMembers(merged.shifts, iso);
      });
    }

    // await batch.commit();
    alert("Roster applied to entire month!");
    setApplingTemplate(false);
  }

  function openDate(date) {
    const iso = formatISODate(date);
    setActiveDateISO(iso);
  }

  // Safe initials helper
  function initials(name) {
    if (!name || typeof name !== "string") return "NA";
    return name
      .trim()
      .split(/\s+/)
      // .map((word) => word[0] || "")
      .slice(0, 1) //2
      .join("");
    // .toUpperCase();
  }

  return (
    <div className="daily-log-container">
      <h2>Duty Tracker</h2>

      {/* Filters */}
      <div className="flex filter-bar">
        <select
          value={selectedRegion}
          onChange={(e) => setSelectedRegion(e.target.value)}
          className="border rounded px-2 py-1"
        >
          <option value="">Select Region</option>
        </select>

        <select
          value={selectedCircle}
          onChange={(e) => setSelectedCircle(e.target.value)}
          className="border rounded px-2 py-1"
        >
          <option value="">Select Circle</option>
        </select>

        <select
          value={selectedSite}
          onChange={(e) => setSelectedSite(e.target.value)}
          className="border rounded px-2 py-1"
        >
          <option value="">Select Site</option>
          {siteList.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <input
          type="month"
          value={format(selectedMonth, "yyyy-MM")}
          onChange={(e) => setSelectedMonth(new Date(e.target.value + "-01"))}
          className="border px-2 py-1 rounded"
        />

        <div style={{ marginLeft: "auto" }}>
          {rosterLoading ? <Badge>Loading...</Badge> : <Badge>Live</Badge>}
        </div>
      </div>

      <div className="grid">
        {/* Calendar (col-span 2) */}
        <div className="calendar-panel">
          <div className="calendar-days-header">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} style={{
                textAlign: 'center',
                fontWeight: '500'
              }}>
                {d}
              </div>
            ))}
          </div>

          <div className="calendar-grid">
            {calendarDays.map((day, index) => {
              if (day === null) {
                return (
                  <div
                    key={"blank-" + index}
                    style={{ minHeight: "90px" }}
                  />
                );
              }

              const iso = formatISODate(day);
              const roster = rosters[iso];
              return (
                <div className="calendar-day-cell" onClick={() => openDate(day)}>
                  <div className="flex">
                    <div style={{ fontSize: "0.875rem", fontWeight: "500" }}>
                      {format(day, "d MMM")}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                      {iso === formatISODate(new Date()) ? "Today" : ""}
                    </div>
                  </div>



                  <div className="shift-title">

                    <div style={{ fontSize: "12px" }}> 🅶 Genarel:</div>
                    <div
                      style={{
                        // display: "flex",
                        gap: "0.25rem",
                        marginTop: "0.25rem"
                      }}
                    >
                      {(roster?.shifts?.G || []).map((uid) => {
                        const u = siteUsers.find((su) => su.uid === uid);
                        return (
                          <div className="initial-badge">
                            {u?.name ? initials(u.name) : uid.slice(0, 4)}
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ marginTop: "8px", fontSize: "0.75rem", color: "#475569", lineHeight: "1.25rem", borderTop: "1px solid #e5e7eb", paddingTop: "4px" }}>🌅 Morning:</div>
                    {/* <div style={{ fontSize: "12px" }}>🌅 Morning:</div> */}
                    <div
                      style={{
                        // display: "flex",
                        gap: "0.25rem",
                        marginTop: "0.25rem"
                      }}
                    >
                      {(roster?.shifts?.M || []).map((uid) => {
                        const u = siteUsers.find((su) => su.uid === uid);
                        return (
                          <div
                            key={uid}
                            style={{
                              paddingLeft: "0.25rem",
                              paddingRight: "0.25rem",
                              paddingTop: "0.125rem",
                              paddingBottom: "0.125rem",
                              border: "1px solid #e5e7eb",
                              borderRadius: "0.375rem",
                              fontSize: "0.75rem"
                            }}
                          >
                            {u?.name ? initials(u.name) : uid.slice(0, 4)}
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ marginTop: "8px", fontSize: "0.75rem", color: "#475569", lineHeight: "1.25rem", borderTop: "1px solid #e5e7eb", paddingTop: "4px" }}>🌇 Evening:</div>
                    <div
                      style={{
                        // display: "flex",
                        gap: "0.25rem",
                        marginTop: "0.25rem"
                      }}
                    >
                      {(roster?.shifts?.E || []).map((uid) => {
                        const u = siteUsers.find((su) => su.uid === uid);
                        return (
                          <div
                            key={uid}
                            style={{
                              paddingLeft: "0.25rem",
                              paddingRight: "0.25rem",
                              paddingTop: "0.125rem",
                              paddingBottom: "0.125rem",
                              border: "1px solid #e5e7eb",
                              borderRadius: "0.375rem",
                              fontSize: "0.75rem"
                            }}
                          >
                            {u?.name ? initials(u.name) : uid.slice(0, 4)}
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ marginTop: "8px", fontSize: "0.75rem", color: "#475569", lineHeight: "1.25rem", borderTop: "1px solid #e5e7eb", paddingTop: "4px" }}>🌙 Night:</div>
                    <div
                      style={{
                        // display: "flex",
                        gap: "0.25rem",
                        marginTop: "0.25rem"
                      }}
                    >
                      {(roster?.shifts?.N || []).map((uid) => {
                        const u = siteUsers.find((su) => su.uid === uid);
                        return (
                          <div
                            key={uid}
                            style={{
                              paddingLeft: "0.25rem",
                              paddingRight: "0.25rem",
                              paddingTop: "0.125rem",
                              paddingBottom: "0.125rem",
                              border: "1px solid #e5e7eb",
                              borderRadius: "0.375rem",
                              fontSize: "0.75rem"
                            }}
                          >
                            {u?.name ? initials(u.name) : uid.slice(0, 4)}
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ marginTop: "8px", fontSize: "0.75rem", color: "#475569", lineHeight: "1.25rem", borderTop: "1px solid #e5e7eb", paddingTop: "4px" }}>🅾 Weekly OFF:</div>
                    <div
                      style={{
                        // display: "flex",
                        gap: "0.25rem",
                        marginTop: "0.25rem"
                      }}
                    >
                      {(roster?.shifts?.WO || []).map((uid) => {
                        const u = siteUsers.find((su) => su.uid === uid);
                        return (
                          <div
                            key={uid}
                            style={{
                              paddingLeft: "0.25rem",
                              paddingRight: "0.25rem",
                              paddingTop: "0.125rem",
                              paddingBottom: "0.125rem",
                              border: "1px solid #e5e7eb",
                              borderRadius: "0.375rem",
                              fontSize: "0.75rem"
                            }}
                          >
                            {u?.name ? initials(u.name) : uid.slice(0, 4)}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p style={{ marginTop: "12px", fontSize: "0.875rem", color: "#64748b", cursor: "pointer" }} onClick={() => navigate("/cl-approve")}>1) Check <strong>"CL"</strong> Status</p>
          <p style={{ marginTop: "12px", fontSize: "0.875rem", color: "#64748b", cursor: "pointer" }} onClick={() => navigate("/cl-calendar")}>2) CL Calendar</p>
          <p style={{ marginTop: "12px", fontSize: "0.875rem", color: "#64748b", cursor: "pointer" }} onClick={() => navigate("/my-leave")}>3) My Leave</p>
          <p style={{ marginTop: "12px", fontSize: "0.875rem", color: "#64748b", cursor: "pointer" }} onClick={() => navigate("/monthly-cl-summary")}>4) Monthly CL Summary</p>
        </div>

        {/* Right side panel: date editor */}
        <motion.div
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="editor-panel">
          <h3>{activeDateISO}</h3>
          <div style={{ fontSize: "0.875rem", color: "#475569", marginBottom: "0.75rem" }}>
            Site: {selectedSite || "—"}
          </div>

          {/* Shift editors */}
          {["M", "E", "N", "G", "WO"].map((shift) => (
            <ShiftEditor
              key={shift}
              shift={shift}
              roster={activeRoster}
              siteUsers={siteUsers}
              onChange={(newShifts) =>
                setActiveRoster((prev) => ({ ...prev, shifts: { ...prev.shifts, [shift]: newShifts } }))
              }
            />
          ))}

          <div style={{ marginTop: "12px" }}>
            <label style={{ display: "block", fontSize: "0.875rem" }}>Remarks</label>
            <textarea
              value={activeRoster?.remarks || ""}
              onChange={(e) => setActiveRoster((prev) => ({ ...prev, remarks: e.target.value }))}
              style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: "0.375rem", padding: "0.5rem" }}
            />
          </div>

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
            <Button onClick={() => handleSaveRoster(activeRoster)} className="bg-green-600">Save</Button>
            <Button onClick={handleSaveAndNotify} className="bg-green-600">
              Save & Notify
            </Button>
          </div>

          {/* Weekly Tamplate */}
          <div style={{ border: "2px solid #000" }}>
            <h3 className="mt-4 mb-2">Weekday Template</h3>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((wd) => (
              <div key={wd} className="border p-2 mt-2 rounded">
                <h4 className="font-semibold">{wd}</h4>

                {["M", "E", "N", "G", "WO"].map((shift) => (
                  <ShiftEditor
                    key={shift}
                    shift={shift}
                    roster={{ shifts: weekdayTemplate[wd] }}
                    siteUsers={siteUsers}
                    onChange={(newArr) =>
                      setWeekdayTemplate((prev) => ({
                        ...prev,
                        [wd]: { ...prev[wd], [shift]: newArr },
                      }))
                    }
                  />
                ))}
              </div>
            ))}
          </div>
          <button
            className="px-3 py-1 bg-blue-600 text-white rounded"
            onClick={() => saveWeekdayTemplate(selectedSite, weekdayTemplate)}
          >
            Save Weekday Template
          </button>

          <button
            className="px-3 py-1 bg-green-600 text-white rounded"
            onClick={() => applyTemplateToMonth(currentUser, selectedMonth, weekdayTemplate)}
          >
            {applingTemplate ? "Appling...." : "Apply Template to This Month"}
          </button>
        </motion.div>
      </div>
    </div>
  );
}

// ---------- ShiftEditor component ----------
function ShiftEditor({ shift, roster, siteUsers, onChange }) {
  const current = roster?.shifts?.[shift] || [];

  function addUser(uid) {
    if (current.length >= 2) return alert("Max 2 users allowed");
    if (current.includes(uid)) return;
    onChange([...current, uid]);
  }

  function removeUser(uid) {
    onChange(current.filter((u) => u !== uid));
  }

  return (
    <div className="shift-editor">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontWeight: "500" }}>Shift {shift}</div>
        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Max 2</div>
      </div>

      <div style={{ marginTop: "12px" }}>
        {current.length === 0 ? (
          <div style={{ fontSize: "0.875rem", color: "#64748b" }}>No one assigned</div>
        ) : (
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {current.map((uid) => {
              const u = siteUsers.find((su) => su.uid === uid);
              return (
                <div
                  key={uid}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    border: "1px solid #e5e7eb",
                    borderRadius: "0.375rem",
                    paddingLeft: "0.5rem",
                    paddingRight: "0.5rem",
                    paddingTop: "0.25rem",
                    paddingBottom: "0.25rem"
                  }}
                >
                  <div style={{ fontWeight: "500" }}>{u?.name || uid}</div>
                  <button style={{ color: "#ef4444" }} onClick={() => removeUser(uid)}>
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ marginTop: "0.5rem" }}>
        <label style={{ fontSize: "14px" }}>Add user</label>
        <UserSelect siteUsers={siteUsers} onSelect={addUser} />
      </div>
    </div>
  );
}

function UserSelect({ siteUsers, onSelect }) {
  const [q, setQ] = useState("");
  const filtered = siteUsers.filter(
    (u) => (u.name || "").toLowerCase().includes(q.toLowerCase()) || (u.empId || "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div>
      <input
        className="user-select-input"
        placeholder="Search user"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="user-select-list">
        {filtered.map((u) => (
          <div
            key={u.uid}
            className="user-select-item"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#f8fafc";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "";
            }}
          >
            <div>
              <div style={{ fontWeight: "500" }}>{u?.name || ""}</div>
              <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                {u.designation} • {u.empId} • {u.mobileNo}
              </div>
            </div>
            <button
              className="bg-green-600"
              onClick={() => onSelect(u.uid)}
            >
              Add
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* (security rules omitted for brevity) */
