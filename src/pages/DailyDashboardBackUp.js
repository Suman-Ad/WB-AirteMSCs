// src/pages/DailyDashboard.js
import React, { useEffect, useState, useMemo } from "react";
import { db } from "../firebase";
import { collection, getDocs, doc, setDoc, getDoc } from "firebase/firestore";
import * as XLSX from "xlsx";
import { Parser } from "hot-formula-parser";
import { sheetTemplates } from "../components/ExcelSheetEditor";
import { formulasConfig } from "../config/formulasConfig";
import { Link } from "react-router-dom";
import "../assets/DailyDashboard.css";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);
const storage = getStorage();

// sheetKeys same as before
const sheetKeys = {
  "Final Summary": "Final_Summary",
  "Diesel Back Up": "Diesel_Back_Up",
  "DG-EB Backup": "DG_EB_Backup",
  "Infra Update": "Infra_Update",
  "Fault Details": "Fault_Details",
  "Planned Activity Details": "Planned_Activity_Details",
  "Manpower Availability": "Manpower_Availability",
  "Sheet1": "Sheet1",
  "In House PM": "In_House_PM",
  "Sheet2": "Sheet2",
  "OEM PM": "OEM_PM",
  "Operational Governance Call": "Operational_Governance_Call"
};

const evaluateFormulasForRows = (rows = [], sheetKey = "") => {
  const cfg = formulasConfig[sheetKey] || {};
  const parser = new Parser();

  // Special handling for Final_Summary
  if (sheetKey === "Final_Summary" && Array.isArray(cfg)) {
    return rows.map(row => {
      const match = cfg.find(item => item.Edge_Data_Centres_Count === row.Edge_Data_Centres_Count);
      if (match && typeof match.WB === "string" && match.WB.trim().startsWith("=")) {
        const formulaSource = match.WB.trim().substring(1);
        // Set variables from row data of other sheets if needed here
        const res = parser.parse(formulaSource);
        return {
          ...row,
          WB: res.error ? "#ERROR" : res.result
        };
      }
      return row;
    });
  }

  // Normal sheets
  let cfgMap = {};
  if (!Array.isArray(cfg)) {
    cfgMap = cfg;
  }

  return (rows || []).map((row) => {
    const evaluated = { ...row };

    // set numeric variables
    Object.entries(row).forEach(([k, v]) => {
      if (typeof v === "string" && v.trim().startsWith("=")) return;
      const n = parseFloat(v);
      if (!isNaN(n)) parser.setVariable(k, n);
    });

    const formulaKeys = Object.keys(row).filter(k => typeof row[k] === "string" && row[k].trim().startsWith("="));
    Object.keys(cfgMap).forEach(k => {
      if (typeof cfgMap[k] === "string" && cfgMap[k].trim().startsWith("=") && !formulaKeys.includes(k)) {
        formulaKeys.push(k);
      }
    });

    const maxIter = Math.max(3, formulaKeys.length);
    for (let iter = 0; iter < maxIter; iter++) {
      let changed = false;
      for (const k of formulaKeys) {
        let formulaSource = null;
        if (typeof row[k] === "string" && row[k].trim().startsWith("=")) {
          formulaSource = row[k].trim().substring(1);
        } else if (typeof cfgMap[k] === "string" && cfgMap[k].trim().startsWith("=")) {
          formulaSource = cfgMap[k].trim().substring(1);
        }
        if (!formulaSource) continue;

        const res = parser.parse(formulaSource);
        if (!res.error) {
          if (evaluated[k] !== res.result) {
            evaluated[k] = res.result;
            parser.setVariable(k, res.result);
            changed = true;
          }
        } else {
          evaluated[k] = "#ERROR";
        }
      }
      if (!changed) break;
    }

    return evaluated;
  });
};

