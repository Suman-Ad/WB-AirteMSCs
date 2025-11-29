// DutyTracker.jsx
// React component (single-file) implementing the Combined View: Calendar + Date Editor
// Prerequisites:
// 1) Firebase v9 (modular) initialized in ../firebase.js exporting `auth`, `firestore` (db)
// 2) Tailwind CSS configured in the project
// 3) User object available from context/provider with fields: { uid, role, emailVerified, region, circle, site }
// 4) Install framer-motion if you want animations: `npm i framer-motion`

/*
Firestore structure used in this file:
- users/{uid}
- dutyRoster/{siteId}_{YYYY-MM-DD}
- leaveRequests/{userId}/{YYYY-MM-DD}

Security rules (example) are included at the bottom of this file in a comment.

This file exports the default component `DutyTrackerPage`.
*/

import React, { useEffect, useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from "date-fns";
import { motion } from "framer-motion";
import { collection, doc, getDoc, getDocs, onSnapshot, query, setDoc, updateDoc, where, serverTimestamp, writeBatch, runTransaction } from "firebase/firestore";
import { db, auth } from "../firebase"; // <- your firebase exports
import "../assets/DutyTracker.css"; // optional css for styling

// ---------- Helper utils ----------
const SITE_DOC_ID = (siteId, date) => `${siteId}_${date}`; // use siteId slug + 2025-11-30

function formatISODate(date) {
  // returns YYYY-MM-DD
  return format(date, "yyyy-MM-dd");
}

// Small UI atoms
function Button({ children, onClick, className = "" }) {
  let customClass = className.includes('bg-green-600') ? ' bg-green-600' : '';
  return (
    <button onClick={onClick} className={`button${customClass}`}>
      {children}
    </button>
  );
}

function Badge({ children }) {
  return <span className="px-2 py-0.5 rounded bg-slate-200 text-sm">{children}</span>;
}

// ---------- useDutyRoster hook ----------
function useDutyRoster(siteId, monthDate) {
  // siteId: site slug, monthDate: Date object representing month
  const [loading, setLoading] = useState(true);
  const [rosters, setRosters] = useState({}); // key: YYYY-MM-DD -> roster doc

  useEffect(() => {
    if (!siteId) return;
    const start = formatISODate(startOfMonth(monthDate));
    const end = formatISODate(endOfMonth(monthDate));

    // For efficiency, we will listen to dutyRoster documents whose id starts with siteId_ and date in month
    // Since Firestore can't query by documentId prefix, we will instead listen to collection and filter client-side for small scale.
    // For large scale, maintain `dutyBySite/{siteId}/YYYY-MM-DD` subcollection.

    const q = collection(db, "dutyRoster");
    const unsub = onSnapshot(q, (snap) => {
      const map = {};
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        const id = docSnap.id;
        if (!id.startsWith(siteId + "_")) return;
        const datePart = id.replace(siteId + "_", "");
        // filter month
        if (datePart >= start && datePart <= end) {
          map[datePart] = { id, ...data };
        }
      });
      setRosters(map);
      setLoading(false);
    }, (err) => {
      console.error("dutyRoster listen error", err);
      setLoading(false);
    });

    return () => unsub();
  }, [siteId, monthDate]);

  function saveRosterForDate(dateISO, rosterDoc, user) {
    // rosterDoc: { siteId, date, shifts: {M:[],E:[],N:[]}, remarks }
    // user: current user performing the operation
    const docId = SITE_DOC_ID(siteId, dateISO);
    const docRef = doc(db, "dutyRoster", docId);

    // Use transaction to avoid race conditions and enforce max 2 users per shift
    return runTransaction(db, async (tx) => {
      const snap = await tx.get(docRef);
      const newData = {
        ...rosterDoc,
        updatedAt: serverTimestamp(),
        createdBy: rosterDoc.createdBy || user.uid,
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
  // currentUser should come from context/provider (auth state)
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [regionList, setRegionList] = useState([]);
  const [circleList, setCircleList] = useState([]);
  const [siteList, setSiteList] = useState([]);

  const [selectedRegion, setSelectedRegion] = useState(currentUser?.region || "");
  const [selectedCircle, setSelectedCircle] = useState(currentUser?.circle || "");
  const [selectedSite, setSelectedSite] = useState(currentUser?.site || "");

  const { rosters, loading: rosterLoading, saveRosterForDate } = useDutyRoster(selectedSite, selectedMonth);

  const [calendarDays, setCalendarDays] = useState([]);
  const [activeDateISO, setActiveDateISO] = useState(formatISODate(new Date()));
  const [activeRoster, setActiveRoster] = useState(null);
  const [siteUsers, setSiteUsers] = useState([]);
  const [leaveMap, setLeaveMap] = useState({}); // { userId: { 'YYYY-MM-DD': {...} } }

  useEffect(() => {
    const days = eachDayOfInterval({ start: startOfMonth(selectedMonth), end: endOfMonth(selectedMonth) });
    setCalendarDays(days);
  }, [selectedMonth]);

  useEffect(() => {
    if (!selectedSite) return;
    // fetch site users
    (async () => {
      const q = query(collection(db, "users"), where("site", "==", selectedSite));
      const snap = await getDocs(q);
      const arr = [];
      snap.forEach(d => arr.push({ uid: d.id, ...d.data() }));
      setSiteUsers(arr);
    })();
  }, [selectedSite]);

  useEffect(() => {
    // when rosters or activeDateISO changes, set active roster
    const r = rosters[activeDateISO];
    if (r) setActiveRoster(r);
    else setActiveRoster({ siteId: selectedSite, date: activeDateISO, shifts: { M: [], E: [], N: [] }, remarks: "" });
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

  function openDate(date) {
    const iso = formatISODate(date);
    setActiveDateISO(iso);
  }

  // small helper
  function initials(name) {
    return name.split(" ").map(n => n[0]).slice(0,2).join("");
  }

  return (
    <div className="daily-log-container">
      <h2 className="text-2xl font-semibold mb-4">Duty Tracker</h2>

      {/* Filters */}
      <div className="flex gap-3 mb-4 items-center">
        <select value={selectedRegion} onChange={e => setSelectedRegion(e.target.value)} className="border rounded px-2 py-1">
          <option value="">Select Region</option>
          {/* region options should be loaded from Firestore - omitted for brevity */}
        </select>

        <select value={selectedCircle} onChange={e => setSelectedCircle(e.target.value)} className="border rounded px-2 py-1">
          <option value="">Select Circle</option>
        </select>

        <select value={selectedSite} onChange={e => setSelectedSite(e.target.value)} className="border rounded px-2 py-1">
          <option value="">Select Site</option>
          {siteList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <input type="month" value={format(selectedMonth, "yyyy-MM")} onChange={(e) => setSelectedMonth(new Date(e.target.value + "-01"))} className="border px-2 py-1 rounded" />

        <div className="ml-auto">{rosterLoading ? <Badge>Loading...</Badge> : <Badge>Live</Badge>}</div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Calendar (col-span 2) */}
        <div className="col-span-2 bg-white rounded shadow p-3">
          <div className="grid grid-cols-7 gap-2 text-sm">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} className="text-center font-medium">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2 mt-2">
            {calendarDays.map(day => {
              const iso = formatISODate(day);
              const roster = rosters[iso];
              return (
                <div key={iso} onClick={() => openDate(day)} className="min-h-[90px] border rounded p-2 hover:shadow cursor-pointer">
                  <div className="flex justify-between items-center">
                    <div className="text-sm font-medium">{format(day, 'd MMM')}</div>
                    <div className="text-xs text-slate-500">{iso === formatISODate(new Date()) ? 'Today' : ''}</div>
                  </div>

                  <div className="mt-2">
                    <div className="text-xs">🌅 M:</div>
                    <div className="flex gap-1 mt-1">
                      {(roster?.shifts?.M || []).map(uid => {
                        const u = siteUsers.find(su => su.uid === uid);
                        return <div key={uid} className="px-1 py-0.5 border rounded text-xs">{u ? initials(u.name) : uid.slice(0,4)}</div>;
                      })}
                    </div>

                    <div className="text-xs mt-2">🌇 E:</div>
                    <div className="flex gap-1 mt-1">
                      {(roster?.shifts?.E || []).map(uid => {
                        const u = siteUsers.find(su => su.uid === uid);
                        return <div key={uid} className="px-1 py-0.5 border rounded text-xs">{u ? initials(u.name) : uid.slice(0,4)}</div>;
                      })}
                    </div>

                    <div className="text-xs mt-2">🌙 N:</div>
                    <div className="flex gap-1 mt-1">
                      {(roster?.shifts?.N || []).map(uid => {
                        const u = siteUsers.find(su => su.uid === uid);
                        return <div key={uid} className="px-1 py-0.5 border rounded text-xs">{u ? initials(u.name) : uid.slice(0,4)}</div>;
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right side panel: date editor */}
        <motion.div initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="bg-white rounded shadow p-4">
          <h3>{activeDateISO}</h3>
          <div className="text-sm text-slate-600 mb-3">Site: {selectedSite || '—'}</div>

          {/* Shift editors */}
          {['M','E','N'].map(shift => (
            <ShiftEditor key={shift} shift={shift} roster={activeRoster} siteUsers={siteUsers} onChange={(newShifts)=>{
              setActiveRoster((prev) => ({ ...prev, shifts: { ...prev.shifts, [shift]: newShifts } }));
            }} />
          ))}

          <div className="mt-3">
            <label className="block text-sm">Remarks</label>
            <textarea value={activeRoster?.remarks || ''} onChange={(e)=> setActiveRoster(prev => ({ ...prev, remarks: e.target.value }))} className="w-full border rounded p-2" />
          </div>

          <div className="flex gap-2 mt-3">
            <Button onClick={() => handleSaveRoster(activeRoster)}>Save</Button>
            <Button onClick={() => alert('Save & Notify not implemented yet')} className="bg-green-600">Save & Notify</Button>
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
    if (current.length >= 2) return alert('Max 2 users allowed');
    if (current.includes(uid)) return;
    onChange([...current, uid]);
  }

  function removeUser(uid) {
    onChange(current.filter(u => u !== uid));
  }

  return (
    <div className="mb-3 border p-2 rounded">
      <div className="flex items-center justify-between">
        <div className="font-medium">Shift {shift}</div>
        <div className="text-xs text-slate-500">Max 2</div>
      </div>

      <div className="mt-2">
        {current.length === 0 ? <div className="text-sm text-slate-500">No one assigned</div> : (
          <div className="flex gap-2">
            {current.map(uid => {
              const u = siteUsers.find(su => su.uid === uid);
              return (
                <div key={uid} className="flex items-center gap-2 border rounded px-2 py-1">
                  <div className="font-medium">{u ? u.name : uid}</div>
                  <button className="text-red-500" onClick={() => removeUser(uid)}>Remove</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-2">
        <label className="text-sm">Add user</label>
        <UserSelect siteUsers={siteUsers} onSelect={addUser} />
      </div>
    </div>
  );
}

function UserSelect({ siteUsers, onSelect }) {
  const [q, setQ] = useState("");
  const filtered = siteUsers.filter(u => u.name.toLowerCase().includes(q.toLowerCase()) || u.empId?.toLowerCase()?.includes(q.toLowerCase()));

  return (
    <div>
      <input className="border rounded px-2 py-1 w-full" placeholder="Search user" value={q} onChange={e=>setQ(e.target.value)} />
      <div className="max-h-40 overflow-auto mt-2">
        {filtered.map(u => (
          <div key={u.uid} className="flex items-center justify-between p-1 hover:bg-slate-50 rounded">
            <div>
              <div className="font-medium">{u.name}</div>
              <div className="text-xs text-slate-500">{u.designation} • {u.empId}</div>
            </div>
            <button className="px-2 py-1 bg-sky-600 text-white rounded" onClick={() => onSelect(u.uid)}>Add</button>
          </div>
        ))}
      </div>
    </div>
  );
}

/*
Firestore security rules example (for firebase.rules):

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{userId} {
      allow read: if request.auth != null && request.auth.token.email_verified == true;
      allow write: if false; // only admin functions via cloud functions or restricted APIs
    }

    match /dutyRoster/{docId} {
      allow read: if request.auth != null && request.auth.token.email_verified == true;

      allow create, update: if request.auth != null && request.auth.token.email_verified == true && (
        // Super Admin
        request.auth.token.role == 'Super Admin' ||
        // Admin (in same region/circle) - for example use custom claims region/circle
        (request.auth.token.role == 'Admin' && request.auth.token.region == resource.data.region) ||
        // Super User - only for same site
        (request.auth.token.role == 'Super User' && request.auth.token.site == resource.data.siteId)
      );
    }

    match /leaveRequests/{userId}/{date} {
      allow read: if request.auth != null && request.auth.uid == userId || request.auth.token.role in ['Admin','Super Admin'];
      allow write: if request.auth != null && (request.auth.uid == userId || request.auth.token.role in ['Admin','Super Admin']);
    }
  }
}

Notes: set custom claims on Firebase Auth users for role, region, circle, site. Security rules referencing request.auth.token.role require setting custom claims via admin sdk.
*/
