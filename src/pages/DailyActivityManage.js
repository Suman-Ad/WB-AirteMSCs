// src/pages/DailyActivityManage.js
import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { Link } from "react-router-dom";
import "../assets/daily-activity.css";

/*
  DailyActivityManage (PM-focused)
  - Uses pm_registers collection with doc id: `${region}__${circle}__${site}__${year}`
  - Document shape (per your screenshot):
    {
      region, circle, site, year,
      createdBy,
      equipmentSchedules: {
        "ACS": [
           { id, frequency, months: [1,4,7,10], dayOfMonth: 13, vendor?, notes? },
           ...
        ],
        ...
      },
      updatedAt
    }
  - userData prop expected: { uid, role, region, circle, site, siteId, name, ... }
  - Admin / Admin-assigned users can create/edit/delete schedules.
  - Site users can view and add scheduled items to daily_activity_sheets (one-click).
  - Daily sheets are saved under daily_activity_sheets doc id: `${siteId || site}_${YYYY-MM-DD}`
*/

const DEFAULT_EQUIP_LIST = [
  "ACS","Air Conditioner","BMS","CCTV","Comfort AC","Diesel Generator","Earth Pit","Exhust Fan",
  "FAS","FSS","HT Panel","Inverter","LT Panel","PAS","PFE","SMPS","SMPS BB","Solar System",
  "UPS","UPS BB","DCDB/ACDB","Transformer"
];

const FREQUENCIES = ["monthly", "quarterly", "half-yearly", "yearly"];

