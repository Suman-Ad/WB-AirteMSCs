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
import { Link, useNavigate } from "react-router-dom";
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


const DEFAULT_EQUIP_LIST = [
  "ACS", "Air Conditioner", "BMS", "CCTV", "Comfort AC", "Diesel Generator", "Earth Pit", "Exhust Fan",
  "FAS", "FSS", "HT Panel", "Inverter", "LT Panel", "PAS", "PFE", "SMPS", "SMPS BB", "Solar System",
  "UPS", "UPS BB", "DCDB/ACDB", "Transformer"
];

const FREQUENCIES = ["monthly", "bi-monthly", "quarterly", "half-yearly", "yearly"];

/* months array for checkboxes */
const MONTHS = [
  { num: 1, label: "Jan" }, { num: 2, label: "Feb" }, { num: 3, label: "Mar" },
  { num: 4, label: "Apr" }, { num: 5, label: "May" }, { num: 6, label: "Jun" },
  { num: 7, label: "Jul" }, { num: 8, label: "Aug" }, { num: 9, label: "Sep" },
  { num: 10, label: "Oct" }, { num: 11, label: "Nov" }, { num: 12, label: "Dec" }
];

function pad2(n) { return n < 10 ? `0${n}` : `${n}`; }
function todayISO() { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function siteDocId(region, circle, site, year) { return `${(region || "")}_${(circle || "")}_${(site || "")}_${year}`.replace(/\s+/g, "_"); }
function pmDocId(region, circle, site, year) { return `${(region || "")}${"__"}${(circle || "")}${"__"}${(site || "")}${"__"}${year}`.replace(/\s+/g, "_"); }
function genId() { return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }
function monthOfISO(iso) { if (!iso) return null; const p = iso.split("-"); return parseInt(p[1], 10); }
function dayOfISO(iso) { if (!iso) return null; const p = iso.split("-"); return parseInt(p[2], 10); }

const isAdminAssignmentValid = (userData) => {
  if (!userData?.isAdminAssigned) return false;
  if (!userData?.adminAssignFrom || !userData?.adminAssignTo) return false;

  const today = new Date();
  const from = new Date(userData.adminAssignFrom);
  const to = new Date(userData.adminAssignTo);

  return today >= from && today <= to;
};

const DEFAULT_MANUAL_META = {
  activityCategory: "",
  activityType: "",
  activityCode: "",
  activityTime: "",
  performBy: "",
  mopRequired: false,
  crRequired: false,
  crDaysBefore: 0,
  approvalLevel: "",
  approvalLevels: [],
  information: "",
};

const REQUIRED_DYNAMIC_META_FIELDS = [
  "activityCategory",
  "activityType",
  "activityCode",
  "activityTime",
  "performBy",
];


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

  const navigate = useNavigate();

  const getFirstDayOfMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`;
  };

  const getLastDayOfMonth = () => {
    const d = new Date();
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(lastDay)}`;
  };

  // daily sheet
  const [dateFrom, setDateFrom] = useState(getFirstDayOfMonth());
  const [dateTo, setDateTo] = useState(getLastDayOfMonth());
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
  const isAssignedUser = userData?.isAdminAssigned && isAdminAssignmentValid(userData);
  const canEdit = isAdmin || isAssignedUser || isSuperAdmin || userData?.designation === "Vertiv CIH" || userData?.designation === "Vertiv ZM" || userData?.designation === "Vertiv Site Infra Engineer";

  // equipment list
  const [equipmentList, setEquipmentList] = useState([]);
  const [equipmentFloor, setEquipmentFloor] = useState([]);
  const [vendorList, setVendorList] = useState([]);
  const [equipmentQtyMap, setEquipmentQtyMap] = useState({});

  const [dynamicEquip, setDynamicEquip] = useState("");
  const [othersDynamicEquip, setOthersDynamicEquip] =
    useState("");
  const [othersDynamicActivity, setOthersDynamicActivity] =
    useState("");
  const [dynamicActivity, setDynamicActivity] =
    useState("");

  const [vendorName, setVendorName] = useState("");
  const [vendorNameInHouse, setVendorNameInHouse] =
    useState("");
  const [vendorNameOthers, setVendorNameOthers] =
    useState("");

  const [siteConfig, setSiteConfig] = useState({});
  const siteKey = site?.toUpperCase();

  const [manualMeta, setManualMeta] = useState(
    DEFAULT_MANUAL_META
  );

  /*
   * First resolve the selected master metadata.
   */
  const selectedDynamicMeta = useMemo(() => {
    const activities =
      ACTIVITY_MASTER[dynamicEquip] ||
      ACTIVITY_MASTER["Others"] ||
      [];

    return activities.find(
      item =>
        item.activityDescription === dynamicActivity
    );
  }, [dynamicEquip, dynamicActivity]);

  /*
   * Resolve activity description separately.
   */
  const resolvedDynamicActivityDetails = useMemo(() => {
    if (!dynamicActivity) return "";

    if (dynamicActivity === "Others") {
      return othersDynamicActivity.trim();
    }

    return dynamicActivity.trim();
  }, [dynamicActivity, othersDynamicActivity]);

  const missingDynamicMetaFields = useMemo(() => {
    if (!dynamicActivity) return [];

    return REQUIRED_DYNAMIC_META_FIELDS.filter(
      field => {
        /*
         * For a normal master activity, check the master value first.
         */
        if (
          dynamicActivity !== "Others" &&
          selectedDynamicMeta
        ) {
          const masterValue =
            selectedDynamicMeta[field];

          if (
            masterValue !== undefined &&
            masterValue !== null &&
            String(masterValue).trim() !== ""
          ) {
            return false;
          }
        }

        /*
         * The master value is unavailable, so check
         * whether the user supplied a manual value.
         */
        const manualValue = manualMeta[field];

        return (
          manualValue === undefined ||
          manualValue === null ||
          String(manualValue).trim() === ""
        );
      }
    );
  }, [
    dynamicActivity,
    selectedDynamicMeta,
    manualMeta,
  ]);

  const isManualMetaRequired =
    Boolean(dynamicActivity) &&
    (
      dynamicActivity === "Others" ||
      !selectedDynamicMeta ||
      missingDynamicMetaFields.length > 0
    );

  const resolvedDynamicMeta = useMemo(() => {
    const masterMeta = selectedDynamicMeta || {};

    const resolveTextValue = (
      field,
      fallback = ""
    ) => {
      const masterValue = masterMeta[field];

      if (
        masterValue !== undefined &&
        masterValue !== null &&
        String(masterValue).trim() !== ""
      ) {
        return masterValue;
      }

      const manualValue = manualMeta[field];

      if (
        manualValue !== undefined &&
        manualValue !== null &&
        String(manualValue).trim() !== ""
      ) {
        return manualValue;
      }

      return fallback;
    };

    const hasMasterField = field =>
      Object.prototype.hasOwnProperty.call(
        masterMeta,
        field
      );

    return {
      activityDescription:
        resolvedDynamicActivityDetails,

      activityCategory: resolveTextValue(
        "activityCategory"
      ),

      activityType: resolveTextValue(
        "activityType"
      ),

      activityCode: resolveTextValue(
        "activityCode"
      ),

      activityTime: resolveTextValue(
        "activityTime"
      ),

      performBy: resolveTextValue(
        "performBy"
      ),

      mopRequired: hasMasterField("mopRequired")
        ? Boolean(masterMeta.mopRequired)
        : Boolean(manualMeta.mopRequired),

      crRequired: hasMasterField("crRequired")
        ? Boolean(masterMeta.crRequired)
        : Boolean(manualMeta.crRequired),

      crDaysBefore:
        hasMasterField("crDaysBefore") &&
          masterMeta.crDaysBefore !== null
          ? Number(masterMeta.crDaysBefore || 0)
          : Number(manualMeta.crDaysBefore || 0),

      approvalLevel: resolveTextValue(
        "approvalLevel",
        "NA"
      ),

      approvalLevels:
        Array.isArray(masterMeta.approvalLevels) &&
          masterMeta.approvalLevels.length > 0
          ? masterMeta.approvalLevels
          : Array.isArray(manualMeta.approvalLevels)
            ? manualMeta.approvalLevels
            : [],

      information: resolveTextValue(
        "information"
      ),

      siteCategory: resolveTextValue(
        "siteCategory",
        siteConfig?.siteCategory || "Major"
      ),

      metadataSource:
        selectedDynamicMeta
          ? missingDynamicMetaFields.length > 0
            ? "ACTIVITY_MASTER_WITH_MANUAL_FIELDS"
            : "ACTIVITY_MASTER"
          : "MANUAL",
    };
  }, [
    selectedDynamicMeta,
    manualMeta,
    resolvedDynamicActivityDetails,
    missingDynamicMetaFields,
    siteConfig?.siteCategory,
  ]);

  const hasMasterMopRequired =
    Boolean(selectedDynamicMeta) &&
    Object.prototype.hasOwnProperty.call(
      selectedDynamicMeta,
      "mopRequired"
    );

  const hasMasterCrRequired =
    Boolean(selectedDynamicMeta) &&
    Object.prototype.hasOwnProperty.call(
      selectedDynamicMeta,
      "crRequired"
    );

  const approvalLevels = [
    "Level-1",
    "Level-2",
    "Level-3",
    "Level-4",
    "Level-5",
    "Level-6",
    "Level-7",
  ];

  const toggleApprovalLevel = (level) => {
    setManualMeta((prev) => ({
      ...prev,
      approvalLevels: prev.approvalLevels.includes(level)
        ? prev.approvalLevels.filter((l) => l !== level)
        : [...prev.approvalLevels, level],
    }));
  };

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
      approvalStatusByLevel: normalizeApprovalStatusByLevel(editRowData),
      activityTime: editRowData.activityTime || "Day", // default to "Day" if not set
      floor: editRowData.floor || "NA",
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

          if (d.Floor) equipFloor.add(d.Floor);
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

    fetchConfig();
    loadAssetsFlatData();
  }, [region, circle, site, isAdmin]);


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

  // apply quick frequency -> months helper (monthly/quarterly/half/yearly)
  function applyFrequencyToEntry(entryId, equipmentName, frequency, startMonth = 1) {
    const months = [];
    if (frequency === "monthly") {
      for (let m = 1; m <= 12; m++) months.push(m);
    } else if (frequency === "bi-monthly") {
      for (let m = startMonth; m <= 12; m += 2) months.push(m);
    } else if (frequency === "quarterly") {
      for (let m = startMonth; m <= 12; m += 3) months.push(m);
    } else if (frequency === "half-yearly") {
      months.push(startMonth);
      const other = ((startMonth + 6 - 1) % 12) + 1;
      if (!months.includes(other)) months.push(other);
    } else if (frequency === "yearly") {
      months.push(startMonth);
    }
    updateSchedule(equipmentName, entryId, "months", months);
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
              rowId:
                entry.rowId ||
                `${siteId}_${date}_${entry.id || genId()}`,
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
              activityTime: entry.activityTime || "Day", // Day / Night
              floor: entry.floor || "",
              mopDocument: null,
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
    const generatedMop = getMopByActivity(
      row,
      userData,
      siteConfig
    );

    if (!generatedMop) {
      alert("MOP format not found for this activity");
      return;
    }

    // Open saved MOP when it exists; otherwise use master template.
    const mop = row.mopDocument?.data
      ? JSON.parse(JSON.stringify(row.mopDocument.data))
      : generatedMop;

    const sheetDate = row._sheetDate;

    if (!sheetDate) {
      alert("Activity date not found. Cannot open MOP.");
      return;
    }

    const sheetId = `${siteId || userData?.siteId
      }_${sheetDate}`.replace(/\s+/g, "_");

    navigate("/mop-preview", {
      state: {
        mop,
        hardCodedMop: generatedMop,
        sourceRow: row,
        sheetId,
        rowId: row.rowId || null,
        createdFromPmId: row.createdFromPmId || null,
        mode: "edit",
        returnTo: "/daily-activity-manage",
      },
    });
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

      {(userData?.role === "Admin" || userData?.role === "Super Admin" || isAssignedUser || userData.designation === "Vertiv CIH" || userData.designation === "Vertiv ZM" || userData.designation === "Vertiv Site Infra Engineer") && (
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
                              style={{ cursor: "pointer", color: "#fff", borderRadius: "5px", borderBottom: "1px solid #fff", fontSize: "12px" }}
                              onMouseMove={(e) => e.currentTarget.style.backgroundColor = "#54a6bb"}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ""}
                            >
                              {idx + 1}) {entry.pmType}
                              <br />
                              (
                              {entry.notes || "No notes"} - {formatSchedule(entry)}
                              ) {isEntryToggeled[`${eq}_${idx}`] ? "▶" : "▼"}
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
                                    <label style={{ fontSize: window.innerWidth > 512 ? "30px" : "15px", color: "#0c145a" }}><strong>Activity Description</strong></label>
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
                                  <div style={{ fontSize: window.innerWidth > 612 ? "40px" : "12px" }}>
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
                                </div>

                                <div>
                                  {/* Frequency */}
                                  <div>
                                    <label style={{ fontSize: 12, color: "#666" }}>Frequency</label>
                                    <select className="daily-activity-select" value={entry.frequency || "monthly"}
                                      onChange={(e) => {
                                        const freq = e.target.value;

                                        const months =
                                          freq === "monthly" ? Array.from({ length: 12 }, (_, i) => i + 1) :
                                            freq === "bi-monthly" ? [1, 3, 5, 7, 9, 11] :
                                              freq === "quarterly" ? [1, 4, 7, 10] :
                                                freq === "half-yearly" ? [1, 7] :
                                                  [1];

                                        updateScheduleEntryFull(eq, entry.id, {
                                          frequency: freq,
                                          months
                                        });
                                      }}
                                      disabled={!canEdit}>
                                      {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                                    </select>
                                  </div>

                                  {/* Months */}
                                  <div>
                                    <label style={{ fontSize: 12, color: "#666" }}>Months (comma separated)</label>
                                    <input className="daily-activity-input" value={(entry.months || []).join(",")} onChange={(e) => {
                                      const months = (e.target.value || "").split(/[,\s]+/).map(x => parseInt(x, 10)).filter(n => !isNaN(n) && n >= 1 && n <= 12);
                                      updateSchedule(eq, entry.id, "months", Array.from(new Set(months)).sort((a, b) => a - b));
                                    }} disabled={!canEdit} />
                                    <div style={{ fontSize: 11, color: "#666" }}>{(entry.months || []).length ? `Months: ${(entry.months || []).join(",")}` : "No months set"}</div>

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
                                              updateSchedule(eq, entry.id, "months", Array.from(next).sort((a, b) => a - b));
                                            }}
                                            type="button"
                                            style={{ padding: "6px 8px", borderRadius: 6 }}
                                          >
                                            {m.label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    <button className="daily-activity-btn daily-activity-btn-secondary" onClick={() => applyFrequencyToEntry(entry.id, eq, entry.frequency || "monthly", (entry.months && entry.months[0]) || 1)} disabled={!canEdit}>Apply Frequency → Months</button>

                                  </div>

                                  {/* Day */}
                                  <div style={{ marginBottom: 6 }}>
                                    <label style={{ display: "block", fontSize: 12, color: "#666" }}>Day (1-31)</label>
                                    <input type="number" className="daily-activity-input" min="1" max="31" value={entry.dayOfMonth || 1} onChange={(e) => updateSchedule(eq, entry.id, "dayOfMonth", Math.max(1, Math.min(31, parseInt(e.target.value || "1", 10))))} disabled={!canEdit} />
                                  </div>
                                  <p>
                                    <label style={{ fontSize: 12, color: "#666" }}>Location: </label>
                                    <input type="text" className="daily-activity-input" value={entry.floor || ""} onChange={(e) => updateSchedule(eq, entry.id, "floor", e.target.value)} disabled={!canEdit} />
                                  </p>
                                </div>
                                <div>
                                  <label>Quantity: <input type="text" className="daily-activity-input" value={entry.quantity || ""} onChange={(e) => updateSchedule(eq, entry.id, "quantity", e.target.value)} /></label>

                                  <label style={{ fontSize: 12, color: "#666" }}>Vendor Name: </label>
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
                                    <input type="text" className="daily-activity-input" value={entry.notes || ""} onChange={(e) => updateSchedule(eq, entry.id, "notes", e.target.value)} disabled={!canEdit} />
                                  </p>
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
                                  <div style={{ textAlign: "right" }}>
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

      {/* Add Dynamic Activity */}
      <div className="child-container" style={{ marginBottom: 12, border: "1px dashed #ccc", padding: 10 }}>
        <h4>➕ Add Dynamic Activity (Site User)</h4>

        {/* Date Selection */}
        <label>Select Date:</label>
        <input
          type="date"
          className="daily-activity-date-picker"
          value={selectDate}
          onChange={(e) => setSelectDate(e.target.value)}
        />

        {/* Equipment Name */}
        <label>Equipment Name:</label>
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
          <option value="ACDB/DCDB">ACDB/DCDB</option>
          <option value="Rack Power Tapping">Rack Power Tapping</option>
          <option value="DR Test Activity">DR Test Activity</option>
          <option value="Others" >Others</option>
        </select>

        {/* Other Equipment Name */}
        {dynamicEquip === "Others" && (
          <>
            <label>Other Equipment Name:</label>
            <input
              type="text"
              className="daily-activity-input"
              placeholder="Enter Equipment Name"
              value={othersDynamicEquip}
              onChange={(e) => setOthersDynamicEquip(e.target.value)}
            />
          </>

        )}

        {/* Activity */}
        {dynamicEquip && (
          <>
            <label>Activity Details</label>
            <select
              className="daily-activity-select"
              value={dynamicActivity}
              onChange={(e) => setDynamicActivity(e.target.value)}
              style={{ marginLeft: 8 }}
            >
              <option value="">Select Activity</option>
              {(ACTIVITY_MASTER[dynamicEquip] || ACTIVITY_MASTER["Others"] || []).map(a => (
                <option key={a.activityDescription} value={a.activityDescription}>{a.activityDescription}</option>
              ))}
              <option value="Others">Others</option>
            </select>
          </>
        )}

        {/* Other Activity Details */}
        {dynamicActivity === "Others" && (
          <>
            <label>Other Activity Details:</label>
            <input
              type="text"
              className="daily-activity-input"
              placeholder="Enter Activity Details"
              value={othersDynamicActivity}
              onChange={(e) => setOthersDynamicActivity(e.target.value)}
            />
          </>
        )}

        {isManualMetaRequired && (
          <div className="dynamic-meta-panel">
            <h4>Activity Metadata</h4>

            {(
              !selectedDynamicMeta?.activityCategory ||
              dynamicActivity === "Others"
            ) && (
                <label>
                  Activity Category

                  <select
                    className="daily-activity-select"
                    value={manualMeta.activityCategory}
                    onChange={(event) =>
                      setManualMeta(previous => ({
                        ...previous,
                        activityCategory: event.target.value,
                      }))
                    }
                  >
                    <option value="">
                      Select Activity Category
                    </option>

                    <option value="Super Critical">
                      Super Critical
                    </option>

                    <option value="Major">Major</option>
                    <option value="Minor">Minor</option>
                    <option value="PM">PM</option>
                    <option value="CM">CM</option>
                    <option value="Breakdown">
                      Breakdown
                    </option>
                  </select>
                </label>
              )}

            {(
              !selectedDynamicMeta?.activityType ||
              dynamicActivity === "Others"
            ) && (
                <label>
                  Activity Type

                  <input
                    className="daily-activity-input"
                    value={manualMeta.activityType}
                    placeholder="Enter activity type"
                    onChange={(event) =>
                      setManualMeta(previous => ({
                        ...previous,
                        activityType: event.target.value,
                      }))
                    }
                  />
                </label>
              )}

            {(
              !selectedDynamicMeta?.activityCode ||
              dynamicActivity === "Others"
            ) && (
                <label>
                  Activity Code

                  <select
                    className="daily-activity-select"
                    value={manualMeta.activityCode}
                    onChange={(event) =>
                      setManualMeta(previous => ({
                        ...previous,
                        activityCode: event.target.value,
                      }))
                    }
                  >
                    <option value="">
                      Select Activity Code
                    </option>
                    <option value="RED">RED</option>
                    <option value="AMBER">AMBER</option>
                    <option value="GREEN">GREEN</option>
                    <option value="BLUE">BLUE</option>
                  </select>
                </label>
              )}

            {(
              !selectedDynamicMeta?.activityTime ||
              dynamicActivity === "Others"
            ) && (
                <label>
                  Activity Time

                  <select
                    className="daily-activity-select"
                    value={manualMeta.activityTime}
                    onChange={(event) =>
                      setManualMeta(previous => ({
                        ...previous,
                        activityTime: event.target.value,
                      }))
                    }
                  >
                    <option value="">
                      Select Activity Time
                    </option>
                    <option value="Day">Day</option>
                    <option value="Night">Night</option>
                  </select>
                </label>
              )}

            {(
              !selectedDynamicMeta?.performBy ||
              dynamicActivity === "Others"
            ) && (
                <label>
                  Perform By

                  <input
                    className="daily-activity-input"
                    value={manualMeta.performBy}
                    placeholder="Enter activity owner"
                    onChange={(event) =>
                      setManualMeta(previous => ({
                        ...previous,
                        performBy: event.target.value,
                      }))
                    }
                  />
                </label>
              )}

            {(
              dynamicActivity === "Others" ||
              !hasMasterMopRequired
            ) && (
                <label>
                  <input
                    type="checkbox"
                    checked={manualMeta.mopRequired}
                    onChange={(event) =>
                      setManualMeta(previous => ({
                        ...previous,
                        mopRequired: event.target.checked,
                      }))
                    }
                  />

                  MOP Required
                </label>
              )}

            {(
              dynamicActivity === "Others" ||
              !hasMasterCrRequired
            ) && (
                <label>
                  <input
                    type="checkbox"
                    checked={manualMeta.crRequired}
                    onChange={(event) =>
                      setManualMeta(previous => ({
                        ...previous,
                        crRequired: event.target.checked,
                      }))
                    }
                  />

                  CRQ Required
                </label>
              )}

            {/* {(
              !selectedDynamicMeta?.approvalLevel ||
              dynamicActivity === "Others"
            ) && (
                <label>
                  Approval Requirement

                  <select
                    className="daily-activity-select"
                    value={manualMeta.approvalLevel}
                    onChange={(event) => {
                      const value = event.target.value;

                      setManualMeta(previous => ({
                        ...previous,
                        approvalLevel: value,

                        approvalLevels:
                          value === "NA" || value === "No"
                            ? []
                            : previous.approvalLevels,
                      }));
                    }}
                  >
                    <option value="">
                      Select Approval Requirement
                    </option>

                    <option value="NA">
                      No Approval Required
                    </option>

                    <option value="Level-1">Level-1</option>
                    <option value="Level-2">Level-2</option>
                    <option value="Level-3">Level-3</option>
                    <option value="Level-4">Level-4</option>
                    <option value="Level-5">Level-5</option>
                    <option value="Level-6">Level-6</option>
                    <option value="Level-7">Level-7</option>
                  </select>
                </label>
              )} */}


            <label>
              Approval Required

              <select
                value={manualMeta.approvalLevel}
                onChange={(event) =>
                  setManualMeta(previous => ({
                    ...previous,
                    approvalLevel: event.target.value,
                    approvalLevels:
                      event.target.value === "No"
                        ? []
                        : previous.approvalLevels,
                  }))
                }
              >
                <option value="">
                  Select Approval Requirement
                </option>
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </label>


            {/* {manualMeta.approvalLevel &&
              manualMeta.approvalLevel !== "NA" && (
                <label>
                  Approval Levels

                  <select
                    multiple
                    className="daily-activity-select"
                    value={manualMeta.approvalLevels}
                    onChange={(event) => {
                      const selectedLevels = Array.from(
                        event.target.selectedOptions,
                        option => option.value
                      );

                      setManualMeta(previous => ({
                        ...previous,
                        approvalLevels: selectedLevels,
                      }));
                    }}
                  >
                    {[
                      "Level-1",
                      "Level-2",
                      "Level-3",
                      "Level-4",
                      "Level-5",
                      "Level-6",
                      "Level-7",
                    ].map(level => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </label>
              )
            } */}

            {manualMeta.approvalLevel &&
              manualMeta.approvalLevel === "Yes" && (
                <div className="approval-dropdown">
                  <div className="dropdown-header">
                    {manualMeta.approvalLevels.length
                      ? manualMeta.approvalLevels.join(", ")
                      : "Select Approval Levels"}
                  </div>

                  <div className="dropdown-menu">
                    {approvalLevels.map((level) => (
                      <label key={level} className="dropdown-item">
                        <input
                          type="checkbox"
                          checked={manualMeta.approvalLevels.includes(level)}
                          onChange={() => toggleApprovalLevel(level)}
                        />
                        {level}
                      </label>
                    ))}
                  </div>
                </div>
              )}


            {(
              dynamicActivity === "Others" ||
              !selectedDynamicMeta?.information
            ) && (
                <label>
                  Activity Information

                  <textarea
                    className="daily-activity-input"
                    value={manualMeta.information}
                    placeholder="Enter activity information"
                    onChange={(event) =>
                      setManualMeta(previous => ({
                        ...previous,
                        information: event.target.value,
                      }))
                    }
                  />
                </label>
              )}
          </div>
        )}

        {resolvedDynamicMeta.crRequired && (
          <label>
            CRQ Days Before

            <input
              type="number"
              min="0"
              className="daily-activity-input"
              value={
                selectedDynamicMeta?.crDaysBefore ??
                manualMeta.crDaysBefore
              }
              disabled={
                selectedDynamicMeta?.crDaysBefore !==
                undefined &&
                selectedDynamicMeta?.crDaysBefore !== null
              }
              onChange={(event) =>
                setManualMeta(previous => ({
                  ...previous,
                  crDaysBefore:
                    Number(event.target.value) || 0,
                }))
              }
            />
          </label>
        )}

        {/* Vendor Name */}
        <label>Vendor Name</label>
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
          <>
            <label>Other Vendor Name</label>
            <input
              type="text"
              className="daily-activity-input"
              placeholder="Enter Vendor Name"
              value={vendorNameOthers}
              onChange={(e) => setVendorNameOthers(e.target.value)}
            />
          </>

        )}

        {/* Add Button */}
        <button
          className="daily-activity-btn daily-activity-btn-primary"
          style={{ marginLeft: 8 }}
          // disabled={!dynamicEquip || !dynamicActivity}
          disabled={
            saving ||
            !dynamicEquip ||
            !dynamicActivity ||
            (
              dynamicEquip === "Others" &&
              !othersDynamicEquip.trim()
            ) ||
            (
              dynamicActivity === "Others" &&
              !othersDynamicActivity.trim()
            ) ||
            missingDynamicMetaFields.length > 0
          }

          onClick={async () => {
            if (!selectDate) {
              alert("Please select an activity date.");
              return;
            }

            if (!dynamicEquip || !dynamicActivity) {
              alert("Please select equipment and activity.");
              return;
            }

            const meta = resolvedDynamicMeta;

            if (!meta) {
              alert("Activity configuration not found.");
              return;
            }

            const selectedSiteId = siteId || userData?.siteId;

            if (!selectedSiteId) {
              alert("Site identity not found.");
              return;
            }

            const nodeName =
              dynamicEquip === "Others"
                ? othersDynamicEquip?.trim()
                : dynamicEquip;

            const activityDetails =
              resolvedDynamicActivityDetails;

            if (!nodeName) {
              alert("Please enter equipment name.");
              return;
            }

            if (!activityDetails) {
              alert("Please enter activity details.");
              return;
            }

            let selectedVendor = vendorName || "";

            if (vendorName === "In-House") {
              selectedVendor = vendorNameInHouse?.trim()
                ? `${vendorNameInHouse.trim()} (In-House)`
                : "In-House";
            }

            if (vendorName === "Others") {
              selectedVendor = vendorNameOthers?.trim() || "Others";
            }

            const missingFields = [];

            if (!meta.activityCategory) {
              missingFields.push("Activity Category");
            }

            if (!meta.activityType) {
              missingFields.push("Activity Type");
            }

            if (!meta.activityCode) {
              missingFields.push("Activity Code");
            }

            if (!meta.activityTime) {
              missingFields.push("Activity Time");
            }

            if (!meta.performBy) {
              missingFields.push("Perform By");
            }

            if (
              meta.crRequired &&
              Number(meta.crDaysBefore) < 0
            ) {
              missingFields.push("Valid CRQ Days Before");
            }

            if (missingFields.length) {
              alert(
                `Please complete the following metadata:\n\n${missingFields.join(
                  "\n"
                )}`
              );

              return;
            }

            setSaving(true);

            try {
              const docId =
                `${selectedSiteId}_${selectDate}`.replace(/\s+/g, "_");

              const sheetRef = doc(
                db,
                "daily_activity_sheets",
                docId
              );

              /*
               * Important:
               * Read only the selected date document.
               * Do not use the range-level dailyRows array here.
               */
              const sheetSnapshot = await getDoc(sheetRef);

              const existingRowsForDate = sheetSnapshot.exists()
                ? Array.isArray(sheetSnapshot.data().rows)
                  ? sheetSnapshot.data().rows
                  : []
                : [];

              const newRow = {
                rowId: `${selectedSiteId}_${selectDate}_${genId()}`,

                nodeName,
                activityDetails,

                activityType: meta.activityType,
                activityCategory: meta.activityCategory,
                performBy: meta.performBy,
                mopRequired: meta.mopRequired ? "Yes" : "No",
                activityCode: meta.activityCode,
                activityTime: meta.activityTime,

                siteCategory:
                  meta.siteCategory ||
                  siteConfig?.siteCategory ||
                  "Major",

                approvalRequire:
                  meta.approvalLevel || "NA",

                approvers:
                  getApproversFromLevels(
                    meta.approvalLevels || []
                  ) || [],

                crDaysBefore:
                  Number(meta.crDaysBefore || 0),

                crqType:
                  meta.crRequired ? "CRQ" : "PE",

                information:
                  meta.information || "",

                activityMeta: {
                  activityCategory: meta.activityCategory,
                  activityType: meta.activityType,
                  activityCode: meta.activityCode,
                  activityTime: meta.activityTime,
                  performBy: meta.performBy,

                  mopRequired:
                    Boolean(meta.mopRequired),

                  crRequired:
                    Boolean(meta.crRequired),

                  crDaysBefore:
                    Number(meta.crDaysBefore || 0),

                  approvalLevel:
                    meta.approvalLevel || "NA",

                  approvalLevels:
                    meta.approvalLevels || [],

                  information:
                    meta.information || "",

                  source:
                    meta.metadataSource,
                },

                /*
                 * Use ISO string inside an array item.
                 * Keep serverTimestamp() at document level.
                 */
                createdAt: new Date().toISOString(),
                createdBy: userData?.uid || null,
                createdByName:
                  userData?.name ||
                  userData?.displayName ||
                  "",
              };

              /*
               * Optional duplicate protection.
               *
               * This blocks accidental double-clicks or repeated submission of
               * exactly the same activity for the same equipment and date.
               */
              const duplicateExists = existingRowsForDate.some(
                (row) =>
                  row.isDynamic === true &&
                  row.nodeName?.trim().toLowerCase() ===
                  nodeName.trim().toLowerCase() &&
                  row.activityDetails?.trim().toLowerCase() ===
                  activityDetails.trim().toLowerCase() &&
                  row.activityStartTime === newRow.activityStartTime &&
                  row.activityEndTime === newRow.activityEndTime
              );

              if (duplicateExists) {
                alert(
                  "This dynamic activity already exists for the selected date."
                );
                return;
              }

              const rowsForSelectedDate = [
                ...existingRowsForDate,
                newRow,
              ];

              await setDoc(
                sheetRef,
                {
                  siteId: selectedSiteId,
                  region: region || userData?.region || "",
                  circle: circle || userData?.circle || "",
                  siteName: site || userData?.site || "",
                  date: selectDate,

                  /*
                   * Only rows belonging to selectDate are saved here.
                   */
                  rows: rowsForSelectedDate,

                  lastUpdatedBy: userData?.uid || null,
                  lastUpdatedAt: serverTimestamp(),
                },
                { merge: true }
              );

              /*
               * dailyRows is the complete date-range UI state.
               * Add _sheetDate only locally; do not save it to Firestore.
               */
              setDailyRows((previousRows) => [
                ...previousRows,
                {
                  ...newRow,
                  _sheetDate: selectDate,
                },
              ]);

              /*
               * Keep date-wise state synchronized.
               */
              setDailyRowsByDate((previous) => ({
                ...previous,
                [selectDate]: rowsForSelectedDate,
              }));

              setDynamicEquip("");
              setDynamicActivity("");
              setOthersDynamicEquip("");
              setOthersDynamicActivity("");
              setVendorName("");
              setVendorNameInHouse("");
              setVendorNameOthers("");
              setManualMeta(DEFAULT_MANUAL_META);

              alert("Dynamic activity added successfully.");
            } catch (error) {
              console.error(
                "Dynamic activity add failed:",
                error
              );

              alert(
                error?.message ||
                "Failed to add dynamic activity."
              );
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Adding..." : "Add"}
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
                  <th style={{ position: "sticky", left: 0, zIndex: 5 }} >Date</th>
                  <th>Region</th>
                  <th>Circle</th>
                  <th>Site</th>
                  <th style={{ position: "sticky", left: 0, zIndex: 5 }}>Node Name</th>
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
                  <th>Activity Time</th>
                  <th>Equipment Location</th>
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
                    <td style={{ backgroundColor: ACTIVITY_CODE_BG[r.activityCode] || "transparent", position: "sticky", left: 0 }}>{r._sheetDate || selectDate || "-"}</td>
                    <td style={{ backgroundColor: ACTIVITY_CODE_BG[r.activityCode] || "transparent", }}>{region}</td>
                    <td style={{ backgroundColor: ACTIVITY_CODE_BG[r.activityCode] || "transparent", }}>{circle}</td>
                    <td style={{ backgroundColor: ACTIVITY_CODE_BG[r.activityCode] || "transparent", }}>{site}</td>
                    <td className="daily-activity-input" style={{ backgroundColor: ACTIVITY_CODE_BG[r.activityCode] || "transparent", position: "sticky", left: 0 }} > {/* value={r.nodeName || ""} onChange={(e) => updateDailyRow(idx, "nodeName", e.target.value)}  */}
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
                        // <button
                        //   style={{ height: "fit-content", width: "100%", fontSize: "15px", padding: "2px 2px" }}
                        //   onClick={() => handleGenerateMOP(r)}
                        // >
                        //   Generate MOP
                        // </button>
                        <button
                          style={{
                            height: "fit-content",
                            width: "100%",
                            fontSize: "15px",
                            padding: "2px",
                          }}
                          onClick={() => handleGenerateMOP(r)}
                        >
                          {r.mopDocument?.data ? "Edit MOP" : "Generate MOP"}
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
                    <td style={{ backgroundColor: ACTIVITY_CODE_BG[r.activityCode] || "transparent", }}>{r.activityTime || "Day"}</td>
                    <td style={{ backgroundColor: ACTIVITY_CODE_BG[r.activityCode] || "transparent", }}>{r.floor || "Unknown Location"}</td>
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

                  <label>Activity Time</label>
                  <select
                    className="daily-activity-input"

                    value={editRowData.activityTime || ""}
                    placeholder={"Activity Time (e.g. Day, Night, 10:00-18:00)"}
                    required
                    onChange={(e) => setEditRowData({ ...editRowData, activityTime: e.target.value })}
                  >
                    <option value="Day">Day</option>
                    <option value="Night">Night</option>
                    <option value="Flexible">Flexible</option>
                  </select>

                  <label>Equipment Location</label>
                  <input
                    className="daily-activity-input"

                    value={editRowData.floor || ""}
                    placeholder={"Equipment Floor"}
                    required
                    onChange={(e) => setEditRowData({ ...editRowData, floor: e.target.value })}
                  />

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
    </div >
  );
}
