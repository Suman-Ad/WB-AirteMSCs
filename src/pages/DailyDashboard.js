// src/pages/DailyDashboard.js
import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import * as XLSX from "xlsx";

const DailyDashboard = () => {
  const [dates, setDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [siteData, setSiteData] = useState({});

  useEffect(() => {
    const fetchDates = async () => {
      const snap = await getDocs(collection(db, "excel_data_by_date"));
      const dateList = snap.docs.map((doc) => doc.id);
      console.log("Available dates:", dateList); // Add this
      setDates(dateList);
    };
    fetchDates();
  }, []);

  const fetchSiteData = async (date) => {
    setSelectedDate(date);
    const siteSnap = await getDocs(collection(db, "excel_data_by_date", date, "sites"));
    const allData = {};
    for (let docSnap of siteSnap.docs) {
      allData[docSnap.id] = docSnap.data();
    }
    setSiteData(allData);
  };

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

  return (
    <div style={{ padding: "1rem" }}>
      <h2>📊 Admin Dashboard - Daily Data Overview</h2>

      <div style={{ marginBottom: "1rem" }}>
        <label>Select Date: </label>
        <select onChange={(e) => fetchSiteData(e.target.value)} value={selectedDate}>
          <option value="">-- Select Date --</option>
          {dates.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      {selectedDate && (
        <>
          <h3>🗂 Uploaded Sites for {selectedDate}</h3>
          <ul>
            {Object.keys(siteData).length === 0 ? (
              <li>No data uploaded yet.</li>
            ) : (
              Object.entries(siteData).map(([site, data]) => (
                <li key={site}>
                  ✅ <strong>{site}</strong> — {Object.keys(data).length} sheets submitted
                </li>
              ))
            )}
          </ul>

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
                            {rows.length > 0 &&
                              Object.keys(rows[0]).map((col) => <th key={col}>{col}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row, i) => (
                            <tr key={i}>
                              {Object.values(row).map((val, j) => (
                                <td key={j}>{val}</td>
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
