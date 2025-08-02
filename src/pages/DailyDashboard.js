// src/pages/DailyDashboard.js
import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs, doc, setDoc } from "firebase/firestore";
import * as XLSX from "xlsx";
import { sheetTemplates } from "../components/ExcelSheetEditor";
import "../assets/DailyDashboard.css";

const allSites = [
  "Andaman", "Asansol", "Berhampore", "DLF", "GLOBSYN",
  "Infinity-I", "Infinity-II", "Kharagpur", "Mira Tower",
  "New Alipore", "SDF", "Siliguri"
];

const sheetKeys = {
  "A_Final Summary": "Final_Summary",
  "B_Diesel Back Up": "Diesel_Back_Up",
  "C_DG-EB Backup": "DG_EB_Backup",
  "D_Infra Update": "Infra_Update",
  "E_Fault Details": "Fault_Details",
  "F_Planned Activity Details": "Planned_Activity_Details",
  "F_Manpower Availability": "Manpower_Availability",
  "F_Sheet1": "Sheet1",
  "F_In House PM": "In_House_PM",
  "F_Sheet2": "Sheet2",
  "F_OEM PM": "OEM_PM",
  "F_Operational Governance Call": "Operational_Governance_Call"
};

const userRole = "Super Admin";

const DailyDashboard = () => {
  const [dates, setDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [siteData, setSiteData] = useState({});
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    window.alert("Dear My All Team Members, This Daily Details Data on Upgradation Stage. Please try to fill data for Fixing Issues . \nThanks & Regards\n@Suman Adhikari");
  }, []);

  useEffect(() => {
    const fetchDates = async () => {
      const snap = await getDocs(collection(db, "excel_data_by_date"));
      const dateList = snap.docs.map((doc) => doc.id);
      setDates(dateList);
    };
    fetchDates();
  }, []);

  useEffect(() => {
    const fetchSiteData = async () => {
      if (!selectedDate) return;
      const siteSnap = await getDocs(collection(db, "excel_data_by_date", selectedDate, "sites"));
      const allData = {};
      for (let docSnap of siteSnap.docs) {
        allData[docSnap.id] = docSnap.data();
      }
      setSiteData(allData);
    };
    fetchSiteData();
  }, [selectedDate]);

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

    Object.entries(sheetKeys).forEach(([sheetLabel, sheetKey]) => {
      const allRows = [];

      Object.entries(siteData).forEach(([site, data]) => {
        const rows = data[sheetKey];
        if (Array.isArray(rows)) {
          const template = sheetTemplates[sheetKey];
          const colOrder = template ? Object.keys(template[0]) : (rows.length > 0 ? Object.keys(rows[0]) : []);

          rows.forEach((row) => {
            const orderedRow = {};
            colOrder.forEach(col => {
              orderedRow[col] = row[col] || "";
            });
            allRows.push({ Site: site, ...orderedRow });
          });
        }
      });

      if (allRows.length > 0) {
        const ws = XLSX.utils.json_to_sheet(allRows);
        XLSX.utils.book_append_sheet(wb, ws, sheetLabel.substring(2));
      }
    });

    XLSX.writeFile(wb, `Compiled_By_Sheet_${selectedDate}.xlsx`);
  };

  const handleEdit = (site, sheetName, rowIndex, colKey, newValue) => {
    if (userRole !== "Super Admin" && userRole !== "Admin") return;
    const updated = { ...siteData };
    updated[site][sheetName][rowIndex][colKey] = newValue;
    setSiteData(updated);
    const ref = doc(db, "excel_data_by_date", selectedDate, "sites", site);
    setDoc(ref, updated[site]);
  };

  const sortedSites = [...allSites].sort((a, b) =>
    sortAsc ? a.localeCompare(b) : b.localeCompare(a)
  );

  return (
    <div style={{ padding: "1rem" }}>
      <h2>📊 Daily Details Dashboard Overview - WB Circle Location</h2>

      <div style={{ marginBottom: "1rem" }}>
        <label>Select Date: </label>
        <select onChange={(e) => setSelectedDate(e.target.value)} value={selectedDate}>
          <option value="">-- Select Date --</option>
          {dates.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <button onClick={() => setSortAsc(!sortAsc)} style={{ marginLeft: "1rem" }}>
          Sort: {sortAsc ? "A-Z" : "Z-A"}
        </button>
      </div>

      {selectedDate && (
        <>
          <h3>✅ Completed Site Submission Status</h3>
          <div style={{ overflowX: "auto" }}>
            <table className="status-table" style={{ minWidth: "800px", borderCollapse: "collapse", marginBottom: "2rem", position: "sticky", top: 0 }}>
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

          {Object.entries(siteData).map(([site, sheets]) => (
            <div key={site} style={{ marginTop: "2rem", borderTop: "2px solid #ccc", paddingTop: "1rem" }}>
              <h3>📍 Site: {site}</h3>
              <div className="sheet-blocks-wrapper sheet-block-card">
                {Object.entries(sheetKeys).map(([sheetLabel, sheetKey]) => {
                  const rows = sheets[sheetKey];
                  const { status, color, filled, total } = getSheetStatus(rows || []);
                  const template = sheetTemplates[sheetKey];
                  const columns = template ? Object.keys(template[0]) : (rows?.length > 0 ? Object.keys(rows[0]) : []);
                  return Array.isArray(rows) ? (
                    <div className="sheet-block-card" key={sheetKey}>
                      <h4>📄 Sheet: {sheetLabel} — <span style={{ color }}>{status}</span> ({filled}/{total})</h4>
                      <div style={{ overflowX: "auto" }}>
                        <table >
                          <thead>
                            <tr>
                              {columns.map((col) => <th key={col}>{col}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row, rowIndex) => (
                              <tr key={rowIndex}>
                                {columns.map((col, j) => (
                                  <td key={j}>
                                    {(userRole === "Super Admin" || userRole === "Admin") ? (
                                      <input
                                        type="text"
                                        value={row[col] || ""}
                                        onChange={(e) => handleEdit(site, sheetKey, rowIndex, col, e.target.value)}
                                      />
                                    ) : row[col]}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          ))}

          {/* Additional content such as sheet render and download button remains here */}

          {Object.keys(siteData).length > 0 && (
            <button onClick={downloadExcel} style={{ marginTop: "2rem" }}>
              📥 Download Compiled Excel
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default DailyDashboard;
