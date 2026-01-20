import React, { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs, getDoc, updateDoc, doc, setDoc } from "firebase/firestore";
import * as XLSX from "xlsx";
import { Link, useNavigate } from "react-router-dom";
import Chart from "chart.js/auto"; // auto-registers needed controllers
import "../assets/daily-activity.css";

/** Column headers in the exact ordered structure you requested */
const LABELS = [
  "Sl.No",
  "Date",
  "Site Name",
  "Site Category",
  "Node Name",
  "Activity Details",
  "Activity Category",
  "Activity Type",
  "Activity Owner",
  "MOP Required",
  "Activity Code",
  "Approval Require",
  "Approvers",
  "CRQ Required",
  "CRQ/PE/REQ Tpye",
  "CRQ No/PE",
  "Activity Start Time",
  "Activity End Time",
];

/** Field keys mapped to the TABLE cells (excluding Sl.No) */
const KEYS = [
  "date",
  "siteName",
  "siteCategory",
  "nodeName",
  "activityDetails",
  "activityCategory",
  "activityType",
  "performBy",
  "mopRequired",
  "activityCode",
  "approvalRequire",
  "approvers",
  "crRequired",
  "crqType",
  "crqNo",
  "activityStartTime",
  "activityEndTime",
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
  today.setHours(0, 0, 0, 0);

  const from = new Date(userData.adminAssignFrom);
  const to = new Date(userData.adminAssignTo);
  to.setHours(23, 59, 59, 999);

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
    userData?.designation === "Vertiv Site Infra Engineer" ||
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
    siteName: "",
    activityType: "",
    siteCategory: "",
    approvalStatus: "", // "", "done", "pending" (based on Approval Require)
  });

  /** chart refs */
  const approvalCanvasRef = useRef(null);
  const dailyTrendCanvasRef = useRef(null);
  const crqCanvasRef = useRef(null);
  const approvalChartRef = useRef(null);
  const dailyTrendChartRef = useRef(null);
  const crqChartRef = useRef(null);


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
          const siteName = sheet.siteName || "";
          const date = sheet.date
            ? sheet.date.toDate ? sheet.date.toDate().toISOString().slice(0, 10) : sheet.date
            : "";

          (sheet.rows || []).forEach((r, idx) => {
            out.push({
              _sheetId: sheetId,
              _rowIndex: idx,
              siteId,
              date,
              siteName,
              siteCategory: r.siteCategory || "",
              nodeName: r.nodeName || "",
              activityDetails: r.activityDetails || "",
              activityCategory: r.activityCategory || "",   // ✅ added
              activityType: r.activityType || "",
              performBy: r.performBy || "",                 // ✅ added
              activityCode: r.activityCode || "",          // ✅ added
              approvalRequire: r.approvalRequire || "",
              approvers: r.approvers || "",                // ✅ added
              cih: r.cih || "",
              centralInfra: r.centralInfra || "",
              ranOpsHead: r.ranOpsHead || "",
              coreOpsHead: r.coreOpsHead || "",
              fiberOpsHead: r.fiberOpsHead || "",
              crqType: r.crqType || "",                     // ✅ added
              crqNo: r.crqNo || "",
              activityStartTime: r.activityStartTime || "",
              activityEndTime: r.activityEndTime || "",
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

    // date range
    if (filters.dateFrom || filters.dateTo) {
      data = data.filter((r) => inDateRange(r.date, filters.dateFrom, filters.dateTo));
    }

    // activity type
    if (filters.activityType) {
      data = data.filter((r) => (r.activityType || "") === filters.activityType);
    }

    // site category
    if (filters.siteCategory) {
      data = data.filter((r) => (r.siteCategory || "") === filters.siteCategory);
    }

    // approval status by "Approval Require"
    // done → approvalRequire is non-empty; pending → empty
    if (filters.approvalStatus === "done") {
      data = data.filter((r) => (r.approvalRequire || "").trim() !== "");
    } else if (filters.approvalStatus === "pending") {
      data = data.filter((r) => (r.approvalRequire || "").trim() === "");
    }

    return data;
  }, [visibleRows, filters]);

  /** inline edit (admin only) — we update Firestore by row identity, not by index */
  async function handleEdit(rowObj, key, value) {
    if (!isAdmin) return;
    try {
      // optimistic UI
      setRows((prev) =>
        prev.map((r) =>
          r._sheetId === rowObj._sheetId && r._rowIndex === rowObj._rowIndex
            ? { ...r, [key]: value }
            : r
        )
      );

      // write to Firestore
      const ref = doc(db, "daily_activity_sheets", rowObj._sheetId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const data = snap.data();
      const arr = Array.isArray(data.rows) ? [...data.rows] : [];
      const target = { ...(arr[rowObj._rowIndex] || {}) };
      target[key] = value;
      arr[rowObj._rowIndex] = target;
      await updateDoc(ref, { rows: arr });
    } catch (e) {
      console.error("Edit failed", e);
    }
  }

  async function saveEdit(rowObj) {
    try {
      const ref = doc(db, "daily_activity_sheets", rowObj._sheetId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;

      const data = snap.data();
      const arr = [...(data.rows || [])];

      const updated = {};
      KEYS.forEach((k) => {
        updated[k] = draftRow[k] || "";
      });

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
    if (!isAdmin) return;
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
        "Site Name": r.siteName || "",
        "Site Category": r.siteCategory || "",
        "Node Name": r.nodeName || "",
        "Activity Details": r.activityDetails || "",
        "Activity Category": r.activityCategory || "",
        "Activity Type": r.activityType || "",
        "Activity Owner": r.performBy || "",
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
        "Activity Start Time": r.activityStartTime || "",
        "Activity End Time": r.activityEndTime || "",
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


  return (
    <div className="dhr-dashboard-container">
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
        <h6 style={{ marginLeft: "90%" }}>Thanks & Regurds @Suman Adhikari</h6>
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
                  <th key={label}>{label}</th>
                ))}

                {/* 🔹 Dynamic approval level headers */}
                {headerLevels.map((level) => (
                  <th key={level}>{level}</th>
                ))}

                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((rowObj, idx) => (
                <tr key={`${rowObj._sheetId}-${rowObj._rowIndex}`}>
                  <td>{idx + 1}</td>
                  {KEYS.map((k) => {
                    const isApprovers = k === "approvers";
                    const isCode = k === "activityCode";
                    const isColor = k.activityCode;

                    return (
                      <td key={k}
                        style={{
                          // maxHeight: isApprovers ? "10px" : "10px",
                          overflowY: isApprovers ? "auto" : "visible",
                          whiteSpace: isApprovers ? "nowrap" : "pre-line",
                          maxWidth: isApprovers ? "200px" : "auto",
                          scrollbarsWidth: isApprovers ? "thin" : "auto",
                          background: isCode ? isColor === "BLUE" ? "blue" : isColor === "GREEN" ? "green" : isColor === "AMBER" ? "amber" : isColor === "RED" ? "red" : "gray" : "",
                          // verticalAlign: "top",
                        }}
                      >
                        {isAdmin &&
                          editingRow &&
                          editingRow.sheetId === rowObj._sheetId &&
                          editingRow.rowIndex === rowObj._rowIndex ? (
                          <input
                            type="text"
                            className="daily-activity-input"
                            value={draftRow[k] || ""}
                            onChange={(e) =>
                              setDraftRow((d) => ({ ...d, [k]: e.target.value }))
                            }
                          />
                        ) : (
                          k === "approvers"
                            ? formatApproversForDashboard(rowObj.approvers)
                            : rowObj[k] || ""
                        )}
                      </td>
                    )
                  })}
                  {/* 🔹 Level-based approval status */}
                  {headerLevels.map((level) => {
                    const rowLevels = Array.isArray(rowObj.approvers)
                      ? rowObj.approvers.map((a) => a.level)
                      : [];

                    const hasLevel = rowLevels.includes(level);

                    return (
                      <td key={level}>
                        {hasLevel
                          ? rowObj.approvalStatusByLevel?.[level] || "NA"
                          : "—"}
                      </td>
                    );
                  })}

                  {isAdmin && (
                    <td>
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
                          <button
                            className="daily-activity-btn daily-activity-btn-danger"
                            onClick={() => handleDelete(rowObj)}
                          >
                            Delete
                          </button>
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
              <input
                className="daily-activity-input"
                placeholder="Search text"
                value={filters.searchText}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, searchText: e.target.value }))
                }
              />
              {isAdmin ? (
                <input
                  type="text"
                  className="daily-activity-input"
                  placeholder="Site name"
                  value={filters.siteName}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, siteName: e.target.value }))
                  }
                />
              ) : (
                <input
                  type="text"
                  className="daily-activity-input"
                  value={userData?.site || userData?.siteName || ""}
                  disabled
                />
              )}
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

              <select
                className="daily-activity-select"
                value={filters.approvalStatus}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, approvalStatus: e.target.value }))
                }
              >
                <option value="">All Approvals</option>
                <option value="done">Approval Done</option>
                <option value="pending">Approval Pending</option>
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