function pad2(n){ return n < 10 ? `0${n}` : `${n}`; }
function todayISO(){ const d=new Date(); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function siteDocId(region, circle, site, year){ return `${(region||"")}_${(circle||"")}_${(site||"")}_${year}`.replace(/\s+/g,"_"); }
function pmDocId(region, circle, site, year){ return `${(region||"")}${"__"}${(circle||"")}${"__"}${(site||"")}${"__"}${year}`.replace(/\s+/g,"_"); }
function genId(){ return `${Date.now()}_${Math.random().toString(36).slice(2,8)}`; }
function monthOfISO(iso){ if(!iso) return null; const p=iso.split("-"); return parseInt(p[1],10); }
function dayOfISO(iso){ if(!iso) return null; const p=iso.split("-"); return parseInt(p[2],10); }

export default function DailyActivityManage({ userData }) {
  // selection
  const [region, setRegion] = useState(userData?.region || "");
  const [circle, setCircle] = useState(userData?.circle || "");
  const [site, setSite] = useState(userData?.site || userData?.siteName || "");
  const [year, setYear] = useState(new Date().getFullYear());

  // pm doc
  const [pmDoc, setPmDoc] = useState(null);
  const [loadingPm, setLoadingPm] = useState(false);

  // daily sheet
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [dailyRows, setDailyRows] = useState([]);
  const [loadingDaily, setLoadingDaily] = useState(false);

  // UI states
  const [loadingHierarchy, setLoadingHierarchy] = useState(true);
  const [hierarchy, setHierarchy] = useState({ East: { WB: [] }, West: {} }); // minimal fallback
  const [saving, setSaving] = useState(false);
  const [addingEntryFor, setAddingEntryFor] = useState(null); // equipment being added

  // permissions
  const isSuperAdmin = userData?.role === "Super Admin";
  const isAdmin = isSuperAdmin || userData?.role === "Admin";
  const [isAssignedUser, setIsAssignedUser] = useState(false);
  const canEdit = isAdmin || isAssignedUser;

  // equipment list
  const [equipmentList, setEquipmentList] = useState(DEFAULT_EQUIP_LIST);

  // load admin_assignments to detect assigned user
  useEffect(() => {
    async function loadAssigns(){
      try{
        const snap = await getDocs(collection(db, "admin_assignments"));
        let found = false;
        snap.forEach(s=>{
          const d = s.data() || {};
          if(Array.isArray(d.assignedUsers) && d.assignedUsers.includes(userData?.uid)) found = true;
        });
        setIsAssignedUser(found);
      }catch(e){
        console.warn("admin_assignments load failed", e);
      }
    }
    loadAssigns();
  }, [userData?.uid]);

  // load site hierarchy from assets_register if available (best-effort)
  useEffect(() => {
    async function loadHierarchy(){
      setLoadingHierarchy(true);
      try {
        const snap = await getDocs(collection(db, "assets_register"));
        if (!snap.empty) {
          const map = {};
          snap.forEach(s => {
            const d = s.data() || {};
            const r = d.region || d.Region || "Unknown";
            const c = d.circle || d.Circle || d.circleName || "General";
            const sname = d.site || d.siteName || d.Site || d.name || s.id;
            map[r] = map[r] || {};
            map[r][c] = map[r][c] || [];
            if (!map[r][c].includes(sname)) map[r][c].push(sname);
          });
          setHierarchy(map);
        } else {
          setHierarchy(prev => prev);
        }
      } catch(e) {
        console.warn("Failed to load assets_register", e);
      } finally {
        setLoadingHierarchy(false);
      }
    }
    loadHierarchy();
  }, []);

  // load pm doc for selected site/year
  useEffect(() => {
    async function loadPm(){
      if(!region || !circle || !site || !year){ setPmDoc(null); return; }
      setLoadingPm(true);
      const id = pmDocId(region, circle, site, year);
      try {
        const snap = await getDoc(doc(db, "pm_registers", id));
        if(snap.exists()){
          const d = snap.data() || {};
          // normalize equipmentSchedules
          d.equipmentSchedules = d.equipmentSchedules || {};
          Object.keys(d.equipmentSchedules).forEach(eq=>{
            if(!Array.isArray(d.equipmentSchedules[eq])) d.equipmentSchedules[eq] = [];
          });
          setPmDoc(d);
        } else {
          setPmDoc({
            region, circle, site, year,
            createdBy: userData?.uid || null,
            equipmentSchedules: {}
          });
        }
      } catch(e){
        console.error("loadPm error", e);
        setPmDoc({
          region, circle, site, year,
          createdBy: userData?.uid || null,
          equipmentSchedules: {}
        });
      } finally {
        setLoadingPm(false);
      }
    }
    loadPm();
  }, [region, circle, site, year, userData?.uid]);

  // load daily sheet for selected date
  useEffect(() => {
    async function loadDaily(){
      if(!site) { setDailyRows([]); return; }
      setLoadingDaily(true);
      const docId = `${userData?.siteId || site}_${selectedDate}`.replace(/\s+/g,"_");
      try {
        const snap = await getDoc(doc(db, "daily_activity_sheets", docId));
        if(snap.exists()){
          setDailyRows(snap.data().rows || []);
        } else {
          setDailyRows([]);
        }
      } catch(e){
        console.error("loadDaily error", e);
        setDailyRows([]);
      } finally {
        setLoadingDaily(false);
      }
    }
    loadDaily();
  }, [selectedDate, site, userData?.siteId]);

  // helpers for modifying pmDoc locally
  function ensureEquipmentSlot(equipment) {
    if(!pmDoc) return;
    setPmDoc(prev=>{
      const copy = { ...(prev || {}) };
      copy.equipmentSchedules = copy.equipmentSchedules || {};
      if(!Array.isArray(copy.equipmentSchedules[equipment])) copy.equipmentSchedules[equipment] = [];
      return copy;
    });
  }

  function addSchedule(equipment, payload = null) {
    if(!pmDoc) return;
    const entry = payload || { id: genId(), frequency: "monthly", months: [1], dayOfMonth: 1, vendor: "", notes: "" };
    setPmDoc(prev=>{
      const copy = { ...(prev||{}) };
      copy.equipmentSchedules = copy.equipmentSchedules || {};
      const arr = Array.isArray(copy.equipmentSchedules[equipment]) ? [...copy.equipmentSchedules[equipment]] : [];
      arr.push(entry);
      copy.equipmentSchedules[equipment] = arr;
      return copy;
    });
  }

  function updateSchedule(equipment, entryId, field, value) {
    if(!pmDoc) return;
    setPmDoc(prev=>{
      const copy = { ...(prev||{}) };
      copy.equipmentSchedules = copy.equipmentSchedules || {};
      const arr = Array.isArray(copy.equipmentSchedules[equipment]) ? [...copy.equipmentSchedules[equipment]] : [];
      const idx = arr.findIndex(x=>x.id === entryId);
      if(idx >= 0){
        arr[idx] = { ...arr[idx], [field]: value };
      }
      copy.equipmentSchedules[equipment] = arr;
      return copy;
    });
  }

  function removeSchedule(equipment, entryId) {
    if(!pmDoc) return;
    setPmDoc(prev=>{
      const copy = { ...(prev||{}) };
      copy.equipmentSchedules = copy.equipmentSchedules || {};
      const arr = Array.isArray(copy.equipmentSchedules[equipment]) ? [...copy.equipmentSchedules[equipment]] : [];
      copy.equipmentSchedules[equipment] = arr.filter(x=>x.id !== entryId);
      return copy;
    });
  }

  // Save pmDoc to Firestore (create/update)
  async function savePmDocToFirestore() {
    if(!canEdit) { alert("No permission to save"); return; }
    if(!pmDoc) return;
    setSaving(true);
    try {
      const id = pmDocId(pmDoc.region, pmDoc.circle, pmDoc.site, pmDoc.year);
      const payload = {
        region: pmDoc.region,
        circle: pmDoc.circle,
        site: pmDoc.site,
        year: pmDoc.year,
        equipmentSchedules: pmDoc.equipmentSchedules || {},
        createdBy: pmDoc.createdBy || userData?.uid || null,
        updatedAt: serverTimestamp()
      };
      await setDoc(doc(db, "pm_registers", id), payload, { merge: true });
      alert("PM register saved.");
      // reload
      const snap = await getDoc(doc(db, "pm_registers", id));
      if(snap.exists()) setPmDoc(snap.data());
    } catch(e){
      console.error("savePmDoc error", e);
      alert("Save failed. See console.");
    } finally {
      setSaving(false);
    }
  }

  // Delete entire pm doc
  async function deletePmDocFromFirestore() {
    if(!canEdit) { alert("No permission"); return; }
    if(!pmDoc) return;
    if(!window.confirm("Delete entire PM register for this site & year? This cannot be undone.")) return;
    try {
      const id = pmDocId(pmDoc.region, pmDoc.circle, pmDoc.site, pmDoc.year);
      await deleteDoc(doc(db, "pm_registers", id));
      setPmDoc({
        region, circle, site, year,
        createdBy: userData?.uid || null,
        equipmentSchedules: {}
      });
      alert("Deleted.");
    } catch(e){
      console.error("deletePmDoc error", e);
      alert("Delete failed.");
    }
  }

  // Add scheduled items for the selected date into daily_activity_sheets
  // Logic: for each equipment in pmDoc, for each schedule entry check if selectedDate matches:
  // - if entry.months includes the month (1..12) AND entry.dayOfMonth equals day -> include
  // - OR if entry has scheduleDates array (YYYY-MM-DD strings) -> check includes selectedDate
  async function addScheduledItemsToDailySheet() {
    if(!pmDoc) return alert("No PM template loaded.");
    const month = monthOfISO(selectedDate);
    const day = dayOfISO(selectedDate);
    if(!month || !day) return alert("Invalid date selected.");
    const matches = [];
    Object.entries(pmDoc.equipmentSchedules || {}).forEach(([eq, arr])=>{
      (Array.isArray(arr) ? arr : []).forEach(entry=>{
        const months = Array.isArray(entry.months) ? entry.months : [];
        const scheduleDates = Array.isArray(entry.scheduleDates) ? entry.scheduleDates : [];
        const matchesByMonths = months.length ? months.includes(month) && (entry.dayOfMonth ? entry.dayOfMonth === day : true) : false;
        const matchesByDates = scheduleDates.length ? scheduleDates.includes(selectedDate) : false;
        if(matchesByMonths || matchesByDates){
          matches.push({
            nodeName: eq,
            activityDetails: `${entry.pmType || "PM"} scheduled (${entry.frequency || entry.pmType || "scheduled"})`,
            activityType: entry.activityType || "Major",
            siteCategory: entry.siteCategory || "Super Critical",
            approvalRequire: "CIH",
            cih: "NA",
            centralInfra: "NA",
            ranOpsHead: "NA",
            coreOpsHead: "NA",
            fiberOpsHead: "NA",
            crqNo: "CRQ00000",
            activityStartTime: entry.activityStartTime && entry.activityStartTime.trim() !== "" 
              ? entry.activityStartTime 
              : "10:00 AM", // ✅ Default Start Time
            activityEndTime: entry.activityEndTime && entry.activityEndTime.trim() !== "" 
              ? entry.activityEndTime 
              : "06:00 PM", // ✅ Default End Time
            createdFromPmId: entry.id || null,
            pmEntry: entry,
          });
        }
      });
    });

    if(matches.length === 0) {
      alert("No scheduled PM items for selected date.");
      return;
    }

    // Merge into existing dailyRows, avoid duplicates by nodeName + pmEntry.id
    const merged = [...dailyRows];
    matches.forEach(m=>{
      const exists = merged.some(r => (r.nodeName === m.nodeName) && (r.createdFromPmId && r.createdFromPmId === m.createdFromPmId));
      if(!exists){
        merged.push(m);
      }
    });

    // save to daily_activity_sheets
    const docId = `${userData?.siteId || site}_${selectedDate}`.replace(/\s+/g,"_");
    try {
      await setDoc(doc(db, "daily_activity_sheets", docId), {
        siteId: userData?.siteId || site,
        siteName: userData?.site || site,
        date: selectedDate,
        rows: merged,
        lastUpdatedBy: userData?.uid || null,
        lastUpdatedAt: serverTimestamp()
      }, { merge: true });
      setDailyRows(merged);
      alert(`Added ${matches.length} scheduled item(s) to daily sheet.`);
    } catch(e){
      console.error("addScheduledItemsToDailySheet error", e);
      alert("Failed to add scheduled items.");
    }
  }

  // Update / delete a daily row (simple operations for site users)
  async function updateDailyRow(index, key, value) {
    const updated = [...dailyRows];
    updated[index] = { ...(updated[index] || {}), [key]: value };
    const docId = `${userData?.siteId || site}_${selectedDate}`.replace(/\s+/g,"_");
    try {
      await setDoc(doc(db, "daily_activity_sheets", docId), {
        siteId: userData?.siteId || site,
        siteName: userData?.site || site,
        date: selectedDate,
        rows: updated,
        lastUpdatedBy: userData?.uid || null,
        lastUpdatedAt: serverTimestamp()
      }, { merge: true });
      setDailyRows(updated);
    } catch(e){ console.error("updateDailyRow", e); alert("Save failed"); }
  }
  async function deleteDailyRow(index) {
    const updated = dailyRows.filter((_,i)=>i!==index);
    const docId = `${userData?.siteId || site}_${selectedDate}`.replace(/\s+/g,"_");
    try {
      await setDoc(doc(db, "daily_activity_sheets", docId), {
        siteId: userData?.siteId || site,
        siteName: userData?.site || site,
        date: selectedDate,
        rows: updated,
        lastUpdatedBy: userData?.uid || null,
        lastUpdatedAt: serverTimestamp()
      }, { merge: true });
      setDailyRows(updated);
    } catch(e){ console.error("deleteDailyRow", e); alert("Delete failed"); }
  }

  // UI helpers
  const equipmentKeys = useMemo(()=> {
    if(!pmDoc || !pmDoc.equipmentSchedules) return DEFAULT_EQUIP_LIST;
    const keys = Array.from(new Set([...Object.keys(pmDoc.equipmentSchedules || {}), ...DEFAULT_EQUIP_LIST]));
    return keys;
  }, [pmDoc]);

  return (
    <div className="daily-activity-container">
      <div className="daily-activity-header">
        <h2 className="dashboard-header">
    👋    Welcome, <strong>{userData?.name || "Team Member"}</strong>
        </h2>
        <p className="dashboard-subinfo">
          {userData?.role === "Super Admin" && <span>🔒 <strong>Super Admin</strong></span>}
          {userData?.role === "Admin" && <span>🛠️ <strong>Admin</strong></span>}
          {userData?.role === "Super User" && <span>📍 <strong>Super User</strong></span>}
          {userData?.role === "User" && <span>👤 <strong>User</strong></span>}
          &nbsp; | &nbsp; 🎖️ Designation: <strong>{userData?.designation || "All"}</strong> | &nbsp; 🏢 Site: <strong>{userData?.site || "All"}</strong> | &nbsp; 🛡️ Site ID: <strong>{userData.siteId || "All"}</strong>
        </p>
        <h1>
          <strong>🚧🛠️ Daily Activity Manage (PM Register integration)</strong>
        </h1> 
        <div className="daily-activity-subtitle">Admins / assigned users maintain PM registers. Site users add scheduled PM to daily sheet.</div>
      </div>

      {(userData?.role === "Super User" || userData?.role === "Admin" || userData?.role === "Super Admin" || userData?.role === "User") && (
                      <Link to="/pm-register"><span className="btn-danger pm-manage-btn">📋 Manage PM Register</span></Link>
                    )}

      {/* selection row */}
      <div className="daily-activity-toolbar" style={{ alignItems: "center", gap: 8 }}>
        <input className="daily-activity-input" placeholder="Region" value={region} onChange={(e)=>setRegion(e.target.value)} style={{ width: 140 }} />
        <input className="daily-activity-input" placeholder="Circle" value={circle} onChange={(e)=>setCircle(e.target.value)} style={{ width: 140 }} />
        <input className="daily-activity-input" placeholder="Site" value={site} onChange={(e)=>setSite(e.target.value)} style={{ width: 220 }} />
        <input className="daily-activity-input" type="number" min="2000" max="2100" value={year} onChange={(e)=>setYear(parseInt(e.target.value || String(new Date().getFullYear()),10))} style={{ width: 110 }} />
        <button className="daily-activity-btn daily-activity-btn-secondary" onClick={() => {
          // reload pm doc (useEffect covers it) — but we force re-fetch
          if(!region || !circle || !site) return alert("Select region, circle & site");
          (async ()=> {
            setLoadingPm(true);
            try {
              const id = pmDocId(region, circle, site, year);
              const snap = await getDoc(doc(db, "pm_registers", id));
              if(snap.exists()) setPmDoc(snap.data());
              else setPmDoc({ region, circle, site, year, createdBy: userData?.uid || null, equipmentSchedules: {} });
            } catch(e){ console.error(e); alert("Load failed"); } finally { setLoadingPm(false); }
          })();
        }}>Load PM Register</button>

        <button className="daily-activity-btn daily-activity-btn-primary" onClick={savePmDocToFirestore} disabled={!canEdit || saving}>{saving ? "Saving..." : "Save PM Register"}</button>
        <button className="daily-activity-btn daily-activity-btn-danger" onClick={deletePmDocFromFirestore} disabled={!canEdit}>Delete PM Register</button>
      </div>

      {/* PM doc editor */}
      <div style={{ marginTop: 12, border: "1px solid #eee", padding: 12, borderRadius: 8 }}>
        {loadingPm ? <div className="daily-activity-loading">Loading PM Register…</div> : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontWeight: 700 }}>{pmDoc ? `${pmDoc.region} / ${pmDoc.circle} / ${pmDoc.site} — ${pmDoc.year}` : "No PM register loaded"}</div>
              <div style={{ color: "#666" }}>Only admins & assigned users can edit schedules</div>
            </div>

            {/* equipment list with schedules */}
            <div style={{ display: "grid", gap: 12 }}>
              {equipmentKeys.length === 0 ? <div className="daily-activity-empty">No equipment</div> : equipmentKeys.map(eq => {
                const entries = (pmDoc && pmDoc.equipmentSchedules && Array.isArray(pmDoc.equipmentSchedules[eq])) ? pmDoc.equipmentSchedules[eq] : [];
                return (
                  <div key={eq} style={{ border: "1px solid #f3f3f3", padding: 10, borderRadius: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontWeight: 600 }}>{eq}</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="daily-activity-btn daily-activity-btn-secondary" onClick={()=>ensureEquipmentSlot(eq)} disabled={!canEdit}>Ensure</button>
                        <button className="daily-activity-btn daily-activity-btn-primary" onClick={()=>addSchedule(eq)} disabled={!canEdit}>+ Add Schedule</button>
                      </div>
                    </div>

                    <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                      {entries.length === 0 ? (
                        <div style={{ color: "#666" }}>No schedule entries</div>
                      ) : entries.map(entry => (
                        <div key={entry.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, alignItems: "center", padding: 8, borderTop: "1px dashed #eee" }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{entry.pmType || (entry.frequency ? (entry.frequency + " PM") : "PM")}</div>
                            <div style={{ fontSize: 12, color: "#444" }}>{entry.notes || ""}</div>
                          </div>
                          <div>
                            <label style={{ fontSize:12, color:"#666" }}>Frequency</label>
                            <select className="daily-activity-select" value={entry.frequency || "monthly"} onChange={(e)=>updateSchedule(eq, entry.id, "frequency", e.target.value)} disabled={!canEdit}>
                              {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                          </div>
                          <div>
                            <label style={{ fontSize:12, color:"#666" }}>Months (comma separated)</label>
                            <input className="daily-activity-input" value={(entry.months || []).join(",")} onChange={(e)=>{
                              const months = (e.target.value||"").split(/[,\s]+/).map(x=>parseInt(x,10)).filter(n=>!isNaN(n) && n>=1 && n<=12);
                              updateSchedule(eq, entry.id, "months", Array.from(new Set(months)).sort((a,b)=>a-b));
                            }} disabled={!canEdit} />
                            <div style={{ fontSize: 11, color: "#666" }}>{(entry.months || []).length ? `Months: ${(entry.months || []).join(",")}` : "No months set"}</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ marginBottom: 6 }}>
                              <label style={{ display: "block", fontSize: 12, color: "#666" }}>Day (1-31)</label>
                              <input type="number" className="daily-activity-input" min="1" max="31" value={entry.dayOfMonth || 1} onChange={(e)=>updateSchedule(eq, entry.id, "dayOfMonth", Math.max(1, Math.min(31, parseInt(e.target.value||"1",10))))} disabled={!canEdit} />
                            </div>
                            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                              <button className="daily-activity-btn daily-activity-btn-secondary" onClick={()=>{
                                // quick toggle pmType between In-House and Vendor
                                updateSchedule(eq, entry.id, "pmType", entry.pmType === "Vendor" ? "In-House" : "Vendor");
                              }} disabled={!canEdit}>Toggle Type</button>
                              <button className="daily-activity-btn daily-activity-btn-danger" onClick={()=>{
                                if(!canEdit) return;
                                if(!window.confirm("Remove this schedule entry?")) return;
                                removeSchedule(eq, entry.id);
                              }} disabled={!canEdit}>Remove</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Daily sheet */}
      <div style={{ marginTop: 12, border: "1px solid #eee", padding: 12, borderRadius: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>Daily Sheet — {site} — {selectedDate}</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="date" className="daily-activity-date-picker" value={selectedDate} onChange={(e)=>setSelectedDate(e.target.value)} />
            <button className="daily-activity-btn daily-activity-btn-secondary" onClick={()=> {
              // reload daily
              (async ()=> {
                setLoadingDaily(true);
                try {
                  const docId = `${userData?.siteId || site}_${selectedDate}`.replace(/\s+/g,"_");
                  const snap = await getDoc(doc(db, "daily_activity_sheets", docId));
                  setDailyRows(snap.exists() ? snap.data().rows || [] : []);
                } catch(e){ console.error(e); } finally { setLoadingDaily(false); }
              })();
            }}>Reload</button>

            <button className="daily-activity-btn daily-activity-btn-primary" onClick={addScheduledItemsToDailySheet}>Add Scheduled Items</button>
          </div>
        </div>

        {loadingDaily ? <div className="daily-activity-loading">Loading daily sheet…</div> : (
          <table className="daily-activity-table">
            <thead>
              <tr>
                <th>Sl.No</th>
                <th>Node Name</th>
                <th>Activity Details</th>
                <th>Activity Type</th>
                <th>Site Category</th>
                <th>Approval Required</th>
                <th>CIH</th>
                <th>Central Infra</th>
                <th>RAN Ops Head</th>
                <th>Core Ops Head</th>
                <th>Fiber Ops Head</th>
                <th>PE/CRQ/REQ</th>
                <th>Start</th>
                <th>End</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(dailyRows || []).length === 0 ? (
                <tr><td colSpan="14" className="daily-activity-empty">No rows for this date</td></tr>
              ) : (dailyRows || []).map((r, idx) => (
                <tr key={idx}>
                  <td>{idx+1}</td>
                  <td>
                    <input className="daily-activity-input" value={r.nodeName || ""} onChange={(e)=>updateDailyRow(idx, "nodeName", e.target.value)} />
                  </td>
                  <td>
                    <input className="daily-activity-input" value={r.activityDetails || ""} onChange={(e)=>updateDailyRow(idx, "activityDetails", e.target.value)} />
                  </td>
                  {/* Activity Type dropdown */}
                  <td>
                    <select className="daily-activity-select" value={r.activityType || "Major"} onChange={(e)=>updateDailyRow(idx, "activityType", e.target.value)}>
                      <option value="Major">Major</option>
                      <option value="Minor">Minor</option>
                    </select>
                  </td>
                  {/* Site Category dropdown */}
                  <td>
                    <select className="daily-activity-select" value={r.siteCategory || "Super Critical"} onChange={(e)=>updateDailyRow(idx, "siteCategory", e.target.value)}>
                      <option value="Super Critical">Super Critical</option>
                      <option value="Critical">Critical</option>
                      <option value="Major">Major</option>
                    </select>
                  </td>
                  {/* Approval Required dropdown */}
                  <td>
                    <select className="daily-activity-select" value={r.approvalRequire || "CIH"} onChange={(e)=>updateDailyRow(idx, "approvalRequire", e.target.value)}>
                      <option value="CIH">CIH</option>
                      <option value="Central Infra">Central Infra</option>
                      <option value="RAN Ops Head">RAN Ops Head</option>
                      <option value="Core Ops Head">Core Ops Head</option>
                      <option value="Fiber Ops Head">Fiber Ops Head</option>
                    </select>
                  </td>
                  {/* Individual approvals */}
                  {["cih","centralInfra","ranOpsHead","coreOpsHead","fiberOpsHead"].map(col => (
                    <td key={col}>
                      <select className="daily-activity-select" value={r[col] || "NA"} onChange={(e)=>updateDailyRow(idx, col, e.target.value)}>
                        <option value="NA">NA</option>
                        <option value="Y">Y</option>
                        <option value="N">N</option>
                      </select>
                    </td>
                  ))}
                  {/* CRQ No input with suggestions */}
                  <td>
                    <input
                      className="daily-activity-input"
                      list={`crq-options-${idx}`}
                      value={r.crqNo || ""}
                      placeholder="Enter CRQ No"
                      onChange={(e) => updateDailyRow(idx, "crqNo", e.target.value)}
                    />
                    <datalist id={`crq-options-${idx}`}>
                      <option value="CRQ00000" />
                      <option value="PE" />
                      <option value="REQ" />
                    </datalist>
                  </td>
                  {/* Start/End time */}
                  <td><input className="daily-activity-input" type="time" value={r.activityStartTime || ""} onChange={(e)=>updateDailyRow(idx, "activityStartTime", e.target.value)} /></td>
                  <td><input className="daily-activity-input" type="time" value={r.activityEndTime || ""} onChange={(e)=>updateDailyRow(idx, "activityEndTime", e.target.value)} /></td>
                  {/* Delete */}
                  <td>
                    <button className="daily-activity-btn daily-activity-btn-danger" onClick={()=>deleteDailyRow(idx)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>

          </table>
        )}
      </div>

      <div style={{ marginTop: 12, color: "#666", fontSize: 13 }}>
        Notes: PM register documents live in <code>pm_registers</code> collection with doc id pattern: <code>Region__Circle__Site__YYYY</code>.
        Use Add Scheduled Items to copy schedule items for the selected date into <code>daily_activity_sheets</code>.
      </div>
    </div>
  );
}
