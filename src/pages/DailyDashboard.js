// src/pages/DailyDashboard.js
import React, { useEffect, useState, useMemo } from "react";
import { db } from "../firebase";
import { collection, getDocs, doc, setDoc,getDoc } from "firebase/firestore";
import * as XLSX from "xlsx";
import { Parser } from "hot-formula-parser";
import { sheetTemplates } from "../components/ExcelSheetEditor";
import { formulasConfig } from "../config/formulasConfig";
import { Link } from "react-router-dom";
import "../assets/DailyDashboard.css";

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
  const today = new Date().toISOString().split("T")[0];
  const [dates, setDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(today);
  const [siteData, setSiteData] = useState({});
  const [sortAsc, setSortAsc] = useState(true);
  const [instructionText, setInstructionText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");  
  // const userName = userData?.name;
  // const userRole = userData?.role;
  // const userSite = userData?.site;
  // const today = new Date().toISOString().split("T")[0];

  // const [dates, setDates] = useState([]);
  // const [selectedDate, setSelectedDate] = useState(today);
  // const [siteData, setSiteData] = useState({});
  // const [sortAsc, setSortAsc] = useState(true);

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

    // example: add a Final Summary sheet (static)
    const finalSummaryData = [
      ["Edge Data Centres Count", "WB"],
      ["", 12],
      // ...example; you may want to programmatically build from templates
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(finalSummaryData), "Final Summary");

    // compile sheets site-wise using evaluated values
    Object.entries(sheetKeys).forEach(([sheetLabel, sheetKey]) => {
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
        const ws = XLSX.utils.json_to_sheet(allRows);
        XLSX.utils.book_append_sheet(wb, ws, sheetLabel);
      }
    });

    XLSX.writeFile(wb, `WB_Daily_Details_${selectedDate}.xlsx`);
  };

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
    <div style={{ padding: "1rem" }}>
      <h2 className="dashboard-header">
  👋    Welcome, <strong>{userName || "Team Member"}</strong>
      </h2>
      <p className="dashboard-subinfo">
        {userRole === "Super Admin" && <span>🔒 <strong>Super Admin</strong></span>}
        {userRole === "Admin" && <span>🛠️ <strong>Admin</strong></span>}
        {userRole === "Super User" && <span>📍 <strong>Super User</strong></span>}
        {userRole === "User" && <span>👤 <strong>User</strong></span>}
        &nbsp; | &nbsp; 🏢 Site: <strong>{userSite || "All"}</strong> | &nbsp; 🛡️ Site ID: <strong>{userData.siteId || "All"}</strong>
      </p>
      <h1>
        <strong>📅 Daily Dashboard</strong>
      </h1> 
      <div className="instruction-tab">
        <h2 className="dashboard-header">📌 Notice Board </h2>
        <h3 className="dashboard-header">📘 App Overview </h3>
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
      <h3>✅ Completed Site Submission Status</h3>
      <div style={{ overflowX: "auto" }}>
        <table className="status-table" style={{ minWidth: "800px", borderCollapse: "collapse", marginBottom: "2rem" }}>
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

        <button onClick={() => setSortAsc(!sortAsc)} style={{ marginLeft: 8 }}>
          Sort: {sortAsc ? "A-Z" : "Z-A"}
        </button>

        <button onClick={downloadExcel} style={{ marginLeft: 8 }}>📥 Download Compiled Excel</button>
      </div>

      {sortedSites.map(site => {
        const sheets = siteData[site] || {};
        return (
          <div key={site} style={{ marginTop: 20, borderTop: "1px solid #ccc", paddingTop: 12 }}>
            <h3>📍 Site: {site} MSC</h3>

            <div className="sheet-blocks-wrapper sheet-block-card">
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
