// src/pages/DailyDashboard.js
import React, { useEffect, useState, useMemo } from "react";
import { db } from "../firebase";
import { collection, getDocs, doc, setDoc, getDoc, onSnapshot } from "firebase/firestore";
import * as XLSX from "xlsx";
import { evaluateFormulasForRows } from "../utils/dailySheetFormulas";
import FinalSummary from "../components/FinalSummary";
import { sheetTemplates } from "../components/ExcelSheetEditor";
import { formulasConfig } from "../config/formulasConfig";
import { Link } from "react-router-dom";
import "../assets/DailyDashboard.css";
import useDailyDashboardAutofill from "../hooks/useDailyDashboardAutofill";
import { getISTDate, mergeDailyAutofill } from "../utils/dailyDashboardAutofill";
// sheetKeys same as before
const sheetKeys = {
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



const DailyDashboard = ({ userData }) => {
  const userRole = userData?.role;
  const today = getISTDate();
  const [dates, setDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(today);
  const [storedSiteData, setSiteData] = useState({});
  const { patches, error: autofillError } = useDailyDashboardAutofill(Object.keys(storedSiteData), selectedDate, Boolean(userRole) && userRole !== "User");
  const siteData = useMemo(() => Object.fromEntries(Object.entries(storedSiteData).map(([site, data]) => [site, patches[site] ? mergeDailyAutofill(data, patches[site]) : data])), [storedSiteData, patches]);
  const [sortAsc, setSortAsc] = useState(true);
  const [instructionText, setInstructionText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");

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

  // Keep site submissions current while source autofill updates arrive.
  useEffect(() => {
    setSiteData({});
    if (!selectedDate || !userRole || userRole === "User") return;
    return onSnapshot(collection(db, "excel_data_by_date", selectedDate, "sites"), snapshot => {
      const all = {};
      snapshot.forEach(site => { all[site.id] = site.data(); });
      setSiteData(all);
    }, error => console.error("Daily dashboard load failed", error));
  }, [selectedDate, userRole]);

  const getSheetStatus = (rows) => {
    if (!Array.isArray(rows) || rows.length === 0) return { status: "Empty", color: "red", filled: 0, total: 0 };
    const keys = Object.keys(rows[0]).filter(key => !key.startsWith("__"));
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
      ["Total Site Count", { f: "=COUNTA('Diesel Back Up'!A2:A13)" }],
      ["Category Checks", ""],
      ["Sites Less Than 12 Hrs Diesel Back Up", { f: "=COUNTIF('Diesel Back Up'!L:L, \"<12\")" }],
      ["Sites More Than 12 Hrs Diesel Back Up", { f: "=COUNTIF('Diesel Back Up'!L:L, \">12\")" }],
      ["MSC more than 2500 Litres excluding Day Tanks", { f: "=COUNTIF('Diesel Back Up'!F:F, \">2500\")" }],
      ["MSC more than 2500 Litres Including Day Tanks", { f: "=COUNTIF('Diesel Back Up'!H:H, \">2500\")" }],
      ["DG Running Hrs.", { f: "=SUM('DG-EB Backup'!E2:E21)" }],
      ["EB Availability Hrs.", { f: "=(B2*24)-SUM('DG-EB Backup'!D2:D21)" }],
      ["Infra Uptime", { f: "=AVERAGE('Infra Update'!E2:E22)" }],
      ["Infra Uptime with Redundancy", "100%"],
      ["Minor Fault Details (If any)", "N"],
      ["Major Fault Details (If any)", "N"],
      ["Planned Activity Details", "Y"],

      [`Month ${monthYear}`],
      ["Edge Data Centres Count", "WB"],
      ["Total Site Count", { f: "=B2" }],
      ["Category Checks", ""],
      ["O&M Manpower Availability as Per LOI", "Ok"],
      [`In House PM Planned (${monthYear} Month)`, { f: "=COUNTA('In House PM'!A2:A10000)" }],
      [`In House PM Completed (${monthYear} Month)`, { f: "=COUNTIF('In House PM'!H:H, \"Done\")" }],
      ["Inhouse PM Completion %", { f: "=(B21/B20)*100" }],
      [`OEM PM Planned (${monthYear} Month)`, { f: "=COUNTA('OEM PM'!A2:A10000)" }],
      [`OEM PM Completed (${monthYear} Month)`, { f: "=COUNTIF('OEM PM'!O:O, \"Done\")" }],
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
          const out = {};
          // use template column order if available
          const template = sheetTemplates[sheetKey];
          const cols = template ? Object.keys(template[0]) : Object.keys(er);
          cols.forEach(c => { out[c] = er[c] ?? ""; });
          allRows.push(out);
        });
      });
      if (allRows.length) {
        const ws = XLSX.utils.json_to_sheet(allRows, { raw: false });
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
    await setDoc(siteDocRef, { [sheetName]: rows }, { merge: true });

    // update local state
    setSiteData(prev => ({ ...prev, [site]: { ...prev[site], [sheetName]: rows } }));
  };

  const sortedSites = Object.keys(siteData).sort((a, b) => sortAsc ? a.localeCompare(b) : b.localeCompare(a));

  if (userRole === "User") {
    return <h3 style={{ padding: "2rem", color: "crimson" }}>🚫 You don't have access to this dashboard.</h3>;
  }

  // Render
  return (
    <div className="daily-details-dashboard">
      <header className="daily-dashboard-heading">
        <div>
          <p className="daily-dashboard-eyebrow">WB Circle · Daily operations</p>
          <h1>Daily Details Dashboard</h1>
          <p className="daily-dashboard-subtitle">Review site submissions, daily summaries and operational details.</p>
        </div>
        <span className="daily-dashboard-date-badge">{selectedDate || "Select a reporting date"}</span>
      </header>
      <section className="daily-dashboard-controls" aria-label="Dashboard controls">
      {(userRole === "Super User" || userRole === "Admin" || userRole === "Super Admin") && (
        <Link to="/excel-live-edit" className="pm-manage-btn">Edit <strong>"{userData?.site}"</strong> Daily Details Dashboard ✎ </Link>
      )}
      <div className="daily-dashboard-toolbar">
        <label htmlFor="daily-dashboard-date">Select Date: </label>
        <select id="daily-dashboard-date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}>
          {!dates.includes(today) && <option value={today}>{today} (Today)</option>}
          <option value="">-- Select Date --</option>
          {dates.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        <button onClick={() => setSortAsc(!sortAsc)} className="btn-info">
          Sort: {sortAsc ? "A-Z" : "Z-A"}
        </button>

        <button onClick={downloadExcel} className="btn-success pm-manage-btn">📥 Download Compiled Excel</button>
      </div>

      </section>
      <p className="daily-dashboard-reporting-note"><strong>Reporting window:</strong> Previous day 4 PM to selected date 4 PM (IST). DG tank stock is opening fuel minus the selected day’s saved run consumption. External stock uses the latest saved DG log on or before the selected date (this month or the previous month). DG and power-failure hours update from the selected day’s saved runs without waiting for 4 PM. Activities without start times use their scheduled date.</p>
      {autofillError && <p role="alert">{autofillError}</p>}
      <section className="daily-dashboard-submissions" aria-labelledby="daily-submissions-title">
      <div className="daily-dashboard-section-heading">
        <div><h2 id="daily-submissions-title">Site submission status</h2><p>Field completion for the selected reporting date.</p></div>
        <span className="daily-dashboard-count">{sortedSites.length} sites</span>
      </div>
      <div className="status-table-container">
        <table className="status-table">
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
                  const keys = Object.keys(rows[0]).filter(key => !key.startsWith("__"));
                  totalFields += rows.length * keys.length;
                  rows.forEach(row => {
                    keys.forEach(k => {
                      if (row[k] !== "" && row[k] !== null && row[k] !== undefined) filledTotal++;
                    });
                  });
                }
              });

              const percentage = totalFields > 0 ? ((filledTotal / totalFields) * 100).toFixed(0) : 0;
              const isComplete = totalFields > 0 && filledTotal === totalFields;

              return (
                <tr key={site}>
                  <td>{site}</td>
                  <td className={isComplete ? "status-complete" : "status-pending"}>
                    {isComplete ? "✅ Completed" : "⛔ Pending"}
                  </td>
                  <td><div className="daily-dashboard-progress"><progress max="100" value={percentage} aria-label={`${site} completion`} /><span>{percentage}%</span></div></td>
                </tr>
              );
            })}
            {sortedSites.length === 0 && <tr><td colSpan={3} className="daily-dashboard-empty">No site submissions to display for this date.</td></tr>}
          </tbody>
        </table>
      </div>
      </section>

      <div className="instruction-tab">
        <h2 className="noticeboard-header">Notice board</h2>
        {isEditing ? (
          <>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={5}
              className="dashboard-instruction-panel"
            />
            <div className="daily-dashboard-actions">
              <button
                className="daily-dashboard-primary"
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
                className="daily-dashboard-secondary"
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
                className="daily-dashboard-secondary"
                onClick={() => setIsEditing(true)}
              >
                Edit Instruction
              </button>
            )}
          </>
        )}
        <p className="daily-dashboard-signature">Thanks & Regards @Suman Adhikari</p>
      </div>
      <FinalSummary siteData={siteData} selectedDate={selectedDate} title="Compiled Final Summary — All Sites" />

      {sortedSites.map(site => {
        const sheets = siteData[site] || {};
        return (
          <details key={`${selectedDate}-${site}`} className="daily-dashboard-site">
            <summary><span>{site} MSC</span><span className="daily-dashboard-site-hint">View summary & sheets</span></summary>
            <div className="daily-dashboard-site-content">

            <FinalSummary
              siteData={{ [site]: sheets }}
              selectedDate={selectedDate}
              title={`Final Summary — ${site}`}
            />

            <div className="sheet-blocks-wrapper">
              {Object.entries(sheetKeys).map(([sheetLabel, sheetKey]) => {
                const rows = sheets[sheetKey] || [];
                const { status, filled, total } = getSheetStatus(rows || []);
                const evaluated = evaluateFormulasForRows(rows, sheetKey);
                const template = sheetTemplates[sheetKey];
                const cols = template ? Object.keys(template[0]) : (rows.length ? Object.keys(rows[0]).filter(key => !key.startsWith("__")) : []);
                return (
                  <details key={sheetKey} className="sheet-block-card">
                    <summary><span>{sheetLabel}</span><span className={`daily-sheet-status daily-sheet-status-${status.toLowerCase()}`}>{status} · {filled}/{total}</span></summary>
                    <div className="daily-dashboard-sheet-scroll">
                      <table>
                        <thead>
                          <tr>{cols.map(c => <th key={c}>{c}</th>)}</tr>
                        </thead>
                        <tbody>
                          {evaluated.length === 0 && <tr><td colSpan={Math.max(cols.length, 1)} className="daily-dashboard-empty">No entries in this sheet.</td></tr>}
                          {evaluated.map((er, rIdx) => (
                            <tr key={rIdx}>
                              {cols.map((c, ci) => (
                                <td key={ci}>
                                  {["Admin", "Super Admin"].includes(userRole) ? (
                                    <input
                                      type="text"
                                      aria-label={`${sheetLabel}, row ${rIdx + 1}, ${c}`}
                                      key={`${selectedDate}-${rows[rIdx]?.[c] ?? ""}`}
                                      defaultValue={er[c] ?? ""}
                                      onBlur={(e) => handleEdit(site, sheetKey, rIdx, c, e.target.value)}
                                      disabled={(typeof rows[rIdx]?.[c] === "string" && rows[rIdx][c].trim().startsWith("=")) || Boolean(formulasConfig[sheetKey]?.[c])}
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
                  </details>
                );
              })}
            </div>
            </div>
          </details>
        );
      })}
    </div>
  );
};

export default DailyDashboard;