// --- Helper: compute metrics in JS (used for cached values and fallback chart) ---
const computeSummaryMetrics = (siteData) => {
  const totalSites = Object.keys(siteData).length;
  let less12 = 0;
  let more12 = 0;
  let dgHours = 0;
  let infraUptimeSum = 0;
  let infraCount = 0;
  let inhousePlanned = 0;
  let inhouseDone = 0;
  let oemPlanned = 0;
  let oemDone = 0;

  Object.values(siteData).forEach(data => {
    // Diesel backup checks
    const dieselRows = data["Diesel_Back_Up"] || [];
    dieselRows.forEach(row => {
      const hrs = parseFloat(row["Backup Hours"]) || 0;
      if (hrs < 12) less12++;
      if (hrs > 12) more12++;
    });

    // DG-EB backup
    const dgRows = data["DG_EB_Backup"] || [];
    dgRows.forEach(row => {
      const dg = parseFloat(row["DG Running Hrs"]) || 0;
      dgHours += dg;
    });

    // Infra update
    const infraRows = data["Infra_Update"] || [];
    infraRows.forEach(row => {
      if (row["Infra Uptime"]) {
        infraUptimeSum += parseFloat(row["Infra Uptime"]) || 0;
        infraCount++;
      }
    });

    // In-house PM
    const inhouseRows = data["In_House_PM"] || [];
    inhousePlanned += inhouseRows.length;
    inhouseRows.forEach(r => { if (r.Status === "Done") inhouseDone++; });

    // OEM PM
    const oemRows = data["OEM_PM"] || [];
    oemPlanned += oemRows.length;
    oemRows.forEach(r => { if (r.Status === "Done") oemDone++; });
  });

  const ebHours = (totalSites * 24) - dgHours;
  const avgInfraUptime = infraCount > 0 ? (infraUptimeSum / infraCount) : 0;

  return {
    totalSites,
    less12,
    more12,
    dgHours,
    ebHours,
    infraUptime: avgInfraUptime,
    inhousePlanned,
    inhouseDone,
    oemPlanned,
    oemDone,
  };
};

