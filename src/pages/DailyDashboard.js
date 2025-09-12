// src/pages/DailyDashboard.js
import React, { useEffect, useState, useMemo } from "react";
import { db } from "../firebase";
import { collection, getDocs, doc, setDoc,getDoc, } from "firebase/firestore";
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

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);


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

  const downloadExcel = () => {
    const wb = XLSX.utils.book_new();
    // Get current month in format Aug'25
    const now = new Date();
    const monthYear = now.toLocaleString("en-US", {
      month: "short"
    }) + "'" + now.getFullYear().toString().slice(-2);

    // example: add a Final Summary sheet (static)
    const finalSummaryData = [
      ["Edge Data Centres Count", "WB"],
      ["Total Site Count", {f: "=COUNTA('Diesel Back Up'!C2:C13)"}],
      ["Category Checks", ""],
      ["Sites Less Than 12 Hrs Diesel Back Up", { f: "=COUNTIF('Diesel Back Up'!M:M, \"<12\")" }],
      ["Sites More Than 12 Hrs Diesel Back Up", { f: "=COUNTIF('Diesel Back Up'!M:M, \">12\")" }],
      ["MSC more than 2500 Litres excluding Day Tanks", { f: "=COUNTIF('Diesel Back Up'!G:G, \">2500\")" }],
      ["MSC more than 2500 Litres Including Day Tanks", { f: "=COUNTIF('Diesel Back Up'!I:I, \">2500\")" }],
      ["DG Running Hrs.", {f: "=SUM('DG-EB Backup'!F2:F21)"}],
      ["EB Availability Hrs.", {f: "=(B2*24)-SUM('DG-EB Backup'!E2:E21)"}],
      ["Infra Uptime", {f: "=AVERAGE('Infra Update'!F2:F22)"}],
      ["Infra Uptime with Redundancy", "100%"],
      ["Minor Fault Details (If any)", "N"],
      ["Major Fault Details (If any)", "N"],
      ["Planned Activity Details", "Y"],

      [`Month ${monthYear}`],
      ["Edge Data Centres Count", "WB"],
      ["Total Site Count", {f: "=B2"}],
      ["Category Checks", ""],
      ["O&M Manpower Availability as Per LOI", "Ok"],
      [`In House PM Planned (${monthYear} Month)`, {f: "=COUNTA('In House PM'!C2:C10000)"}],
      [`In House PM Completed (${monthYear} Month)`, {f: "=COUNTIF('In House PM'!I:I, \"Done\")"}],
      ["Inhouse PM Completion %", { f: "=(B21/B20)*100" }],
      [`OEM PM Planned (${monthYear} Month)`, {f: "=COUNTA('OEM PM'!C2:C10000)"}],
      [`OEM PM Completed (${monthYear} Month)`, {f: "=COUNTIF('OEM PM'!P:P, \"Done\")"}],
      ["OEM PM Completion %", { f: "=(B24/B23)*100" }],
      ["Incidents / Accidents Reported", 0],
      ["EOL Replacement Planned", 0],
      ["EOL Replacement Completed", 0],
      ["Operational Governance Call Planned", 0],
      ["Operational Governance Call Executed", 0],
    ];
    
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(finalSummaryData), "Final Summary");

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

    XLSX.writeFile(wb, `WB_Daily_Details_${selectedDate}.xlsx`);
  };

  useEffect(() => {
    if (!siteData || Object.keys(siteData).length === 0) {
      setSummaryMetrics(null);
      return;
    }

    let totalSites = Object.keys(siteData).length;
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
        // Use correct column name; adjust if needed
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

    // Now calculate EB hours AFTER loop
    const ebHours = (totalSites * 24) - dgHours;
    const avgInfraUptime = infraCount > 0 ? (infraUptimeSum / infraCount) : 0;

    setSummaryMetrics({
      totalSites,
      less12,
      more12,
      dgHours,
      ebHours,
      infraUptime: avgInfraUptime,
      inhousePlanned,
      inhouseDone,
      oemPlanned,
      oemDone
    });

  }, [siteData]);

  const summaryChartData = useMemo(() => {
    if (!summaryMetrics) return null;

    return {
      labels: [
        "Total Sites",
        "<12 Hrs Backup",
        ">12 Hrs Backup",
        "DG Hours",
        "EB Hours",
        "Infra Uptime %",
        "In-House PM %",
        "OEM PM %"
      ],
      datasets: [
        {
          label: "Summary Metrics",
          data: [
            summaryMetrics.totalSites,
            summaryMetrics.less12,
            summaryMetrics.more12,
            summaryMetrics.dgHours,
            summaryMetrics.ebHours,
            summaryMetrics.infraUptime,
            summaryMetrics.inhousePlanned ? (summaryMetrics.inhouseDone / summaryMetrics.inhousePlanned) * 100 : 0,
            summaryMetrics.oemPlanned ? (summaryMetrics.oemDone / summaryMetrics.oemPlanned) * 100 : 0
          ],
          backgroundColor: [
            "#4caf50",
            "#ff9800",
            "#f44336",
            "#3f51b5",
            "#2196f3",
            "#9c27b0",
            "#00bcd4",
            "#8bc34a"
          ]
        }
      ]
    };
  }, [summaryMetrics]);



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
      {/* {summaryChartData && (
        <div style={{ marginBottom: "2rem" }} className="summary-chart-container">
          <h3>📊 Summary Overview</h3>
          <div style={{ maxWidth: "800px", margin: "auto" }} className="chart-wrapper chart-container">
            <Bar data={summaryChartData} options={{
              responsive: true,
              plugins: { legend: { position: "top" }, title: { display: true, text: "WB Daily Summary" } }
            }} />
          </div>
        </div>
      )} */}

      
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
      <div style={{ marginBottom: "1rem"}}>
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

      {sortedSites.map(site => {
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
                                      disabled={ (typeof rows[rIdx]?.[c] === "string" && rows[rIdx][c].trim().startsWith("=")) || Boolean(formulasConfig[sheetKey]?.[c]) }
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
