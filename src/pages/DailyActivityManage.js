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
  query, where
} from "firebase/firestore";
import { db } from "../firebase";
import { Link } from "react-router-dom";
import "../assets/daily-activity.css";
import { ACTIVITY_MASTER, getApproversFromLevels } from "../config/activityMaster";
// import { APPROVAL_LEVELS } from "../config/approvalLevels";

const formatApproversFromArray = (approversArr) => {
  if (!Array.isArray(approversArr) || approversArr.length === 0) {
    return "NA";
  }

  const grouped = approversArr.reduce((acc, { level, approver }) => {
    if (!level || !approver) return acc;
    acc[level] = acc[level] || [];
    acc[level].push(approver);
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([level, users]) => `${level}: ${users.join(", ")}`)
    .join("\n");
};


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
  "ACS", "Air Conditioner", "BMS", "CCTV", "Comfort AC", "Diesel Generator", "Earth Pit", "Exhust Fan",
  "FAS", "FSS", "HT Panel", "Inverter", "LT Panel", "PAS", "PFE", "SMPS", "SMPS BB", "Solar System",
  "UPS", "UPS BB", "DCDB/ACDB", "Transformer"
];

const FREQUENCIES = ["monthly", "quarterly", "half-yearly", "yearly"];

function pad2(n) { return n < 10 ? `0${n}` : `${n}`; }
function todayISO() { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function siteDocId(region, circle, site, year) { return `${(region || "")}_${(circle || "")}_${(site || "")}_${year}`.replace(/\s+/g, "_"); }
function pmDocId(region, circle, site, year) { return `${(region || "")}${"__"}${(circle || "")}${"__"}${(site || "")}${"__"}${year}`.replace(/\s+/g, "_"); }
function genId() { return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }
function monthOfISO(iso) { if (!iso) return null; const p = iso.split("-"); return parseInt(p[1], 10); }
function dayOfISO(iso) { if (!iso) return null; const p = iso.split("-"); return parseInt(p[2], 10); }

export default function DailyActivityManage({ userData }) {
  // selection
  const [region, setRegion] = useState(userData?.region || "");
  const [circle, setCircle] = useState(userData?.circle || "");
  const [site, setSite] = useState(userData?.site || userData?.siteName || "");
  const [year, setYear] = useState(new Date().getFullYear());

  const [regions, setRegions] = useState([]);
  const [circles, setCircles] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(false);


  // pm doc
  const [pmDoc, setPmDoc] = useState(null);
  const [loadingPm, setLoadingPm] = useState(false);

  // daily sheet
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [dailyRows, setDailyRows] = useState([]);
  const [loadingDaily, setLoadingDaily] = useState(false);

  // UI states
  const [saving, setSaving] = useState(false);
  const [addingEntryFor, setAddingEntryFor] = useState(null); // equipment being added

  // permissions
  const isSuperAdmin = userData?.role === "Super Admin";
  const isAdmin = isSuperAdmin || userData?.role === "Admin";
  const isAssignedUser = userData?.isAdminAssigned;
  const canEdit = isAdmin || isAssignedUser || isSuperAdmin;

  // equipment list
  const [equipmentList, setEquipmentList] = useState([]);
  const [vendorList, setVendorList] = useState([]);

  const [dynamicEquip, setDynamicEquip] = useState("");
  const [dynamicActivity, setDynamicActivity] = useState("");
  const [vendorName, setVendorName] = useState("");

  const [siteConfig, setSiteConfig] = useState({});
  const siteKey = site?.toUpperCase();

  const [editRowIndex, setEditRowIndex] = useState(null);
  const [editRowData, setEditRowData] = useState(null);
  const openEditModal = (row, index) => {
    setEditRowIndex(index);
    setEditRowData({ ...row });
  };

  const saveEditModal = async () => {
    if (editRowIndex === null) return;

    const updated = [...dailyRows];
    updated[editRowIndex] = editRowData;

    const docId = `${userData?.siteId || site}_${selectedDate}`.replace(/\s+/g, "_");

    await setDoc(
      doc(db, "daily_activity_sheets", docId),
      {
        rows: updated,
        lastUpdatedBy: userData?.uid,
        lastUpdatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    setDailyRows(updated);
    setEditRowIndex(null);
    setEditRowData(null);
  };

  // collapse state per equipment
  const [collapsedEquip, setCollapsedEquip] = useState({});
  const [isAllCollapsed, setIsAllCollapsed] = useState(true); // default closed




  // Fetch Site Configs from Firestore
  const fetchConfig = async () => {
    if (!siteKey) return;
    const snap = await getDoc(doc(db, "siteConfigs", siteKey));
    if (snap.exists()) {
      setSiteConfig(snap.data());
    }
  };


  // load site hierarchy from assets_register if available (best-effort)
  useEffect(() => {
    if (!circle || !(userData?.siteId || site)) return;

    async function loadAssetsFlat() {
      try {
        setLoading(true);
        const snap = await getDocs(collection(db, "assets_flat"));

        const equipSet = new Set();
        const vendorSet = new Set();

        snap.forEach(docSnap => {
          const d = docSnap.data();

          // 🔐 Admin / Super Admin → ALL sites
          if (isAdmin || isSuperAdmin) {
            if (d.EquipmentCategory) equipSet.add(d.EquipmentCategory);
            if (d.AMC_Partner_Name) vendorSet.add(d.AMC_Partner_Name);
            return;
          }

          // 👤 Other users → EXISTING site-based logic
          if (
            d.Circle === circle &&
            d.UniqueCode === (userData?.siteId || site)
          ) {
            if (d.EquipmentCategory) equipSet.add(d.EquipmentCategory);
            if (d.AMC_Partner_Name) vendorSet.add(d.AMC_Partner_Name);
          }
        });

        setEquipmentList(Array.from(equipSet).sort());
        setVendorList(Array.from(vendorSet).sort());
        setLoading(false);
      } catch (e) {
        console.error("assets_flat load failed", e);
      }
    }

    fetchConfig();

    loadAssetsFlat();
  }, [circle, site, userData?.siteId, siteKey]);


  // load pm doc for selected site/year
  useEffect(() => {
    async function loadPm() {
      if (!region || !circle || !site || !year) { setPmDoc(null); return; }
      setLoadingPm(true);
      setLoading(true);
      const id = pmDocId(region, circle, site, year);
      try {
        const snap = await getDoc(doc(db, "pm_registers", id));
        if (snap.exists()) {
          const d = snap.data() || {};
          // normalize equipmentSchedules
          d.equipmentSchedules = d.equipmentSchedules || {};
          Object.keys(d.equipmentSchedules).forEach(eq => {
            if (!Array.isArray(d.equipmentSchedules[eq])) d.equipmentSchedules[eq] = [];
          });
          setPmDoc(d);
        } else {
          setPmDoc({
            region, circle, site, year,
            createdBy: userData?.uid || null,
            equipmentSchedules: {}
          });
        }
      } catch (e) {
        console.error("loadPm error", e);
        setPmDoc({
          region, circle, site, year,
          createdBy: userData?.uid || null,
          equipmentSchedules: {}
        });
      } finally {
        setLoadingPm(false);
        setLoading(false);
      }
    }
    loadPm();
  }, [region, circle, site, year, userData?.uid]);

  // load daily sheet for selected date
  useEffect(() => {
    async function loadDaily() {
      if (!site) { setDailyRows([]); return; }
      setLoadingDaily(true);
      setLoading(true);
      const docId = `${userData?.siteId || site}_${selectedDate}`.replace(/\s+/g, "_");
      try {
        const snap = await getDoc(doc(db, "daily_activity_sheets", docId));
        if (snap.exists()) {
          setDailyRows(snap.data().rows || []);
        } else {
          setDailyRows([]);
        }
      } catch (e) {
        console.error("loadDaily error", e);
        setDailyRows([]);
      } finally {
        setLoadingDaily(false);
        setLoading(false);
      }
    }
    loadDaily();
  }, [selectedDate, site, userData?.siteId]);


  useEffect(() => {
    async function loadRegionCircleSite() {
      const snap = await getDocs(collection(db, "assets_flat"));

      const regionSet = new Set();
      const circleMap = {};
      const siteMap = {};

      snap.forEach(docSnap => {
        const d = docSnap.data();

        // 🔐 Restrict non-admin users
        if (!isAdmin && !isSuperAdmin) {
          if (
            d.Region !== userData?.region ||
            d.Circle !== userData?.circle ||
            d.UniqueCode !== (userData?.siteId || userData?.site)
          ) {
            return;
          }
        }

        // REGION
        if (d.Region) regionSet.add(d.Region);

        // CIRCLE
        if (d.Region && d.Circle) {
          circleMap[d.Region] = circleMap[d.Region] || new Set();
          circleMap[d.Region].add(d.Circle);
        }

        // SITE
        if (d.Circle && d.SiteName) {
          siteMap[d.Circle] = siteMap[d.Circle] || new Set();
          siteMap[d.Circle].add(d.SiteName);
        }
      });

      setRegions([...regionSet].sort());
      setCircles(region ? [...(circleMap[region] || [])].sort() : []);
      setSites(circle ? [...(siteMap[circle] || [])].sort() : []);
    }

    loadRegionCircleSite();
  }, [region, circle, isAdmin, isSuperAdmin, userData]);


  // helpers for modifying pmDoc locally
  function ensureEquipmentSlot(equipment) {
    if (!pmDoc) return;
    setPmDoc(prev => {
      const copy = { ...(prev || {}) };
      copy.equipmentSchedules = copy.equipmentSchedules || {};
      if (!Array.isArray(copy.equipmentSchedules[equipment])) copy.equipmentSchedules[equipment] = [];
      return copy;
    });
  }

  function addSchedule(equipment, payload = null) {
    if (!pmDoc) return;
    const entry = payload || { id: genId(), frequency: "monthly", months: [1], dayOfMonth: 1, vendor: "", notes: "" };
    setPmDoc(prev => {
      const copy = { ...(prev || {}) };
      copy.equipmentSchedules = copy.equipmentSchedules || {};
      const arr = Array.isArray(copy.equipmentSchedules[equipment]) ? [...copy.equipmentSchedules[equipment]] : [];
      arr.push(entry);
      copy.equipmentSchedules[equipment] = arr;
      return copy;
    });
  }

  function updateSchedule(equipment, entryId, field, value) {
    if (!pmDoc) return;
    setPmDoc(prev => {
      const copy = { ...(prev || {}) };
      copy.equipmentSchedules = copy.equipmentSchedules || {};
      const arr = Array.isArray(copy.equipmentSchedules[equipment]) ? [...copy.equipmentSchedules[equipment]] : [];
      const idx = arr.findIndex(x => x.id === entryId);
      if (idx >= 0) {
        arr[idx] = { ...arr[idx], [field]: value };
      }
      copy.equipmentSchedules[equipment] = arr;
      return copy;
    });
  }

  function removeSchedule(equipment, entryId) {
    if (!pmDoc) return;
    setPmDoc(prev => {
      const copy = { ...(prev || {}) };
      copy.equipmentSchedules = copy.equipmentSchedules || {};
      const arr = Array.isArray(copy.equipmentSchedules[equipment]) ? [...copy.equipmentSchedules[equipment]] : [];
      copy.equipmentSchedules[equipment] = arr.filter(x => x.id !== entryId);
      return copy;
    });
  }

  // Save pmDoc to Firestore (create/update)
  async function savePmDocToFirestore() {
    if (!canEdit) { alert("No permission to save"); return; }
    if (!pmDoc) return;
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
      if (snap.exists()) setPmDoc(snap.data());
    } catch (e) {
      console.error("savePmDoc error", e);
      alert("Save failed. See console.");
    } finally {
      setSaving(false);
    }
  }

  // Delete entire pm doc
  async function deletePmDocFromFirestore() {
    if (!canEdit) { alert("No permission"); return; }
    if (!pmDoc) return;
    if (!window.confirm("Delete entire PM register for this site & year? This cannot be undone.")) return;
    try {
      const id = pmDocId(pmDoc.region, pmDoc.circle, pmDoc.site, pmDoc.year);
      await deleteDoc(doc(db, "pm_registers", id));
      setPmDoc({
        region, circle, site, year,
        createdBy: userData?.uid || null,
        equipmentSchedules: {}
      });
      alert("Deleted.");
    } catch (e) {
      console.error("deletePmDoc error", e);
      alert("Delete failed.");
    }
  }

  // Add scheduled items for the selected date into daily_activity_sheets
  // Logic: for each equipment in pmDoc, for each schedule entry check if selectedDate matches:
  // - if entry.months includes the month (1..12) AND entry.dayOfMonth equals day -> include
  // - OR if entry has scheduleDates array (YYYY-MM-DD strings) -> check includes selectedDate
  async function addScheduledItemsToDailySheet() {
    if (!pmDoc) return alert("No PM template loaded.");
    const month = monthOfISO(selectedDate);
    const day = dayOfISO(selectedDate);
    if (!month || !day) return alert("Invalid date selected.");
    const matches = [];
    Object.entries(pmDoc.equipmentSchedules || {}).forEach(([eq, arr]) => {
      (Array.isArray(arr) ? arr : []).forEach(entry => {
        const months = Array.isArray(entry.months) ? entry.months : [];
        const scheduleDates = Array.isArray(entry.scheduleDates) ? entry.scheduleDates : [];
        const matchesByMonths = months.length ? months.includes(month) && (entry.dayOfMonth ? entry.dayOfMonth === day : true) : false;
        const matchesByDates = scheduleDates.length ? scheduleDates.includes(selectedDate) : false;
        if (matchesByMonths || matchesByDates) {
          matches.push({
            // circle: pmDoc.circle || "",
            nodeName: eq,
            activityDetails: entry.pmType || "",
            vendor: entry.vendor || "",
            activityType: entry.activityType || "Major",
            siteCategory: entry.siteCategory || "Super Critical",
            mopRequired: entry.mopRequired ? "Yes" : "No",
            activityCode: entry.activityCode,
            activityCategory: entry.activityCategory || "",        // NEW
            approvalRequire: entry.approvalLevel || "",        // Yes / No
            approvers: getApproversFromLevels(entry.approvalLevels) || "",
            performBy: entry.performBy || "",
            crqType: entry.crRequired ? "CRQ" : "PE",
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

    if (matches.length === 0) {
      alert("No scheduled PM items for selected date.");
      return;
    }

    // Merge into existing dailyRows, avoid duplicates by nodeName + pmEntry.id
    const merged = [...dailyRows];
    matches.forEach(m => {
      const exists = merged.some(r => (r.nodeName === m.nodeName) && (r.createdFromPmId && r.createdFromPmId === m.createdFromPmId));
      if (!exists) {
        merged.push(m);
      }
    });

    // save to daily_activity_sheets
    const docId = `${userData?.siteId || site}_${selectedDate}`.replace(/\s+/g, "_");
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
    } catch (e) {
      console.error("addScheduledItemsToDailySheet error", e);
      alert("Failed to add scheduled items.");
    }
  }

  // Update / delete a daily row (simple operations for site users)
  async function updateDailyRow(index, key, value) {
    const updated = [...dailyRows];
    updated[index] = { ...(updated[index] || {}), [key]: value };
    const docId = `${userData?.siteId || site}_${selectedDate}`.replace(/\s+/g, "_");
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
    } catch (e) { console.error("updateDailyRow", e); alert("Save failed"); }
  }
  async function deleteDailyRow(index) {
    const updated = dailyRows.filter((_, i) => i !== index);
    const docId = `${userData?.siteId || site}_${selectedDate}`.replace(/\s+/g, "_");
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
    } catch (e) { console.error("deleteDailyRow", e); alert("Delete failed"); }
  }

  // UI helpers
  const equipmentKeys = useMemo(() => {
    const fromPm = Object.keys(pmDoc?.equipmentSchedules || {});
    const fromAssets = equipmentList.length ? equipmentList : DEFAULT_EQUIP_LIST;
    return Array.from(new Set([...fromAssets, ...fromPm]));
  }, [pmDoc, equipmentList]);

  function resolveApproval(category) {
    if (category === "PM") {
      return { approvalRequired: "No", approvalLevel: "NA" };
    }
    if (category === "CM" || category === "Breakdown") {
      return { approvalRequired: "Yes", approvalLevel: "CIH" };
    }
    return { approvalRequired: "Yes", approvalLevel: "CIH" };
  }


  function sanitize(obj) {
    return JSON.parse(
      JSON.stringify(obj, (_, v) => (v === undefined ? null : v))
    );
  }

  const getUniqueLevels = (approversArr = []) => {
    if (!Array.isArray(approversArr)) return [];
    return [...new Set(approversArr.map(a => a.level))];
  };

  const getMaxApprovalLevelNumber = (rows = []) => {
    let max = 0;

    rows.forEach((r) => {
      if (!Array.isArray(r.approvers)) return;

      r.approvers.forEach(({ level }) => {
        const num = parseInt(level?.replace("Level-", ""), 10);
        if (!isNaN(num)) max = Math.max(max, num);
      });
    });

    return max;
  };

  /* 👇 ADD THIS BLOCK HERE */
  const maxLevel = getMaxApprovalLevelNumber(dailyRows);
  const headerLevels = Array.from(
    { length: maxLevel },
    (_, i) => `Level-${i + 1}`
  );

  return (
    <div className="dhr-dashboard-container">
      {loading && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: "#0f172a",
              padding: "30px 40px",
              borderRadius: "12px",
              textAlign: "center",
              color: "white",
              boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                border: "4px solid #334155",
                borderTop: "4px solid #38bdf8",
                borderRadius: "50%",
                margin: "0 auto 15px",
                animation: "spin 1s linear infinite",
              }}
            />
            <div style={{ fontSize: "15px", fontWeight: "bold" }}>
              Fetching Daily Activity…
            </div>
            <div style={{ fontSize: "12px", color: "#cbd5e1", marginTop: "4px" }}>
              Please wait
            </div>
          </div>
        </div>
      )}
      <div className="daily-activity-header">
        <h1 className="dashboard-header">
          <strong>🚧🛠️ Daily Activity Manage (PM Register integration)</strong>
        </h1>
        <div className="daily-activity-subtitle">Admins / assigned users maintain PM registers. Site users add scheduled PM to daily sheet.</div>
      </div>

      {(userData?.role === "Admin" || userData?.role === "Super Admin" || userData?.isAdminAssigned || userData.designation === "Vertiv CIH" || userData.designation === "Vertiv ZM") && (
        <Link to="/pm-register"><span className="pm-manage-btn">📜Manage PM Register</span></Link>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <button
          className="daily-activity-btn daily-activity-btn-secondary"
          onClick={() => setIsAllCollapsed(prev => !prev)}
        >
          {isAllCollapsed ? "➕ Expand PM Register " : "➖ Collapse PM Register"}
        </button>
      </div>
      {/* PM doc editor */}
      {!isAllCollapsed && (
        <div style={{ marginTop: 12, border: "1px solid #eee", padding: 12, borderRadius: 8 }}>
          {/* selection row */}
          <div className="daily-activity-toolbar" style={{ alignItems: "center", gap: 8 }}>
            {/* <input className="daily-activity-input" placeholder="Region" value={region} onChange={(e) => setRegion(e.target.value)} style={{ width: 140 }} disabled={!isAdmin} /> */}
            <select
              className="daily-activity-select"
              value={region}
              onChange={(e) => {
                setRegion(e.target.value);
                setCircle("");
                setSite("");
              }}
              disabled={!isAdmin && !isSuperAdmin}
            >
              <option value="">Select Region</option>
              {regions.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>

            {/* <input className="daily-activity-input" placeholder="Circle" value={circle} onChange={(e) => setCircle(e.target.value)} style={{ width: 140 }} disabled={!isAdmin} /> */}
            <select
              className="daily-activity-select"
              value={circle}
              onChange={(e) => {
                setCircle(e.target.value);
                setSite("");
              }}
              disabled={!region || (!isAdmin && !isSuperAdmin)}
            >
              <option value="">Select Circle</option>
              {circles.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* <input className="daily-activity-input" placeholder="Site" value={site} onChange={(e) => setSite(e.target.value)} style={{ width: 220 }} disabled={!isAdmin} /> */}
            <select
              className="daily-activity-select"
              value={site}
              onChange={(e) => setSite(e.target.value)}
              disabled={!circle || (!isAdmin && !isSuperAdmin)}
            >
              <option value="">Select Site</option>
              {sites.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <input className="daily-activity-input" type="number" min="2000" max="2100" value={year} onChange={(e) => setYear(parseInt(e.target.value || String(new Date().getFullYear()), 10))} style={{ width: 110 }} />
            <button className="daily-activity-btn daily-activity-btn-secondary" onClick={() => {
              // reload pm doc (useEffect covers it) — but we force re-fetch
              if (!region || !circle || !site) return alert("Select region, circle & site");
              (async () => {
                setLoadingPm(true);
                try {
                  const id = pmDocId(region, circle, site, year);
                  const snap = await getDoc(doc(db, "pm_registers", id));
                  if (snap.exists()) setPmDoc(snap.data());
                  else setPmDoc({ region, circle, site, year, createdBy: userData?.uid || null, equipmentSchedules: {} });
                } catch (e) { console.error(e); alert("Load failed"); } finally { setLoadingPm(false); }
              })();
            }}>Load PM Register</button>

            <button className="daily-activity-btn daily-activity-btn-primary" onClick={savePmDocToFirestore} disabled={!canEdit || saving}>{saving ? "Saving..." : "Save PM Register"}</button>
            <button className="daily-activity-btn daily-activity-btn-danger" onClick={deletePmDocFromFirestore} disabled={!canEdit}>Delete PM Register</button>
          </div>
          {loadingPm ? <div className="daily-activity-loading">Loading PM Register…</div> : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontWeight: 700 }}>{pmDoc ? `${pmDoc.region} / ${pmDoc.circle} / ${pmDoc.site} — ${pmDoc.year}` : "No PM register loaded"}</div>
                <div style={{ color: "#666" }}>Only admins & assigned users can edit schedules</div>
              </div>



              {/* equipment list with schedules */}
              <div className="child-container" style={{ display: "grid", gap: 12 }}>
                {equipmentKeys.length === 0 ? <div className="daily-activity-empty">No equipment</div> : equipmentKeys.map(eq => {
                  const entries = (pmDoc && pmDoc.equipmentSchedules && Array.isArray(pmDoc.equipmentSchedules[eq])) ? pmDoc.equipmentSchedules[eq] : [];
                  return (
                    <div key={eq} style={{ border: "1px solid #f3f3f3", padding: 10, borderRadius: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontWeight: 600 }}>{eq}</div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="daily-activity-btn daily-activity-btn-secondary" onClick={() => ensureEquipmentSlot(eq)} disabled={!canEdit}>Ensure</button>
                          <button className="daily-activity-btn daily-activity-btn-primary" onClick={() => addSchedule(eq)} disabled={!canEdit}>+ Add Schedule</button>
                        </div>
                      </div>


                      <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                        {entries.length === 0 ? (
                          <div style={{ color: "#666" }}>No schedule entries</div>
                        ) : entries.map(entry => (
                          <div key={entry.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, alignItems: "center", padding: 8, borderTop: "1px dashed #eee", width: "inherit", background: "#adababd2" }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600 }}>
                                {entry.pmType ||
                                  <>
                                    <select>
                                      <option value="">Select Activity</option>
                                      {(ACTIVITY_MASTER[eq] || ACTIVITY_MASTER["Other"] || []).map(a => (
                                        <option key={a.activityDescription} value={a.activityDescription}>{a.activityDescription}</option>
                                      ))}
                                    </select>
                                  </>
                                }
                              </div>
                              <div style={{ fontSize: 12, color: "#444" }}>{entry.notes || ""}</div>
                            </div>
                            <div>
                              <label style={{ fontSize: 12, color: "#666" }}>Frequency</label>
                              <select className="daily-activity-select" value={entry.frequency || "monthly"} onChange={(e) => updateSchedule(eq, entry.id, "frequency", e.target.value)} disabled={!canEdit}>
                                {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                              </select>
                            </div>
                            <div>
                              <label style={{ fontSize: 12, color: "#666" }}>Months (comma separated)</label>
                              <input className="daily-activity-input" value={(entry.months || []).join(",")} onChange={(e) => {
                                const months = (e.target.value || "").split(/[,\s]+/).map(x => parseInt(x, 10)).filter(n => !isNaN(n) && n >= 1 && n <= 12);
                                updateSchedule(eq, entry.id, "months", Array.from(new Set(months)).sort((a, b) => a - b));
                              }} disabled={!canEdit} />
                              <div style={{ fontSize: 11, color: "#666" }}>{(entry.months || []).length ? `Months: ${(entry.months || []).join(",")}` : "No months set"}</div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ marginBottom: 6 }}>
                                <label style={{ display: "block", fontSize: 12, color: "#666" }}>Day (1-31)</label>
                                <input type="number" className="daily-activity-input" min="1" max="31" value={entry.dayOfMonth || 1} onChange={(e) => updateSchedule(eq, entry.id, "dayOfMonth", Math.max(1, Math.min(31, parseInt(e.target.value || "1", 10))))} disabled={!canEdit} />
                              </div>
                              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                                {/* <button className="daily-activity-btn daily-activity-btn-secondary" onClick={() => {
                                // quick toggle pmType between In-House and Vendor
                                updateSchedule(eq, entry.id, "pmType", entry.pmType === "Vendor" ? "In-House" : "Vendor");
                              }} disabled={!canEdit}>Toggle Type</button> */}
                                <button className="daily-activity-btn daily-activity-btn-danger" onClick={() => {
                                  if (!canEdit) return;
                                  if (!window.confirm("Remove this schedule entry?")) return;
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
      )}

      <div className="child-container" style={{ marginBottom: 12, border: "1px dashed #ccc", padding: 10 }}>
        <h4>➕ Add Dynamic Activity (Site User)</h4>

        {/* Equipment */}
        <select
          className="daily-activity-select"
          value={dynamicEquip}
          onChange={(e) => {
            setDynamicEquip(e.target.value);
            setDynamicActivity("");
          }}
        >
          <option value="">Select Equipment</option>
          {equipmentKeys.map(eq => (
            <option key={eq} value={eq}>{eq}</option>
          ))}
          <option value="Others" >Others</option>
        </select>

        <select
          value={vendorName}
          onChange={(e) => setVendorName(e.target.value)}
        >
          <option value="">Select Vendor Name</option>
          {vendorList.map(v => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>

        {/* Activity */}
        {dynamicEquip && (
          <select
            className="daily-activity-select"
            value={dynamicActivity}
            onChange={(e) => setDynamicActivity(e.target.value)}
            style={{ marginLeft: 8 }}
          >
            <option value="">Select Activity</option>
            {(ACTIVITY_MASTER[dynamicEquip] || ACTIVITY_MASTER["Other"] || []).map(a => (
              <option key={a.activityDescription} value={a.activityDescription}>{a.activityDescription}</option>
            ))}
          </select>
        )}

        {/* Add Button */}
        <button
          className="daily-activity-btn daily-activity-btn-primary"
          style={{ marginLeft: 8 }}
          disabled={!dynamicEquip || !dynamicActivity}
          onClick={async () => {
            const meta = ACTIVITY_MASTER[dynamicEquip].find(
              a => a.activityDescription === dynamicActivity
            );

            const newRow = sanitize({
              nodeName: dynamicEquip,
              activityDetails: meta.activityDescription ?? "",
              activityType: meta.activityType ?? "Major",
              activityCategory: meta.activityCategory ?? "PM",
              performBy: meta.performBy ?? "In-House",
              vendor: vendorName || "In-House",
              mopRequired: meta.mopRequired ? "Yes" : "No",
              activityCode: meta.activityCode ?? "*",

              siteCategory: siteConfig?.siteCategory ?? "Major",

              approvalRequire: meta.approvalLevel ?? "No",
              approvers: getApproversFromLevels(meta.approvalLevels) ?? null,

              crDaysBefore: meta.crDaysBefore ?? 0,

              crqType: meta.crRequired ? "CRQ" : "PE",
              crqNo: null,

              activityStartTime: "10:00",
              activityEndTime: "18:00",

              isDynamic: true,
              activitySource: "DYNAMIC",
              createdAt: serverTimestamp()
            });

            const updated = [...dailyRows, newRow];
            setDailyRows(updated);

            const docId = `${userData?.siteId || site}_${selectedDate}`.replace(/\s+/g, "_");
            await setDoc(
              doc(db, "daily_activity_sheets", docId),
              sanitize({
                siteId: userData?.siteId || site,
                siteName: site,
                date: selectedDate,
                rows: updated,
                lastUpdatedBy: userData?.uid || null,
                lastUpdatedAt: serverTimestamp()
              }),
              { merge: true }
            );


            setDynamicEquip("");
            setDynamicActivity("");
          }}
        >
          Add
        </button>
      </div>
      {/* Daily sheet */}
      <div style={{ marginTop: 12, border: "1px solid #eee", padding: 12, borderRadius: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>Daily Sheet — {site} — {selectedDate}</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="date" className="daily-activity-date-picker" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
            <button className="daily-activity-btn daily-activity-btn-secondary" onClick={() => {
              // reload daily
              (async () => {
                setLoadingDaily(true);
                try {
                  const docId = `${userData?.siteId || site}_${selectedDate}`.replace(/\s+/g, "_");
                  const snap = await getDoc(doc(db, "daily_activity_sheets", docId));
                  setDailyRows(snap.exists() ? snap.data().rows || [] : []);
                } catch (e) { console.error(e); } finally { setLoadingDaily(false); }
              })();
            }}>Reload</button>

            <button className="daily-activity-btn daily-activity-btn-primary" onClick={addScheduledItemsToDailySheet}>Add Scheduled Items</button>
          </div>
        </div>

        {loadingDaily ? <div className="daily-activity-loading">Loading daily sheet…</div> : (
          <div className="table-container">
            <table className="table-container">
              <thead>
                <tr>
                  <th>Sl.No</th>
                  <th>Node Name</th>
                  <th>Activity Details</th>
                  <th>Site Category</th>
                  <th>Activity Category</th>
                  <th>Activity Code</th>
                  <th>Activity Type</th>
                  <th>Activity Owner</th>
                  <th>OEM/Vendor Name</th>
                  <th>MOP Required</th>
                  <th>Approval Required</th>
                  <th>Approval Level</th>
                  {/* 👇 DYNAMIC LEVEL HEADERS */}
                  {headerLevels.map(level => (
                    <th key={level}>{level}</th>
                  ))}
                  <th>CRQ/PE Type</th>
                  <th>CRQ/PE Number</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(dailyRows || []).length === 0 ? (
                  <tr><td colSpan="14" className="daily-activity-empty">No rows for this date</td></tr>
                ) : (dailyRows || []).map((r, idx) => (
                  <tr key={idx}
                    style={{
                      background: r.activitySource === "DYNAMIC" ? "#f0fbff" : "transparent"
                    }}
                  >
                    <td>{idx + 1}</td>
                    <td className="daily-activity-input" value={r.nodeName || ""} onChange={(e) => updateDailyRow(idx, "nodeName", e.target.value)} >
                      {r.nodeName || ""}
                    </td>
                    <td className="daily-activity-input" value={r.activityDetails || ""} onChange={(e) => updateDailyRow(idx, "activityDetails", e.target.value)} >
                      {r.activityDetails || ""}
                    </td>

                    {/* Site Category dropdown */}
                    {/* <td>
                      <select className="daily-activity-select" value={siteConfig?.siteCategory || r.siteCategory} onChange={(e) => updateDailyRow(idx, "siteCategory", e.target.value)}>
                        <option value="Super Critical">Super Critical</option>
                        <option value="Critical">Critical</option>
                        <option value="Major">Major</option>
                      </select>
                    </td> */}
                    <td>{siteConfig?.siteCategory || r.siteCategory}</td>

                    {/* Activity Type dropdown */}
                    <td
                      className="daily-activity-select"
                      value={r.activityCategory || "Minor"}
                      disabled
                    >
                      {r.activityCategory || "Minor"}
                    </td>

                    <td
                      className="daily-activity-select"
                      value={r.activityCode || "*"}
                      disabled
                    >
                      {r.activityCode || "*"}
                    </td>

                    <td
                      className="daily-activity-select"
                      value={r.activityType || ""}
                      disabled
                    >
                      {r.activityType || ""}
                    </td>

                    <td
                      className="daily-activity-select"
                      value={r.performBy || "In-House"}
                      disabled
                    >
                      {r.performBy || "In-House"}
                    </td>

                    <td
                      className="daily-activity-select"
                      value={r.vendor || "In-House"}
                      disabled
                    >
                      {r.vendor || "In-House"}
                    </td>

                    {/* <td>
                    <select
                      className="daily-activity-select"
                      value={r.activityCategory || "PM"}
                      onChange={(e) => {
                        const val = e.target.value;
                        const approval = resolveApproval(val);
                        updateDailyRow(idx, "activityCategory", val);
                        updateDailyRow(idx, "approvalRequired", approval.approvalRequired);
                        updateDailyRow(idx, "approvalLevel", approval.approvalLevel);
                      }}
                    >
                      <option value="PM">PM</option>
                      <option value="CM">CM</option>
                      <option value="Breakdown">Breakdown</option>
                      <option value="Other">Other</option>
                    </select>
                  </td> */}

                    <td
                      className="daily-activity-input"
                      value={r.mopRequired}
                      disabled
                    >
                      {r.mopRequired}
                    </td>

                    <td
                      className="daily-activity-input"
                      value={r.approvalRequire || "No"}
                      disabled
                    >
                      {r.approvalRequire || "No"}
                    </td>

                    <td>
                      <textarea
                        className="daily-activity-input"
                        value={formatApproversFromArray(r.approvers)}
                        disabled
                        style={{ width: "150px", height: "150px" }}
                      />
                    </td>


                    {/* <td>
                    <select
                      className="daily-activity-select"
                      value={r.approvalLevel || "NA"}
                      disabled={r.approvalRequired === "No"}
                      onChange={(e) => updateDailyRow(idx, "approvalLevel", e.target.value)}
                    >
                      <option value="NA">NA</option>
                      <option value="CIH">CIH</option>
                      <option value="Central Infra">Central Infra</option>
                      <option value="Ops Head">Ops Head</option>
                    </select>
                  </td> */}


                    {/* Approval Required dropdown */}
                    {/* <td>
                    <select className="daily-activity-select" value={r.approvalRequire || "CIH"} onChange={(e) => updateDailyRow(idx, "approvalRequire", e.target.value)}>
                      <option value="CIH">CIH</option>
                      <option value="Central Infra">Central Infra</option>
                      <option value="RAN Ops Head">RAN Ops Head</option>
                      <option value="Core Ops Head">Core Ops Head</option>
                      <option value="Fiber Ops Head">Fiber Ops Head</option>
                    </select>
                  </td> */}
                    {/* Individual approvals – Level based */}
                    {/* Individual approvals – dynamic by max level */}
                    {headerLevels.map((level) => {
                      const rowLevels = Array.isArray(r.approvers)
                        ? r.approvers.map(a => a.level)
                        : [];

                      const hasLevel = rowLevels.includes(level);

                      return (
                        <td key={level}>
                          <select
                            className="daily-activity-select"
                            value={r.approvalStatusByLevel?.[level] || "NA"}
                            disabled={!hasLevel}
                            onChange={(e) => {
                              if (!hasLevel) return;

                              updateDailyRow(idx, "approvalStatusByLevel", {
                                ...(r.approvalStatusByLevel || {}),
                                [level]: e.target.value,
                              });
                            }}
                            style={{ cursor: !hasLevel ? "not-allowed" : "pointer" }}
                          >
                            <option value="NA">NA</option>
                            <option value="Y">Y</option>
                            <option value="N">N</option>
                          </select>
                        </td>
                      );
                    })}

                    <td>
                      <select
                        className="daily-activity-select"
                        value={r.crqType}
                        onChange={(e) => updateDailyRow(idx, "crqType", e.target.value)}
                      >
                        <option value="CRQ" disabled={!r.crRequired}>CRQ</option>
                        <option value="PE">PE</option>
                      </select>
                    </td>

                    {/* CRQ No input with suggestions */}
                    <td>
                      <input
                        className="daily-activity-input"
                        list={`crq-options-${idx}`}
                        value={r.crqNo || ""}
                        placeholder={r.crqType === "CRQ" ? "CRQ Number required" : "PE Number required"}
                        required={r.crqType === "CRQ"}
                        onChange={(e) => updateDailyRow(idx, "crqNo", e.target.value)}
                      />
                      <datalist id={`crq-options-${idx}`}>
                        <option value="CRQ00000" />
                        <option value="PE" />
                      </datalist>
                    </td>

                    {/* <td>
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
                  </td> */}
                    {/* Start/End time */}
                    <td className="daily-activity-input" type="time" value={r.activityStartTime || ""} onChange={(e) => updateDailyRow(idx, "activityStartTime", e.target.value)} >{r.activityStartTime || ""}</td>
                    <td className="daily-activity-input" type="time" value={r.activityEndTime || ""} onChange={(e) => updateDailyRow(idx, "activityEndTime", e.target.value)} >{r.activityEndTime || ""}</td>
                    {/* Delete */}
                    <td>
                      <button
                        className="daily-activity-btn daily-activity-btn-secondary"
                        onClick={() => openEditModal(r, idx)}
                      >
                        Edit
                      </button>

                      <button
                        className="daily-activity-btn daily-activity-btn-danger"
                        onClick={() => deleteDailyRow(idx)}
                      >
                        Delete
                      </button>
                    </td>

                  </tr>
                ))}
              </tbody>

            </table>

            {editRowData && (
              <div className="modal-overlay">
                <div className="modal-box">
                  <h3>Edit Daily Activity</h3>

                  <label>Node Name</label>
                  <input
                    className="daily-activity-input"
                    value={editRowData.nodeName}
                    onChange={(e) =>
                      setEditRowData({ ...editRowData, nodeName: e.target.value })
                    }
                  />

                  <label>Activity Details</label>
                  <input
                    className="daily-activity-input"
                    value={editRowData.activityDetails}
                    onChange={(e) =>
                      setEditRowData({ ...editRowData, activityDetails: e.target.value })
                    }
                  />

                  <label>Start Time</label>
                  <input
                    type="time"
                    className="daily-activity-input"
                    value={editRowData.activityStartTime}
                    onChange={(e) =>
                      setEditRowData({ ...editRowData, activityStartTime: e.target.value })
                    }
                  />

                  <label>End Time</label>
                  <input
                    type="time"
                    className="daily-activity-input"
                    value={editRowData.activityEndTime}
                    onChange={(e) =>
                      setEditRowData({ ...editRowData, activityEndTime: e.target.value })
                    }
                  />

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <button
                      className="daily-activity-btn daily-activity-btn-secondary"
                      onClick={() => setEditRowData(null)}
                    >
                      Cancel
                    </button>
                    <button
                      className="daily-activity-btn daily-activity-btn-primary"
                      onClick={saveEditModal}
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      <div style={{ marginTop: 12, color: "#666", fontSize: 13 }}>
        Notes: PM register documents live in <code>pm_registers</code> collection with doc id pattern: <code>Region__Circle__Site__YYYY</code>.
        Use Add Scheduled Items to copy schedule items for the selected date into <code>daily_activity_sheets</code>.
      </div>
    </div>
  );
}
