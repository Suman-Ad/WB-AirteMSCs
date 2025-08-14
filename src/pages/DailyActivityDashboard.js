// src/pages/DailyActivityDashboard.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where
} from "firebase/firestore";
import { db } from "../firebase";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import "../assets/daily-activity.css";
import {
  Chart,
  BarElement,
  CategoryScale,
  LinearScale,
  ArcElement,
  Tooltip,
  Legend,
  Title,
} from "chart.js";

Chart.register(BarElement, CategoryScale, LinearScale, ArcElement, Tooltip, Legend, Title);

/*
  Behavior:
  - Loads daily_activity_sheets (docs with id like `${siteIdOrName}_${YYYY-MM-DD}`) and monthly_templates (site recurring template)
  - Filters via single Filters popup
  - Shows compiled month view + charts and export
  - Inline edit allowed for admins and admin-assigned users; site users can edit their site rows
*/

const DEFAULT_EQUIP_LIST = [
  "ACS","Air Conditioner","BMS","CCTV","Comfort AC","Diesel Generator","Earth Pit","FAS","FSS","HT Panel",
  "LT Panel","PAS","PFE","SMPS","SMPS BB","Solar System","UPS","UPS BB","DCDB/ACDB","Transformer"
];

const SITE_HIERARCHY = {
  "East": {
    "BH & JH": ["Patliputra", "Bhaglpur", "Muzaffarpur New", "Muzaffarpur Old", "Ranchi", "Ranchi telenor", "Marwari Awas"],
    "WB": ["Andaman", "Asansol", "Berhampore", "DLF", "Globsyn", "Infinity-I", "Infinity-II", "Kharagpur", "Mira Tower", "New Alipore", "SDF", "Siliguri"],
    "NESA":["Aizwal", "Guwahati", "Jorabat New", "Jorhat", "Shillong"],
    "OR": ["Cuttack", "Sambalpur"],
  },
  "West": {
    "GUJ": ["Astron Park", "Bharti House", "Changodar", "Rajkot Madhapar-New", "Rajkot Mavdi Old", "Surat", "Surat Telenor"],
    "MPCG": ["Bhopal Center 1st floor", "Bhopal Center 4th floor", "Gobindpura", "Gwalior", "Indore Geeta Bhawan", "Jabalpur", "Pardesipura", "Raipur"],
    "ROM": ["Nagpur", "Vega Center", "E-Space", "Kolhapur", "Nagpur New", "Nagpur BTSOL"],
  },
  "North": {
    "DEL": ["DLF", "Mira Tower"],
    "HR": ["GLOBSYN"]
  },
  "South": {
    "KA": ["Infinity-I", "Infinity-II"],
    "TS": ["Siliguri"]
  }
};

const LABELS = [
  "Sl.No","Date","Site Name","Node Name","Activity Details","Activity Type","Site Category",
  "Approval Require","CIH","Central Infra","RAN OPS head","Core OPS head","Fiber OPS head","CRQ No/PE","Activity Start Time","Activity End Time"
];

const KEYS = [
  "date","siteName","nodeName","activityDetails","activityType","siteCategory",
  "approvalRequire","cih","centralInfra","ranOpsHead","coreOpsHead","fiberOpsHead","crqNo","activityStartTime","activityEndTime"
];

function pad2(n){ return n<10?`0${n}`:`${n}`; }
function isoMonthKeyFromDate(isoDate) {
  // isoDate: YYYY-MM-DD => YYYY-MM
  if (!isoDate) {
    const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;
  }
  const parts = isoDate.split("-");
  if (parts.length < 2) {
    const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;
  }
  return `${parts[0]}-${parts[1]}`;
}
function siteKey(region, circle, site) { return `${region || ""}__${circle || ""}__${site || ""}`.replace(/\s+/g, "_"); }

