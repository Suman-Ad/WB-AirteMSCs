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
  query,
  where
} from "firebase/firestore";
import { db } from "../firebase";
import "../assets/daily-activity.css";
import { region, siteList, siteIdMap } from "../config/siteConfigs.js";
import { ACTIVITY_MASTER, getApproversFromLevels } from "../config/activityMaster.js";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { App } from "antd";


/*
 PM Register Sheet
 - Admins and admin-assigned users can add/edit/upload/delete yearly PM schedules per site.
 - Stores per-site-year doc in 'pm_registers/{siteKey__YYYY}' with structure described below.
 - userData prop is used: userData?.uid, role, region, circle, site, siteId, name, designation ...
*/

/* Default equipment list (from you) */
// const DEFAULT_EQUIP_LIST = [
//   "ACS", "Air Conditioner", "BMS", "CCTV", "Comfort AC", "Diesel Generator", "Earth Pit",
//   "Exhust Fan", "FAS", "FSS", "HT Panel", "Inverter", "LT Panel", "PAS", "PFE", "SMPS",
//   "SMPS BB", "Solar System", "UPS", "UPS BB", "DCDB/ACDB", "Transformer"
// ];

/* default local site hierarchy fallback (used if assets_register not available) */
const DEFAULT_SITE_HIERARCHY = siteList;

/* months array for checkboxes */
const MONTHS = [
  { num: 1, label: "Jan" }, { num: 2, label: "Feb" }, { num: 3, label: "Mar" },
  { num: 4, label: "Apr" }, { num: 5, label: "May" }, { num: 6, label: "Jun" },
  { num: 7, label: "Jul" }, { num: 8, label: "Aug" }, { num: 9, label: "Sep" },
  { num: 10, label: "Oct" }, { num: 11, label: "Nov" }, { num: 12, label: "Dec" }
];

