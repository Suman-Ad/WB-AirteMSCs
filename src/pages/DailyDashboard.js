// src/pages/DailyDashboard.js
import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs, doc, setDoc, getDoc } from "firebase/firestore";
import * as XLSX from "xlsx";
import { sheetTemplates } from "../components/ExcelSheetEditor";
import { Link } from "react-router-dom";
import "../assets/DailyDashboard.css";

const allSites = [
  "Andaman", "Asansol", "Berhampore", "DLF", "GLOBSYN",
  "Infinity-I", "Infinity-II", "Kharagpur", "Mira Tower",
  "New Alipore", "SDF", "Siliguri"
];

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

  // useEffect(() => {
  //   if (userRole === "User") return;
  //   window.alert("Dear My All Team Members, This Daily Details Data on Upgradation Stage. Please try to fill data for Fixing Issues . \nThanks & Regards\n@Suman Adhikari");
  // }, [userRole]);

  useEffect(() => {
      const fetchInstruction = async () => {
        const docRef = doc(db, "config", "dashboard_instruction");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setInstructionText(docSnap.data().text || "");
          setEditText(docSnap.data().text || "");
        }
      };
      fetchInstruction();
    }, []);

  useEffect(() => {
    const fetchDates = async () => {
      const snap = await getDocs(collection(db, "excel_data_by_date"));
      const dateList = snap.docs.map((doc) => doc.id);
      setDates(dateList);
    };
    if (userRole !== "User") fetchDates();
  }, [userRole]);

  useEffect(() => {
    const fetchSiteData = async () => {
      if (!selectedDate || userRole === "User") return;
      const siteSnap = await getDocs(collection(db, "excel_data_by_date", selectedDate, "sites"));
      const allData = {};
      for (let docSnap of siteSnap.docs) {
        allData[docSnap.id] = docSnap.data();
      }
      if (userRole === "Super User") {
        setSiteData(userSite && allData[userSite] ? { [userSite]: allData[userSite] } : {});
      } else {
        setSiteData(allData);
      }
    };
    fetchSiteData();
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

  // const sortedSites = Object.keys(siteData).sort((a, b) =>
  //   sortAsc ? a.localeCompare(b) : b.localeCompare(a)
  // );

  const sortedSites = [...allSites].sort((a, b) =>
    sortAsc ? a.localeCompare(b) : b.localeCompare(a)
  );

  if (userRole === "User") {
    return <h3 style={{ padding: "2rem", color: "crimson" }}>🚫 You don't have access to this dashboard.</h3>;
  }

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
        &nbsp; | &nbsp; 🏢 Site: <strong>{userSite || "All"}</strong>
      </p>

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
                  const docRef = doc(db, "config", "dashboard_instruction");
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
      <h2>📊 Daily Details Dashboard Overview - WB Circle Location</h2>

      <div style={{ marginBottom: "1rem" }}>
        <label>Select Date: </label>
        <select
          onChange={(e) => setSelectedDate(e.target.value)}
          value={selectedDate || today}
        >
          {!dates.includes(today) && (
            <option value={today}>{today} (Today)</option>
          )}
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

          {Object.entries(siteData).map(([site, sheets]) => (
            <div key={site} style={{ marginTop: "2rem", borderTop: "2px solid #ccc", paddingTop: "1rem" }}>
              {(userData.role === "Super User" || userData.role === "Admin" || userData.role === "Super Admin") && (
                        <Link to="/excel-live-edit" className="pm-manage-btn">Edit <strong>"{site}"</strong> Daily Details Dashboard ✎ </Link>
                        )}
              <h3>📍 Site Name: {site} MSC</h3>
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
                        <table>
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
