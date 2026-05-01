import React, { act, useEffect, useMemo, useRef, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs, getDoc, updateDoc, doc, setDoc, serverTimestamp } from "firebase/firestore";
import * as XLSX from "xlsx";
import { Link, useNavigate } from "react-router-dom";
import Chart from "chart.js/auto"; // auto-registers needed controllers
import "../assets/daily-activity.css";

/** Column headers in the exact ordered structure you requested */
const LABELS = [
  "Sl.No",
  "Date",
  "Region",
  "Circle",
  "Site Name",
  "Site Category",
  "Node Name",
  "Quantity",
  "Activity Time (Day/Night)", // ✅ NEW
  "Activity Details",
  "Activity Descriptions",
  "Activity Category",
  "Activity Type",
  "Activity Owner",
  "OEM/Vendor",
  "MOP Required",
  "Activity Code",
  "Approval Require",
  "Approvers",
  "CRQ/PE/REQ Tpye",
  "CRQ No/PE",
  "Done Date",
  "Activity Start Time",
  "Activity End Time",
  "PM Status",
  "Equipment Location",
];

/** Field keys mapped to the TABLE cells (excluding Sl.No) */
const KEYS = [
  "date",
  "region",
  "circle",
  "siteName",
  "siteCategory",
  "nodeName",
  "quantity",
  "activityTime",
  "activityDetails",
  "notes",
  "activityCategory",
  "activityType",
  "performBy",
  "vendor",
  "mopRequired",
  "activityCode",
  "approvalRequire",
  "approvers",
  "crqType",
  "crqNo",
  "doneDate",
  "activityStartTime",
  "activityEndTime",
  "pmStatus",
  "floor",
];

const EDITABLE_KEYS = [
  "crqNo",
  "activityStartTime",
  "activityEndTime",
  "pmStatus",
  "doneDate",
];


/** Small utils */
const toDateObj = (d) => {
  if (!d) return null;
  // Expecting YYYY-MM-DD strings from inputs
  const parts = String(d).split("-");
  if (parts.length === 3) {
    const [y, m, dd] = parts;
    return new Date(Number(y), Number(m) - 1, Number(dd));
  }
  // fallback try parse
  const t = Date.parse(d);
  return Number.isNaN(t) ? null : new Date(t);
};
const inDateRange = (rowDateStr, fromStr, toStr) => {
  if (!fromStr && !toStr) return true;
  const d = toDateObj(rowDateStr);
  if (!d) return false;
  const from = fromStr ? toDateObj(fromStr) : null;
  const to = toStr ? toDateObj(toStr) : null;
  if (from && d < from) return false;
  if (to) {
    const toEnd = new Date(to);
    toEnd.setHours(23, 59, 59, 999);
    if (d > toEnd) return false;
  }
  return true;
};

const isAdminAssignmentValid = (userData) => {
  if (!userData?.isAdminAssigned) return false;
  if (!userData?.adminAssignFrom || !userData?.adminAssignTo) return false;

  const today = new Date();
  const from = new Date(userData.adminAssignFrom);
  const to = new Date(userData.adminAssignTo);

  return today >= from && today <= to;
};