/* helper utilities */
const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);
const currentYear = () => new Date().getFullYear();
function makeSiteKey(region, circle, site) {
  return `${(region || "")}__${(circle || "")}__${(site || "")}`.replace(/\s+/g, "_");
}
function generateId() { return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`; }

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
      const [a, b] = p.split("-").map(x => parseInt(x, 10)).filter(n => !isNaN(n));
      if (!isNaN(a) && !isNaN(b)) {
        for (let k = Math.max(1, a); k <= Math.min(12, b); k++) out.add(k);
      }
    } else {
      const n = parseInt(p, 10);
      if (!isNaN(n) && n >= 1 && n <= 12) out.add(n);
    }
  });
  return Array.from(out).sort((a, b) => a - b);
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
  const [loading, setLoading] = useState(false);

  // selected area & year
  const initialRegion = userData?.region || Object.keys(DEFAULT_SITE_HIERARCHY)[0] || "";
  const [region, setRegion] = useState(initialRegion);
  const [circle, setCircle] = useState(userData?.circle || "");
  const [site, setSite] = useState(userData?.site || "");
  const [year, setYear] = useState(currentYear());

  // equipment list
  const [equipmentList, setEquipmentList] = useState([]);
  const [equipmentFloor, setEquipmentFloor] = useState([]);
  const [vendorList, setVendorList] = useState([]);

  // pm document (loaded for site+year)
  const [pmDoc, setPmDoc] = useState(() => emptyPMDoc(region, circle, site, year));
  const [pmLoading, setPmLoading] = useState(false);

  const [equipmentQtyMap, setEquipmentQtyMap] = useState({});

  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("");


  // permissions
  const isAdmin = userData?.role === "Admin" ||
    userData?.role === "Super Admin" ||
    userData?.designation === "Vertiv CIH" ||
    userData?.isAdminAssigned ||
    userData?.designation === "Vertiv ZM";
  const canEdit = isAdmin || userData?.designation === "Vertiv Site Infra Engineer";

  // const isDynamic = (entry) => entry.pmType === "Dynamic";

  // const addSchedule = (equipmentName, newEntry) => {
  //   setPmDoc(prev => ({
  //     ...prev,
  //     [equipmentName]: [...(prev[equipmentName] || []), newEntry]
  //   }));
  // };

  // UI states
  const [selectedEquipment, setSelectedEquipment] = useState("");
  useEffect(() => {
    if (equipmentList.length && !selectedEquipment) {
      setSelectedEquipment(equipmentList[0]);
    }
  }, [equipmentList]);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedEquipments, setExpandedEquipments] = useState({});

  function getActivityDetails(equipmentName, activityDescription) {
    const list =
      ACTIVITY_MASTER[equipmentName] ||
      ACTIVITY_MASTER.Other ||
      [];

    return list.find(
      a => a.activityDescription === activityDescription
    ) || null;
  }


  // // load site list from assets_register if available
  // useEffect(() => {
  //   if (!circle || !site) return;
  //   async function loadAssetsFlatData() {
  //     try {
  //       setLoading(true);

  //       const snap = await getDocs(collection(db, "assets_flat"));

  //       const equipSet = new Set();
  //       const vendorSet = new Set();

  //       snap.forEach(docSnap => {
  //         const d = docSnap.data();
  //         // 🔐 Admin / Super Admin → ALL sites
  //         if (isAdmin) {
  //           if (d.EquipmentCategory) equipSet.add(d.EquipmentCategory);
  //           if (d.AMC_Partner_Name) vendorSet.add(d.AMC_Partner_Name);
  //           return;
  //         }

  //         // 👤 Other users → EXISTING site-based logic
  //         if (
  //           d.Circle === circle &&
  //           d.UniqueCode === (userData?.siteId || site)
  //         ) {
  //           if (d.EquipmentCategory) equipSet.add(d.EquipmentCategory);
  //           if (d.AMC_Partner_Name) vendorSet.add(d.AMC_Partner_Name);
  //         }
  //       });

  //       setEquipmentList(Array.from(equipSet).sort());
  //       setVendorList(Array.from(vendorSet).sort());
  //       setLoading(false);
  //     } catch (e) {
  //       console.error("assets_flat load failed", e);
  //     }
  //   }

  //   loadAssetsFlatData();
  // }, [circle, site]);

  // load site list from assets_register with correct filtering
  useEffect(() => {
    if (!region || !circle || !site) return;

    async function loadAssetsFlatData() {
      try {
        setLoading(true);

        let q;

        // 🔐 Admin → filter by selected Region + Circle + Site
        if (isAdmin) {
          q = query(
            collection(db, "assets_flat"),
            where("Region", "==", region),
            where("Circle", "==", circle),
            where("UniqueCode", "==", siteIdMap[site])
          );
        } else {
          // 👤 Normal user → always their own site
          q = query(
            collection(db, "assets_flat"),
            where("Circle", "==", circle),
            where("UniqueCode", "==", siteIdMap[site])
          );
        }

        const snap = await getDocs(q);

        const equipSet = new Set();
        const equipQty = {};
        const vendorSet = new Set();
        const equipFloor = new Set();

        snap.forEach(docSnap => {
          const d = docSnap.data();

          if (d.EquipmentCategory) {
            equipSet.add(d.EquipmentCategory);
            equipQty[d.EquipmentCategory] =
              (equipQty[d.EquipmentCategory] || 0) + (Number(d.Qty) || 0);
          }

          if (d.Floor) {
            equipFloor.add(d.Floor);
          }
          if (d.AMC_Partner_Name) vendorSet.add(d.AMC_Partner_Name);
        });

        setEquipmentList(Array.from(equipSet).sort());
        setEquipmentFloor(Array.from(equipFloor).sort());
        setEquipmentQtyMap(equipQty);
        setVendorList(Array.from(vendorSet).sort());

        setLoading(false);
      } catch (e) {
        console.error("assets_flat load failed", e);
        setLoading(false);
      }
    }

    loadAssetsFlatData();
  }, [region, circle, site, isAdmin]);



  // When region/circle/site/year changes, load existing PM doc
  useEffect(() => {
    async function loadPM() {
      if (!region || !circle || !site || !year) {
        setPmDoc(emptyPMDoc(region, circle, site, year));
        return;
      }
      setLoading(true);
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
        setLoading(false);
      }
    }
    loadPM();
  }, [region, circle, site, year, userData?.uid]);

  // helpers to edit pmDoc state (local only until Save)
  // function ensureEquipmentSlot(equipmentName) {
  //   setPmDoc(prev => {
  //     const copy = { ...(prev || {}) };
  //     copy.equipmentSchedules = copy.equipmentSchedules || {};
  //     if (!Array.isArray(copy.equipmentSchedules[equipmentName])) copy.equipmentSchedules[equipmentName] = [];
  //     return copy;
  //   });
  // }

  function ensureEquipmentSlot(equipmentName) {
    setPmDoc(prev => {
      const copy = { ...prev };
      copy.equipmentSchedules ||= {};

      // ⛔ STOP if already exists
      if (copy.equipmentSchedules.hasOwnProperty(equipmentName)) {
        return copy;
      }

      // ✅ only create empty slot ONCE
      copy.equipmentSchedules[equipmentName] = [];
      return copy;
    });
  }

  // function addScheduleEntry(equipmentName) {
  //   setPmDoc(prev => {
  //     const copy = { ...(prev || {}) };
  //     copy.equipmentSchedules = copy.equipmentSchedules || {};
  //     const arr = Array.isArray(copy.equipmentSchedules[equipmentName]) ? [...copy.equipmentSchedules[equipmentName]] : [];
  //     arr.push({
  //       id: generateId(),
  //       pmType: "In-House", // or Vendor
  //       frequency: "monthly", // monthly | quarterly | half-yearly | yearly (informative)
  //       months: [1], // which months (1..12) this PM falls on
  //       dayOfMonth: 1,
  //       vendor: "",
  //       notes: ""
  //     });
  //     copy.equipmentSchedules[equipmentName] = arr;
  //     return copy;
  //   });
  // }

  // function addScheduleEntry(equipmentName, activityDescription) {
  //   const activity = getActivityDetails(equipmentName, activityDescription);

  //   if (!activity) return;

  //   setPmDoc(prev => {
  //     const copy = { ...prev };
  //     copy.equipmentSchedules ||= {};
  //     copy.equipmentSchedules[equipmentName] ||= [];

  //     copy.equipmentSchedules[equipmentName].push({
  //       id: generateId(),
  //       pmType: activity.activityDescription,

  //       // 🔽 activityMaster sync
  //       activityCategory: activity.activityCategory,
  //       activityCode: activity.activityCode,
  //       activityType: activity.activityType,
  //       avgMonthlyCount: activity.avgMonthlyCount,
  //       crRequired: activity.crRequired,
  //       crDaysBefore: activity.crDaysBefore,
  //       approvalLevel: activity.approvalLevel,
  //       approvers: activity.approvers || [],
  //       information: activity.information || "",

  //       // 🔽 PM specific
  //       frequency: "monthly",
  //       months: [1],
  //       dayOfMonth: 1,
  //       vendor: "",
  //       notes: ""
  //     });

  //     return copy;
  //   });
  // }

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


  function addScheduleEntry(equipmentName, activityDescription) {
    const activity = getActivityDetails(equipmentName, activityDescription);
    if (!activity) return;

    setPmDoc(prev => {
      const copy = { ...prev };
      copy.equipmentSchedules ||= {};

      const existing = copy.equipmentSchedules[equipmentName] || [];

      // 🚫 STOP if same activity already exists
      const alreadyExists = existing.some(
        e => e.pmType === activity.activityDescription
      );

      if (alreadyExists) {
        return copy; // ⛔ no duplicate, no re-render
      }

      const entry = {
        id: generateId(),
        pmType: activity.activityDescription,

        // 🔹 activity master
        activityCategory: activity.activityCategory,
        performBy: activity.performBy || "In-House",
        activityCode: activity.activityCode,
        mopRequired: activity.mopRequired || false,
        activityType: activity.activityType,
        avgMonthlyCount: activity.avgMonthlyCount,
        crRequired: activity.crRequired || false,
        crDaysBefore: activity.crDaysBefore,
        approvalLevel: activity.approvalLevel,
        approvalLevels: activity.approvalLevels,
        information: activity.information || "",
        quantity: equipmentQtyMap[equipmentName] || "",
        floor: "",

        // 🔹 schedule fields
        frequency: "monthly",
        months: Array.from({ length: 12 }, (_, i) => i + 1),
        dayOfMonth: 1,
        vendor: "",
        notes: ""
      };

      copy.equipmentSchedules[equipmentName] = [...existing, entry];
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

  function updateScheduleEntryFull(equipmentName, entryId, updates) {
    setPmDoc(prev => {
      const copy = { ...prev };
      copy.equipmentSchedules ||= {};

      const arr = (copy.equipmentSchedules[equipmentName] || []).map(e =>
        e.id === entryId ? { ...e, ...updates } : e
      );

      copy.equipmentSchedules[equipmentName] = arr;
      return copy;
    });
  }


  // function removeScheduleEntry(equipmentName, entryId) {
  //   setPmDoc(prev => {
  //     const copy = { ...(prev || {}) };
  //     copy.equipmentSchedules = copy.equipmentSchedules || {};
  //     const arr = Array.isArray(copy.equipmentSchedules[equipmentName]) ? [...copy.equipmentSchedules[equipmentName]] : [];
  //     copy.equipmentSchedules[equipmentName] = arr.filter(x => x.id !== entryId);
  //     return copy;
  //   });
  // }

  function removeScheduleEntry(equipmentName, entryId) {
    setPmDoc(prev => {
      const copy = { ...prev };
      copy.equipmentSchedules ||= {};

      const next = (copy.equipmentSchedules[equipmentName] || [])
        .filter(e => e.id !== entryId);

      if (next.length === 0) {
        delete copy.equipmentSchedules[equipmentName];
      } else {
        copy.equipmentSchedules[equipmentName] = next;
      }

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

  const parseExcel = async (file) => {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(worksheet);
  };

  // CSV upload handling
  async function handleFileUpload(file) {
    if (!file) return;
    if (!canEdit) {
      alert("No permission to upload.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadStatus("Reading file...");

    try {
      let rows = [];

      // ---- File parsing phase (20%) ----
      if (file.name.endsWith(".csv")) {
        const text = await file.text();
        rows = parseCSV(text);
      } else if (file.name.endsWith(".xlsx")) {
        rows = await parseExcel(file);
      } else {
        alert("Only CSV or Excel (.xlsx) allowed");
        return;
      }

      setUploadProgress(20);
      setUploadStatus("Processing rows...");

      // ---- Data processing phase (20 → 90%) ----
      setPmDoc((prev) => {
        const copy = { ...prev };
        copy.equipmentSchedules ||= {};

        rows.forEach((r, index) => {
          const percent = 20 + Math.round((index / rows.length) * 70);
          setUploadProgress(percent);

          const equip = (r.equipment || "").trim();
          if (!equip) return;

          copy.equipmentSchedules[equip] ||= [];

          const months = parseMonthsString(r.months || "");

          const activity = getActivityDetails(equip, r.pmType);

          const existingArr = copy.equipmentSchedules[equip];

          const existsIndex = existingArr.findIndex(
            (e) => e.pmType === (r.pmType || "Vendor PM")
          );

          const newEntry = {
            id: existsIndex >= 0 ? existingArr[existsIndex].id : generateId(),
            pmType: r.pmType || "Vendor PM",
            frequency: r.frequency || "monthly",
            months:
              months.length > 0
                ? months
                : Array.from({ length: 12 }, (_, i) => i + 1),
            dayOfMonth: parseInt(r.day || 1),
            vendor: r.vendor || "",
            notes: r.notes || "",


            activityCategory: activity.activityCategory,
            performBy: activity.performBy || "In-House",
            activityCode: activity.activityCode,
            mopRequired: activity.mopRequired || false,
            activityType: activity.activityType,
            avgMonthlyCount: activity.avgMonthlyCount,
            crRequired: activity.crRequired || false,
            crDaysBefore: activity.crDaysBefore,
            approvalLevel: activity.approvalLevel,
            approvalLevels: activity.approvalLevels,
            information: activity.information || "",
            quantity: equipmentQtyMap[equip] || "",
          };

          if (existsIndex >= 0) {
            existingArr[existsIndex] = {
              ...existingArr[existsIndex],
              ...newEntry,
            };
          } else {
            existingArr.push(newEntry);
          }
        });

        return copy;
      });

      setUploadProgress(100);
      setUploadStatus("Upload completed");

      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
        setUploadStatus("");
      }, 800);

    } catch (err) {
      console.error("Upload error:", err);
      alert("Upload failed. Check file format.");
      setUploading(false);
      setUploadProgress(0);
      setUploadStatus("");
    }
  }

  /* derived lists for selects */
  const regions = useMemo(() => Object.keys(hierarchy || {}), [hierarchy]);
  const circles = useMemo(() => (region && hierarchy[region]) ? Object.keys(hierarchy[region]) : [], [hierarchy, region]);
  const sites = useMemo(() => (region && circle && hierarchy[region] && hierarchy[region][circle]) ? hierarchy[region][circle] : [], [hierarchy, region, circle]);

  // protect non-admin users: if user is non-admin and has a site, lock region/circle/site to user's site
  useEffect(() => {
    if (!isAdmin) {
      if (userData?.region) setRegion(userData.region);
      if (userData?.circle) setCircle(userData.circle);
      if (userData?.site) setSite(userData.site);
    }
  }, [userData, isAdmin]);

  const genId = () =>
    `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const toggleEquipment = (equipmentName) => {
    setExpandedEquipments((prev) => ({
      ...prev,
      [equipmentName]: !prev[equipmentName],
    }));
  };

  const addScheduleForEquipment = (equipmentName, activityDescription) => {
    if (!canEdit) return;
    const activity = getActivityDetails(equipmentName, activityDescription);

    setPmDoc((prev) => {
      const copy = { ...(prev || {}) };

      copy.equipmentSchedules = { ...(copy.equipmentSchedules || {}) };

      const existing = copy.equipmentSchedules[equipmentName] || [];

      const newEntry = {
        id: generateId(),
        pmType: activity.activityDescription,

        // 🔹 activity master
        activityCategory: activity.activityCategory,
        performBy: activity.performBy || "In-House",
        activityCode: activity.activityCode,
        mopRequired: activity.mopRequired || false,
        activityType: activity.activityType,
        avgMonthlyCount: activity.avgMonthlyCount,
        crRequired: activity.crRequired || false,
        crDaysBefore: activity.crDaysBefore,
        approvalLevel: activity.approvalLevel,
        approvalLevels: activity.approvalLevels,
        information: activity.information || "",
        quantity: equipmentQtyMap[equipmentName] || "",

        // 🔹 schedule fields
        frequency: "monthly",
        months: Array.from({ length: 12 }, (_, i) => i + 1),
        dayOfMonth: 1,
        vendor: "",
        notes: ""
      };

      copy.equipmentSchedules[equipmentName] = [...existing, newEntry];

      return copy;
    });

    // auto expand equipment after adding
    setExpandedEquipments((prev) => ({
      ...prev,
      [equipmentName]: true,
    }));
  };

  const downloadExcel = () => {
    if (!pmDoc || !pmDoc.equipmentSchedules) {
      alert("No PM data to download");
      return;
    }

    const rows = [];

    Object.entries(pmDoc.equipmentSchedules).forEach(([equipment, entries]) => {
      (entries || []).forEach((entry) => {
        rows.push({
          Year: pmDoc.year,
          Region: pmDoc.region,
          Circle: pmDoc.circle,
          Site: pmDoc.site,
          "Site ID": siteIdMap[pmDoc.site] || "",
          Equipment: equipment,
          "Activity Type": entry.activityType || "",
          Activity: entry.pmType,
          Notes: entry.notes || "",
          "Activity Category": entry.activityCategory || "",
          "Perform By": entry.performBy || "",
          "Activity Code": entry.activityCode || "",
          "CRQ Required": entry.crRequired ? "Yes" : "No",
          "CRQ Days Before": entry.crDaysBefore || "",
          "MOP Required": entry.mopRequired ? "Yes" : "No",
          Frequency: entry.frequency,
          Months: (entry.months || []).join(","),
          Day: entry.dayOfMonth,
          Vendor: entry.vendor || "",
          Quantity: entry.quantity || "",
          ApprovalLevels: formatApproversFromArray(getApproversFromLevels(entry.approvalLevels || [])),
        });
      });
    });

    if (!rows.length) {
      alert("No PM schedules found to export");
      return;
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, "PM Register");

    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });

    const file = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    saveAs(
      file,
      `PM_Register_${pmDoc.site}_${pmDoc.year}.xlsx`
    );
  };

  const downloadAllSitePMExcel = async () => {
    try {
      setLoading(true);

      const snap = await getDocs(collection(db, "pm_registers"));

      if (snap.empty) {
        alert("No PM Register data found");
        return;
      }

      const rows = [];

      snap.forEach((docSnap) => {
        const data = docSnap.data();

        const {
          region,
          circle,
          site,
          year,
          equipmentSchedules = {},
        } = data;

        Object.entries(equipmentSchedules).forEach(
          ([equipment, entries]) => {
            (entries || []).forEach((entry) => {
              rows.push({
                Year: year,
                Region: region,
                Circle: circle,
                Site: site,
                Equipment: equipment,
                "Activity Type": entry.activityType || "",
                Activity: entry.pmType,
                Notes: entry.notes || "",
                "Activity Category": entry.activityCategory || "",
                "Perform By": entry.performBy || "",
                "Activity Code": entry.activityCode || "",
                "CRQ Required": entry.crRequired ? "Yes" : "No",
                "CRQ Days Before": entry.crDaysBefore || "",
                "MOP Required": entry.mopRequired ? "Yes" : "No",
                Frequency: entry.frequency,
                Months: (entry.months || []).join(","),
                Day: entry.dayOfMonth,
                Vendor: entry.vendor || "",
                Quantity: entry.quantity || "",
                ApprovalLevels: formatApproversFromArray(getApproversFromLevels(entry.approvalLevels || [])),
              });
            });
          }
        );
      });

      if (!rows.length) {
        alert("No PM schedules found to export");
        return;
      }

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(wb, ws, "All PM Schedules");

      const excelBuffer = XLSX.write(wb, {
        bookType: "xlsx",
        type: "array",
      });

      const file = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      saveAs(file, `ALL_SITES_PM_REGISTER.xlsx`);
    } catch (err) {
      console.error("All site PM download error:", err);
      alert("Failed to download PM register");
    } finally {
      setLoading(false);
    }
  };


  const buildExcelSafeName = (name) =>
    name.replace(/[^a-zA-Z0-9_]/g, "_");

  const downloadUploadTemplate = () => {
    const wb = XLSX.utils.book_new();

    // -------- Main Upload Sheet --------
    const template = [
      {
        equipment: "",
        pmType: "",
        frequency: "",
        months: "",
        day: "",
        vendor: "",
        notes: ""
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);

    // -------- Build Equipment + Activity Lists --------
    const equipmentList = Object.keys(ACTIVITY_MASTER);

    const listSheetData = [["Equipment"]];
    equipmentList.forEach(e => listSheetData.push([e]));

    const activitySheetData = [];

    equipmentList.forEach(equip => {
      const safeName = buildExcelSafeName(equip);
      activitySheetData.push([safeName]);

      ACTIVITY_MASTER[equip].forEach(act => {
        activitySheetData.push([act.activityDescription]);
      });

      activitySheetData.push([""]); // spacer
    });

    const listWs = XLSX.utils.aoa_to_sheet(listSheetData);
    const activityWs = XLSX.utils.aoa_to_sheet(activitySheetData);

    // -------- Create Workbook Sheets --------
    wb.SheetNames.push("Upload Format", "EquipmentList", "ActivityList");
    wb.Sheets["Upload Format"] = ws;
    wb.Sheets["EquipmentList"] = listWs;
    wb.Sheets["ActivityList"] = activityWs;

    // -------- Named Ranges for Excel --------
    wb.Workbook = { Names: [] };

    wb.Workbook.Names.push({
      Name: "EquipmentList",
      Ref: `EquipmentList!$A$2:$A$${equipmentList.length + 1}`
    });

    let rowCursor = 1;

    equipmentList.forEach(equip => {
      const safeName = buildExcelSafeName(equip);
      const start = rowCursor + 1;
      const end = start + ACTIVITY_MASTER[equip].length - 1;

      wb.Workbook.Names.push({
        Name: safeName,
        Ref: `ActivityList!$A$${start}:$A$${end}`
      });

      rowCursor = end + 1;
    });

    // -------- Data Validations --------
    ws["!dataValidation"] = [
      {
        type: "list",
        allowBlank: true,
        sqref: "A2:A1000",
        formulas: ["=EquipmentList"]
      },
      {
        type: "list",
        allowBlank: true,
        sqref: "B2:B1000",
        formulas: ["=INDIRECT(SUBSTITUTE(A2,\" \",\"_\"))"]
      }
    ];

    // -------- Export --------
    const excelBuffer = XLSX.write(wb, {
      bookType: "xlsx",
      type: "array"
    });

    const file = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    saveAs(file, isAdmin ? "PM_Register_Upload_Format.xlsx" : `${site}_PM_Register_Upload_Format.xlsx`);
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
              Fetching PM Templates…
            </div>
            <div style={{ fontSize: "12px", color: "#cbd5e1", marginTop: "4px" }}>
              Please wait
            </div>
          </div>
        </div>
      )}
      <div className="daily-activity-header">
        <h1 className="dashboard-header">
          <strong>📜 PM Register Sheet (Yearly Templates)</strong>
        </h1>
        <div className="daily-activity-subtitle">
          Create In-House (monthly) & Vendor (quarterly/half-year/yearly) PM schedules per site (recurring each year).
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <select className="daily-activity-select" value={region || ""} onChange={(e) => { setRegion(e.target.value); setCircle(""); setSite(""); }} disabled={!isAdmin && !!userData?.region}>
          <option value="">Select Region</option>
          {regions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        <select className="daily-activity-select" value={circle || ""} onChange={(e) => { setCircle(e.target.value); setSite(""); }} disabled={!region || (!isAdmin && !!userData?.circle)}>
          <option value="">Select Circle</option>
          {circles.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select className="daily-activity-select" value={site || ""} onChange={(e) => setSite(e.target.value)} disabled={!circle || (!isAdmin && !!userData?.site)}>
          <option value="">Select Site</option>
          {sites.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <input className="daily-activity-input" type="number" min="2000" max="2100" value={year} onChange={(e) => setYear(parseInt(e.target.value, 10) || currentYear())} style={{ width: 110 }} />

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

        <button
          className="daily-activity-btn daily-activity-btn-secondary"
          onClick={downloadExcel}
        >
          ⬇ Download Excel
        </button>

        <button
          className="daily-activity-btn daily-activity-btn-secondary"
          onClick={downloadAllSitePMExcel}
        // disabled={!isAdmin}
        >
          ⬇ Download All Sites PM Excel
        </button>

        <button className="daily-activity-btn daily-activity-btn-danger" onClick={deletePmDocFirestore} disabled={!canEdit}>
          Delete Template
        </button>

        <div>
          <button
            className="daily-activity-btn daily-activity-btn-secondary"
            onClick={downloadUploadTemplate}
          >
            ⬇ Download Upload Format
          </button>
          <label style={{ display: "inline-block", marginLeft: 8 }}>
            <input
              type="file"
              accept=".csv,.xlsx"
              style={{ display: "none" }}
              id="pm-upload"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileUpload(f);
                e.target.value = "";
              }}
            />
            <span
              className="daily-activity-btn daily-activity-btn-secondary"
              style={{ cursor: "pointer" }}
            >
              {uploading ? "Uploading…" : "Upload CSV / Excel"}
              {uploading && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 13, marginBottom: 4 }}>
                    {uploadStatus} ({uploadProgress}%)
                  </div>

                  <div
                    style={{
                      height: 8,
                      background: "#e5e7eb",
                      borderRadius: 6,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${uploadProgress}%`,
                        background: "linear-gradient(90deg,#38bdf8,#6366f1)",
                        transition: "width 0.2s ease",
                      }}
                    />
                  </div>
                </div>
              )}
            </span>
          </label>
        </div>
      </div>

      {/* PM Doc Editor */}
      <div className="chart-container" style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
        {pmLoading ? <div className="daily-activity-loading">Loading template…</div> : (
          <>
            <div style={{ marginBottom: 8, display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ fontWeight: 700 }}>{(pmDoc && pmDoc.site) ? `${pmDoc.region} / ${pmDoc.circle} / ${pmDoc.site} — ${pmDoc.year}` : "No template loaded"}</div>
              <div style={{ color: "#666" }}>Edit equipment schedules below. Click Save Template to persist to Save PM Resister.</div>
            </div>

            {/* equipment selection quick add */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <select className="daily-activity-select" value={selectedEquipment} onChange={(e) => setSelectedEquipment(e.target.value)}>
                {Array.from(new Set([...equipmentList, ...Object.keys(pmDoc.equipmentSchedules || {})])).map(eq => <option key={eq} value={eq}>{eq}{equipmentQtyMap[eq] ? ` (${equipmentQtyMap[eq]} units)` : ""}</option>)}
              </select>
              <button className="daily-activity-btn daily-activity-btn-secondary" onClick={() => ensureEquipmentSlot(selectedEquipment)} disabled={!canEdit}>Ensure Slot</button>
              <button
                className="daily-activity-btn daily-activity-btn-primary"
                disabled={!canEdit}
                onClick={() => {
                  const activities =
                    ACTIVITY_MASTER[selectedEquipment] ||
                    ACTIVITY_MASTER.Other ||
                    [];

                  if (!activities.length) {
                    alert("No activities defined for this equipment");
                    return;
                  }

                  addScheduleEntry(
                    selectedEquipment,
                    activities[0].activityDescription   // ✅ STRING
                  );
                }}
              >
                + Add Schedule Entry
              </button>

            </div>

            {/* equipment schedules list */}
            <div style={{ display: "grid", gap: 12 }}>
              {Object.keys(pmDoc.equipmentSchedules || {}).length === 0 ? <div className="daily-activity-empty">No equipment schedules. Use 'Ensure Slot' and 'Add Schedule Entry' or upload CSV.</div> : (
                Object.keys(pmDoc.equipmentSchedules || {}).map(equipmentName => {
                  const entries = Array.isArray(pmDoc.equipmentSchedules[equipmentName]) ? pmDoc.equipmentSchedules[equipmentName] : [];
                  return (
                    <div className="child-container" key={equipmentName} style={{ border: "1px solid #f0f0f0", padding: 10, borderRadius: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            cursor: "pointer",
                            background: "#f0f2f5",
                            padding: "8px 10px",
                            borderRadius: 6,
                            marginTop: 10,
                          }}
                          onClick={() => toggleEquipment(equipmentName)}
                        >
                          <strong>{equipmentName} - {`${entries.length} Activity Scheduled`} </strong>

                          <span style={{ fontSize: 14 }}>
                            {expandedEquipments[equipmentName] ? "▼" : "▶"}
                          </span>
                        </div>

                        <div style={{ display: "flex", gap: 8 }}>
                          {/* <button className="daily-activity-btn daily-activity-btn-secondary" onClick={() => ensureEquipmentSlot(equipmentName)} disabled={!canEdit} style={{ padding: "2px 2px", height: "fit-content" }}>Ensure</button> */}
                          <p
                            className="daily-activity-btn"
                            onClick={() => addScheduleForEquipment(equipmentName, (ACTIVITY_MASTER[equipmentName] || ACTIVITY_MASTER.Other || [])[0]?.activityDescription)}
                            disabled={!canEdit}
                          >
                            ➕ Add Schedule
                          </p>
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

                      {expandedEquipments[equipmentName] && (
                        <div className="chart-container" style={{ display: "grid", gap: 12 }}>
                          {entries.length === 0 && <div style={{ color: "#666" }}>No entries for this equipment</div>}
                          {entries.map((entry, idx) => (
                            <div key={entry.id} style={{ borderTop: "1px dashed #eee", paddingTop: 8 }}>
                              <b>Entry #{idx + 1}</b>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                <label style={{ minWidth: 110 }}>
                                  Activity Name:
                                  <select
                                    className="daily-activity-select"
                                    value={entry.pmType || ""}
                                    disabled={!canEdit}
                                    onChange={(e) => {
                                      const activity = getActivityDetails(equipmentName, e.target.value);
                                      if (!activity) return;

                                      updateScheduleEntryFull(equipmentName, entry.id, {
                                        pmType: activity.activityDescription,
                                        activityCategory: activity.activityCategory,
                                        activityCode: activity.activityCode,
                                        activityType: activity.activityType,
                                        avgMonthlyCount: activity.avgMonthlyCount,
                                        crRequired: activity.crRequired,
                                        crDaysBefore: activity.crDaysBefore,
                                        approvalLevel: activity.approvalLevel,
                                        approvalLevels: activity.approvalLevels,
                                        information: activity.information || "",
                                        performBy: activity.performBy || "In-House",
                                        mopRequired: activity.mopRequired || false,
                                        approvalLevels: activity.approvalLevels
                                      });
                                    }}

                                  >
                                    {(ACTIVITY_MASTER[equipmentName] || ACTIVITY_MASTER.Other || []).map(a => (
                                      <option key={a.activityDescription} value={a.activityDescription}>
                                        {a.activityDescription}
                                      </option>
                                    ))}
                                  </select>

                                </label>

                                <label>Quantity: <input type="text" className="daily-activity-input" value={entry.quantity || equipmentQtyMap[equipmentName] || ""} disabled /></label>

                                <label style={{ minWidth: 160 }}>
                                  Frequency:
                                  <select className="daily-activity-select" value={entry.frequency || "monthly"}
                                    // onChange={(e) => updateScheduleEntry(equipmentName, entry.id, "frequency", e.target.value)} disabled={!canEdit}>
                                    onChange={(e) => {
                                      const freq = e.target.value;

                                      const months =
                                        freq === "monthly" ? Array.from({ length: 12 }, (_, i) => i + 1) :
                                          freq === "quarterly" ? [1, 4, 7, 10] :
                                            freq === "half-yearly" ? [1, 7] :
                                              [1];

                                      updateScheduleEntryFull(equipmentName, entry.id, {
                                        frequency: freq,
                                        months
                                      });
                                    }}

                                    disabled={!canEdit}
                                  >

                                    <option value="monthly">Monthly</option>
                                    <option value="quarterly">Quarterly</option>
                                    <option value="half-yearly">Half-Yearly</option>
                                    <option value="yearly">Yearly</option>
                                  </select>
                                </label>

                                <label>
                                  Day:
                                  <input type="number" className="daily-activity-input" min="1" max="31" value={entry.dayOfMonth || 1}
                                    // onChange={(e) => updateScheduleEntry(equipmentName, entry.id, "dayOfMonth", Math.max(1, Math.min(31, parseInt(e.target.value || "1", 10))))} disabled={!canEdit}
                                    onChange={(e) =>
                                      updateScheduleEntryFull(equipmentName, entry.id, {
                                        dayOfMonth: Math.max(1, Math.min(31, Number(e.target.value)))
                                      })
                                    }
                                  />
                                </label>

                                <label>
                                  Vendor:
                                  <select
                                    className="daily-activity-select"
                                    value={entry.vendor || ""}
                                    // onChange={(e) =>
                                    //   updateScheduleEntry(equipmentName, entry.id, "vendor", e.target.value)
                                    // }
                                    onChange={(e) =>
                                      updateScheduleEntryFull(equipmentName, entry.id, {
                                        vendor: e.target.value
                                      })
                                    }

                                    disabled={!canEdit}
                                  >
                                    <option value="">Select Vendor</option>
                                    {vendorList.map(v => (
                                      <option key={v} value={v}>{v}</option>
                                    ))}
                                  </select>
                                </label>

                                <label>
                                  Floor:
                                  <select
                                    className="daily-activity-select"
                                    value={entry.floor || ""}
                                    // onChange={(e) =>
                                    //   updateScheduleEntry(equipmentName, entry.id, "vendor", e.target.value)
                                    // }
                                    onChange={(e) =>
                                      updateScheduleEntryFull(equipmentName, entry.id, {
                                        floor: e.target.value
                                      })
                                    }

                                    disabled={!canEdit}
                                  >
                                    <option value="">Select Floor</option>
                                    {equipmentFloor.map(v => (
                                      <option key={v} value={v}>{v}</option>
                                    ))}
                                  </select>
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
                                          updateScheduleEntry(equipmentName, entry.id, "months", Array.from(next).sort((a, b) => a - b));
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
                                <textarea placeholder="Notes / instructions" className="daily-activity-input" value={entry.notes || ""}
                                  // onChange={(e) => updateScheduleEntry(equipmentName, entry.id, "notes", e.target.value)} disabled={!canEdit} 
                                  onChange={(e) =>
                                    updateScheduleEntryFull(equipmentName, entry.id, {
                                      notes: e.target.value
                                    })
                                  }
                                />
                              </div>
                              <div style={{ marginTop: 8 }}>
                                <label style={{ fontSize: 12, color: "#666", display: "block" }}>
                                  Approvers
                                </label>
                                <textarea
                                  className="daily-activity-input"
                                  value={formatApproversFromArray(getApproversFromLevels(entry.approvalLevels || []))}
                                  disabled
                                  rows={3}
                                />
                              </div>
                              <div style={{ marginTop: 8 }}>
                                <label style={{ fontSize: 12, color: "#666", display: "block" }}>
                                  Actvivity Information
                                </label>
                                <p
                                  className="daily-activity-input"
                                  style={{ minHeight: 60, whiteSpace: "pre-wrap" }}
                                  disabled
                                  rows={3}
                                >
                                  Activity Code - {entry.activityCode || ""}{"\n"}
                                  Activity Type - {entry.activityType || ""}{"\n"}
                                  Activity Category - {entry.activityCategory || ""}{"\n"}
                                  Perform By - {entry.performBy || ""}{"\n"}
                                  MOP Required - {entry.mopRequired ? "Yes" : "No"}{"\n"}
                                  Average Monthly Count - {entry.avgMonthlyCount || "N/A"}{"\n"}
                                  CR Required - {entry.crRequired ? "Yes" : "No"}{"\n"}
                                  {entry.crRequired ? `CR Days Before - ${entry.crDaysBefore || "N/A"}` : ""}{"\n"}
                                  Approval Level - {entry.approvalLevel || "N/A"}{"\n"}
                                  {entry.information || ""}
                                </p>
                              </div>

                            </div>
                          ))}
                        </div>
                      )}
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