const DailyDashboard = ({ userData }) => {
  const userName = userData?.name;
  const userRole = userData?.role;
  const userSite = userData?.site;
  const userDesignation = userData?.designation;
  const today = new Date().toISOString().split("T")[0];
  const [dates, setDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(today);
  const [siteData, setSiteData] = useState({});
  const [sortAsc, setSortAsc] = useState(true);
  const [instructionText, setInstructionText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [summaryMetrics, setSummaryMetrics] = useState(null);

  // 🔹 NEW: state for parsed Final Summary from compiled Excel
  const [finalSummaryData, setFinalSummaryData] = useState(null);

  useEffect(() => {
    const fetchInstruction = async () => {
      const docRef = doc(db, "config", "daily_details_dashboard_instruction");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setInstructionText(docSnap.data().text || "");
        setEditText(docSnap.data().text || "");
      }
    };
    fetchInstruction();
  }, []);

  // fetch date list
  useEffect(() => {
    const run = async () => {
      const snap = await getDocs(collection(db, "excel_data_by_date"));
      const list = snap.docs.map(d => d.id).sort().reverse();
      setDates(list);
    };
    if (userRole !== "User") run();
  }, [userRole]);

  // fetch site docs under the selected date
  useEffect(() => {
    const run = async () => {
      if (!selectedDate) return;
      const siteSnap = await getDocs(collection(db, "excel_data_by_date", selectedDate, "sites"));
      const all = {};
      siteSnap.forEach(s => { all[s.id] = s.data(); });
      if (userRole === "User") {
        setSiteData(userSite && all[userSite] ? { [userSite]: all[userSite] } : {});
      } else {
        setSiteData(all);
      }
    };
    run();
  }, [selectedDate, userRole, userSite]);

  const getSheetStatus = (rows) => {
    if (!Array.isArray(rows) || rows.length === 0) return { status: "Empty", color: "red", filled: 0, total: 0 };
    const keys = Object.keys(rows[0]);
    const total = rows.length * keys.length;
    let filled = 0;
    rows.forEach(row => {
      keys.forEach(k => {
        if (row[k] !== "" && row[k] !== null && row[k] !== undefined) filled++;
      });
    });
    if (filled === 0) return { status: "Empty", color: "red", filled, total };
    if (filled < total) return { status: "Partial", color: "orange", filled, total };
    return { status: "Complete", color: "green", filled, total };
  };

  // --- 🔹 NEW: create compiled Excel with cached values for Final Summary ---
  const generateCompiledExcel = () => {
    const wb = XLSX.utils.book_new();

    // compute metrics for cached values
    const m = computeSummaryMetrics(siteData);
    const inhousePct = m.inhousePlanned ? (m.inhouseDone / m.inhousePlanned) * 100 : 0;
    const oemPct = m.oemPlanned ? (m.oemDone / m.oemPlanned) * 100 : 0;

    // Build Final Summary with formula + cached value (v). This preserves your Excel formulas
    // but also allows us to read numeric values back in the app.
    const fs = [
      ["Edge Data Centres Count", "WB"],
      [{ f: "Total Site Count", v: "Total Site Count" }, { f: "=COUNTA('Diesel Back Up'!C2:C13)", v: m.totalSites }],
      ["Category Checks", ""],
      [
        { f: "Sites Less Than 12 Hrs Diesel Back Up", v: "Sites Less Than 12 Hrs Diesel Back Up" },
        { f: "=COUNTIF('Diesel Back Up'!M:M, \"<12\")", v: m.less12 }
      ],
      [
        { f: "Sites More Than 12 Hrs Diesel Back Up", v: "Sites More Than 12 Hrs Diesel Back Up" },
        { f: "=COUNTIF('Diesel Back Up'!M:M, \">12\")", v: m.more12 }
      ],
      [
        "MSC more than 2500 Litres excluding Day Tanks",
        { f: "=COUNTIF('Diesel Back Up'!G:G, \">2500\")" }
      ],
      [
        "MSC more than 2500 Litres Including Day Tanks",
        { f: "=COUNTIF('Diesel Back Up'!I:I, \">2500\")" }
      ],
      [
        { f: "DG Running Hrs.", v: "DG Running Hrs." },
        { f: "=SUM('DG-EB Backup'!F2:F21)", v: m.dgHours }
      ],
      [
        { f: "EB Availability Hrs.", v: "EB Availability Hrs." },
        { f: "=(B2*24)-SUM('DG-EB Backup'!E2:E21)", v: m.ebHours }
      ],
      [
        { f: "Infra Uptime", v: "Infra Uptime" },
        { f: "=AVERAGE('Infra Update'!F2:F22)", v: m.infraUptime }
      ],
      ["Infra Uptime with Redundancy", "100%"],
      ["Minor Fault Details (If any)", "N"],
      ["Major Fault Details (If any)", "N"],
      ["Planned Activity Details", "Y"],
      [],
      ["Edge Data Centres Count", "WB"],
      [{ f: "Total Site Count", v: "Total Site Count" }, { f: "=B2", v: m.totalSites }],
      ["Category Checks", ""],
      ["O&M Manpower Availability as Per LOI", "Ok"],
      [
        { f: "In House PM Planned (Aug'25 Month)", v: "In House PM Planned (Aug'25 Month)" },
        { f: "=COUNTA('In House PM'!A2:A10000)", v: m.inhousePlanned }
      ],
      [
        { f: "In House PM Completed (Aug'25 Month)", v: "In House PM Completed (Aug'25 Month)" },
        { f: "=COUNTIF('In House PM'!I:I, \"Done\")", v: m.inhouseDone }
      ],
      [
        { f: "Inhouse PM Completion %", v: "Inhouse PM Completion %" },
        { f: "=(B21/B20)*100", v: inhousePct }
      ],
      [
        { f: "OEM PM Planned (Jul'25 Month)", v: "OEM PM Planned (Jul'25 Month)" },
        { f: "=COUNTA('OEM PM'!A2:A10000)", v: m.oemPlanned }
      ],
      [
        { f: "OEM PM Completed (Jul'25 Month)", v: "OEM PM Completed (Jul'25 Month)" },
        { f: "=COUNTIF('OEM PM'!P:P, \"Done\")", v: m.oemDone }
      ],
      [
        { f: "OEM PM Completion %", v: "OEM PM Completion %" },
        { f: "=(B24/B23)*100", v: oemPct }
      ],
      ["Incidents / Accidents Reported", 0],
      ["EOL Replacement Planned", 0],
      ["EOL Replacement Completed", 0],
      ["Operational Governance Call Planned", 0],
      ["Operational Governance Call Executed", 0],
    ];

    const fsSheet = XLSX.utils.aoa_to_sheet(fs);
    XLSX.utils.book_append_sheet(wb, fsSheet, "Final Summary");

    // compile sheets site-wise using evaluated values
    Object.entries(sheetKeys).forEach(([sheetLabel, sheetKey]) => {
      if (sheetLabel === "Final Summary") return; // ✅ Skip duplicate Final Summary
      const allRows = [];
      Object.entries(siteData).forEach(([site, data]) => {
        const rows = data[sheetKey] || [];
        if (!Array.isArray(rows) || rows.length === 0) return;
        const evaluated = evaluateFormulasForRows(rows, sheetKey);
        evaluated.forEach(er => {
          const out = { Site: site };
          // use template column order if available
          const template = sheetTemplates[sheetKey];
          const cols = template ? Object.keys(template[0]) : Object.keys(er);
          cols.forEach(c => { out[c] = er[c] ?? ""; });
          allRows.push(out);
        });
      });
      if (allRows.length) {
        const ws = XLSX.utils.json_to_sheet(allRows, {raw: false});
        XLSX.utils.book_append_sheet(wb, ws, sheetLabel);
      }
    });

    return XLSX.write(wb, { bookType: "xlsx", type: "array" }); // ArrayBuffer
  };

  // 🔹 NEW: upload compiled file and then fetch it back to parse Final Summary
  const uploadCompiledExcel = async () => {
    if (!siteData || Object.keys(siteData).length === 0) return;
    try {
      const buffer = generateCompiledExcel();
      const fileRef = ref(storage, `compiled_reports/WB_Daily_Details_${selectedDate}.xlsx`);
      await uploadBytes(fileRef, buffer, { contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    } catch (e) {
      console.error("Upload compiled Excel failed", e);
    }
  };

  const fetchCompiledExcelData = async () => {
    try {
      const fileRef = ref(storage, `compiled_reports/WB_Daily_Details_${selectedDate}.xlsx`);
      const url = await getDownloadURL(fileRef);
      const resp = await fetch(url);
      const arr = await resp.arrayBuffer();
      const wb = XLSX.read(arr, { type: "array" });
      const sheet = wb.Sheets["Final Summary"];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      setFinalSummaryData(data);
    } catch (e) {
      console.warn("Fetch compiled Excel failed (will use fallback metrics)", e);
      setFinalSummaryData(null);
    }
  };

  // When siteData changes → upload compiled & then fetch it back (keeps chart in sync)
  useEffect(() => {
    if (Object.keys(siteData).length > 0) {
      (async () => { await uploadCompiledExcel(); await fetchCompiledExcelData(); })();
    } else {
      setFinalSummaryData(null);
    }
  }, [siteData, selectedDate]);

  const downloadExcel = () => {
    // Keep original behavior (manual download), now using the same generator
    const buffer = generateCompiledExcel();
    const wb = XLSX.read(buffer, { type: "array" });
    XLSX.writeFile(wb, `WB_Daily_Details_${selectedDate}.xlsx`);
  };

  // Keep your existing summaryMetrics computation (also used as fallback)
  useEffect(() => {
    if (!siteData || Object.keys(siteData).length === 0) {
      setSummaryMetrics(null);
      return;
    }

    setSummaryMetrics(computeSummaryMetrics(siteData));
  }, [siteData]);

  // Prefer Final Summary (from compiled file) for the chart; fallback to computed metrics
  const summaryChartData = useMemo(() => {
    if (finalSummaryData && Array.isArray(finalSummaryData)) {
      const labels = [];
      const values = [];
      finalSummaryData.forEach((row, i) => {
        if (!row || row.length < 2) return;
        const label = row[0];
        const val = row[1];
        // Skip header rows and empty lines
        if (typeof label !== "string") return;
        if (label.toLowerCase().includes("edge data centres count") || label.toLowerCase().includes("category checks") || label.trim() === "") return;
        let num = 0;
        if (typeof val === "number") num = val;
        else if (typeof val === "string") {
          const cleaned = val.replace(/%/g, "").trim();
          const parsed = parseFloat(cleaned);
          if (!isNaN(parsed)) num = parsed;
        } else if (val && typeof val.v === "number") {
          num = val.v;
        }
        // Only push numeric rows
        if (!isNaN(num)) {
          labels.push(label);
          values.push(num);
        }
      });
      if (labels.length) {
        return {
          labels,
          datasets: [
            {
              label: "WB Daily Summary Matrix",
              data: values,
              backgroundColor: [
                "#4caf50",
                "#ff9800",
                "#f44336",
                "#3f51b5",
                "#2196f3",
                "#9c27b0",
                "#00bcd4",
                "#8bc34a",
                "#ffc107",
                "#e91e63",
              ],
            },
          ],
        };
      }
    }

    if (!summaryMetrics) return null;

    return {
      labels: [
        "Total Site Count",
        "Sites <12 Hrs Diesel Back Up",
        "Sites >12 Hrs Diesel Back Up",
        "DG Running Hrs.",
        "EB Availability Hrs.",
        "Infra Uptime (%)",
        "Inhouse PM Completion %",
        "OEM PM Completion %",
      ],
      datasets: [
        {
          label: "WB Daily Summary (Fallback)",
          data: [
            summaryMetrics.totalSites,
            summaryMetrics.less12,
            summaryMetrics.more12,
            summaryMetrics.dgHours,
            summaryMetrics.ebHours,
            summaryMetrics.infraUptime,
            summaryMetrics.inhousePlanned ? (summaryMetrics.inhouseDone / summaryMetrics.inhousePlanned) * 100 : 0,
            summaryMetrics.oemPlanned ? (summaryMetrics.oemDone / summaryMetrics.oemPlanned) * 100 : 0,
          ],
          backgroundColor: [
            "#4caf50",
            "#ff9800",
            "#f44336",
            "#3f51b5",
            "#2196f3",
            "#9c27b0",
            "#00bcd4",
            "#8bc34a",
          ],
        },
      ],
    };
  }, [finalSummaryData, summaryMetrics]);

  const handleEdit = async (site, sheetName, rowIndex, colKey, newValue) => {
    // only Admin/Super Admin can edit via this dashboard
    if (!["Admin", "Super Admin"].includes(userRole)) return;

    const siteDocRef = doc(db, "excel_data_by_date", selectedDate, "sites", site);
    // fetch the site doc (could use local state)
    const siteDoc = siteData[site] ? { ...siteData[site] } : {};
    const rows = Array.isArray(siteDoc[sheetName]) ? [...siteDoc[sheetName]] : [];
    if (!rows[rowIndex]) return;
    // if the column is a formula (either stored as "=..." or declared in config), prevent editing
    const rawVal = rows[rowIndex][colKey];
    const cfgFormula = formulasConfig[sheetName]?.[colKey];
    if ((typeof rawVal === "string" && rawVal.trim().startsWith("=")) || (typeof cfgFormula === "string")) {
      // do not allow editing formula cell
      return;
    }

    rows[rowIndex] = { ...rows[rowIndex], [colKey]: newValue };
    siteDoc[sheetName] = rows;
    // update DB with merge
    await setDoc(siteDocRef, siteDoc, { merge: true });

    // update local state
    setSiteData(prev => ({ ...prev, [site]: siteDoc }));
  };

  const sortedSites = Object.keys(siteData).sort((a, b) => sortAsc ? a.localeCompare(b) : b.localeCompare(a));

  if (userRole === "User") {
    return <h3 style={{ padding: "2rem", color: "crimson" }}>🚫 You don't have access to this dashboard.</h3>;
  }

  // Render
  return (
    <div className="dhr-dashboard-container">
      <h1 className="dashboard-header">
        <strong>📅 Daily Details Dashboard</strong>
      </h1>

      {summaryChartData && (
        <div style={{ marginBottom: "2rem" }} className="summary-chart-container">
          <h3>📊 Summary Overview</h3>
          <div style={{ maxWidth: "800px", margin: "auto" }} className="chart-wrapper chart-container">
            <Bar data={summaryChartData} options={{
              responsive: true,
              plugins: { legend: { position: "top" }, title: { display: true, text: "WB Daily Summary" } }
            }} />
          </div>
        </div>
      )}

      <h3>✅ Completed Site Submission Status</h3>
      <div style={{ overflowX: "auto" }} className="status-table-container">
        <table className="status-table child-container" style={{ minWidth: "800px", borderCollapse: "collapse", marginBottom: "2rem" }}>
          <thead>
            <tr>
              <th>Site</th>
              <th>Status</th>
              <th>Completion %</th>
            </tr>
          </thead>
          <tbody>
            {sortedSites.map((site) => {
              const siteSheets = siteData[site] || {};
              let filledTotal = 0;
              let totalFields = 0;

              Object.values(sheetKeys).forEach((key) => {
                const rows = siteSheets[key];
                if (Array.isArray(rows) && rows.length > 0) {
                  const keys = Object.keys(rows[0]);
                  totalFields += rows.length * keys.length;
                  rows.forEach(row => {
                    keys.forEach(k => {
                      if (row[k] !== "" && row[k] !== null && row[k] !== undefined) filledTotal++;
                    });
                  });
                }
              });

              const percentage = totalFields > 0 ? ((filledTotal / totalFields) * 100).toFixed(0) : 0;
              const isComplete = percentage === "100";

              return (
                <tr key={site}>
                  <td>{site}</td>
                  <td className={isComplete ? "status-complete" : "status-pending"}>
                    {isComplete ? "✅ Completed" : "⛔ Pending"}
                  </td>
                  <td>{percentage}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="instruction-tab">
        <h2 className="noticeboard-header">📌 Notice Board </h2>
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
                  const docRef = doc(db, "config", "daily_details_dashboard_instruction");
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
            {["Admin", "Super Admin"].includes(userRole) && (
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

      <h2>📘 Daily Details Dashboard - WB Circle</h2>
      {(userData.role === "Super User" || userData.role === "Admin" || userData.role === "Super Admin") && (
        <Link to="/excel-live-edit" className="pm-manage-btn">Edit <strong>"{userData.site}"</strong> Daily Details Dashboard ✎ </Link>
      )}

      <div style={{ marginBottom: "1rem" }}>
        <label>Select Date: </label>
        <select value={selectedDate} onChange={e => setSelectedDate(e.target.value)}>
          {!dates.includes(today) && <option value={today}>{today} (Today)</option>}
          <option value="">-- Select Date --</option>
          {dates.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        <button onClick={() => setSortAsc(!sortAsc)} className="btn-info">
          Sort: {sortAsc ? "A-Z" : "Z-A"}
        </button>

        <button onClick={downloadExcel} className="btn-success pm-manage-btn">📥 Download Compiled Excel</button>
      </div>

      {Object.keys(siteData).sort((a, b) => sortAsc ? a.localeCompare(b) : b.localeCompare(a)).map(site => {
        const sheets = siteData[site] || {};
        return (
          <div key={site} style={{ marginTop: 20, borderTop: "1px solid #ccc", paddingTop: 12 }} className="child-container">
            <h3>📍 Site: {site} MSC</h3>

            <div className="sheet-blocks-wrapper sheet-block-card status-table" style={{ overflowY: "auto", height: "1170px" }}>
              {Object.entries(sheetKeys).map(([sheetLabel, sheetKey]) => {
                const rows = sheets[sheetKey] || [];
                const { status, color, filled, total } = getSheetStatus(rows || []);
                const evaluated = evaluateFormulasForRows(rows, sheetKey);
                const template = sheetTemplates[sheetKey];
                const cols = template ? Object.keys(template[0]) : (rows.length ? Object.keys(rows[0]) : []);
                return (
                  <div key={sheetKey} className="sheet-block-card">
                    <h4>Sheet: {sheetLabel} — <span style={{ color }}>{status}</span> ({filled}/{total})</h4>
                    <div style={{ overflowX: "auto" }}>
                      <table>
                        <thead>
                          <tr>{cols.map(c => <th key={c}>{c}</th>)}</tr>
                        </thead>
                        <tbody>
                          {evaluated.map((er, rIdx) => (
                            <tr key={rIdx}>
                              {cols.map((c, ci) => (
                                <td key={ci}>
                                  {["Admin","Super Admin"].includes(userRole) ? (
                                    <input
                                      type="text"
                                      defaultValue={rows[rIdx]?.[c] ?? ""}
                                      onBlur={(e) => handleEdit(site, sheetKey, rIdx, c, e.target.value)}
                                      disabled={(typeof rows[rIdx]?.[c] === "string" && rows[rIdx][c].trim().startsWith("=")) || Boolean(formulasConfig[sheetKey]?.[c]) }
                                    />
                                  ) : (
                                    er[c] ?? ""
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DailyDashboard;
