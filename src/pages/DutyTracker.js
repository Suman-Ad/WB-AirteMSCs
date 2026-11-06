import React, { useEffect, useId, useMemo, useState } from "react";
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
import { regions, siteList as siteConfigList, siteIdMap } from "../config/siteConfigs";


// ---------- Helper utils ----------
const SHIFT_LABELS = { M: "Morning", E: "Evening", N: "Night", G: "General", WO: "Weekly off" };

const SITE_DOC_ID = (siteId, date) => `${siteId}_${date}`; // use siteId slug + 2025-11-30

function formatISODate(date) {
  // returns YYYY-MM-DD
  return format(date, "yyyy-MM-dd");
}

// Small UI atoms
function Button({ children, onClick, className = "", ...props }) {
  return (
    <button
      type="button"
      {...props}
      onClick={onClick}
      className={`button ${className}`}
    >
      {children}
    </button>
  );
}


function Badge({ children }) {
  return (
    <span className="duty-badge">{children}</span>
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
  const [loadError, setLoadError] = useState("");
  const [rosters, setRosters] = useState({}); // key: YYYY-MM-DD -> roster doc

  useEffect(() => {
    setRosters({});
    setLoadError("");
    setLoading(Boolean(siteId));
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
        setLoadError("Unable to load this roster. Check your connection and site access, then reload.");
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

  return { rosters, loading, loadError, saveRosterForDate };
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

const isAdminAssignmentValid = (userData) => {
  if (!userData?.isAdminAssigned) return false;
  if (!userData?.adminAssignFrom || !userData?.adminAssignTo) return false;

  const today = new Date();
  const from = new Date(userData.adminAssignFrom);
  const to = new Date(userData.adminAssignTo);

  return today >= from && today <= to;
};

// ---------- Main Page Component ----------
export default function DutyTrackerPage({ currentUser }) {
  /** permissions */
  const isAdmin =
    currentUser?.role === "Super Admin" ||
    currentUser?.role === "Admin" ||
    currentUser?.isAdminAssigned ||
    isAdminAssignmentValid(currentUser) ||
    // currentUser?.designation === "Vertiv Site Infra Engineer" ||
    currentUser?.designation === "Vertiv CIH" ||
    currentUser?.designation === "Vertiv ZM";

  const canEdit = isAdmin || currentUser?.designation === "Vertiv Site Infra Engineer";

  const [selectedRegion, setSelectedRegion] = useState(currentUser?.region || "");
  const [selectedCircle, setSelectedCircle] = useState(currentUser?.circle || "");
  const [selectedSite, setSelectedSite] = useState(currentUser?.site || "");
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const regionList = Object.keys(regions);
  const circleList = selectedRegion ? regions[selectedRegion] || [] : [];
  const siteList =
    selectedRegion && selectedCircle
      ? siteConfigList[selectedRegion]?.[selectedCircle] || []
      : [];

  const [applingTemplate, setApplingTemplate] = useState(false);
  const navigate = useNavigate();

  const { rosters, loading: rosterLoading, loadError, saveRosterForDate } = useDutyRoster(
    selectedSite,
    selectedMonth
  );


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

  const [isRosterView, setIsRosterView] = useState(false);

  const calendarDays = useMemo(() => {
    const start = startOfMonth(selectedMonth);
    const end = endOfMonth(selectedMonth);

    const days = eachDayOfInterval({ start, end });

    const blanks = [];
    const startWeekday = start.getDay(); // 0 = Sun, 1 = Mon ...

    for (let i = 0; i < startWeekday; i++) {
      blanks.push(null); // empty cells
    }

    return [...blanks, ...days];
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

  }, [rosters, activeDateISO, selectedSite]);

  useEffect(() => {
    if (!selectedSite) return;

    // reset template to empty when site changes
    setWeekdayTemplate({
      Mon: { M: [], E: [], N: [], G: [], WO: [] },
      Tue: { M: [], E: [], N: [], G: [], WO: [] },
      Wed: { M: [], E: [], N: [], G: [], WO: [] },
      Thu: { M: [], E: [], N: [], G: [], WO: [] },
      Fri: { M: [], E: [], N: [], G: [], WO: [] },
      Sat: { M: [], E: [], N: [], G: [], WO: [] },
      Sun: { M: [], E: [], N: [], G: [], WO: [] },
    });

    // then load site-specific template
    loadWeekdayTemplate(selectedSite).then((data) => {
      if (data) setWeekdayTemplate(data);
    });

  }, [selectedSite]);

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

  const [dayCollaps, setDayCollaps] = useState({});
  const toggleWDay = (wd) => {
    setDayCollaps((prev) => ({
      ...prev,
      [wd]: !prev[wd],
    }));
  };


  return (
    <div className="duty-workspace">
      <header className="duty-page-header">
        <div><span className="duty-eyebrow">TEAM OPERATIONS</span><h1>Duty Tracker</h1><p>View site coverage and organize daily shifts and weekday templates.</p></div>
        <Badge>{canEdit ? "Roster management" : "Roster overview"}</Badge>
      </header>

      {/* Filters */}
      <div className="duty-filter-bar">
        {isAdmin && (
          <div className="duty-site-filters">
            <select
              aria-label="Region"
              value={selectedRegion}
              onChange={(e) => {
                setSelectedRegion(e.target.value);
                setSelectedCircle("");
                setSelectedSite("");
              }}
              className="border rounded px-2 py-1"
            >
              <option value="">Select Region</option>
              {regionList.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>

            <select
              aria-label="Circle"
              value={selectedCircle}
              onChange={(e) => {
                setSelectedCircle(e.target.value);
                setSelectedSite("");
              }}
              className="border rounded px-2 py-1"
              disabled={!selectedRegion}
            >
              <option value="">Select Circle</option>
              {circleList.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>


            <select
              aria-label="Site"
              value={selectedSite}
              onChange={(e) => setSelectedSite(e.target.value)}
              className="border rounded px-2 py-1"
              disabled={!selectedCircle}
            >
              <option value="">Select Site</option>
              {siteList.map((siteName) => (
                <option key={siteName} value={siteName}>
                  {siteName}
                </option>
              ))}
            </select>
          </div>
        )}

        <input
          aria-label="Roster month"
          type="month"
          value={format(selectedMonth, "yyyy-MM")}
          onChange={(e) => {
            if (!e.target.value) return;
            const [year, month] = e.target.value.split("-").map(Number);
            const nextMonth = new Date(year, month - 1, 1);
            setSelectedMonth(nextMonth);
            setActiveDateISO(formatISODate(nextMonth));
          }}
          className="border px-2 py-1 rounded"
        />

        <div style={{ marginLeft: "auto" }}>
          {!selectedSite ? <Badge>Select a site</Badge> : loadError ? <Badge>Roster unavailable</Badge> : rosterLoading ? <Badge>Loading roster…</Badge> : <Badge>Roster connected</Badge>}
        </div>
      </div>


      {loadError && <div className="duty-error" role="alert">{loadError}</div>}
      <div className="duty-shift-legend" aria-label="Shift key">{Object.entries(SHIFT_LABELS).map(([code, label]) => <span key={code}><b>{code}</b> {label}</span>)}</div>
      <div className={`duty-tracker-layout ${canEdit ? "has-editor" : ""} ${isRosterView ? "calendar-collapsed" : ""}`}>
        <div className={`calendar-panel ${isRosterView ? "is-collapsed" : ""}`}>
          <button
            type="button"
            className="calendar-collapse-button"
            onClick={() => setIsRosterView(prev => !prev)}
            aria-expanded={!isRosterView}
            aria-controls="duty-calendar-content"
            hidden={!canEdit}
          >
            {isRosterView ? "Expand Calendar ▶" : "Collapse Calendar ◀"}
          </button>

          {!isRosterView && (
            <div className="calendar-panel-content" id="duty-calendar-content">
              <div className="duty-calendar-heading"><div><h2>{format(selectedMonth, "MMMM yyyy")}</h2><p>{selectedSite ? `${selectedSite}${siteIdMap[selectedSite] ? ` · ${siteIdMap[selectedSite]}` : ""}` : "Select a site to view its duty roster."}</p></div></div>
              {!selectedSite && <div className="duty-empty" role="status">{isAdmin ? "Choose a region, circle, and site above to get started." : "A site must be assigned to your profile to view a roster."}</div>}
              <div className="duty-calendar-scroll" role="region" aria-label="Monthly duty calendar" tabIndex={0}>
              <div className="duty-calendar-surface">
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
                      <button type="button" key={iso}
                        className={`calendar-day-cell ${iso === activeDateISO ? "is-selected" : ""} ${iso === formatISODate(new Date()) ? "is-today" : ""}`}
                        aria-label={`Select ${format(day, "EEEE, d MMMM yyyy")}`}
                        aria-pressed={iso === activeDateISO}
                        onClick={() => openDate(day)}>
                        <span className="duty-day-heading"><span>{format(day, "d")}</span>{iso === formatISODate(new Date()) && <span className="duty-today">Today</span>}</span>
                        <span className="duty-day-shifts">
                          {Object.entries(SHIFT_LABELS).map(([shift, label]) => (
                            <span className="duty-calendar-shift" key={shift}>
                              <span className="duty-shift-code">{shift}</span>
                              <span className="duty-shift-people" title={label}>
                                {(roster?.shifts?.[shift] || []).length ? roster.shifts[shift].map(uid => {
                                  const user = siteUsers.find(member => member.uid === uid);
                                  return <span className="initial-badge" key={uid}>{user?.name ? initials(user.name) : uid.slice(0, 4)}</span>;
                                }) : <span className="duty-unassigned">—</span>}
                              </span>
                            </span>
                          ))}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              </div>
                {canEdit && (
                  <div className="duty-leave-links">
                    <button type="button" onClick={() => navigate("/cl-approve")}>1) Check <strong>"CL"</strong> Status</button>
                    <button type="button" onClick={() => navigate("/cl-calendar")}>2) CL Calendar</button>
                    <button type="button" onClick={() => navigate("/my-leave")}>3) My Leave</button>
                    <button type="button" onClick={() => navigate("/monthly-cl-summary")}>4) Monthly CL Summary</button>
                  </div>
                )}
            </div>
          )}
        </div>
        {/* Right side panel: date editor */}
        {canEdit && (
          <motion.div
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="editor-panel">
            <span className="duty-eyebrow">DAILY ROSTER</span><h2>{activeDateISO}</h2>
            <div style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", marginBottom: "0.75rem" }}>
              Site: {selectedSite || "—"}
            </div>

            <fieldset className="duty-editor-fields" disabled={!selectedSite || rosterLoading || !!loadError}>
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
                <label htmlFor="duty-remarks">Remarks</label>
                <textarea id="duty-remarks" rows={3}
                  value={activeRoster?.remarks || ""}
                  onChange={(e) => setActiveRoster((prev) => ({ ...prev, remarks: e.target.value }))}
                  style={{ width: "100%", border: "1px solid var(--app-border)", borderRadius: "0.375rem", padding: "0.5rem" }}
                />
              </div>

              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                <Button onClick={() => handleSaveRoster(activeRoster)} className="bg-green-600">Save</Button>
                <Button onClick={handleSaveAndNotify} className="bg-green-600">
                  Save & Notify
                </Button>
              </div>
            </fieldset>

            {/* Weekday template */}
            <fieldset className="duty-template" disabled={!selectedSite || rosterLoading || !!loadError || applingTemplate}>
              <h2>Weekday template</h2><p className="duty-description">Set recurring assignments for each day of the week.</p>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((wd) => (
                <div key={wd} className="duty-template-day">
                  <button type="button" className="duty-disclosure" aria-expanded={!!dayCollaps[wd]} onClick={() => toggleWDay(wd)}><span>{wd}</span><span aria-hidden="true">{dayCollaps[wd] ? "−" : "+"}</span></button>

                  {dayCollaps[wd] && ["M", "E", "N", "G", "WO"].map((shift) => (
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
              <div>
                <button
                  className="btn-primary"
                  onClick={() => applyTemplateToMonth(currentUser, selectedMonth, weekdayTemplate)}
                  style={{ marginTop: "5px", fontSize: "12px" }}
                >
                  {applingTemplate ? "Applying template…" : "Apply Template to This Month"}
                </button>

                <button
                  className="px-3 py-1 bg-blue-600 text-white rounded"
                  onClick={() => saveWeekdayTemplate(selectedSite, weekdayTemplate)}
                  style={{ marginTop: "5px", fontSize: "12px" }}
                >
                  Save Weekday Template
                </button>
              </div>
            </fieldset>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ---------- ShiftEditor component ----------
function ShiftEditor({ shift, roster, siteUsers, onChange }) {
  const current = roster?.shifts?.[shift] || [];

  function addUser(uid) {
    if (current.length >= 3) return alert("Max 3 users allowed");
    if (current.includes(uid)) return;
    onChange([...current, uid]);
  }

  function removeUser(uid) {
    onChange(current.filter((u) => u !== uid));
  }

  const [shiftCollaps, setShiftCollaps] = useState({});
  const toggleShift = (shift) => {
    setShiftCollaps((prev) => ({
      ...prev,
      [shift]: !prev[shift],
    }));
  };

  return (
    <div className="shift-editor">
      <button type="button" className="duty-disclosure" aria-expanded={!!shiftCollaps[shift]} onClick={() => toggleShift(shift)}>
        <span>{SHIFT_LABELS[shift]} <span className="duty-shift-count">{current.length} assigned</span></span>
        <span aria-hidden="true">{shiftCollaps[shift] ? "−" : "+"}</span>
      </button>
      {shiftCollaps[shift] && (
        <div>
          <div style={{ marginTop: "12px" }}>
            {current.length === 0 ? (
              <div style={{ fontSize: "0.875rem", color: "var(--app-text-muted)" }}>No one assigned</div>
            ) : (
              <div className="duty-assigned-users">
                {current.map((uid) => {
                  const u = siteUsers.find((su) => su.uid === uid);
                  return (
                    <div
                      key={uid}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        border: "1px solid var(--app-border)",
                        borderRadius: "0.375rem",
                        paddingLeft: "0.5rem",
                        paddingRight: "0.5rem",
                        paddingTop: "0.25rem",
                        paddingBottom: "0.25rem"
                      }}
                    >
                      <div style={{ fontWeight: "500" }}>{u?.name || uid}</div>
                      <button type="button" className="duty-remove" aria-label={`Remove ${u?.name || uid} from ${SHIFT_LABELS[shift]}`} onClick={() => removeUser(uid)}>
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ marginTop: "0.5rem" }}>
            <div className="duty-description">Add a team member</div>
            <UserSelect shift={shift} siteUsers={siteUsers} onSelect={addUser} disabled={!siteUsers.length} />
          </div>
        </div>
      )}
    </div>
  );
}

function UserSelect({ shift, siteUsers, onSelect, disabled }) {
  const searchId = useId();
  const [q, setQ] = useState("");

  if (disabled) {
    return (
      <div style={{ fontSize: "0.875rem", color: "var(--app-text-muted)" }}>
        No team members are available for this site.
      </div>
    );
  }

  const filtered = siteUsers.filter(
    (u) =>
      (u.name || "").toLowerCase().includes(q.toLowerCase()) ||
      (u.empId || "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div>
      <label className="duty-search-label" htmlFor={searchId}>Search team members for {SHIFT_LABELS[shift]}</label>
      <input id={searchId}
        className="user-select-input"
        placeholder="Search user"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="user-select-list">
        {!filtered.length && <div className="duty-empty">No team members match your search.</div>}
        {filtered.map((u) => (
          <div
            key={u.uid}
            className="user-select-item"

          >
            <div>
              <div style={{ fontWeight: "500" }}>{u?.name || ""}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--app-text-muted)" }}>
                {u.designation} • {u.empId} • {u.mobileNo}
              </div>
            </div>
            <button
              className="bg-green-600"
              aria-label={`Add ${u.name || u.uid} to ${SHIFT_LABELS[shift]}`}
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
