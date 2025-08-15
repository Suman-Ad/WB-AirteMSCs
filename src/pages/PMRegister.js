// src/pages/PMRegister.js
import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import "../assets/daily-activity.css";

/*
 PM Register Sheet
 - Admins and admin-assigned users can add/edit/upload/delete yearly PM schedules per site.
 - Stores per-site-year doc in 'pm_registers/{siteKey__YYYY}' with structure described below.
 - userData prop is used: userData?.uid, role, region, circle, site, siteId, name, designation ...
*/

/* Default equipment list (from you) */
const DEFAULT_EQUIP_LIST = [
  "ACS","Air Conditioner","BMS","CCTV","Comfort AC","Diesel Generator","Earth Pit",
  "Exhust Fan","FAS","FSS","HT Panel","Inverter","LT Panel","PAS","PFE","SMPS",
  "SMPS BB","Solar System","UPS","UPS BB","DCDB/ACDB","Transformer"
];

/* default local site hierarchy fallback (used if assets_register not available) */
const DEFAULT_SITE_HIERARCHY = {
  East: {
    "BH & JH": ["Patliputra", "Bhaglpur", "Muzaffarpur New", "Muzaffarpur Old", "Ranchi", "Ranchi telenor", "Marwari Awas"],
    "WB": ["Andaman", "Asansol", "Berhampore", "DLF", "Globsyn", "Infinity-I", "Infinity-II", "Kharagpur", "Mira Tower", "New Alipore", "SDF", "Siliguri"],
    "NESA":["Aizwal", "Guwahati", "Jorabat New", "Jorhat", "Shillong"],
    "OR": ["Cuttack", "Sambalpur"],

  },
  West: {
    "GUJ": ["Astron Park", "Bharti House", "Changodar", "Rajkot Madhapar-New", "Rajkot Mavdi Old", "Surat", "Surat Telenor"],
    "MPCG": ["Bhopal Center 1st floor", "Bhopal Center 4th floor", "Gobindpura", "Gwalior", "Indore Geeta Bhawan", "Jabalpur", "Pardesipura", "Raipur"],
    "ROM": ["Nagpur", "Vega Center", "E-Space", "Kolhapur", "Nagpur New", "Nagpur BTSOL"],
  },
  North: {
    "DEL": ["DLF", "Mira Tower"],
    "HR": ["GLOBSYN"]
  },
  South: {
    "KA": ["Infinity-I", "Infinity-II"],
    "TS": ["Siliguri"]
  }
};

/* months array for checkboxes */
const MONTHS = [
  { num: 1, label: "Jan" },{ num: 2, label: "Feb" },{ num: 3, label: "Mar" },
  { num: 4, label: "Apr" },{ num: 5, label: "May" },{ num: 6, label: "Jun" },
  { num: 7, label: "Jul" },{ num: 8, label: "Aug" },{ num: 9, label: "Sep" },
  { num: 10, label: "Oct" },{ num: 11, label: "Nov" },{ num: 12, label: "Dec" }
];

/* helper utilities */
const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);
const currentYear = () => new Date().getFullYear();
function makeSiteKey(region, circle, site) {
  return `${(region||"")}__${(circle||"")}__${(site||"")}`.replace(/\s+/g, "_");
}
function generateId() { return `${Date.now()}_${Math.random().toString(36).slice(2,9)}`; }

/* parse CSV simple — expects header row like: equipment,pmType,frequency,months,day,notes */
function parseCSV(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map(c => c.trim());
    const obj = {};
    headers.forEach((h, idx) => obj[h] = cols[idx] ?? "");
    rows.push(obj);
  }
  return rows;
}

/* parse months string "1,4,7,10" or "1-3" -> [1,2,3] */
function parseMonthsString(s) {
  const parts = (s || "").split(/[,\s]+/).map(p => p.trim()).filter(Boolean);
  const out = new Set();
  parts.forEach(p => {
    if (p.includes("-")) {
      const [a,b] = p.split("-").map(x => parseInt(x,10)).filter(n => !isNaN(n));
      if (!isNaN(a) && !isNaN(b)) {
        for (let k = Math.max(1,a); k <= Math.min(12,b); k++) out.add(k);
      }
    } else {
      const n = parseInt(p,10);
      if (!isNaN(n) && n >= 1 && n <= 12) out.add(n);
    }
  });
  return Array.from(out).sort((a,b) => a-b);
}

