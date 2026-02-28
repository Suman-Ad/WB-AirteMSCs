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
import { ACTIVITY_MASTER, getApproversFromLevels, getMopByActivity } from "../config/activityMaster";
import { generateMopPDF, generateMopExcel } from "../utils/mopGenerator";
import { siteIdMap } from "../config/siteConfigs";

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
  const [site, setSite] = useState(userData?.site || "");
  const siteId = siteIdMap[site] || "";
  const [year, setYear] = useState(new Date().getFullYear());

  const [regions, setRegions] = useState([]);
  const [circles, setCircles] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(false);

  // pm doc
  const [pmDoc, setPmDoc] = useState(null);
  const [loadingPm, setLoadingPm] = useState(false);

  // daily sheet
  const [dateFrom, setDateFrom] = useState(todayISO());
  const [dateTo, setDateTo] = useState(todayISO());
  const [selectDate, setSelectDate] = useState(todayISO());
  const [editingRowDate, setEditingRowDate] = useState(null);

  const [dailyRows, setDailyRows] = useState([]);
  const [dailyRowsByDate, setDailyRowsByDate] = useState({});
  const [loadingDaily, setLoadingDaily] = useState(false);

  // UI states
  const [saving, setSaving] = useState(false);
  const [addingEntryFor, setAddingEntryFor] = useState(null); // equipment being added

  // permissions
  const isSuperAdmin = userData?.role === "Super Admin";
  const isAdmin = isSuperAdmin || userData?.role === "Admin";
  const isAssignedUser = userData?.isAdminAssigned;
  const canEdit = isAdmin || isAssignedUser || isSuperAdmin || userData?.designation === "Vertiv CIH" || userData?.designation === "Vertiv ZM" || userData?.designation === "Vertiv Site Infra Engineer";

  // equipment list
  const [equipmentList, setEquipmentList] = useState([]);
  const [vendorList, setVendorList] = useState([]);

  const [dynamicEquip, setDynamicEquip] = useState("");
  const [dynamicActivity, setDynamicActivity] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [vendorNameInHouse, setVendorNameInHouse] = useState("");
  const [vendorNameOthers, setVendorNameOthers] = useState("");

  const [siteConfig, setSiteConfig] = useState({});
  const siteKey = site?.toUpperCase();

  const [editRowIndex, setEditRowIndex] = useState(null);
  const [editRowData, setEditRowData] = useState(null);
  // const openEditModal = (row, index) => {
  //   setEditRowIndex(index);
  //   setEditRowData({ ...row });
  //   setEditingRowDate(row._sheetDate);
  // };

  const [isEntryToggeled, setIsEntryToggeled] = useState({});

  const toggleEntry = (equipment, idx) => {
    const key = `${equipment}_${idx}`;

    setIsEntryToggeled(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };


  const normalizeApprovalStatusByLevel = (row) => {
    const status = { ...(row.approvalStatusByLevel || {}) };

    (row.approvers || []).forEach((a) => {
      if (!status[a.level]) {
        status[a.level] = "NA";
      }
    });

    return status;
  };

  const normalizeApproversByLevel = (approvers = []) => {
    const seen = new Set();

    return approvers.filter(a => {
      if (!a?.level) return false;
      if (seen.has(a.level)) return false;
      seen.add(a.level);
      return true;
    });
  };


  const openEditModal = (row, index) => {
    const cleanApprovers = normalizeApproversByLevel(row.approvers || []);

    setEditRowIndex(index);
    setEditingRowDate(row._sheetDate);

    setEditRowData({
      ...row,
      approvers: cleanApprovers,
      approvalStatusByLevel: normalizeApprovalStatusByLevel({
        ...row,
        approvers: cleanApprovers,
      }),
    });
  };


  const saveEditModal = async () => {
    if (editRowIndex === null || !editingRowDate) return;

    const cleanedRow = {
      ...editRowData,
      approvers: normalizeApproversByLevel(editRowData.approvers || []),
    };

    // 1️⃣ Update only edited row in memory
    const updatedAll = [...dailyRows];
    updatedAll[editRowIndex] = cleanedRow;

    // 2️⃣ 🔥 Extract rows ONLY for this date
    const rowsForDate = updatedAll
      .filter(r => r._sheetDate === editingRowDate)
      .map(({ _sheetDate, ...rest }) => rest); // remove helper field

    const docId = `${siteId || userData?.siteId}_${editingRowDate}`.replace(/\s+/g, "_");

    await setDoc(
      doc(db, "daily_activity_sheets", docId),
      {
        siteId: siteId || userData?.siteId,
        region: region || userData?.region,
        circle: circle || userData?.circle,
        siteName: site,
        date: editingRowDate,
        rows: rowsForDate,
        lastUpdatedBy: userData?.uid,
        lastUpdatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // 3️⃣ Update UI state
    setDailyRows(updatedAll);
    setEditRowIndex(null);
    setEditRowData(null);
    setEditingRowDate(null);
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

  function getDatesBetween(from, to) {
    const dates = [];
    let d = new Date(from);
    const end = new Date(to);

    while (d <= end) {
      dates.push(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }
    return dates;
  }

  // load daily sheet for selected date
  // useEffect(() => {
  //   async function loadDaily() {
  //     if (!site) { setDailyRows([]); return; }
  //     setLoadingDaily(true);
  //     setLoading(true);
  //     const docId = `${userData?.siteId || site}_${selectedDate}`.replace(/\s+/g, "_");
  //     try {
  //       const snap = await getDoc(doc(db, "daily_activity_sheets", docId));
  //       if (snap.exists()) {
  //         setDailyRows(snap.data().rows || []);
  //       } else {
  //         setDailyRows([]);
  //       }
  //     } catch (e) {
  //       console.error("loadDaily error", e);
  //       setDailyRows([]);
  //     } finally {
  //       setLoadingDaily(false);
  //       setLoading(false);
  //     }
  //   }
  //   loadDaily();
  // }, [selectedDate, site, userData?.siteId]);


  // async function getAllExistingDailyDatesForSite() {
  //   const q = query(
  //     collection(db, "daily_activity_sheets"),
  //     where("siteId", "==", siteId || userData?.siteId)
  //   );

  //   const snap = await getDocs(q);
  //   return snap.docs.map(d => d.data().date).sort();
  // }


  useEffect(() => {
    async function loadDailyRange() {
      if (!site || !dateFrom || !dateTo) {
        setDailyRows([]);
        return;
      }

      setLoadingDaily(true);
      setLoading(true);

      try {
        const dates = getDatesBetween(dateFrom, dateTo);

        let allRows = [];

        for (const date of dates) {
          const docId = `${siteId || userData?.siteId}_${date}`.replace(/\s+/g, "_");
          const snap = await getDoc(doc(db, "daily_activity_sheets", docId));

          if (snap.exists()) {
            const rows = snap.data().rows || [];
            allRows.push(
              ...rows.map(r => ({
                ...r,
                _sheetDate: date, // ✅ keep date info
              }))
            );
          }
        }

        setDailyRows(allRows);
      } catch (e) {
        console.error("loadDailyRange error", e);
        setDailyRows([]);
      } finally {
        setLoadingDaily(false);
        setLoading(false);
      }
    }

    loadDailyRange();
  }, [dateFrom, dateTo, site, userData?.siteId]);

  // load regions/circles/sites for selection dropdowns

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

  // function addSchedule(equipment, payload = null) {
  //   if (!pmDoc) return;
  //   const entry = payload || { id: genId(), frequency: "monthly", months: [1], dayOfMonth: 1, vendor: "", notes: "" };
  //   setPmDoc(prev => {
  //     const copy = { ...(prev || {}) };
  //     copy.equipmentSchedules = copy.equipmentSchedules || {};
  //     const arr = Array.isArray(copy.equipmentSchedules[equipment]) ? [...copy.equipmentSchedules[equipment]] : [];
  //     arr.push(entry);
  //     copy.equipmentSchedules[equipment] = arr;
  //     return copy;
  //   });
  // }

  function addSchedule(equipment, payload = null) {
    if (!pmDoc) return;

    setPmDoc(prev => {
      const copy = { ...(prev || {}) };
      copy.equipmentSchedules = copy.equipmentSchedules || {};

      const arr = Array.isArray(copy.equipmentSchedules[equipment])
        ? [...copy.equipmentSchedules[equipment]]
        : [];

      // 🔐 PREVENT duplicate empty/new schedule
      const hasEmpty = arr.some(e =>
        !e.pmType &&
        (!Array.isArray(e.months) || e.months.length === 0)
      );

      if (hasEmpty) {
        alert("⚠️ Please configure the existing schedule before adding a new one.");
        return prev; // ⛔ no duplicate added
      }

      const entry = payload || {
        id: genId(),
        pmType: "",
        frequency: "monthly",
        months: [],
        dayOfMonth: 1,
        vendor: "",
        notes: "",
        createdAt: serverTimestamp(),
      };

      const isDuplicate = arr.some(e =>
        e.pmType === payload?.pmType &&
        e.frequency === payload?.frequency &&
        e.dayOfMonth === payload?.dayOfMonth &&
        JSON.stringify(e.months || []) === JSON.stringify(payload?.months || [])
      );

      if (isDuplicate) {
        alert("⚠️ This PM schedule already exists.");
        return prev;
      }

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
  // async function savePmDocToFirestore() {
  //   if (!canEdit) { alert("No permission to save"); return; }
  //   if (!pmDoc) return;
  //   setSaving(true);
  //   try {
  //     const id = pmDocId(pmDoc.region, pmDoc.circle, pmDoc.site, pmDoc.year);
  //     const payload = {
  //       region: pmDoc.region,
  //       circle: pmDoc.circle,
  //       site: pmDoc.site,
  //       year: pmDoc.year,
  //       equipmentSchedules: pmDoc.equipmentSchedules || {},
  //       createdBy: pmDoc.createdBy || userData?.uid || null,
  //       updatedAt: serverTimestamp()
  //     };
  //     await setDoc(doc(db, "pm_registers", id), payload, { merge: true });
  //     alert("PM register saved.");
  //     // reload
  //     const snap = await getDoc(doc(db, "pm_registers", id));
  //     if (snap.exists()) setPmDoc(snap.data());
  //   } catch (e) {
  //     console.error("savePmDoc error", e);
  //     alert("Save failed. See console.");
  //   } finally {
  //     setSaving(false);
  //   }
  // }
  async function savePmDocToFirestore() {
    if (!canEdit) {
      alert("No permission to save");
      return;
    }
    if (!pmDoc) return;

    setSaving(true);

    try {
      const id = pmDocId(pmDoc.region, pmDoc.circle, pmDoc.site, pmDoc.year);

      // 🔐 SANITIZE equipmentSchedules deeply
      const cleanedSchedules = sanitize(pmDoc.equipmentSchedules || {});

      const payload = sanitize({
        region: pmDoc.region,
        circle: pmDoc.circle,
        site: pmDoc.site,
        year: pmDoc.year,
        equipmentSchedules: cleanedSchedules,
        createdBy: pmDoc.createdBy || userData?.uid || null,
        updatedAt: serverTimestamp(),
      });

      await setDoc(doc(db, "pm_registers", id), payload, { merge: true });

      alert("✅ PM register saved successfully");

      const snap = await getDoc(doc(db, "pm_registers", id));
      if (snap.exists()) {
        setPmDoc(snap.data());
      }
    } catch (e) {
      console.error("❌ savePmDoc error", e);
      alert("Save failed. Invalid PM data found. Check console.");
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
  // async function addScheduledItemsToDailySheet() {
  //   if (!pmDoc) return alert("No PM template loaded.");
  //   const month = monthOfISO(selectedDate);
  //   const day = dayOfISO(selectedDate);
  //   if (!month || !day) return alert("Invalid date selected.");
  //   const matches = [];
  //   Object.entries(pmDoc.equipmentSchedules || {}).forEach(([eq, arr]) => {
  //     (Array.isArray(arr) ? arr : []).forEach(entry => {
  //       const months = Array.isArray(entry.months) ? entry.months : [];
  //       const scheduleDates = Array.isArray(entry.scheduleDates) ? entry.scheduleDates : [];
  //       const matchesByMonths = months.length ? months.includes(month) && (entry.dayOfMonth ? entry.dayOfMonth === day : true) : false;
  //       const matchesByDates = scheduleDates.length ? scheduleDates.includes(selectedDate) : false;
  //       if (matchesByMonths || matchesByDates) {
  //         matches.push({
  //           // circle: pmDoc.circle || "",
  //           nodeName: eq,
  //           activityDetails: entry.pmType || "",
  //           vendor: entry.vendor || "",
  //           activityType: entry.activityType || "Major",
  //           siteCategory: entry.siteCategory || "Super Critical",
  //           mopRequired: entry.mopRequired ? "Yes" : "No",
  //           activityCode: entry.activityCode,
  //           activityCategory: entry.activityCategory || "",        // NEW
  //           approvalRequire: entry.approvalLevel || "",        // Yes / No
  //           approvers: getApproversFromLevels(entry.approvalLevels) || "",
  //           performBy: entry.performBy || "",
  //           crqType: entry.crRequired ? "CRQ" : "PE",
  //           crqNo: "CRQ00000",
  //           activityStartTime: entry.activityStartTime && entry.activityStartTime.trim() !== ""
  //             ? entry.activityStartTime
  //             : "10:00 AM", // ✅ Default Start Time
  //           activityEndTime: entry.activityEndTime && entry.activityEndTime.trim() !== ""
  //             ? entry.activityEndTime
  //             : "06:00 PM", // ✅ Default End Time
  //           createdFromPmId: entry.id || null,
  //           pmEntry: entry,
  //         });
  //       }
  //     });
  //   });

  //   if (matches.length === 0) {
  //     alert("No scheduled PM items for selected date.");
  //     return;
  //   }

  //   // Merge into existing dailyRows, avoid duplicates by nodeName + pmEntry.id
  //   const merged = [...dailyRows];
  //   matches.forEach(m => {
  //     const exists = merged.some(r => (r.nodeName === m.nodeName) && (r.createdFromPmId && r.createdFromPmId === m.createdFromPmId));
  //     if (!exists) {
  //       merged.push(m);
  //     }
  //   });

  //   // save to daily_activity_sheets
  //   const docId = `${userData?.siteId || site}_${selectedDate}`.replace(/\s+/g, "_");
  //   try {
  //     await setDoc(doc(db, "daily_activity_sheets", docId), {
  //       siteId: userData?.siteId || site,
  //       region: userData?.region || region || "",
  //       circle: userData?.circle || circle || "",
  //       siteName: userData?.site || site,
  //       date: selectedDate,
  //       rows: merged,
  //       lastUpdatedBy: userData?.uid || null,
  //       lastUpdatedAt: serverTimestamp()
  //     }, { merge: true });
  //     setDailyRows(merged);
  //     alert(`Added ${matches.length} scheduled item(s) to daily sheet.`);
  //   } catch (e) {
  //     console.error("addScheduledItemsToDailySheet error", e);
  //     alert("Failed to add scheduled items.");
  //   }
  // }

  function isDuplicateDailyRow(existingRows, newRow) {
    return existingRows.some(r =>
      // Strong match (preferred)
      (r.createdFromPmId && r.createdFromPmId === newRow.createdFromPmId) ||

      // Fallback for legacy rows
      (
        r.nodeName === newRow.nodeName &&
        r.activityDetails === newRow.activityDetails &&
        r.activityCategory === newRow.activityCategory
      )
    );
  }

  function hasPmActivitiesForRange(pmDoc, dateFrom, dateTo) {
    if (!pmDoc?.equipmentSchedules) return false;

    const dates = getDatesBetween(dateFrom, dateTo);

    return dates.some(date => {
      const month = monthOfISO(date);
      const day = dayOfISO(date);

      return Object.values(pmDoc.equipmentSchedules).some(arr =>
        (arr || []).some(entry => {
          const months = entry.months || [];
          const scheduleDates = entry.scheduleDates || [];

          const byMonth =
            months.includes(month) &&
            (!entry.dayOfMonth || entry.dayOfMonth === day);

          const byDate = scheduleDates.includes(date);

          return byMonth || byDate;
        })
      );
    });
  }

  function canAddScheduledItems(pmDoc, dateFrom, dateTo, dailyRowsByDate) {
    if (!pmDoc?.equipmentSchedules || !dateFrom || !dateTo) return false;

    const dates = getDatesBetween(dateFrom, dateTo);

    for (const date of dates) {
      const month = monthOfISO(date);
      const day = dayOfISO(date);

      const dailyRows = dailyRowsByDate?.[date] || [];

      for (const [eq, arr] of Object.entries(pmDoc.equipmentSchedules)) {
        for (const entry of arr || []) {
          const months = entry.months || [];
          const scheduleDates = entry.scheduleDates || [];

          const isScheduled =
            (months.includes(month) &&
              (!entry.dayOfMonth || entry.dayOfMonth === day)) ||
            scheduleDates.includes(date);

          if (!isScheduled) continue;

          const alreadyExists = dailyRows.some(r =>
            r.createdFromPmId === entry.id ||
            (
              r.nodeName === eq &&
              r.activityDetails === entry.pmType
            )
          );

          // 🔑 at least one PM activity NOT yet added
          if (!alreadyExists) return true;
        }
      }
    }

    // ❌ all PM activities already exist
    return false;
  }

  async function loadDailyRowsForRange(from, to) {
    if (!from || !to || !siteId) return;

    const dates = getDatesBetween(from, to);
    const result = {};

    for (const date of dates) {
      const docId = `${siteId}_${date}`.replace(/\s+/g, "_");
      const snap = await getDoc(doc(db, "daily_activity_sheets", docId));
      result[date] = snap.exists() ? snap.data().rows || [] : [];
    }

    setDailyRowsByDate(result);
  }

  useEffect(() => {
    if (dateFrom && dateTo && siteId) {
      loadDailyRowsForRange(dateFrom, dateTo);
    }
  }, [dateFrom, dateTo, siteId]);


  async function addScheduledItemsToDailySheet() {
    if (!pmDoc) return alert("No PM template loaded.");
    if (!dateFrom || !dateTo) return alert("Select date range.");
    // ✅ NEW CHECK
    if (!hasPmActivitiesForRange(pmDoc, dateFrom, dateTo)) {
      alert("ℹ️ No PM activities scheduled for the selected date range.");
      return;
    }

    const dates = getDatesBetween(dateFrom, dateTo);

    let totalAdded = 0;

    for (const date of dates) {
      const month = monthOfISO(date);
      const day = dayOfISO(date);

      const matches = [];

      Object.entries(pmDoc.equipmentSchedules || {}).forEach(([eq, arr]) => {
        (arr || []).forEach(entry => {
          const months = entry.months || [];
          const scheduleDates = entry.scheduleDates || [];

          const byMonth =
            months.includes(month) &&
            (!entry.dayOfMonth || entry.dayOfMonth === day);

          const byDate = scheduleDates.includes(date);

          if (byMonth || byDate) {
            matches.push({
              nodeName: eq,
              activityDetails: entry.pmType || "",
              vendor: entry.vendor || "",
              activityType: entry.activityType || "Major",
              siteCategory: siteConfig.siteCategory || entry.siteCategory,
              mopRequired: entry.mopRequired ? "Yes" : "No",
              activityCode: entry.activityCode,
              activityCategory: entry.activityCategory || "",
              approvalRequire: entry.approvalLevel || "",
              approvers: getApproversFromLevels(entry.approvalLevels),
              performBy: entry.performBy || "",
              crqType: entry.crRequired ? "CRQ" : "PE",
              crqNo: entry.crRequired ? "CRQ00000" : "PE0",
              activityStartTime: entry.activityStartTime || "10:00 AM",
              activityEndTime: entry.activityEndTime || "06:00 PM",
              createdFromPmId: entry.id,
              notes: entry.notes || "",
              pmEntry: entry,
              quantity: entry.quantity || 1, // default quantity for PM tasks
            });
          }
        });
      });

      if (!matches.length) continue;

      const docId = `${siteId}_${date}`.replace(/\s+/g, "_");
      const snap = await getDoc(doc(db, "daily_activity_sheets", docId));
      const existingRows = snap.exists() ? snap.data().rows || [] : [];

      const merged = [...existingRows];
      let addedForDate = 0;

      matches.forEach(m => {
        if (!isDuplicateDailyRow(merged, m)) {
          merged.push(m);
          addedForDate++;
        }
      });

      await setDoc(
        doc(db, "daily_activity_sheets", docId),
        sanitize({
          siteId: siteId || "",
          region: region || "",
          circle: circle || "",
          siteName: site || "",
          date,
          rows: merged,
          lastUpdatedBy: userData?.uid,
          lastUpdatedAt: serverTimestamp(),
        }),
        { merge: true }

      );
      totalAdded += addedForDate;
      setDailyRows(merged);
    }

    alert(`✅ Scheduled PM items added for date range (${dateFrom} → ${dateTo})`);
  }


  // Update / delete a daily row (simple operations for site users)
  async function updateDailyRow(index, key, value) {
    const updated = [...dailyRows];
    updated[index] = { ...(updated[index] || {}), [key]: value };
    const docId = `${siteId || userData?.siteId}_${editingRowDate}`.replace(/\s+/g, "_");
    try {
      await setDoc(doc(db, "daily_activity_sheets", docId), {
        siteId: userData?.siteId || site,
        siteName: userData?.site || site,
        date: editingRowDate,
        rows: updated,
        lastUpdatedBy: userData?.uid || null,
        lastUpdatedAt: serverTimestamp()
      }, { merge: true });
      setDailyRows(updated);
    } catch (e) { console.error("updateDailyRow", e); alert("Save failed"); }
  }
  async function deleteDailyRow(index, sheetDate) {
    if (!sheetDate) {
      alert("Invalid row date. Cannot delete.");
      return;
    }

    // 🔹 Remove row from UI list
    const updatedAll = dailyRows.filter((_, i) => i !== index);

    // 🔹 Keep only rows of the same date (without helper field)
    const rowsForDate = updatedAll
      .filter(r => r._sheetDate === sheetDate)
      .map(({ _sheetDate, ...rest }) => rest);

    const docId = `${siteId || userData?.siteId}_${sheetDate}`.replace(/\s+/g, "_");

    try {
      await setDoc(
        doc(db, "daily_activity_sheets", docId),
        {
          siteId: siteId || userData?.siteId,
          siteName: site,
          date: sheetDate,
          rows: rowsForDate,
          lastUpdatedBy: userData?.uid || null,
          lastUpdatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 🔹 Update UI instantly
      setDailyRows(updatedAll);
    } catch (e) {
      console.error("deleteDailyRow error", e);
      alert("Delete failed");
    }
  }


  async function deleteAllDailySheetsInRange() {
    if (!dateFrom || !dateTo) {
      alert("Select From and To date");
      return;
    }

    if (
      !window.confirm(
        `⚠️ This will DELETE ALL daily activities from ${dateFrom} to ${dateTo}.\nThis action cannot be undone.\n\nDo you want to continue?`
      )
    ) {
      return;
    }

    setLoading(true);

    try {
      const dates = getDatesBetween(dateFrom, dateTo);

      for (const date of dates) {
        const docId = `${userData?.siteId || site}_${date}`.replace(/\s+/g, "_");
        await deleteDoc(doc(db, "daily_activity_sheets", docId));
      }

      setDailyRows([]);
      alert("✅ All Daily Sheet data deleted for selected date range");
    } catch (e) {
      console.error("deleteAllDailySheetsInRange error", e);
      alert("❌ Failed to delete daily sheets");
    } finally {
      setLoading(false);
    }
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

  const ACTIVITY_CODE_BG = {
    RED: "#ffb7af",
    GREEN: "#8fe496",
    BLUE: "#a1d5fa",
    AMBER: "#fde7a0",
  };

  function formatSchedule(entry) {
    // Explicit fixed dates (best priority)
    if (Array.isArray(entry.scheduleDates) && entry.scheduleDates.length) {
      return entry.scheduleDates.join(", ");
    }

    // Month + day based schedule
    if (Array.isArray(entry.months) && entry.months.length) {
      const months = entry.months
        .map(m => new Date(0, m - 1).toLocaleString("en", { month: "short" }))
        .join(", ");

      return `${months} - ${entry.dayOfMonth || "Any day"}`;
    }

    return "Not scheduled";
  }

  const handleGenerateMOP = (row) => {
    const mop = getMopByActivity(row.activityDetails);

    if (!mop) {
      alert("MOP format not found for this activity");
      return;
    }

    const choice = window.confirm(
      "Click OK for PDF\nClick Cancel for Excel"
    );

    if (choice) {
      generateMopPDF(mop);
    } else {
      generateMopExcel(mop);
    }
  };

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

      {(userData?.role === "Admin" || userData?.role === "Super Admin" || userData?.isAdminAssigned || userData.designation === "Vertiv CIH" || userData.designation === "Vertiv ZM" || userData.designation === "Vertiv Site Infra Engineer") && (
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
                    <div key={eq} style={{ border: "1px solid #f3f3f3", padding: 10, borderRadius: 6, background: "#515169a9" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f9f9f9", padding: "6px 10px", borderRadius: "4px" }}>
                        <div style={{ fontWeight: 600 }}>{eq}</div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="daily-activity-btn daily-activity-btn-secondary" onClick={() => ensureEquipmentSlot(eq)} disabled={!canEdit}>Ensure</button>
                          <button className="daily-activity-btn daily-activity-btn-primary" onClick={() => addSchedule(eq)} disabled={!canEdit}>+ Add Schedule</button>
                        </div>
                      </div>
                      <p style={{ color: "#091727", fontSize: "12px" }}>{entries.length} schedule entries</p>
                      <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                        {entries.length === 0 ? (
                          <div style={{ color: "#666" }}>No schedule entries</div>
                        ) : entries.map((entry, idx) => (
                          <>
                            <b
                              onClick={() => toggleEntry(eq, idx)}
                              style={{ cursor: "pointer", color: "#fff", borderRadius: "3px" }}
                            >
                              {idx + 1}) {entry.pmType}
                              <br />
                              (
                              {entry.notes || "No notes"} - {formatSchedule(entry)}
                              )
                            </b>

                            {isEntryToggeled[`${eq}_${idx}`] && (
                              <div key={entry.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, alignItems: "center", padding: 8, borderTop: "1px dashed #eee", width: "inherit", background: "#adababd2" }}>
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                                    {/* {entry.pmType ||
                                  <>
                                    <select>
                                      <option value="">Select Activity</option>
                                      {(ACTIVITY_MASTER[eq] || ACTIVITY_MASTER["Other"] || []).map(a => (
                                        <option key={a.activityDescription} value={a.activityDescription}>{a.activityDescription}</option>
                                      ))}
                                    </select>
                                  </>
                                } */}
                                    <label style={{ fontSize: 12, color: "#666" }}>Activity Description</label>
                                    <select
                                      className="daily-activity-select"
                                      value={entry.pmType || ""}
                                      disabled={!canEdit}
                                      onChange={(e) => {
                                        const selected = (ACTIVITY_MASTER[eq] || ACTIVITY_MASTER["Other"] || [])
                                          .find(a => a.activityDescription === e.target.value);

                                        if (!selected) return;

                                        updateSchedule(eq, entry.id, "pmType", selected.activityDescription);
                                        updateSchedule(eq, entry.id, "activityCode", selected.activityCode);
                                        updateSchedule(eq, entry.id, "activityCategory", selected.activityCategory);
                                        updateSchedule(eq, entry.id, "performBy", selected.performBy);
                                        updateSchedule(eq, entry.id, "approvalLevels", selected.approvalLevels || []);
                                        updateSchedule(eq, entry.id, "approvalLevel", selected.approvalLevel || "");
                                        updateSchedule(eq, entry.id, "crRequired", selected.crRequired || false);
                                        updateSchedule(eq, entry.id, "crDaysBefore", selected.crDaysBefore || 0);
                                        updateSchedule(eq, entry.id, "activityType", selected.activityType || "Major");
                                        updateSchedule(eq, entry.id, "siteCategory", selected.siteCategory || "Super Critical");
                                      }}
                                    >
                                      <option value="">Select Activity</option>
                                      {(ACTIVITY_MASTER[eq] || ACTIVITY_MASTER["Other"] || []).map(a => (
                                        <option key={a.activityDescription} value={a.activityDescription}>
                                          {a.activityDescription}
                                        </option>
                                      ))}
                                    </select>

                                  </div>
                                  <div style={{ fontSize: 12, color: "#444" }}>Activity Owner: {entry.performBy || ""}</div>
                                  <div style={{ fontSize: 12, color: "#444" }}>Activity Type: {entry.activityType || ""}</div>
                                  <div style={{
                                    fontSize: 12, color: "#444",
                                    background: ACTIVITY_CODE_BG[entry.activityCode] || "transparent",
                                    display: "inline-block",
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                  }}>
                                    Activity Code: {entry.activityCode || ""}
                                  </div>
                                  <div style={{ fontSize: 12, color: "#444" }}>Activity Category: {entry.activityCategory || ""}</div>
                                  <div style={{ fontSize: 12, color: "#444" }}>CR Required: {entry.crRequired ? "Yes" : "No"}</div>
                                  <div style={{ fontSize: 12, color: "#444" }}>CR Days Before: {entry.crRequired ? entry.crDaysBefore : "0"}</div>
                                  <div style={{ fontSize: 12, color: "#444" }}>Notes: {entry.notes || ""}</div>
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
                                <div>
                                  <select
                                    value={entry.vendor || vendorName}
                                    onChange={(e) => updateSchedule(eq, entry.id, "vendor", e.target.value)}
                                  >
                                    <option value="">Select Vendor Name</option>
                                    {vendorList.map(v => (
                                      <option key={v} value={v}>{v}</option>
                                    ))}
                                  </select>
                                  <p>
                                    <label style={{ fontSize: 12, color: "#666" }}>Notes</label>
                                    Notes: <input type="text" className="daily-activity-input" value={entry.notes || ""} onChange={(e) => updateSchedule(eq, entry.id, "notes", e.target.value)} disabled={!canEdit} />
                                  </p>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                  <div style={{ marginBottom: 6 }}>
                                    <label style={{ display: "block", fontSize: 12, color: "#666" }}>Day (1-31)</label>
                                    <input type="number" className="daily-activity-input" min="1" max="31" value={entry.dayOfMonth || 1} onChange={(e) => updateSchedule(eq, entry.id, "dayOfMonth", Math.max(1, Math.min(31, parseInt(e.target.value || "1", 10))))} disabled={!canEdit} />
                                  </div>
                                  <div style={{ marginBottom: 6 }}>
                                    <label style={{ display: "block", fontSize: 12, color: "#666" }}>
                                      Approvers
                                    </label>

                                    <textarea
                                      className="daily-activity-input"
                                      value={formatApproversFromArray(getApproversFromLevels(entry.approvalLevels || []))}
                                      readOnly
                                      disabled
                                      rows={3}
                                      style={{
                                        resize: "none",
                                        background: "#f5f5f5",
                                        cursor: "not-allowed",
                                      }}
                                    />
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
                            )}
                          </>
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
        <input
          type="date"
          className="daily-activity-date-picker"
          value={selectDate}
          onChange={(e) => setSelectDate(e.target.value)}
        />
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

        <select
          value={vendorName}
          onChange={(e) => setVendorName(e.target.value)}
        >
          <option value="">Select Vendor Name</option>
          {vendorList.map(v => (
            <option key={v} value={v}>{v}</option>
          ))}
          <option value="In-House">In-House</option>
          <option value="Others">Others</option>
        </select>

        {vendorName === "In-House" && (
          <input
            type="text"
            className="daily-activity-input"
            placeholder="Enter In-House Name"
            value={vendorNameInHouse || "Vertiv"}
            onChange={(e) => setVendorNameInHouse(e.target.value || "Vertiv")}
          />
        )}

        {vendorName === "Others" && (
          <input
            type="text"
            className="daily-activity-input"
            placeholder="Enter Vendor Name"
            value={vendorNameOthers}
            onChange={(e) => setVendorNameOthers(e.target.value)}
          />
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
              vendor: vendorName === "In-House" ? `${vendorNameInHouse}(In-House)` : vendorName === "Others" ? vendorNameOthers : vendorName,
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

            const docId = `${siteId}_${selectDate}`.replace(/\s+/g, "_");
            await setDoc(
              doc(db, "daily_activity_sheets", docId),
              sanitize({
                siteId: siteId || "",
                region: region || "",
                circle: circle || "",
                siteName: site,
                date: selectDate,
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
        <div style={{ fontWeight: 700 }}>Daily Sheet — {site} — {dateFrom} — {dateTo}({dailyRows.length})</div>
        <div style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 8, overflowX: "auto" }}>
          <div style={{ display: "grid", gap: 8, alignItems: "center" }}>
            <input
              type="date"
              className="daily-activity-date-picker"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />

            <input
              type="date"
              className="daily-activity-date-picker"
              value={dateTo}
              min={dateFrom}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="daily-activity-btn daily-activity-btn-secondary" onClick={() => {
              // reload daily
              (async () => {
                setLoadingDaily(true);
                try {
                  const docId = `${siteId || userData?.siteId}_${editingRowDate}`.replace(/\s+/g, "_");
                  const snap = await getDoc(doc(db, "daily_activity_sheets", docId));
                  setDailyRows(snap.exists() ? snap.data().rows || [] : []);
                } catch (e) { console.error(e); } finally { setLoadingDaily(false); }
              })();
            }}>Reload</button>

            <button
              className="daily-activity-btn daily-activity-btn-primary"
              disabled={
                !canAddScheduledItems(
                  pmDoc,
                  dateFrom,
                  dateTo,
                  dailyRowsByDate
                )
              }
              onClick={addScheduledItemsToDailySheet}
            >
              {canAddScheduledItems(pmDoc,
                dateFrom,
                dateTo,
                dailyRowsByDate) ? "Add Scheduled Items" : ""}
              {!canAddScheduledItems(pmDoc,
                dateFrom,
                dateTo,
                dailyRowsByDate) && (
                  <small style={{ color: "#888" }}>
                    All PM activities already added for this date range
                  </small>
                )}

            </button>


            {/* <button className="daily-activity-btn daily-activity-btn-primary" onClick={addScheduledItemsToDailySheet}>Add Scheduled Items</button> */}
            <button
              className="daily-activity-btn daily-activity-btn-danger"
              onClick={deleteAllDailySheetsInRange}
            >
              🗑️ Delete All
            </button>
          </div>
        </div>

        {loadingDaily ? <div className="daily-activity-loading">Loading daily sheet…</div> : (
          <div className="table-container">
            <table className="table-container">
              <thead>
                <tr>
                  <th>Sl.No</th>
                  <th>Date</th>
                  <th>Region</th>
                  <th>Circle</th>
                  <th>Site</th>
                  <th>Node Name</th>
                  <th>Quantity</th>
                  <th>Activity Details</th>
                  <th>Site Category</th>
                  <th>Activity Category</th>
                  <th>Activity Code</th>
                  <th>Activity Type</th>
                  <th>Activity Owner</th>
                  <th>OEM/Vendor Name</th>
                  <th>MOP Required</th>
                  <th>MOP</th>
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
                    <td style={{ backgroundColor: ACTIVITY_CODE_BG[r.activityCode] || "transparent", }}>{idx + 1}</td>
                    <td style={{ backgroundColor: ACTIVITY_CODE_BG[r.activityCode] || "transparent", }}>{r._sheetDate || selectDate || "-"}</td>
                    <td style={{ backgroundColor: ACTIVITY_CODE_BG[r.activityCode] || "transparent", }}>{region}</td>
                    <td style={{ backgroundColor: ACTIVITY_CODE_BG[r.activityCode] || "transparent", }}>{circle}</td>
                    <td style={{ backgroundColor: ACTIVITY_CODE_BG[r.activityCode] || "transparent", }}>{site}</td>
                    <td className="daily-activity-input" style={{ backgroundColor: ACTIVITY_CODE_BG[r.activityCode] || "transparent", }} > {/* value={r.nodeName || ""} onChange={(e) => updateDailyRow(idx, "nodeName", e.target.value)}  */}
                      {r.nodeName || ""}
                    </td>
                    <td className="daily-activity-input" style={{ backgroundColor: ACTIVITY_CODE_BG[r.activityCode] || "transparent", }} > {/* value={r.quantity || ""} onChange={(e) => updateDailyRow(idx, "quantity", e.target.value)} */}
                      {r.quantity || ""}
                    </td>
                    <td className="daily-activity-input" style={{ backgroundColor: ACTIVITY_CODE_BG[r.activityCode] || "transparent", }} > {/*value={r.activityDetails || ""} onChange={(e) => updateDailyRow(idx, "activityDetails", e.target.value)} */}
                      {r.activityDetails || ""} - {r.notes || ""}
                    </td>

                    {/* Site Category dropdown */}
                    {/* <td>
                      <select className="daily-activity-select" value={siteConfig?.siteCategory || r.siteCategory} onChange={(e) => updateDailyRow(idx, "siteCategory", e.target.value)}>
                        <option value="Super Critical">Super Critical</option>
                        <option value="Critical">Critical</option>
                        <option value="Major">Major</option>
                      </select>
                    </td> */}
                    <td style={{ backgroundColor: ACTIVITY_CODE_BG[r.activityCode] || "transparent", }} >{siteConfig?.siteCategory || r.siteCategory}</td>

                    {/* Activity Type dropdown */}
                    <td
                      className="daily-activity-select"
                      value={r.activityCategory || "Minor"}
                      style={{ backgroundColor: ACTIVITY_CODE_BG[r.activityCode] || "transparent", }}
                      disabled
                    >
                      {r.activityCategory || "Minor"}
                    </td>

                    <td
                      className="daily-activity-select"
                      value={r.activityCode || "*"}
                      style={{ backgroundColor: ACTIVITY_CODE_BG[r.activityCode] || "transparent", }}
                      disabled
                    >
                      {r.activityCode || "*"}
                    </td>

                    <td
                      className="daily-activity-select"
                      value={r.activityType || ""}
                      style={{ backgroundColor: ACTIVITY_CODE_BG[r.activityCode] || "transparent", }}
                      disabled
                    >
                      {r.activityType || ""}
                    </td>

                    <td
                      className="daily-activity-select"
                      value={r.performBy || "In-House"}
                      style={{ backgroundColor: ACTIVITY_CODE_BG[r.activityCode] || "transparent", }}
                      disabled
                    >
                      {r.performBy || "In-House"}
                    </td>

                    <td
                      className="daily-activity-select"
                      value={r.vendor || "In-House"}
                      style={{ backgroundColor: ACTIVITY_CODE_BG[r.activityCode] || "transparent", }}
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
                      style={{ backgroundColor: ACTIVITY_CODE_BG[r.activityCode] || "transparent", }}
                      disabled
                    >
                      {r.mopRequired}
                    </td>

                    <td
                      style={{ backgroundColor: ACTIVITY_CODE_BG[r.activityCode] || "transparent", }}
                    >
                      {r.mopRequired === "Yes" ? (
                        <button
                        style={{ height:"fit-content", width:"100%", fontSize:"15px", padding:"2px 2px"}}
                          onClick={() => handleGenerateMOP(r)}
                        >
                          Generate MOP
                        </button>
                      ) : (
                        <span style={{ color: "#999" }}>N/A</span>
                      )}
                    </td>

                    <td
                      className="daily-activity-input"
                      value={r.approvalRequire || "No"}
                      style={{ backgroundColor: ACTIVITY_CODE_BG[r.activityCode] || "transparent", }}
                      disabled
                    >
                      {r.approvalRequire || "No"}
                    </td>

                    <td>
                      <textarea
                        className="daily-activity-input"
                        value={formatApproversFromArray(r.approvers)}
                        style={{ backgroundColor: ACTIVITY_CODE_BG[r.activityCode] || "transparent", width: "150px", height: "150px" }}
                        disabled
                      />
                    </td>

                    {/* Individual approvals – dynamic by max level */}
                    {headerLevels.map((level) => {
                      const rowLevels = Array.isArray(r.approvers)
                        ? r.approvers.map(a => a.level)
                        : [];

                      const hasLevel = rowLevels.includes(level);

                      return (
                        <td key={level} style={{ backgroundColor: ACTIVITY_CODE_BG[r.activityCode] || "transparent", }}>
                          {/* <select
                            className="daily-activity-select"
                            value={r.approvalStatusByLevel?.[level] || "NA"}
                            disabled={!hasLevel}
                            onChange={(e) => {
                              if (!hasLevel) return;

                              updateDailyRow(idx, "approvalStatusByLevel", {
                                ...(r.approvalStatusByLevel || {}),
                                [level]: e.target.value,
                              });
                              // setEditRowData({ ...(r.approvalStatusByLevel || {}), [level]: e.target.value });
                              setEditingRowDate(r._sheetDate);
                            }}
                            style={{ cursor: !hasLevel ? "not-allowed" : "pointer" }}
                          >
                            <option value="NA">NA</option>
                            <option value="Y">Y</option>
                            <option value="N">N</option>
                          </select> */}
                          {!hasLevel ? "NA" : r.approvalStatusByLevel?.[level] || "N"}
                        </td>
                      );
                    })}

                    <td
                      className="daily-activity-select"
                      value={r.crqType}
                      style={{ backgroundColor: ACTIVITY_CODE_BG[r.activityCode] || "transparent", }}
                      disabled
                    >
                      {/* <select
                        className="daily-activity-select"
                        value={r.crqType}
                        onChange={(e) => updateDailyRow(idx, "crqType", e.target.value)}
                      >
                        <option value="CRQ" disabled={!r.crRequired}>CRQ</option>
                        <option value="PE">PE</option>
                      </select> */}
                      {r.crqType}
                    </td>

                    {/* CRQ No input with suggestions */}
                    <td
                      className="daily-activity-input"
                      list={`crq-options-${idx}`}
                      value={r.crqNo || ""}
                      placeholder={r.crqType === "CRQ" ? "CRQ Number required" : "PE Number required"}
                      style={{ backgroundColor: ACTIVITY_CODE_BG[r.activityCode] || "transparent", }}
                      required={r.crqType === "CRQ"}
                      onChange={(e) => updateDailyRow(idx, "crqNo", e.target.value)}
                    >
                      {/* <datalist id={`crq-options-${idx}`}>
                        <option value="CRQ00000" />
                        <option value="PE" />
                      </datalist> */}
                      {r.crqNo || ""}
                    </td>

                    {/* Start/End time */}
                    <td className="daily-activity-input" type="time" value={r.activityStartTime || ""} onChange={(e) => updateDailyRow(idx, "activityStartTime", e.target.value)} style={{ backgroundColor: ACTIVITY_CODE_BG[r.activityCode] || "transparent", }}>{r.activityStartTime || ""}</td>
                    <td className="daily-activity-input" type="time" value={r.activityEndTime || ""} onChange={(e) => updateDailyRow(idx, "activityEndTime", e.target.value)} style={{ backgroundColor: ACTIVITY_CODE_BG[r.activityCode] || "transparent", }} >{r.activityEndTime || ""}</td>
                    {/* Delete */}
                    <td style={{ backgroundColor: ACTIVITY_CODE_BG[r.activityCode] || "transparent", }} >
                      <button
                        className="daily-activity-btn daily-activity-btn-secondary"
                        onClick={() => {
                          openEditModal(r, idx);
                          setEditingRowDate(r._sheetDate)
                        }}
                      >
                        Edit
                      </button>

                      <button
                        className="daily-activity-btn daily-activity-btn-danger"
                        onClick={() => deleteDailyRow(idx, r._sheetDate)}
                      >
                        Delete
                      </button>
                    </td>

                  </tr>
                ))}
              </tbody>

            </table>

            {editRowData && (
              <div className="modal-overlay" style={{ zIndex: "1000" }}>
                <div className="modal-box" style={{ overflowY: "auto", padding: "20px 20px" }}>
                  <h3>Edit Daily Activity — {editingRowDate}</h3>

                  <label>Node Name</label>
                  <input
                    className="daily-activity-input"
                    value={editRowData.nodeName}
                    onChange={(e) =>
                      setEditRowData({ ...editRowData, nodeName: e.target.value })
                    }
                    disabled
                  />

                  <label>Activity Details</label>
                  <input
                    className="daily-activity-input"
                    value={editRowData.activityDetails}
                    onChange={(e) =>
                      setEditRowData({ ...editRowData, activityDetails: e.target.value })
                    }
                    disabled
                  />

                  <label>CRQ/PE Type</label>
                  {/* <select
                    className="daily-activity-select"
                    value={editRowData.crqType}
                    onChange={(e) =>
                      setEditRowData({ ...editRowData, crqType: e.target.value })
                    }
                  >
                    <option value="CRQ" disabled={!editRowData.crRequired}>CRQ</option>
                    <option value="PE">PE</option>
                  </select> */}
                  <input
                    className="daily-activity-input"

                    value={editRowData.crqNo || ""}
                    placeholder={editRowData.crqType === "CRQ" ? "CRQ Number required" : "PE Number required"}
                    required={editRowData.crqType === "CRQ"}
                    onChange={(e) => setEditRowData({ ...editRowData, crqNo: e.target.value })}
                  />
                  <datalist>
                    <option value="CRQ00000" />
                    <option value="PE" />
                  </datalist>

                  {/* Individual approvals – row specific */}
                  <label>Approval Status by Level</label>

                  {Array.isArray(editRowData?.approvers) &&
                    editRowData.approvers.map(({ level }) => (
                      <div key={level} style={{ marginBottom: "8px" }}>
                        <label style={{ marginRight: "8px" }}>{level}</label>

                        <select
                          className="daily-activity-select"
                          value={editRowData.approvalStatusByLevel?.[level] || "N"}
                          onChange={(e) => {
                            const value = e.target.value;

                            setEditRowData((prev) => ({
                              ...prev,
                              approvalStatusByLevel: {
                                ...(prev.approvalStatusByLevel || {}),
                                [level]: value,
                              },
                            }));
                          }}
                        >
                          <option value="N">N</option>
                          <option value="Y">Y</option>
                          {/* <option value="NA">NA</option> */}
                        </select>
                      </div>
                    ))}

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
