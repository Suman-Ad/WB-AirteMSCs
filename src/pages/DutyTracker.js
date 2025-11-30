// DutyTracker.jsx
// React component (single-file) implementing the Combined View: Calendar + Date Editor
// Prerequisites:
// 1) Firebase v9 (modular) initialized in ../firebase.js exporting `auth`, `firestore` (db)
// 2) Tailwind CSS configured in the project (optional)
// 3) User object available from context/provider with fields: { uid, role, emailVerified, region, circle, site }
// 4) Install framer-motion if you want animations: `npm i framer-motion`

import React, { useEffect, useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
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
  addDoc
} from "firebase/firestore";
import { db } from "../firebase";
import "../assets/DutyTracker.css"; // optional

// ---------- Helper utils ----------
const SITE_DOC_ID = (siteId, date) => `${siteId}_${date}`; // use siteId slug + 2025-11-30

function formatISODate(date) {
  // returns YYYY-MM-DD
  return format(date, "yyyy-MM-dd");
}

// Small UI atoms
function Button({ children, onClick, className = "" }) {
  let customClass = className.includes("bg-green-600") ? " bg-green-600" : "";
  return (
    <button onClick={onClick} className={`button${customClass}`}>
      {children}
    </button>
  );
}

function Badge({ children }) {
  return (
    <span className="px-2 py-0.5 rounded bg-slate-200 text-sm">{children}</span>
  );
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
      for (const s of ["M", "E", "N"]) {
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

// ---------- Main Page Component ----------
export default function DutyTrackerPage({ currentUser }) {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [regionList, setRegionList] = useState([]);
  const [circleList, setCircleList] = useState([]);
  const [siteList, setSiteList] = useState([]);

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

  useEffect(() => {
    const days = eachDayOfInterval({
      start: startOfMonth(selectedMonth),
      end: endOfMonth(selectedMonth)
    });
    setCalendarDays(days);
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
        shifts: { M: [], E: [], N: [] },
        remarks: ""
      });
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

  function findShiftChanges(oldShifts, newShifts) {
    const result = [];
    ["M", "E", "N"].forEach((shift) => {
      const oldList = oldShifts[shift] || [];
      const newList = newShifts[shift] || [];
      const added = newList.filter((uid) => !oldList.includes(uid));
      added.forEach((uid) => result.push({ uid, shift }));
    });
    return result;
  }

  function getNewlyAssignedUsers(oldRoster, newRoster) {
  const result = [];

  ["M", "E", "N"].forEach(shift => {
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
  const oldRoster = rosters[dateISO] || { shifts: { M: [], E: [], N: [] } };

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
          message: `You have been assigned to ${item.shift} shift on ${dateISO}.`,
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
      .map((word) => word[0] || "")
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  return (
    <div className="daily-log-container">
      <h2>Duty Tracker</h2>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          marginBottom: "16px",
          alignItems: "center"
        }}
      >
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "16px"
        }}
      >
        {/* Calendar (col-span 2) */}
        <div
          style={{
            gridColumn: "span 2 / span 2",
            backgroundColor: "white",
            borderRadius: "0.375rem",
            boxShadow:
              "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
            padding: "0.75rem"
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
              gap: "8px",
              fontSize: "0.875rem"
            }}
          >
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="text-center font-medium">
                {d}
              </div>
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
              gap: "8px",
              marginTop: "8px"
            }}
          >
            {calendarDays.map((day) => {
              const iso = formatISODate(day);
              const roster = rosters[iso];
              return (
                <div
                  key={iso}
                  onClick={() => openDate(day)}
                  style={{
                    minHeight: "90px",
                    border: "1px solid #e5e7eb",
                    borderRadius: "0.375rem",
                    padding: "0.5rem",
                    cursor: "pointer",
                    transition: "box-shadow 0.2s ease-in-out"
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <div style={{ fontSize: "0.875rem", fontWeight: "500" }}>
                      {format(day, "d MMM")}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                      {iso === formatISODate(new Date()) ? "Today" : ""}
                    </div>
                  </div>

                  <div style={{ marginTop: "8px" }}>
                    <div style={{ fontSize: "12px" }}>🌅 M:</div>
                    <div
                      style={{
                        display: "flex",
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

                    <div style={{ fontSize: "12px" }}>🌇 E:</div>
                    <div
                      style={{
                        display: "flex",
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

                    <div style={{ fontSize: "12px" }}>🌙 N:</div>
                    <div
                      style={{
                        display: "flex",
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
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right side panel: date editor */}
        <motion.div
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          style={{
            backgroundColor: "white",
            borderRadius: "0.375rem",
            boxShadow:
              "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
            padding: "1rem"
          }}
        >
          <h3>{activeDateISO}</h3>
          <div style={{ fontSize: "0.875rem", color: "#475569", marginBottom: "0.75rem" }}>
            Site: {selectedSite || "—"}
          </div>

          {/* Shift editors */}
          {["M", "E", "N"].map((shift) => (
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
            <Button onClick={() => handleSaveRoster(activeRoster)}>Save</Button>
            <Button onClick={handleSaveAndNotify} style={{ backgroundColor: "#16a34a" }}>
              Save & Notify
            </Button>
          </div>
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
    <div style={{ marginBottom: "0.75rem", border: "1px solid #e5e7eb", padding: "0.5rem", borderRadius: "0.375rem" }}>
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
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: "0.375rem",
          paddingLeft: "0.5rem",
          paddingRight: "0.5rem",
          paddingTop: "0.25rem",
          paddingBottom: "0.25rem",
          width: "100%"
        }}
        placeholder="Search user"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div style={{ maxHeight: "10rem", overflow: "auto", marginTop: "0.5rem" }}>
        {filtered.map((u) => (
          <div
            key={u.uid}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.25rem",
              borderRadius: "0.375rem",
              transition: "background-color 0.2s ease-in-out"
            }}
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
                {u.designation} • {u.empId}
              </div>
            </div>
            <button
              style={{
                paddingLeft: "0.5rem",
                paddingRight: "0.5rem",
                paddingTop: "0.25rem",
                paddingBottom: "0.25rem",
                backgroundColor: "#0284c7",
                color: "white",
                borderRadius: "0.375rem"
              }}
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
