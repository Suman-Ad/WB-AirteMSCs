// src/pages/DailyDashboard.js
import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs, doc, setDoc } from "firebase/firestore";
import * as XLSX from "xlsx";

const allSites = [
  "Andaman", "Asansol", "Berhampore", "DLF", "GLOBSYN",
  "Infinity-I", "Infinity-II", "Kharagpur", "Mira Tower",
  "New Alipore", "SDF", "Siliguri"
];



const userRole = "Super Admin"; // Simulate current user's role

const DailyDashboard = () => {
  const [dates, setDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [siteData, setSiteData] = useState({});

  useEffect(() => {
    const fetchDates = async () => {
      try {
        const snap = await getDocs(collection(db, "excel_data_by_date"));
        const dateList = snap.docs.map((doc) => doc.id);
        setDates(dateList);
        console.log("Fetched Dates from Firestore:", dateList);
      } catch (error) {
        console.error("Error fetching dates:", error);
      }
    };
    fetchDates();
  }, []);

  useEffect(() => {
    const fetchSiteData = async () => {
      if (!selectedDate) return;
      try {
        const siteSnap = await getDocs(collection(db, "excel_data_by_date", selectedDate, "sites"));
        const allData = {};
        for (let docSnap of siteSnap.docs) {
          allData[docSnap.id] = docSnap.data();
        }
        setSiteData(allData);
      } catch (error) {
        console.error("Error fetching site data:", error);
        setSiteData({});
      }
    };
    fetchSiteData();
  }, [selectedDate]);

  const downloadExcel = () => {
    const wb = XLSX.utils.book_new();
    Object.entries(siteData).forEach(([site, data]) => {
      Object.entries(data).forEach(([sheetName, rows]) => {
        if (Array.isArray(rows)) {
          const ws = XLSX.utils.json_to_sheet(rows);
          XLSX.utils.book_append_sheet(wb, ws, `${site}_${sheetName}`);
        }
      });
    });
    XLSX.writeFile(wb, `Compiled_${selectedDate}.xlsx`);
  };

  const handleEdit = (site, sheetName, rowIndex, colKey, newValue) => {
    const updated = { ...siteData };
    updated[site][sheetName][rowIndex][colKey] = newValue;
    setSiteData(updated);
    const ref = doc(db, "excel_data_by_date", selectedDate, "sites", site);
    setDoc(ref, updated[site]);
  };

  return (
    <div style={{ padding: "1rem" }}>
      <h2>📊 Daily Details Dashboard Data Overview</h2>

      <div style={{ marginBottom: "1rem" }}>
        <label>Select Date: </label>
        <select onChange={(e) => setSelectedDate(e.target.value)} value={selectedDate}>
          <option value="">-- Select Date --</option>
          {dates.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      {selectedDate && (
        <>
          <h3>✅ Completed Site Submission Status</h3>
          <table border="1" cellPadding="5" style={{ borderCollapse: "collapse", minWidth: "800px", marginBottom: "2rem" }}>
            <thead>
              <tr>
                <th>Site</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {allSites.map((site) => (
                <tr key={site}>
                  <td>{site}</td>
                  <td style={{ color: siteData[site] ? 'green' : 'red' }}>
                    {siteData[site] ? "Completed" : "Pending"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {Object.entries(siteData).map(([site, sheets]) => (
            <div key={site} style={{ marginTop: "2rem", borderTop: "2px solid #ccc", paddingTop: "1rem" }}>
              <h3>📍 Site: {site}</h3>
              {Object.entries(sheets).map(([sheetName, rows]) =>
                Array.isArray(rows) ? (
                  <div key={sheetName} style={{ marginBottom: "2rem" }}>
                    <h4>📄 Sheet: {sheetName}</h4>
                    <div style={{ overflowX: "auto" }}>
                      <table border="1" cellPadding="5" style={{ minWidth: "600px", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            {rows.length > 0 && Object.keys(rows[0]).map((col) => <th key={col}>{col}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                              {Object.entries(row).map(([col, val], j) => (
                                <td key={j}>
                                  {(userRole === "Super Admin" || userRole === "Admin") ? (
                                    <input
                                      type="text"
                                      value={val}
                                      onChange={(e) => handleEdit(site, sheetName, rowIndex, col, e.target.value)}
                                    />
                                  ) : val}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null
              )}
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
