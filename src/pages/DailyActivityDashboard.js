import React, { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs, getDoc, updateDoc, doc , setDoc} from "firebase/firestore";
import * as XLSX from "xlsx";
import { Link } from "react-router-dom";
import Chart from "chart.js/auto"; // auto-registers needed controllers
import "../assets/daily-activity.css";

/** Column headers in the exact ordered structure you requested */
const LABELS = [
  "Sl.No",
  "Date",
  "Site Name",
  "Node Name",
  "Activity Details",
  "Activity Type",
  "Site Category",
  "Approval Require",
  "CIH",
  "Central Infra",
  "RAN OPS head",
  "Core OPS head",
  "Fiber OPS head",
  "CRQ No/PE",
  "Activity Start Time",
  "Activity End Time",
];

/** Field keys mapped to the TABLE cells (excluding Sl.No) */
const KEYS = [
  "date",
  "siteName",
  "nodeName",
  "activityDetails",
  "activityType",
  "siteCategory",
  "approvalRequire",
  "cih",
  "centralInfra",
  "ranOpsHead",
  "coreOpsHead",
  "fiberOpsHead",
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

export default function DailyActivityDashboard({ userData }) {
  /** permissions */
  const isAdmin =
    userData?.role === "Super Admin" ||
    userData?.role === "Admin" ||
    !!userData?.isAdminAssigned;

  /** raw rows and filtered rows */
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  /** filter popup state */
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    searchText: "",
    dateFrom: "",
    dateTo: "",
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
          const date = sheet.date || "";
          (sheet.rows || []).forEach((r, idx) => {
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
  }, []);

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

  /** export current filtered rows to Excel */
  function exportExcel() {
    const exportData = filteredRows.map((r, i) => ({
      [LABELS[0]]: i + 1,
      [LABELS[1]]: r.date || "",
      [LABELS[2]]: r.siteName || "",
      [LABELS[3]]: r.nodeName || "",
      [LABELS[4]]: r.activityDetails || "",
      [LABELS[5]]: r.activityType || "",
      [LABELS[6]]: r.siteCategory || "",
      [LABELS[7]]: r.approvalRequire || "",
      [LABELS[8]]: r.cih || "",
      [LABELS[9]]: r.centralInfra || "",
      [LABELS[10]]: r.ranOpsHead || "",
      [LABELS[11]]: r.coreOpsHead || "",
      [LABELS[12]]: r.fiberOpsHead || "",
      [LABELS[13]]: r.crqNo || "",
      [LABELS[14]]: r.activityStartTime || "",
      [LABELS[15]]: r.activityEndTime || "",
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Daily Activities");
    XLSX.writeFile(wb, `DailyActivityDashboard_${Date.now()}.xlsx`);
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
      dateFrom: "",
      dateTo: "",
      siteName: "",
      activityType: "",
      siteCategory: "",
      approvalStatus: "",
    });

  return (
    <div className="dhr-dashboard-container">
      <div className="daily-activity-header">
        <h1 className="dashboard-header">
          <strong>🏗️ Daily Activity Dashboard</strong>
        </h1>

        
        <div className="daily-activity-subtitle">
          {isAdmin ? "Admin view: all sites" : "User view: your site only"}
        </div>
        {(userData?.role === "Super User" || userData?.role === "Admin" || userData?.role === "Super Admin" || userData?.role === "User") && (
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
          <h6 style={{marginLeft: "90%"}}>Thanks & Regurds @Suman Adhikari</h6>
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
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((rowObj, idx) => (
                <tr key={`${rowObj._sheetId}-${rowObj._rowIndex}`}>
                  <td>{idx + 1}</td>
                  {KEYS.map((k) => (
                    <td key={k}>
                      {isAdmin ? (
                        <input
                          type="text"
                          className="daily-activity-input"
                          value={rowObj[k] || ""}
                          onChange={(e) => handleEdit(rowObj, k, e.target.value)}
                        />
                      ) : (
                        rowObj[k] || ""
                      )}
                    </td>
                  ))}
                  {isAdmin && (
                    <td>
                      <button
                        className="daily-activity-btn daily-activity-btn-danger"
                        onClick={() => handleDelete(rowObj)}
                      >
                        Delete
                      </button>
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
              <input
                type="text"
                className="daily-activity-input"
                placeholder="Site name"
                value={filters.siteName}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, siteName: e.target.value }))
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