export default function DailyActivityDashboard({ userData }) {
  const [editingRow, setEditingRow] = useState(null);
  const [draftRow, setDraftRow] = useState({});
  function startEdit(rowObj) {
    setEditingRow({
      sheetId: rowObj._sheetId,
      rowIndex: rowObj._rowIndex,
    });
    setDraftRow({ ...rowObj });
  }

  function cancelEdit() {
    setEditingRow(null);
    setDraftRow({});
  }

  /** permissions */
  const isAdmin =
    userData?.role === "Super Admin" ||
    userData?.role === "Admin" ||
    userData.isAdminAssigned ||
    isAdminAssignmentValid(userData) ||
    // userData?.designation === "Vertiv Site Infra Engineer" ||
    userData?.designation === "Vertiv CIH" ||
    userData?.designation === "Vertiv ZM";

  const navigate = useNavigate();

  /** raw rows and filtered rows */
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const getTodayISO = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };


  /** filter popup state */
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    searchText: "",
    dateFrom: getTodayISO(),
    dateTo: getTodayISO(),
    region: "",          // ✅ NEW
    circle: "",
    siteName: "",
    activityType: "",
    siteCategory: "",
    approvalStatus: "", // "", "done", "pending" (based on Approval Require)
    pmStatus: "",
    activityCode: "",
    activityTime: "", // ✅ NEW (Day/Night)
    activityOwner: "",
  });

  /** chart refs */
  const approvalCanvasRef = useRef(null);
  const dailyTrendCanvasRef = useRef(null);
  const crqCanvasRef = useRef(null);
  const approvalChartRef = useRef(null);
  const dailyTrendChartRef = useRef(null);
  const crqChartRef = useRef(null);


  const regionChartRef = useRef(null);
  const circleChartRef = useRef(null);
  const siteChartRef = useRef(null);
  const equipmentChartRef = useRef(null);

  const regionCanvasRef = useRef(null);
  const circleCanvasRef = useRef(null);
  const siteCanvasRef = useRef(null);
  const equipmentCanvasRef = useRef(null);

  const groupCount = (rows, key) => {
    return rows.reduce((acc, r) => {
      const k = r[key] || "Unknown";
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
  };


  const toDateObj = (d) => {
    if (!d) return null;

    // If Firestore Timestamp
    if (d.toDate) return d.toDate();

    // If string YYYY-MM-DD
    const parts = String(d).split("-");
    if (parts.length === 3) {
      const [y, m, dd] = parts;
      return new Date(Number(y), Number(m) - 1, Number(dd));
    }

    // fallback parse
    const t = Date.parse(d);
    return Number.isNaN(t) ? null : new Date(t);
  };

  /** load all daily sheets */
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const snap = await getDocs(collection(db, "daily_activity_sheets"));
        const out = [];
        snap.forEach((docSnap) => {
          const sheet = docSnap.data();
          const sheetId = docSnap.id;
          const siteId = sheet.siteId || "";
          const region = sheet.region || "";
          const circle = sheet.circle || "";
          const siteName = sheet.siteName || "";
          const date = sheet.date
            ? sheet.date.toDate ? sheet.date.toDate().toISOString().slice(0, 10) : sheet.date
            : "";

          (sheet.rows || []).forEach((r, idx) => {
            out.push({
              _sheetId: sheetId,
              _rowIndex: idx,
              // _rowId: r.rowId || `${sheetId}_${idx}`,  // ✅ ADD THIS
              siteId,
              date,
              region,                     // ✅ added
              circle,                     // ✅ added
              siteName,
              siteCategory: r.siteCategory || "",
              nodeName: r.nodeName || "",
              quantity: r.quantity || "",                 // ✅ added
              activityDetails: r.activityDetails || "",
              notes: r.notes || "",                             // ✅ added
              activityCategory: r.activityCategory || "",   // ✅ added
              activityType: r.activityType || "",
              performBy: r.performBy || "",                 // ✅ added
              mopRequired: r.mopRequired || "",                 // ✅ added
              activityCode: r.activityCode || "",          // ✅ added
              approvalRequire: r.approvalRequire || "",
              approvers: r.approvers || "",                // ✅ added
              crRequired: r.crRequired || "",               // ✅ added
              crqType: r.crqType || "",                     // ✅ added
              crqNo: r.crqNo || "",
              doneDate: r.doneDate || "",
              activityStartTime: r.activityStartTime || "",
              activityEndTime: r.activityEndTime || "",
              vendor: r.vendor || "",
              // ✅ ADD THIS
              approvalStatusByLevel: r.approvalStatusByLevel || {},
              pmStatus: r.pmStatus || "Pending", // ✅ NEW
              activityTime: r.activityTime || "", // ✅ NEW
              floor: r.floor || "", // ✅ NEW
            });
          });
        });
        setRows(out);
      } catch (e) {
        console.error("Failed to load Daily Activity data", e);
      } finally {
        setLoading(false);
      }
    })();
    if (
      userData?.isAdminAssigned &&
      !isAdminAssignmentValid(userData)
    ) {
      updateDoc(doc(db, "users", userData.uid), {
        isAdminAssigned: false
      });
    }
  }, [userData]);

  const [instructionText, setInstructionText] = useState("");
  const [instructionEditor, setInstructionEditor] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");

  useEffect(() => {
    const fetchInstruction = async () => {
      const docRef = doc(db, "config", "daily_activity_dashboard_instruction");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setInstructionText(docSnap.data().text || "");
        setInstructionEditor(docSnap.data().uploadBy?.name || "Unknown");
        setEditText(docSnap.data().text || "");
      }
    };
    fetchInstruction();
  }, []);

  /** prepared list of rows respecting user visibility (non-admins only own site) */
  const visibleRows = useMemo(() => {
    if (isAdmin) return rows;
    // non-admin → limit to their own site (prefer siteId match, then site name)
    const mySiteId = userData?.siteId?.trim();
    const mySiteName = (userData?.site || userData?.siteName || "").trim().toLowerCase();
    return rows.filter((r) => {
      if (mySiteId && r.siteId && r.siteId === mySiteId) return true;
      if (mySiteName && (r.siteName || "").trim().toLowerCase() === mySiteName) return true;
      return false;
    });
  }, [rows, isAdmin, userData]);

  const regionOptions = useMemo(
    () => [...new Set(visibleRows.map(r => r.region).filter(Boolean))],
    [visibleRows]
  );

  const circleOptions = useMemo(() => {
    return [...new Set(
      visibleRows
        .filter(r => !filters.region || r.region === filters.region)
        .map(r => r.circle)
        .filter(Boolean)
    )];
  }, [visibleRows, filters.region]);

  const siteOptions = useMemo(() => {
    return [...new Set(
      visibleRows
        .filter(r =>
          (!filters.region || r.region === filters.region) &&
          (!filters.circle || r.circle === filters.circle)
        )
        .map(r => r.siteName)
        .filter(Boolean)
    )];
  }, [visibleRows, filters.region, filters.circle]);

  useEffect(() => {
    setFilters(f => ({ ...f, circle: "", siteName: "" }));
  }, [filters.region]);

  useEffect(() => {
    setFilters(f => ({ ...f, siteName: "" }));
  }, [filters.circle]);


  /** apply filters from popup to visibleRows */
  const filteredRows = useMemo(() => {
    let data = [...visibleRows];

    // enforce site lock ONLY for DailyActivityDashboard
    if (!isAdmin) {
      const mySite = (userData?.site || userData?.siteName || "")
        .trim()
        .toLowerCase();

      data = data.filter(
        (r) => (r.siteName || "").trim().toLowerCase() === mySite
      );
    }

    // quick search across values
    const st = filters.searchText.trim().toLowerCase();
    if (st) {
      data = data.filter((r) =>
        KEYS.some((k) => String(r[k] ?? "").toLowerCase().includes(st))
      );
    }

    // site filter
    if (filters.siteName.trim()) {
      const target = filters.siteName.trim().toLowerCase();
      data = data.filter((r) => (r.siteName || "").toLowerCase().includes(target));
    }

    // Region filter
    if (filters.region) {
      data = data.filter(
        (r) => (r.region || "") === filters.region
      );
    }

    // Circle filter
    if (filters.circle) {
      data = data.filter(
        (r) => (r.circle || "") === filters.circle
      );
    }

    // date range
    if (filters.dateFrom || filters.dateTo) {
      data = data.filter((r) => inDateRange(r.date, filters.dateFrom, filters.dateTo));
    }

    // activity type
    if (filters.activityType) {
      data = data.filter((r) => (r.activityType || "") === filters.activityType);
    }

    // activity time
    if (filters.activityTime) {
      data = data.filter((r) => (r.activityTime || "") === filters.activityTime);
    }

    // site category
    if (filters.siteCategory) {
      data = data.filter((r) => (r.siteCategory || "") === filters.siteCategory);
    }

    // activity owner
    if (filters.activityOwner) {
      data = data.filter((r) => (r.performBy || "") === filters.activityOwner);
    }

    // PM Status
    if (filters.pmStatus) {
      data = data.filter((r) => r.pmStatus === filters.pmStatus);
    }


    // Approval filters
    if (filters.approvalStatus === "done") {
      data = data.filter(r => (r.approvalRequire || "").trim() !== "");
    }

    else if (filters.approvalStatus === "pending") {
      data = data.filter(r => (r.approvalRequire || "").trim() === "");
    }

    else if (filters.approvalStatus === "allApproved") {
      data = data.filter(r => {
        if (!Array.isArray(r.approvers) || r.approvers.length === 0) return false;

        return r.approvers.every(({ level }) =>
          r.approvalStatusByLevel?.[level] === "Y"
        );
      });
    }

    return data;
  }, [visibleRows, filters]);


  /** inline edit (admin only) — we update Firestore by row identity, not by index */
  async function handleEdit(rowObj, key, value) {
    // if (!isAdmin) return;

    // 🔹 Optimistic UI
    setRows(prev =>
      prev.map(r =>
        r._sheetId === rowObj._sheetId && r._rowIndex === rowObj._rowIndex
          ? { ...r, [key]: value }
          : r
      )
    );

    // 🔹 Firestore update
    const ref = doc(db, "daily_activity_sheets", rowObj._sheetId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const data = snap.data();
    const arr = [...(data.rows || [])];

    // const realIndex = arr.findIndex(r => r._sheetId === rowObj._sheetId);
    // if (realIndex === -1) return;

    // arr[realIndex] = { ...arr[realIndex], [key]: value };

    // await updateDoc(ref, { rows: arr });
    const updated = {
      ...draftRow,

      // safety defaults
      // rowId: draftRow._rowId || crypto.randomUUID(), // ✅ ENSURE
      // approvers: Array.isArray(draftRow.approvers) ? draftRow.approvers : [],
      // approvalStatusByLevel: draftRow.approvalStatusByLevel || {},
      pmStatus: draftRow.pmStatus || "Pending",
    };


    arr[rowObj._rowIndex] = updated;
    await updateDoc(ref, { rows: arr });

    // update local rows
    setRows((prev) =>
      prev.map((r) =>
        r._sheetId === rowObj._sheetId && r._rowIndex === rowObj._rowIndex
          ? { ...r, ...updated }
          : r
      )
    );
  }


  async function saveEdit(rowObj) {
    try {
      const ref = doc(db, "daily_activity_sheets", rowObj._sheetId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;

      const data = snap.data();
      const arr = [...(data.rows || [])];

      // const updated = {};
      // KEYS.forEach((k) => {
      //   updated[k] = draftRow[k] || "";
      // });

      const updated = {
        ...draftRow,

        // safety defaults
        rowId: draftRow._rowId || crypto.randomUUID(), // ✅ ENSURE
        approvers: Array.isArray(draftRow.approvers) ? draftRow.approvers : [],
        approvalStatusByLevel: draftRow.approvalStatusByLevel || {},
        pmStatus: draftRow.pmStatus || "Pending",
      };


      arr[rowObj._rowIndex] = updated;
      await updateDoc(ref, { rows: arr });

      // update local rows
      setRows((prev) =>
        prev.map((r) =>
          r._sheetId === rowObj._sheetId && r._rowIndex === rowObj._rowIndex
            ? { ...r, ...updated }
            : r
        )
      );

      cancelEdit();
    } catch (e) {
      console.error("Save failed", e);
    }
  }

  /** delete row (admin only) */
  async function handleDelete(rowObj) {
    if (!isAdmin || (rowObj.siteName !== userData?.site || userData?.designation !== "Vertiv Site Infra Engineer" || userData?.designation !== "Vertiv Supervisor")) return;
    if (!window.confirm("Delete this activity row?")) return;
    try {
      const ref = doc(db, "daily_activity_sheets", rowObj._sheetId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const data = snap.data();
      const next = (data.rows || []).filter((_, i) => i !== rowObj._rowIndex);
      await updateDoc(ref, { rows: next });

      // refresh in-memory
      setRows((prev) =>
        prev.filter(
          (r) => !(r._sheetId === rowObj._sheetId && r._rowIndex === rowObj._rowIndex)
        )
      );
    } catch (e) {
      console.error("Delete failed", e);
    }
  }

  /** Charts: Site-wise Approval (bar), Daily Approval Trend (line), CRQ/PE/REQ (pie) */
  useEffect(() => {
    // destroy old charts to avoid leaks
    if (approvalChartRef.current) {
      approvalChartRef.current.destroy();
      approvalChartRef.current = null;
    }
    if (dailyTrendChartRef.current) {
      dailyTrendChartRef.current.destroy();
      dailyTrendChartRef.current = null;
    }
    if (crqChartRef.current) {
      crqChartRef.current.destroy();
      crqChartRef.current = null;
    }

    if (!filteredRows.length) return;

    const siteApprovalCounts = {};
    const dayApprovalCounts = {};
    const crqCounts = { CRQ: 0, PE: 0, REQ: 0, Other: 0 };

    filteredRows.forEach((r) => {
      const site = r.siteName || "Unspecified";
      const dateKey = r.date || "Unknown";
      const approved = (r.approvalRequire || "").trim() !== "";

      // site-wise done/pending
      if (!siteApprovalCounts[site]) siteApprovalCounts[site] = { done: 0, pending: 0 };
      if (approved) siteApprovalCounts[site].done += 1;
      else siteApprovalCounts[site].pending += 1;

      // day-wise trend
      if (!dayApprovalCounts[dateKey]) dayApprovalCounts[dateKey] = { done: 0, pending: 0 };
      if (approved) dayApprovalCounts[dateKey].done += 1;
      else dayApprovalCounts[dateKey].pending += 1;

      // CRQ pie
      const crq = (r.crqNo || "").toUpperCase();
      if (crq.startsWith("CRQ")) crqCounts.CRQ += 1;
      else if (crq === "PE") crqCounts.PE += 1;
      else if (crq === "REQ") crqCounts.REQ += 1;
      else crqCounts.Other += 1;
    });

    // Site-wise Approval bar
    const siteLabels = Object.keys(siteApprovalCounts);
    const doneData = siteLabels.map((s) => siteApprovalCounts[s].done);
    const pendingData = siteLabels.map((s) => siteApprovalCounts[s].pending);

    if (approvalCanvasRef.current && siteLabels.length) {
      approvalChartRef.current = new Chart(approvalCanvasRef.current, {
        type: "bar",
        data: {
          labels: siteLabels,
          datasets: [
            { label: "Done", data: doneData, backgroundColor: "#16a34a" },
            { label: "Pending", data: pendingData, backgroundColor: "#dc2626" },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: "bottom" },
            title: { display: true, text: "Approval Status by Site (by Approval Require)" },
          },
          scales: { y: { beginAtZero: true } },
        },
      });
    }

    // Daily Approval Trend line
    const dayLabels = Object.keys(dayApprovalCounts).sort();
    const dayDone = dayLabels.map((d) => dayApprovalCounts[d].done);
    const dayPending = dayLabels.map((d) => dayApprovalCounts[d].pending);

    if (dailyTrendCanvasRef.current && dayLabels.length) {
      dailyTrendChartRef.current = new Chart(dailyTrendCanvasRef.current, {
        type: "line",
        data: {
          labels: dayLabels,
          datasets: [
            { label: "Done", data: dayDone, borderColor: "#16a34a", fill: false, tension: 0.2 },
            { label: "Pending", data: dayPending, borderColor: "#dc2626", fill: false, tension: 0.2 },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: "bottom" },
            title: { display: true, text: "Daily Approval Trend (by Approval Require)" },
          },
        },
      });
    }

    // CRQ Pie
    const crqLabels = Object.keys(crqCounts);
    const crqData = Object.values(crqCounts);

    if (crqCanvasRef.current && crqLabels.length) {
      crqChartRef.current = new Chart(crqCanvasRef.current, {
        type: "pie",
        data: {
          labels: crqLabels,
          datasets: [
            {
              data: crqData,
              backgroundColor: ["#3b82f6", "#facc15", "#ef4444", "#9ca3af"],
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: "bottom" },
            title: { display: true, text: "CRQ / PE / REQ Distribution" },
          },
        },
      });
    }
  }, [filteredRows]);

  /** UI: filter modal handlers */
  const resetFilters = () =>
    setFilters({
      searchText: "",
      dateFrom: getTodayISO(),
      dateTo: getTodayISO(),
      siteName: "",
      activityType: "",
      siteCategory: "",
      approvalStatus: "",
      activityOwner: "",
    });


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

  const getHeaderLevels = (rows = []) => {
    const max = getMaxApprovalLevelNumber(rows);
    return Array.from({ length: max }, (_, i) => `Level-${i + 1}`);
  };

  const headerLevels = useMemo(
    () => getHeaderLevels(filteredRows),
    [filteredRows]
  );

  const formatApproversForDashboard = (approversArr) => {
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
      .join(" | ");
  };

  /** export current filtered rows to Excel */
  const formatApproversForExport = (approversArr) => {
    if (!Array.isArray(approversArr) || approversArr.length === 0) return "NA";

    const grouped = approversArr.reduce((acc, { level, approver }) => {
      acc[level] = acc[level] || [];
      acc[level].push(approver);
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([level, users]) => `${level}: ${users.join(", ")}`)
      .join(" | ");
  };

  const getDayNightFromStartTime = (startTime) => {
    if (!startTime || typeof startTime !== "string") return "";

    // Expected formats: "HH:mm" or "HH:mm:ss"
    const parts = startTime.split(":");
    if (parts.length < 2) return "";

    const hour = parseInt(parts[0], 10);
    if (isNaN(hour)) return "";

    return hour < 6 ? "Night Activity" : "Day Activity";
  };


  function exportExcel() {
    if (!filteredRows.length) return;

    // 🔹 dynamic approval levels
    const maxLevel = getMaxApprovalLevelNumber(filteredRows);
    const levelHeaders = Array.from(
      { length: maxLevel },
      (_, i) => `Level-${i + 1}`
    );

    const exportData = filteredRows.map((r, i) => {
      const baseRow = {
        "Sl.No": i + 1,
        Date: r.date || "",
        "Region": r.region || "",
        "Circle": r.circle || "",
        "Site Name": r.siteName || "",
        "siteId": r.siteId || "",
        "Site Category": r.siteCategory || "",
        "Node Name": r.nodeName || "",
        "Quantity": r.quantity || "",
        "Activity Time (Day/Night)": r.activityTime || "",
        "Activity Details": r.activityDetails || "",
        "Activity Descriptions": r.notes || "",
        "Activity Category": r.activityCategory || "",
        "Activity Type": r.activityType || "",
        "Activity Owner": r.performBy || "",
        "OEM/Vendor Name": r.vendor || "",
        "MOP Required": !r.mopRequired ? "No" : "Yes",
        "Activity Code": r.activityCode || "",
        "Approval Require": r.approvalRequire || "",
        Approvers: formatApproversForExport(r.approvers),
        // ✅ NEW COLUMN
        "Activity Time (Day/Night)": getDayNightFromStartTime(
          r.activityStartTime
        ),
        "CRQ Required": r.crRequired ? "Yes" : "No",
        "CRQ/PE/REQ Type": r.crqType || "",
        "CRQ No/PE": r.crqNo || "",
        "Done Date": r.doneDate || "",
        "Activity Start Time": r.activityStartTime || "",
        "Activity End Time": r.activityEndTime || "",
        "PM Status": r.pmStatus || "Pending",
        "Equpment Location": r.floor || "",
      };

      // 🔹 add level-wise approval status
      levelHeaders.forEach((level) => {
        const rowLevels = Array.isArray(r.approvers)
          ? r.approvers.map((a) => a.level)
          : [];

        baseRow[level] = rowLevels.includes(level)
          ? r.approvalStatusByLevel?.[level] || "NA"
          : "";
      });

      return baseRow;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Daily Activities");

    XLSX.writeFile(
      wb,
      `DailyActivityDashboard_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  }

  useEffect(() => {
    // destroy old charts
    [regionChartRef, circleChartRef, siteChartRef, equipmentChartRef].forEach(
      (ref) => {
        if (ref.current) {
          ref.current.destroy();
          ref.current = null;
        }
      }
    );

    if (!filteredRows.length) return;

    const regionData = groupCount(filteredRows, "region");
    const circleData = groupCount(filteredRows, "circle");
    const siteData = groupCount(filteredRows, "siteName");
    const equipmentData = groupCount(filteredRows, "activityCategory");

    const createBarChart = (canvasRef, chartRef, title, dataObj) => {
      if (!canvasRef.current) return;

      chartRef.current = new Chart(canvasRef.current, {
        type: "bar",
        data: {
          labels: Object.keys(dataObj),
          datasets: [
            {
              label: "Activity Count",
              data: Object.values(dataObj),
              backgroundColor: "#3b82f6",
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
            title: { display: true, text: title },
          },
          scales: {
            y: { beginAtZero: true },
          },
        },
      });
    };

    createBarChart(
      regionCanvasRef,
      regionChartRef,
      "Region-wise Activity Count",
      regionData
    );

    createBarChart(
      circleCanvasRef,
      circleChartRef,
      "Circle-wise Activity Count",
      circleData
    );

    createBarChart(
      siteCanvasRef,
      siteChartRef,
      "Site-wise Activity Count",
      siteData
    );

    createBarChart(
      equipmentCanvasRef,
      equipmentChartRef,
      "Equipment Category-wise Activity Count",
      equipmentData
    );
  }, [filteredRows]);

  const ACTIVITY_CODE_BG = {
    RED: "#ffb7af",
    GREEN: "#8fe496",
    BLUE: "#a1d5fa",
    AMBER: "#fde7a0",
  };

  const PM_STATUS_BG = {
    Pending: "#fc6e6e",
    WIP: "#df9d5f",
    Completed: "#7bf5a6",
  };

  const isPMOverdue = (row) => {
    if (row.pmStatus === "Completed") return false;
    if (!row.date) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pmDate = new Date(row.date);
    pmDate.setHours(0, 0, 0, 0);

    return pmDate < today;
  };

  const pmStats = useMemo(() => {
    const total = filteredRows.length;
    const completed = filteredRows.filter(
      (r) => r.pmStatus === "Completed"
    ).length;

    const pending = filteredRows.filter(
      (r) => r.pmStatus === "Pending"
    ).length;

    const wip = filteredRows.filter(
      (r) => r.pmStatus === "WIP"
    ).length;

    const percent =
      total === 0 ? 0 : Math.round((completed / total) * 100);

    return { total, completed, pending, wip, percent };
  }, [filteredRows]);

  const groupPMStatus = (rows, key) => {
    return rows.reduce((acc, r) => {
      const group = r[key] || "Unknown";

      if (!acc[group]) {
        acc[group] = { Pending: 0, WIP: 0, Completed: 0 };
      }

      const status = r.pmStatus || "Pending";
      acc[group][status]++;

      return acc;
    }, {});
  };
  const regionPMChartRef = useRef(null);
  const circlePMChartRef = useRef(null);
  const sitePMChartRef = useRef(null);

  const regionPMCanvasRef = useRef(null);
  const circlePMCanvasRef = useRef(null);
  const sitePMCanvasRef = useRef(null);

  const [activeChart, setActiveChart] = useState(null);
  const modalCanvasRef = useRef(null);
  const modalChartRef = useRef(null);

  const openChartModal = (chartRef, title) => {
    if (!chartRef.current) return;

    setActiveChart({ chartRef, title });
  };

  useEffect(() => {
    if (!activeChart || !modalCanvasRef.current) return;

    // destroy previous modal chart
    if (modalChartRef.current) {
      modalChartRef.current.destroy();
      modalChartRef.current = null;
    }

    const sourceChart = activeChart.chartRef.current;

    modalChartRef.current = new Chart(
      modalCanvasRef.current,
      {
        type: sourceChart.config.type,
        data: JSON.parse(JSON.stringify(sourceChart.config.data)),
        options: {
          ...sourceChart.config.options,
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            ...sourceChart.config.options.plugins,
            title: {
              display: true,
              text: activeChart.title,
            },
          },
        },
      }
    );

    return () => {
      modalChartRef.current?.destroy();
    };
  }, [activeChart]);


  useEffect(() => {
    // destroy old charts
    [regionPMChartRef, circlePMChartRef, sitePMChartRef].forEach(ref => {
      if (ref.current) {
        ref.current.destroy();
        ref.current = null;
      }
    });

    if (!filteredRows.length) return;

    const regionData = groupPMStatus(filteredRows, "region");
    const circleData = groupPMStatus(filteredRows, "circle");
    const siteData = groupPMStatus(filteredRows, "siteName");

    const createStackedChart = (canvasRef, chartRef, title, dataObj) => {
      if (!canvasRef.current) return;

      const labels = Object.keys(dataObj);

      chartRef.current = new Chart(canvasRef.current, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Pending",
              data: labels.map(l => dataObj[l].Pending),
              backgroundColor: "#facc15",
            },
            {
              label: "WIP",
              data: labels.map(l => dataObj[l].WIP),
              backgroundColor: "#3b82f6",
            },
            {
              label: "Completed",
              data: labels.map(l => dataObj[l].Completed),
              backgroundColor: "#16a34a",
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: "bottom" },
            title: { display: true, text: title },
          },
          scales: {
            x: { stacked: true },
            y: { stacked: true, beginAtZero: true },
          },
        },
      });
    };

    createStackedChart(
      regionPMCanvasRef,
      regionPMChartRef,
      "Region-wise PM Status",
      regionData
    );

    createStackedChart(
      circlePMCanvasRef,
      circlePMChartRef,
      "Circle-wise PM Status",
      circleData
    );

    createStackedChart(
      sitePMCanvasRef,
      sitePMChartRef,
      "Site-wise PM Status",
      siteData
    );
  }, [filteredRows]);


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
              Fetching All Activitys…
            </div>
            <div style={{ fontSize: "12px", color: "#cbd5e1", marginTop: "4px" }}>
              Please wait
            </div>
          </div>
        </div>
      )}
      <div className="daily-activity-header">
        <h1 className="dashboard-header">
          <strong>🏗️ Daily Activity Dashboard</strong>
        </h1>

        <div className="daily-activity-subtitle">
          {isAdmin ? "Admin view: all sites" : "User view: your site only"}
        </div>
        <p onClick={() => navigate("/activity-dashboard")} style={{ cursor: "pointer" }}>Activity Matrix</p>
        {(userData?.role === "Super User" || userData?.role === "Admin" || userData?.role === "Super Admin") && (
          <Link to="/daily-activity-management"><span className="pm-manage-btn">🚧🛠️ Manage Daily {userData?.site} Activity</span></Link>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div className="pm-kpi-card">
          <h4>Total PMs</h4>
          <strong>{pmStats.total}</strong>
        </div>

        <div className="pm-kpi-card">
          <h4>Completed</h4>
          <strong style={{ color: "#16a34a" }}>
            {pmStats.completed}
          </strong>
        </div>

        <div className="pm-kpi-card">
          <h4>WIP</h4>
          <strong style={{ color: "#2563eb" }}>
            {pmStats.wip}
          </strong>
        </div>

        <div className="pm-kpi-card">
          <h4>Pending</h4>
          <strong style={{ color: "#ca8a04" }}>
            {pmStats.pending}
          </strong>
        </div>

        <div className="pm-kpi-card">
          <h4>Completion %</h4>
          <strong>{pmStats.percent}%</strong>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
          marginBottom: 20,
          height: "300px",
          width: "100%",
          overflowX: "auto",
        }}
        className="chart-container"
      >
        <canvas
          className="child-container"
          ref={regionPMCanvasRef}
          onClick={() =>
            openChartModal(regionPMChartRef, "Region-wise PM Status")
          }
        />

        <canvas
          className="child-container"
          ref={circlePMCanvasRef}
          onClick={() =>
            openChartModal(circlePMChartRef, "Circle-wise PM Status")
          }
        />

        <canvas
          className="child-container"
          ref={sitePMCanvasRef}
          onClick={() =>
            openChartModal(sitePMChartRef, "Site-wise PM Status")
          }
        />

      </div>

      {/* <div
        style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, overflowX: "auto", marginBottom: 16, height: "300px",
          width: "100%",
          overflowX: "auto",
        }}
        className="chart-container"
      >
        <canvas
          className="child-container"
          ref={regionCanvasRef}
          onClick={() =>
            openChartModal(regionChartRef, "Region-wise Activity Count")
          }
        />

        <canvas
          className="child-container"
          ref={circleCanvasRef}
          onClick={() =>
            openChartModal(circleChartRef, "Circle-wise Activity Count")
          }
        />

        <canvas
          className="child-container"
          ref={siteCanvasRef}
          onClick={() =>
            openChartModal(siteChartRef, "Site-wise Activity Count")
          }
        />

        <canvas
          className="child-container"
          ref={equipmentCanvasRef}
          onClick={() =>
            openChartModal(equipmentChartRef, "Equipment-wise Activity Count")
          }
        />

      </div> */}

      {activeChart && (
        <div
          onClick={() => setActiveChart(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              width: "90%",
              height: "85%",
              borderRadius: 12,
              padding: 16,
              position: "relative",
            }}
          >
            <button
              onClick={() => setActiveChart(null)}
              style={{
                position: "absolute",
                top: 10,
                right: 14,
                fontSize: 22,
                border: "none",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              ✖
            </button>

            <canvas
              ref={modalCanvasRef}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </div>
      )}

      {/* Charts */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }} className="chart-container">
        <div style={{ flex: 1, minWidth: 320 }}>
          <canvas ref={approvalCanvasRef} />
        </div>
        <div style={{ flex: 1, minWidth: 320 }}>
          <canvas ref={dailyTrendCanvasRef} />
        </div>
        <div style={{ width: 360, minWidth: 280 }}>
          <canvas ref={crqCanvasRef} />
        </div>
      </div>


      <div className="instruction-tab">
        <h2 className="noticeboard-header">📌 Notice Board </h2>
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
                  await setDoc(docRef, { text: editText, updatedAt: serverTimestamp(), uploadBy: { name: userData?.name || "Unknown", empId: userData?.empId || "Unknown" } }, { merge: true });
                  setInstructionText(editText);
                  setInstructionEditor(userData?.name || "Unknown");
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
        <h6 style={{ marginLeft: "90%" }}>Thanks & Regurds @{instructionEditor || "Unknown User"}</h6>
      </div>

      {/* Toolbar */}
      <div className="daily-activity-toolbar">
        <button
          onClick={() => setFiltersOpen(true)}
          className="daily-activity-btn daily-activity-btn-secondary"
        >
          Filters
        </button>

        <button
          onClick={exportExcel}
          className="daily-activity-btn daily-activity-btn-primary"
        >
          Export to Excel
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="daily-activity-loading">Loading…</div>
      ) : filteredRows.length === 0 ? (
        <div className="daily-activity-empty">No data found.</div>
      ) : (
        <div className="daily-activity-table-container">
          <table className="daily-activity-table">
            <thead>
              <tr>
                {LABELS.map((label) => (
                  <th key={label} style={{ border: "1px solid #6b6868", }}>{label}</th>
                ))}

                {/* 🔹 Dynamic approval level headers */}
                {headerLevels.map((level) => (
                  <th key={level} style={{ border: "1px solid #6b6868", }}>{level}</th>
                ))}

                {(isAdmin || (userData?.designation === "Vertiv Site Infra Engineer" || userData?.designation === "Vertiv Supervisor")) && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((rowObj, idx) => (
                <tr key={`${rowObj._sheetId}-${rowObj._rowIndex}`}
                  style={{
                    borderLeft: isPMOverdue(rowObj)
                      ? "6px solid #dc2626"
                      : "none",
                  }}
                >
                  <td
                    style={{
                      backgroundColor: ACTIVITY_CODE_BG[rowObj.activityCode] || "transparent",
                      borderRight: "1px solid #6b6868",
                    }}
                  >{idx + 1}</td>
                  {KEYS.map((k) => {
                    const isApprovers = k === "approvers";
                    const isPMStatus = k === "pmStatus";
                    const isEditable = EDITABLE_KEYS.includes(k);

                    const isEditingThisRow =
                      (isAdmin || (rowObj.siteName === userData?.site ? (userData?.designation === "Vertiv Site Infra Engineer" || userData?.designation === "Vertiv Supervisor") : false)) &&
                      // rowObj.siteName === userData?.site &&
                      editingRow &&
                      editingRow.sheetId === rowObj._sheetId &&
                      editingRow.rowIndex === rowObj._rowIndex;

                    return (
                      <td
                        key={k}
                        style={{
                          overflowY: isApprovers ? "auto" : "visible",
                          whiteSpace: isApprovers ? "pre" : "pre-line",
                          maxWidth: isApprovers ? "200px" : "auto",
                          scrollbarsWidth: "thin",
                          borderRight: "1px solid #6b6868",
                          backgroundColor:
                            ACTIVITY_CODE_BG[rowObj.activityCode] || "transparent",
                          ...(k === "pmStatus" && {
                            backgroundColor: PM_STATUS_BG[rowObj.pmStatus],
                          })
                        }}
                      >
                        {/* 🔹 PM STATUS DROPDOWN (SITE USER + ADMIN) */}
                        {isPMStatus ? (
                          (isEditingThisRow) ? (
                            /* 🔹 DROPDOWN MODE */
                            <select
                              className="daily-activity-select"
                              value={draftRow.pmStatus || "Pending"}
                              onChange={(e) => {
                                const value = e.target.value;

                                if (isEditingThisRow) {
                                  setDraftRow((d) => ({ ...d, pmStatus: value }));
                                } else {
                                  // setDraftRow((d) => ({ ...d, pmStatus: value }));
                                  handleEdit(rowObj, "pmStatus", value);
                                  // saveEdit(rowObj);
                                }
                              }}
                            // onChange={(e) => {
                            //   const value = e.target.value;
                            //   setDraftRow((d) => ({ ...d, pmStatus: value }));

                            //   // 🔹 ALWAYS update UI immediately
                            //   setRows(prev =>
                            //     prev.map(r =>
                            //       r._sheetId === rowObj._sheetId &&
                            //         r._rowIndex === rowObj._rowIndex
                            //         ? { ...r, pmStatus: value }
                            //         : r
                            //     )
                            //   );

                            //   // 🔹 Persist to Firestore
                            //   handleEdit(rowObj, "pmStatus", value);
                            // }}

                            >
                              <option value="Pending">Pending</option>
                              <option value="WIP">WIP</option>
                              <option value="Completed">Completed</option>
                            </select>
                          ) : (
                            /* 🔹 READ MODE WITH OVERDUE BADGE */
                            <div style={{ display: "flex", alignItems: "center" }}>
                              <span>{rowObj.pmStatus || "Pending"}</span>

                              {isPMOverdue(rowObj) && (
                                <span
                                  style={{
                                    marginLeft: 6,
                                    padding: "2px 6px",
                                    fontSize: 11,
                                    background: "#fee2e2",
                                    color: "#991b1b",
                                    borderRadius: 4,
                                    fontWeight: 600,
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  OVERDUE
                                </span>
                              )}
                            </div>
                          )
                        ) : isEditingThisRow && isEditable ? (
                          /* 🔹 ALLOWED INPUT FIELDS ONLY */
                          <input
                            type={k.includes("Time") ? "time" : k.includes("Date") ? "date" : "text"}
                            className="daily-activity-input"
                            value={draftRow[k] || ""}
                            onChange={(e) =>
                              setDraftRow((d) => ({ ...d, [k]: e.target.value }))
                            }
                          />
                        ) : (
                          /* 🔹 READ-ONLY MODE */
                          k === "approvers"
                            ? formatApproversForDashboard(rowObj.approvers).replaceAll(" | ", "\n")
                            : rowObj[k] || ""
                        )}
                      </td>
                    );
                  })}

                  {/* 🔹 Level-based approval status */}
                  {headerLevels.map((level) => {
                    const rowLevels = Array.isArray(rowObj.approvers)
                      ? rowObj.approvers.map((a) => a.level)
                      : [];

                    const hasLevel = rowLevels.includes(level);

                    return (
                      <td key={level}
                        style={{
                          // maxHeight: isApprovers ? "10px" : "10px",
                          backgroundColor: ACTIVITY_CODE_BG[rowObj.activityCode] || "transparent",
                          borderRight: "1px solid #6b6868",
                          // verticalAlign: "top",
                        }}
                      >
                        {hasLevel
                          ? rowObj.approvalStatusByLevel?.[level] || "—"
                          : "NA"}
                      </td>
                    );
                  })}

                  {(isAdmin || (rowObj.siteName === userData?.site ? (userData?.designation === "Vertiv Site Infra Engineer" || userData?.designation === "Vertiv Supervisor") : false)) && (
                    <td
                      style={{ backgroundColor: ACTIVITY_CODE_BG[rowObj.activityCode] || "transparent", }}
                    >
                      {editingRow &&
                        editingRow.sheetId === rowObj._sheetId &&
                        editingRow.rowIndex === rowObj._rowIndex ? (
                        <>
                          <button
                            className="daily-activity-btn daily-activity-btn-primary"
                            onClick={() => saveEdit(rowObj)}
                          >
                            Save
                          </button>
                          <button
                            className="daily-activity-btn daily-activity-btn-secondary"
                            onClick={cancelEdit}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="daily-activity-btn daily-activity-btn-secondary"
                            onClick={() => startEdit(rowObj)}
                          >
                            Edit
                          </button>
                          {isAdmin && (
                            <button
                              className="daily-activity-btn daily-activity-btn-danger"
                              onClick={() => handleDelete(rowObj)}
                            >
                              Delete
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Filters Modal */}
      {filtersOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 1000,
          }}
          onClick={() => setFiltersOpen(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 8,
              width: "100%",
              maxWidth: 720,
              padding: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="daily-activity-title" style={{ marginBottom: 12 }}>
              Filters
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <div>
                <input
                  className="daily-activity-input"
                  placeholder="Search text"
                  value={filters.searchText}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, searchText: e.target.value }))
                  }
                />

                <input
                  type="date"
                  className="daily-activity-input"
                  value={filters.dateFrom}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, dateFrom: e.target.value }))
                  }
                />

                <input
                  type="date"
                  className="daily-activity-input"
                  value={filters.dateTo}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, dateTo: e.target.value }))
                  }
                />
              </div>
              {isAdmin ? (
                <div>
                  <select
                    value={filters.region}
                    onChange={(e) => setFilters(f => ({ ...f, region: e.target.value }))}
                  >
                    <option value="">All Regions</option>
                    {regionOptions.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>

                  <select
                    value={filters.circle}
                    onChange={(e) => setFilters(f => ({ ...f, circle: e.target.value }))}
                  >
                    <option value="">All Circles</option>
                    {circleOptions.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>

                  <select
                    className="daily-activity-select"
                    value={filters.siteName}
                    onChange={(e) =>
                      setFilters(f => ({ ...f, siteName: e.target.value }))
                    }
                    disabled={!isAdmin}   // site users still locked
                  >
                    <option value="">All Sites</option>
                    {siteOptions.map(site => (
                      <option key={site} value={site}>
                        {site}
                      </option>
                    ))}
                  </select>

                  <select
                    className="daily-activity-select"
                    value={filters.siteCategory}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, siteCategory: e.target.value }))
                    }
                  >
                    <option value="">All Site Categories</option>
                    <option value="Super Critical">Super Critical</option>
                    <option value="Critical">Critical</option>
                    <option value="Major">Major</option>
                  </select>
                </div>
              ) : (
                <div>
                  <select
                    value={filters.region}
                    onChange={(e) => setFilters(f => ({ ...f, region: e.target.value }))}
                    disabled
                  >
                    <option value="">All Regions</option>
                    {regionOptions.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>

                  <select
                    value={filters.circle}
                    onChange={(e) => setFilters(f => ({ ...f, circle: e.target.value }))}
                    disabled
                  >
                    <option value="">All Circles</option>
                    {circleOptions.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>

                  <input
                    type="text"
                    className="daily-activity-input"
                    value={userData?.site || userData?.siteName || ""}
                    disabled
                  />

                  <select
                    className="daily-activity-select"
                    value={filters.siteCategory}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, siteCategory: e.target.value }))
                    }
                  >
                    <option value="">All Site Categories</option>
                    <option value="Super Critical">Super Critical</option>
                    <option value="Critical">Critical</option>
                    <option value="Major">Major</option>
                  </select>
                </div>
              )}

              <div>
                <select
                  className="daily-activity-select"
                  value={filters.pmStatus}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, pmStatus: e.target.value }))
                  }
                >
                  <option value="">All PM Status</option>
                  <option value="Pending">Pending</option>
                  <option value="WIP">WIP</option>
                  <option value="Completed">Completed</option>
                </select>



                <select
                  className="daily-activity-select"
                  value={filters.activityTime}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, activityTime: e.target.value }))
                  }
                >
                  <option value="">All Activity Times</option>
                  <option value="Day">Day Activity</option>
                  <option value="Night">Night Activity</option>
                </select>

                <select
                  className="daily-activity-select"
                  value={filters.activityType}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, activityType: e.target.value }))
                  }
                >
                  <option value="">All Activity Types</option>
                  <option value="Major">Major</option>
                  <option value="Minor">Minor</option>
                </select>

                <select
                  className="daily-activity-select"
                  value={filters.activityOwner}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, activityOwner: e.target.value }))
                  }
                >
                  <option value="">Select Owner</option>
                  <option value="In-House">In-House Activity</option>
                  <option value="OEM">OEM Activity</option>
                </select>

              </div>

              <select
                value={filters.approvalStatus}
                onChange={(e) =>
                  setFilters(f => ({ ...f, approvalStatus: e.target.value }))
                }
              >
                <option value="">All</option>
                <option value="done">Approval Required Filled</option>
                <option value="pending">Approval Pending</option>
                <option value="allApproved">All Levels Approved (Y)</option>
              </select>

            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                className="daily-activity-btn daily-activity-btn-secondary"
                onClick={resetFilters}
              >
                Reset
              </button>
              <button
                className="daily-activity-btn daily-activity-btn-primary"
                onClick={() => setFiltersOpen(false)}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