/* default empty PM doc structure */
function emptyPMDoc(region, circle, site, year) {
  return {
    region: region || "",
    circle: circle || "",
    site: site || "",
    year: year || currentYear(),
    equipmentSchedules: {}, // equipmentName -> [ { id, pmType, frequency, months[], dayOfMonth, vendor, notes } ]
    createdBy: null,
    updatedAt: null
  };
}

/* Component */
export default function PMRegister({ userData }) {
  // site hierarchy (either from assets_register collection or fallback)
  const [hierarchy, setHierarchy] = useState(DEFAULT_SITE_HIERARCHY);
  const [loadingHierarchy, setLoadingHierarchy] = useState(true);

  // selected area & year
  const initialRegion = userData?.region || Object.keys(DEFAULT_SITE_HIERARCHY)[0] || "";
  const [region, setRegion] = useState(initialRegion);
  const [circle, setCircle] = useState(userData?.circle || "");
  const [site, setSite] = useState(userData?.site || "");
  const [year, setYear] = useState(currentYear());

  // equipment list
  const [equipmentList, setEquipmentList] = useState(DEFAULT_EQUIP_LIST);

  // pm document (loaded for site+year)
  const [pmDoc, setPmDoc] = useState(() => emptyPMDoc(region, circle, site, year));
  const [pmLoading, setPmLoading] = useState(false);

  // permissions
  const isSuperAdmin = userData?.role === "Super Admin";
  const isAdmin = isSuperAdmin || userData?.role === "Admin";
  const [isAssignedUser, setIsAssignedUser] = useState(false);
  const canEdit = isAdmin || isAssignedUser;

  // UI states
  const [selectedEquipment, setSelectedEquipment] = useState(DEFAULT_EQUIP_LIST[0] || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // load site list from assets_register if available
  useEffect(() => {
    async function loadAssets() {
      setLoadingHierarchy(true);
      try {
        const snap = await getDocs(collection(db, "assets_register"));
        if (!snap.empty) {
          // Build hierarchy map: region -> circle -> sites[]
          const map = {};
          snap.forEach(docSnap => {
            const d = docSnap.data() || {};
            // best-effort keys: region, circle, site or siteName
            const r = d.region || d.Region || "Unknown";
            const c = d.circle || d.Circle || d.CircleName || "General";
            const s = d.site || d.siteName || d.Site || d.SiteName || d.name || docSnap.id;
            map[r] = map[r] || {};
            map[r][c] = map[r][c] || [];
            if (!map[r][c].includes(s)) map[r][c].push(s);
          });
          setHierarchy(map);
        } else {
          setHierarchy(DEFAULT_SITE_HIERARCHY);
        }
      } catch (e) {
        console.warn("assets_register not found or failed to load, using default hierarchy", e);
        setHierarchy(DEFAULT_SITE_HIERARCHY);
      } finally {
        setLoadingHierarchy(false);
      }
    }
    loadAssets();
  }, []);

  // load admin_assignments to detect assigned user (any admin_assignments doc containing our uid)
  useEffect(() => {
    async function loadAssignments() {
      try {
        const snap = await getDocs(collection(db, "admin_assignments"));
        let found = false;
        snap.forEach(s => {
          const d = s.data() || {};
          if (Array.isArray(d.assignedUsers) && d.assignedUsers.includes(userData?.uid)) found = true;
        });
        setIsAssignedUser(found);
      } catch (e) {
        console.warn("admin_assignments load failed", e);
      }
    }
    loadAssignments();
  }, [userData?.uid]);

  // When region/circle/site/year changes, load existing PM doc
  useEffect(() => {
    async function loadPM() {
      if (!region || !circle || !site || !year) {
        setPmDoc(emptyPMDoc(region, circle, site, year));
        return;
      }
      setPmLoading(true);
      const key = makeSiteKey(region, circle, site) + "__" + String(year);
      try {
        const snap = await getDoc(doc(db, "pm_registers", key));
        if (snap.exists()) {
          const d = snap.data() || {};
          // Ensure equipmentSchedules defined
          if (!d.equipmentSchedules) d.equipmentSchedules = {};
          setPmDoc(d);
        } else {
          // default empty doc
          const empty = emptyPMDoc(region, circle, site, year);
          empty.createdBy = userData?.uid || null;
          setPmDoc(empty);
        }
      } catch (e) {
        console.error("loadPM error", e);
        setPmDoc(emptyPMDoc(region, circle, site, year));
      } finally {
        setPmLoading(false);
      }
    }
    loadPM();
  }, [region, circle, site, year, userData?.uid]);

  // helpers to edit pmDoc state (local only until Save)
  function ensureEquipmentSlot(equipmentName) {
    setPmDoc(prev => {
      const copy = { ...(prev || {}) };
      copy.equipmentSchedules = copy.equipmentSchedules || {};
      if (!Array.isArray(copy.equipmentSchedules[equipmentName])) copy.equipmentSchedules[equipmentName] = [];
      return copy;
    });
  }

  function addScheduleEntry(equipmentName) {
    setPmDoc(prev => {
      const copy = { ...(prev || {}) };
      copy.equipmentSchedules = copy.equipmentSchedules || {};
      const arr = Array.isArray(copy.equipmentSchedules[equipmentName]) ? [...copy.equipmentSchedules[equipmentName]] : [];
      arr.push({
        id: generateId(),
        pmType: "In-House", // or Vendor
        frequency: "monthly", // monthly | quarterly | half-yearly | yearly (informative)
        months: [1], // which months (1..12) this PM falls on
        dayOfMonth: 1,
        vendor: "",
        notes: ""
      });
      copy.equipmentSchedules[equipmentName] = arr;
      return copy;
    });
  }

  function updateScheduleEntry(equipmentName, entryId, field, value) {
    setPmDoc(prev => {
      const copy = { ...(prev || {}) };
      copy.equipmentSchedules = copy.equipmentSchedules || {};
      const arr = Array.isArray(copy.equipmentSchedules[equipmentName]) ? [...copy.equipmentSchedules[equipmentName]] : [];
      const idx = arr.findIndex(x => x.id === entryId);
      if (idx >= 0) {
        arr[idx] = { ...arr[idx], [field]: value };
      }
      copy.equipmentSchedules[equipmentName] = arr;
      return copy;
    });
  }

  function removeScheduleEntry(equipmentName, entryId) {
    setPmDoc(prev => {
      const copy = { ...(prev || {}) };
      copy.equipmentSchedules = copy.equipmentSchedules || {};
      const arr = Array.isArray(copy.equipmentSchedules[equipmentName]) ? [...copy.equipmentSchedules[equipmentName]] : [];
      copy.equipmentSchedules[equipmentName] = arr.filter(x => x.id !== entryId);
      return copy;
    });
  }

  // apply quick frequency -> months helper (monthly/quarterly/half/yearly)
  function applyFrequencyToEntry(entryId, equipmentName, frequency, startMonth = 1) {
    const months = [];
    if (frequency === "monthly") {
      for (let m = 1; m <= 12; m++) months.push(m);
    } else if (frequency === "quarterly") {
      for (let m = startMonth; m <= 12; m += 3) months.push(m);
    } else if (frequency === "half-yearly") {
      months.push(startMonth);
      const other = ((startMonth + 6 - 1) % 12) + 1;
      if (!months.includes(other)) months.push(other);
    } else if (frequency === "yearly") {
      months.push(startMonth);
    }
    updateScheduleEntry(equipmentName, entryId, "months", months);
  }

  // save to Firestore
  async function savePmDocToFirestore() {
    if (!canEdit) { alert("You don't have permission to save PM schedules."); return; }
    if (!region || !circle || !site) { alert("Choose region / circle / site."); return; }
    setSaving(true);
    try {
      const key = makeSiteKey(region, circle, site) + "__" + String(year);
      const payload = {
        region, circle, site, year,
        equipmentSchedules: pmDoc.equipmentSchedules || {},
        updatedAt: serverTimestamp(),
        createdBy: pmDoc.createdBy || userData?.uid || null
      };
      await setDoc(doc(db, "pm_registers", key), payload, { merge: true });
      alert("PM schedule saved.");
      // reload
      const snap = await getDoc(doc(db, "pm_registers", key));
      if (snap.exists()) setPmDoc(snap.data());
    } catch (e) {
      console.error("savePmDoc error", e);
      alert("Save failed. See console.");
    } finally {
      setSaving(false);
    }
  }

  // delete entire site-year doc
  async function deletePmDocFirestore() {
    if (!canEdit) { alert("No permission"); return; }
    if (!window.confirm("Delete entire PM schedule for this site & year? This cannot be undone.")) return;
    try {
      const key = makeSiteKey(region, circle, site) + "__" + String(year);
      await deleteDoc(doc(db, "pm_registers", key));
      setPmDoc(emptyPMDoc(region, circle, site, year));
      alert("Deleted.");
    } catch (e) {
      console.error("deletePmDoc error", e);
      alert("Delete failed.");
    }
  }

  // CSV upload handling
  async function handleCSVUpload(file) {
    if (!file) return;
    if (!canEdit) { alert("No permission to upload."); return; }
    setUploading(true);
    try {
      const text = await file.text();
      const rows = parseCSV(text); // array of obj using CSV headers
      // expected headers: equipment, pmType, frequency, months, day, vendor, notes
      // integrate rows into pmDoc
      setPmDoc(prev => {
        const copy = { ...(prev || {}) };
        copy.equipmentSchedules = copy.equipmentSchedules || {};
        rows.forEach(r => {
          const equip = (r.equipment || r.eq || r.node || "").trim();
          if (!equip) return;
          if (!Array.isArray(copy.equipmentSchedules[equip])) copy.equipmentSchedules[equip] = [];
          // parse months and day
          const m = parseMonthsString(r.months || r.month || "");
          const entry = {
            id: generateId(),
            pmType: r.pmType || r.pmType || "Vendor",
            frequency: r.frequency || "monthly",
            months: (m.length ? m : (r.frequency === "monthly" ? Array.from({length:12}, (_,i)=>i+1) : [])),
            dayOfMonth: r.day ? parseInt(r.day,10) || 1 : (r.dayOfMonth ? parseInt(r.dayOfMonth,10) || 1 : 1),
            vendor: r.vendor || "",
            notes: r.notes || r.note || ""
          };
          copy.equipmentSchedules[equip].push(entry);
        });
        return copy;
      });
      alert("CSV parsed and merged into current template (not yet saved). Review and click Save.");
    } catch (e) {
      console.error("CSV upload parse error", e);
      alert("CSV upload failed. Check console.");
    } finally {
      setUploading(false);
    }
  }

  /* derived lists for selects */
  const regions = useMemo(() => Object.keys(hierarchy || {}), [hierarchy]);
  const circles = useMemo(() => (region && hierarchy[region]) ? Object.keys(hierarchy[region]) : [], [hierarchy, region]);
  const sites = useMemo(() => (region && circle && hierarchy[region] && hierarchy[region][circle]) ? hierarchy[region][circle] : [], [hierarchy, region, circle]);

  // protect non-admin users: if user is non-admin and has a site, lock region/circle/site to user's site
  useEffect(() => {
    if (!isAdmin && !isAssignedUser) {
      if (userData?.region) setRegion(userData.region);
      if (userData?.circle) setCircle(userData.circle);
      if (userData?.site) setSite(userData.site);
    }
  }, [userData, isAdmin, isAssignedUser]);

  return (
    <div className="dhr-dashboard-container">
      <div className="daily-activity-header">
        <h1>
          <strong>📜 PM Register Sheet (Yearly Templates)</strong>
        </h1>
        <div className="daily-activity-subtitle">
          Create In-House (monthly) & Vendor (quarterly/half-year/yearly) PM schedules per site (recurring each year).
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <select className="daily-activity-select" value={region || ""} onChange={(e) => { setRegion(e.target.value); setCircle(""); setSite(""); }} disabled={!isAdmin && !isAssignedUser && !!userData?.region}>
          <option value="">Select Region</option>
          {regions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        <select className="daily-activity-select" value={circle || ""} onChange={(e)=>{ setCircle(e.target.value); setSite(""); }} disabled={!region || (!isAdmin && !isAssignedUser && !!userData?.circle)}>
          <option value="">Select Circle</option>
          {circles.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select className="daily-activity-select" value={site || ""} onChange={(e)=> setSite(e.target.value)} disabled={!circle || (!isAdmin && !isAssignedUser && !!userData?.site)}>
          <option value="">Select Site</option>
          {sites.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <input className="daily-activity-input" type="number" min="2000" max="2100" value={year} onChange={(e)=>setYear(parseInt(e.target.value,10)||currentYear())} style={{ width: 110 }} />

        <button className="daily-activity-btn daily-activity-btn-secondary" onClick={() => {
          // reload pmDoc for selected site/year — handled by useEffect but we allow manual
          const key = makeSiteKey(region, circle, site) + "__" + String(year);
          (async () => {
            setPmLoading(true);
            try {
              const snap = await getDoc(doc(db, "pm_registers", key));
              if (snap.exists()) setPmDoc(snap.data());
              else setPmDoc(emptyPMDoc(region, circle, site, year));
            } catch (e) { console.error(e); alert("Load failed"); } finally { setPmLoading(false); }
          })();
        }}>Load</button>

        <button className="daily-activity-btn daily-activity-btn-primary" onClick={savePmDocToFirestore} disabled={!canEdit || saving}>
          {saving ? "Saving…" : "Save Template"}
        </button>

        <button className="daily-activity-btn daily-activity-btn-danger" onClick={deletePmDocFirestore} disabled={!canEdit}>
          Delete Template
        </button>

        <label style={{ display: "inline-block", marginLeft: 8 }}>
          <input type="file" accept=".csv" style={{ display: "none" }} id="pm-csv-upload"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleCSVUpload(f);
              e.target.value = "";
            }} />
          <span className="daily-activity-btn daily-activity-btn-secondary" style={{ cursor: "pointer" }}>{uploading ? "Uploading…" : "Upload CSV"}</span>
        </label>
      </div>

      {/* PM Doc Editor */}
      <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
        {pmLoading ? <div className="daily-activity-loading">Loading template…</div> : (
          <>
            <div style={{ marginBottom: 8, display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ fontWeight: 700 }}>{(pmDoc && pmDoc.site) ? `${pmDoc.region} / ${pmDoc.circle} / ${pmDoc.site} — ${pmDoc.year}` : "No template loaded"}</div>
              <div style={{ color: "#666" }}>Edit equipment schedules below. Click Save Template to persist to Firestore.</div>
            </div>

            {/* equipment selection quick add */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <select className="daily-activity-select" value={selectedEquipment} onChange={(e)=>setSelectedEquipment(e.target.value)}>
                {Array.from(new Set([...equipmentList, ...Object.keys(pmDoc.equipmentSchedules || {})])).map(eq => <option key={eq} value={eq}>{eq}</option>)}
              </select>
              <button className="daily-activity-btn daily-activity-btn-secondary" onClick={() => ensureEquipmentSlot(selectedEquipment)} disabled={!canEdit}>Ensure Slot</button>
              <button className="daily-activity-btn daily-activity-btn-primary" onClick={() => addScheduleEntry(selectedEquipment)} disabled={!canEdit}>+ Add Schedule Entry</button>
            </div>

            {/* equipment schedules list */}
            <div style={{ display: "grid", gap: 12 }}>
              {Object.keys(pmDoc.equipmentSchedules || {}).length === 0 ? <div className="daily-activity-empty">No equipment schedules. Use 'Ensure Slot' and 'Add Schedule Entry' or upload CSV.</div> : (
                Object.keys(pmDoc.equipmentSchedules || {}).map(equipmentName => {
                  const entries = Array.isArray(pmDoc.equipmentSchedules[equipmentName]) ? pmDoc.equipmentSchedules[equipmentName] : [];
                  return (
                    <div key={equipmentName} style={{ border: "1px solid #f0f0f0", padding: 10, borderRadius: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{ fontWeight: 700 }}>{equipmentName}</div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="daily-activity-btn daily-activity-btn-secondary" onClick={() => ensureEquipmentSlot(equipmentName)} disabled={!canEdit}>Ensure</button>
                          <button className="daily-activity-btn daily-activity-btn-danger" onClick={() => {
                            // remove entire equipment schedules
                            if (!canEdit) return;
                            if (!window.confirm(`Remove all schedule entries for ${equipmentName}?`)) return;
                            setPmDoc(prev => {
                              const copy = { ...(prev || {}) };
                              copy.equipmentSchedules = { ...(copy.equipmentSchedules || {}) };
                              delete copy.equipmentSchedules[equipmentName];
                              return copy;
                            });
                          }}>Remove Equipment</button>
                        </div>
                      </div>

                      <div style={{ display: "grid", gap: 12 }}>
                        {entries.length === 0 && <div style={{ color: "#666" }}>No entries for this equipment</div>}
                        {entries.map(entry => (
                          <div key={entry.id} style={{ borderTop: "1px dashed #eee", paddingTop: 8 }}>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                              <label style={{ minWidth: 110 }}>
                                PM Type:
                                <select className="daily-activity-select" value={entry.pmType || "In-House"}
                                  onChange={(e) => updateScheduleEntry(equipmentName, entry.id, "pmType", e.target.value)} disabled={!canEdit}>
                                  <option value="In-House">In-House</option>
                                  <option value="Vendor">Vendor</option>
                                </select>
                              </label>

                              <label style={{ minWidth: 160 }}>
                                Frequency:
                                <select className="daily-activity-select" value={entry.frequency || "monthly"}
                                  onChange={(e) => updateScheduleEntry(equipmentName, entry.id, "frequency", e.target.value)} disabled={!canEdit}>
                                  <option value="monthly">Monthly</option>
                                  <option value="quarterly">Quarterly</option>
                                  <option value="half-yearly">Half-Yearly</option>
                                  <option value="yearly">Yearly</option>
                                </select>
                              </label>

                              <label>
                                Day:
                                <input type="number" className="daily-activity-input" min="1" max="31" value={entry.dayOfMonth || 1}
                                  onChange={(e) => updateScheduleEntry(equipmentName, entry.id, "dayOfMonth", Math.max(1, Math.min(31, parseInt(e.target.value || "1",10))))} disabled={!canEdit} />
                              </label>

                              <label>
                                Vendor:
                                <input className="daily-activity-input" value={entry.vendor || ""} onChange={(e)=>updateScheduleEntry(equipmentName, entry.id, "vendor", e.target.value)} disabled={!canEdit} />
                              </label>

                              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                <button className="daily-activity-btn daily-activity-btn-secondary" onClick={() => applyFrequencyToEntry(entry.id, equipmentName, entry.frequency || "monthly", (entry.months && entry.months[0]) || 1)} disabled={!canEdit}>Apply Frequency → Months</button>
                                <button className="daily-activity-btn daily-activity-btn-danger" onClick={() => removeScheduleEntry(equipmentName, entry.id)} disabled={!canEdit}>Remove Entry</button>
                              </label>
                            </div>

                            <div style={{ marginTop: 8 }}>
                              <div style={{ fontSize: 13, marginBottom: 6 }}>Months (click to toggle):</div>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {MONTHS.map(m => {
                                  const checked = Array.isArray(entry.months) && entry.months.includes(m.num);
                                  return (
                                    <button key={m.num}
                                      className={`daily-activity-btn ${checked ? "daily-activity-btn-primary" : "daily-activity-btn-secondary"}`}
                                      onClick={() => {
                                        if (!canEdit) return;
                                        const next = new Set(Array.isArray(entry.months) ? entry.months : []);
                                        if (next.has(m.num)) next.delete(m.num); else next.add(m.num);
                                        updateScheduleEntry(equipmentName, entry.id, "months", Array.from(next).sort((a,b)=>a-b));
                                      }}
                                      type="button"
                                      style={{ padding: "6px 8px", borderRadius: 6 }}
                                    >
                                      {m.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div style={{ marginTop: 8 }}>
                              <textarea placeholder="Notes / instructions" className="daily-activity-input" value={entry.notes || ""} onChange={(e)=>updateScheduleEntry(equipmentName, entry.id, "notes", e.target.value)} disabled={!canEdit} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>

      <div style={{ marginTop: 12, color: "#666", fontSize: 13 }}>
        <strong>Notes:</strong> Save Template persists the configuration in Firestore under collection <code>pm_registers</code> with id <code>siteKey__YYYY</code>. The schedule is recurring yearly; when you build daily/weekly tasks you can reference these schedules to auto-create tasks on scheduled months/days.
      </div>
    </div>
  );
}