export default function DailyActivityDashboard({ userData }) {
  const [allRows, setAllRows] = useState([]); // expanded rows from daily_activity_sheets
  const [loading, setLoading] = useState(true);
  const [instructionText, setInstructionText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(""); 

  useEffect(() => {
          const fetchInstruction = async () => {
            const docRef = doc(db, "config", "daily_activity_dashboard_instruction");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              setInstructionText(docSnap.data().text || "");
              setEditText(docSnap.data().text || "");
            }
          };
          fetchInstruction();
        }, []);

  const [templates, setTemplates] = useState({}); // siteKey -> template doc
  const [equipmentList, setEquipmentList] = useState(DEFAULT_EQUIP_LIST);

  // filter modal state
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filter, setFilter] = useState({
    region: "All",
    circle: "All",
    site: "All",
    month: isoMonthKeyFromDate(null),
    equipment: "All",
    activityType: "All",
    approval: "All",
    crq: "All",
    q: ""
  });

  // admin assignment
  const [adminAssignments, setAdminAssignments] = useState({});
  const [isAdminAssignedUser, setIsAdminAssignedUser] = useState(false);

  const isAdmin = userData?.role === "Super Admin" || userData?.role === "Admin";
  const canEditAll = isAdmin || isAdminAssignedUser;

  // charts
  const equipCanvasRef = useRef(null);
  const crqCanvasRef = useRef(null);
  const equipChartRef = useRef(null);
  const crqChartRef = useRef(null);

  useEffect(() => {
    loadAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAllData() {
    setLoading(true);
    try {
      await Promise.all([loadRows(), loadTemplates(), loadAssignments(), loadEquipmentList()]);
    } finally {
      setLoading(false);
    }
  }

  async function loadRows() {
    try {
      const snap = await getDocs(collection(db, "daily_activity_sheets"));
      const out = [];
      snap.forEach(s => {
        const docData = s.data() || {};
        const sheetId = s.id;
        const siteId = docData.siteId || "";
        const siteName = docData.siteName || "";
        const date = docData.date || "";
        (docData.rows || []).forEach((r, idx) => {
          out.push({
            _sheetId: sheetId,
            _rowIndex: idx,
            siteId,
            date,
            siteName,
            nodeName: r.nodeName || "",
            activityDetails: r.activityDetails || "",
            activityType: r.activityType || "",
            siteCategory: r.siteCategory || "",
            approvalRequire: r.approvalRequire || "",
            cih: r.cih || "",
            centralInfra: r.centralInfra || "",
            ranOpsHead: r.ranOpsHead || "",
            coreOpsHead: r.coreOpsHead || "",
            fiberOpsHead: r.fiberOpsHead || "",
            crqNo: r.crqNo || "",
            activityStartTime: r.activityStartTime || "",
            activityEndTime: r.activityEndTime || "",
            createdBy: r.createdBy || docData.createdBy || null,
          });
        });
      });
      setAllRows(out);
    } catch (e) {
      console.error("loadRows", e);
      setAllRows([]);
    }
  }

  async function loadTemplates() {
    try {
      const snap = await getDocs(collection(db, "monthly_templates"));
      const map = {};
      snap.forEach(s => {
        map[s.id] = s.data() || {};
      });
      setTemplates(map);
    } catch (e) {
      console.error("loadTemplates", e);
      setTemplates({});
    }
  }

  async function loadEquipmentList() {
    try {
      const snap = await getDoc(doc(db, "daily_activity_filters", "global"));
      if (snap.exists()) {
        const d = snap.data() || {};
        if (Array.isArray(d.equipment) && d.equipment.length) setEquipmentList(d.equipment);
      }
    } catch (e) {
      // ignore if not present
    }
  }

  async function loadAssignments() {
    try {
      const snap = await getDocs(collection(db, "admin_assignments"));
      const map = {};
      snap.forEach(s => {
        map[s.id] = Array.isArray(s.data()?.assignedUsers) ? s.data().assignedUsers : [];
      });
      setAdminAssignments(map);
      const found = Object.values(map).some(arr => arr.includes(userData?.uid));
      setIsAdminAssignedUser(found);
    } catch (e) {
      console.error("loadAssignments", e);
      setAdminAssignments({});
    }
  }

  // Derived: filtered rows based on filter state
  const filteredRows = useMemo(() => {
    let out = allRows.slice();

    // region/circle/site filters use SITE_HIERARCHY
    if (filter.region && filter.region !== "All") {
      const circles = SITE_HIERARCHY[filter.region] || {};
      let allowedSites = [];
      if (filter.circle && filter.circle !== "All") {
        allowedSites = circles[filter.circle] || [];
      } else {
        Object.values(circles).forEach(arr => allowedSites = allowedSites.concat(arr));
      }
      out = out.filter(r => allowedSites.includes(r.siteName));
    }
    if (filter.site && filter.site !== "All") out = out.filter(r => r.siteName === filter.site);

    // month filter: check r.date startsWith YYYY-MM
    if (filter.month && filter.month !== "All") {
      out = out.filter(r => r.date && r.date.startsWith(filter.month));
    }
    if (filter.equipment && filter.equipment !== "All") out = out.filter(r => r.nodeName === filter.equipment);
    if (filter.activityType && filter.activityType !== "All") out = out.filter(r => r.activityType === filter.activityType);
    if (filter.approval && filter.approval !== "All") out = out.filter(r => r.approvalRequire === filter.approval);
    if (filter.crq === "Yes") out = out.filter(r => (r.crqNo || "").trim());
    if (filter.crq === "No") out = out.filter(r => !(r.crqNo || "").trim());
    if (filter.q && filter.q.trim()) {
      const q = filter.q.trim().toLowerCase();
      out = out.filter(r => KEYS.map(k => (r[k] || "")).join("|").toLowerCase().includes(q));
    }

    // non-admin users only see their own site
    if (!(isAdmin || isAdminAssignedUser) && (userData?.site || userData?.siteId)) {
      const mySite = userData.site || userData.siteId;
      out = out.filter(r => r.siteName === mySite || r.siteId === mySite);
    }

    return out;
  }, [allRows, filter, isAdminAssignedUser, isAdmin, userData]);

  // Charts based on filteredRows
  useEffect(() => {
    const counts = {};
    filteredRows.forEach(r => {
      const k = r.nodeName || "Unspecified";
      counts[k] = (counts[k] || 0) + 1;
    });
    const labels = Object.keys(counts);
    const values = Object.values(counts);

    if (equipChartRef.current) {
      try { equipChartRef.current.destroy(); } catch(e){}
      equipChartRef.current = null;
    }
    if (equipCanvasRef.current && labels.length) {
      equipChartRef.current = new Chart(equipCanvasRef.current, {
        type: "bar",
        data: { labels, datasets: [{ label: "Activities", data: values, backgroundColor: "#2563eb" }] },
        options: { responsive: true, plugins: { legend: { display: false }, title: { display: true, text: "Equipment-wise Activities" } }, scales: { y: { beginAtZero: true } } }
      });
    }

    const yes = filteredRows.filter(r => (r.crqNo || "").trim()).length;
    const no = filteredRows.length - yes;
    if (crqChartRef.current) {
      try { crqChartRef.current.destroy(); } catch(e){}
      crqChartRef.current = null;
    }
    if (crqCanvasRef.current) {
      crqChartRef.current = new Chart(crqCanvasRef.current, {
        type: "pie",
        data: { labels: ["CRQ/PE: Yes", "CRQ/PE: No"], datasets: [{ data: [yes, no], backgroundColor: ["#2563eb","#ddd"] }] },
        options: { responsive: true, plugins: { legend: { position: "bottom" }, title: { display: true, text: "CRQ/PE Availability" } } }
      });
    }
  }, [filteredRows]);

  // Inline edit handlers (respect permission)
  async function handleInlineEdit(filteredIndex, key, value) {
    const row = filteredRows[filteredIndex];
    if (!row) return;
    const siteIdOrName = row.siteId || row.siteName;
    const isSiteOwner = userData?.siteId ? (userData.siteId === siteIdOrName) : (userData.site === siteIdOrName);
    if (!(canEditAll || isSiteOwner)) { alert("No permission to edit"); return; }

    // find global
    const globalIndex = allRows.findIndex(r => r._sheetId === row._sheetId && r._rowIndex === row._rowIndex);
    if (globalIndex < 0) return;
    const sheetId = row._sheetId;
    try {
      const ref = doc(db, "daily_activity_sheets", sheetId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const data = snap.data();
      const arr = Array.isArray(data.rows) ? [...data.rows] : [];
      const target = { ...(arr[row._rowIndex] || {}) };
      target[key] = value;
      arr[row._rowIndex] = target;
      await updateDoc(ref, { rows: arr });
      // refresh local
      await loadAllData();
    } catch (e) {
      console.error("handleInlineEdit", e);
      alert("Edit failed");
    }
  }

  async function handleInlineDelete(filteredIndex) {
    const row = filteredRows[filteredIndex];
    if (!row) return;
    const siteIdOrName = row.siteId || row.siteName;
    const isSiteOwner = userData?.siteId ? (userData.siteId === siteIdOrName) : (userData.site === siteIdOrName);
    if (!(canEditAll || isSiteOwner)) { alert("No permission to delete"); return; }
    if (!window.confirm("Delete this row?")) return;
    try {
      const ref = doc(db, "daily_activity_sheets", row._sheetId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const data = snap.data();
      const arr = (data.rows || []).filter((_, i) => i !== row._rowIndex);
      await updateDoc(ref, { rows: arr });
      await loadAllData();
    } catch (e) {
      console.error("delete", e);
      alert("Delete failed");
    }
  }

  // Export current filtered view as Excel
  function exportExcel() {
    const exportData = filteredRows.map((r, i) => {
      const out = {};
      LABELS.forEach((label, idx) => {
        out[label] = idx === 0 ? i + 1 : r[KEYS[idx - 1]] || "";
      });
      return out;
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Daily Activities");
    XLSX.writeFile(wb, `DailyActivity_${Date.now()}.xlsx`);
  }

  // Save template from dashboard quick editor (admins)
  async function saveTemplateForSite(region, circle, siteName, scheduleObj) {
    if (!(isAdmin || isAdminAssignedUser)) { alert("No permission"); return; }
    const key = siteKey(region, circle, siteName);
    try {
      await setDoc(doc(db, "monthly_templates", key), { region, circle, site: siteName, equipmentSchedules: scheduleObj, updatedAt: new Date(), createdBy: userData?.uid || null }, { merge: true });
      await loadTemplates();
      alert("Template saved.");
    } catch (e) {
      console.error("saveTemplateForSite", e);
      alert("Save failed");
    }
  }

  // UI state for quick schedule viewer in filter modal
  const [quickRegion, setQuickRegion] = useState("");
  const [quickCircle, setQuickCircle] = useState("");
  const [quickSite, setQuickSite] = useState("");
  const [quickMonth, setQuickMonth] = useState(() => isoMonthKeyFromDate(null));
  const [quickSiteSchedule, setQuickSiteSchedule] = useState(null);

  async function loadQuickSiteSchedule(region, circle, site, monthKey) {
    setQuickSiteSchedule(null);
    if (!region || !circle || !site) return;
    const key = siteKey(region, circle, site);
    try {
      const snap = await getDoc(doc(db, "monthly_templates", key));
      if (!snap.exists()) { setQuickSiteSchedule(null); return; }
      const data = snap.data() || {};
      // data.equipmentSchedules: equipment -> { days: [...], defaultRow: {...} }
      setQuickSiteSchedule(data.equipmentSchedules || {});
    } catch (e) {
      console.error("loadQuickSiteSchedule", e);
      setQuickSiteSchedule(null);
    }
  }

  // Small helper to list available regions/circles/sites from hierarchy
  const regionList = Object.keys(SITE_HIERARCHY);
  function circlesForRegion(r) { return r && SITE_HIERARCHY[r] ? Object.keys(SITE_HIERARCHY[r]) : []; }
  function sitesForRegionCircle(r, c) { return r && c && SITE_HIERARCHY[r] && SITE_HIERARCHY[r][c] ? SITE_HIERARCHY[r][c] : []; }

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
          <strong>🏗️ Daily Activity Dashboard</strong>
        </h1> 
        <div className="instruction-tab">
          <h2 className="dashboard-header">📌 Notice Board </h2>
          {/* <h3 className="dashboard-header">📘 App Overview </h3> */}
          {isEditing ? (
            <>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={5}
                className="dashboard-instruction-panel"
              />
              <div className="flex gap-2">
                <button
                  className="bg-blue-600 text-white px-3 py-1 rounded"
                  onClick={async () => {
                    const docRef = doc(db, "config", "daily_activity_dashboard_instruction");
                    await setDoc(docRef, { text: editText });
                    setInstructionText(editText);
                    setIsEditing(false);
                  }}
                >
                  Save
                </button>
                <button
                  className="bg-gray-400 text-white px-3 py-1 rounded"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="dashboard-instruction-panel">{instructionText || "No instructions available."}</p>
              {["Admin", "Super Admin"].includes(userData?.role) && (
                <button
                  className="text-blue-600 underline"
                  onClick={() => setIsEditing(true)}
                >
                  Edit Instruction
                </button>
              )}
            </>
          )}
          <h6 style={{marginLeft: "90%"}}>Thanks & Regurds @Suman Adhikari</h6>
        </div>
        <div className="daily-activity-subtitle">Compiled site monthly view, templates + actuals. Admins manage templates.</div>
      </div>

      <div className="daily-activity-toolbar">
        <button className="daily-activity-btn daily-activity-btn-primary" onClick={()=>setShowFilterModal(true)}>Filters</button>
        <button className="daily-activity-btn daily-activity-btn-secondary" onClick={exportExcel}>Export Excel</button>
      </div>

      {(userData?.role === "Super User" || userData?.role === "Admin" || userData?.role === "Super Admin" || userData?.role === "User") && (
                <Link to="/daily-activity-management"><span className="btn-danger pm-manage-btn">🚧 Daily Activity Manage</span></Link>
              )}

      {/* summary */}
      <div className="daily-activity-column-tags" style={{ marginTop: 12 }}>
        <div className="daily-activity-column-tag">Total rows: {filteredRows.length}</div>
        <div className="daily-activity-column-tag">Major: {filteredRows.filter(r=>r.activityType==='Major').length}</div>
        <div className="daily-activity-column-tag">Minor: {filteredRows.filter(r=>r.activityType==='Minor').length}</div>
      </div>

      {/* charts */}
      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <div style={{ flex: 1 }}><canvas ref={equipCanvasRef} /></div>
        <div style={{ width: 320 }}><canvas ref={crqCanvasRef} /></div>
      </div>

      {/* table */}
      <div className="daily-activity-table-container" style={{ marginTop: 12 }}>
        <table className="daily-activity-table">
          <thead>
            <tr>
              {LABELS.map(l => <th key={l}>{l}</th>)}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r, idx) => (
              <tr key={`${r._sheetId}-${r._rowIndex}`}>
                <td>{idx + 1}</td>
                {KEYS.map(k => (
                  <td key={k}>
                    {(canEditAll || (userData?.site && (r.siteName === userData.site || r.siteId === userData.siteId))) ? (
                      <input className="daily-activity-input" value={r[k]||""} onChange={(e)=>handleInlineEdit(idx, k, e.target.value)} />
                    ) : (r[k] || "")}
                  </td>
                ))}
                <td>
                  {(canEditAll || (userData?.site && (r.siteName === userData.site || r.siteId === userData.siteId))) ? (
                    <button className="daily-activity-btn daily-activity-btn-danger" onClick={()=>handleInlineDelete(idx)}>Delete</button>
                  ) : <span className="daily-activity-action-link">View</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Filters modal */}
      {showFilterModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 }}>
          <div style={{ width:"min(1100px,98vw)", maxHeight:"90vh", overflowY:"auto", background:"#fff", borderRadius:8, padding:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <strong>Filters & Quick Schedule Viewer</strong>
              <div style={{ display:"flex", gap:8 }}>
                <button className="daily-activity-btn daily-activity-btn-secondary" onClick={()=>setShowFilterModal(false)}>Close</button>
                <button className="daily-activity-btn daily-activity-btn-primary" onClick={()=>{ setShowFilterModal(false); }}>Done</button>
              </div>
            </div>

            <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:12 }}>
              <select className="daily-activity-select" value={filter.region} onChange={(e)=>setFilter({...filter, region: e.target.value, circle: "All", site:"All"})}>
                <option value="All">All Regions</option>
                {regionList.map(r=> <option key={r} value={r}>{r}</option>)}
              </select>

              <select className="daily-activity-select" value={filter.circle} onChange={(e)=>setFilter({...filter, circle: e.target.value, site: "All"})}>
                <option value="All">All Circles</option>
                {(filter.region !== "All") && circlesForRegion(filter.region).map(c=> <option key={c} value={c}>{c}</option>)}
              </select>

              <select className="daily-activity-select" value={filter.site} onChange={(e)=>setFilter({...filter, site: e.target.value})}>
                <option value="All">All Sites</option>
                {filter.region !== "All" && (filter.circle === "All" ? [].concat(...Object.values(SITE_HIERARCHY[filter.region]||{})) : sitesForRegionCircle(filter.region, filter.circle)).map(s=> <option key={s} value={s}>{s}</option>)}
              </select>

              <input type="month" className="daily-activity-date-picker" value={filter.month} onChange={(e)=>setFilter({...filter, month: e.target.value})} />

              <select className="daily-activity-select" value={filter.equipment} onChange={(e)=>setFilter({...filter, equipment: e.target.value})}>
                <option value="All">All Equipment</option>
                {equipmentList.map(eq => <option key={eq} value={eq}>{eq}</option>)}
              </select>

              <select className="daily-activity-select" value={filter.activityType} onChange={(e)=>setFilter({...filter, activityType: e.target.value})}>
                <option value="All">All Types</option><option value="Major">Major</option><option value="Minor">Minor</option>
              </select>

              <select className="daily-activity-select" value={filter.approval} onChange={(e)=>setFilter({...filter, approval: e.target.value})}>
                <option value="All">Approval</option><option value="L0">L0</option><option value="L1">L1</option><option value="L2">L2</option><option value="L3">L3</option><option value="L4">L4</option><option value="L5">L5</option>
              </select>

              <select className="daily-activity-select" value={filter.crq} onChange={(e)=>setFilter({...filter, crq: e.target.value})}>
                <option value="All">CRQ</option><option value="Yes">Yes</option><option value="No">No</option>
              </select>

              <input className="daily-activity-input" placeholder="Search..." value={filter.q} onChange={(e)=>setFilter({...filter, q: e.target.value})} style={{ minWidth: 240 }} />

              <button className="daily-activity-btn daily-activity-btn-secondary" onClick={()=>setFilter({ region: "All", circle: "All", site: "All", month: isoMonthKeyFromDate(null), equipment: "All", activityType: "All", approval: "All", crq: "All", q: "" })}>Reset</button>
            </div>

            {/* quick schedule viewer */}
            <div style={{ marginTop: 8 }}>
              <div style={{ fontWeight:600, marginBottom:6 }}>Quick Schedule Viewer (recurring templates)</div>
              <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8 }}>
                <select className="daily-activity-select" value={quickRegion} onChange={(e)=>{ setQuickRegion(e.target.value); setQuickCircle(""); setQuickSite(""); }}>
                  <option value="">Region</option>
                  {regionList.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <select className="daily-activity-select" value={quickCircle} onChange={(e)=>{ setQuickCircle(e.target.value); setQuickSite(""); }}>
                  <option value="">Circle</option>
                  {quickRegion && circlesForRegion(quickRegion).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select className="daily-activity-select" value={quickSite} onChange={(e)=>setQuickSite(e.target.value)}>
                  <option value="">Site</option>
                  {quickRegion && quickCircle && sitesForRegionCircle(quickRegion, quickCircle).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select className="daily-activity-select" value={quickMonth} onChange={(e)=>setQuickMonth(e.target.value)}>
                  {Array.from({length:12}, (_,i)=>String(i+1).padStart(2,"0")).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <button className="daily-activity-btn daily-activity-btn-secondary" onClick={() => loadQuickSiteSchedule(quickRegion, quickCircle, quickSite, quickMonth)}>Load</button>
              </div>

              <div style={{ border: "1px solid #eee", padding: 8, borderRadius: 6, maxHeight: 300, overflowY: "auto" }}>
                {(!quickSite) ? <div style={{ color:"#666" }}>Select site and Load</div> : (
                  <>
                    {templates[siteKey(quickRegion, quickCircle, quickSite)] ? (
                      Object.entries(templates[siteKey(quickRegion, quickCircle, quickSite)].equipmentSchedules || {}).map(([eq, meta])=>(
                        <div key={eq} style={{ marginBottom: 8 }}>
                          <div style={{ fontWeight:600 }}>{eq}</div>
                          <div style={{ color:"#333" }}>Days: {Array.isArray(meta.days)?meta.days.join(", "):""}</div>
                          <div style={{ fontSize:13, color:"#666" }}>{meta.defaultRow?.activityDetails || ""}</div>
                        </div>
                      ))
                    ) : <div style={{ color:"#666" }}>No template found for selected site.</div>}
                  </>
                )}
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
