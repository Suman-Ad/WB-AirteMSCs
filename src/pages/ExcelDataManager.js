// src/pages/ExcelDataManager.js
import React, { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import ExcelUploadForm from "../components/ExcelUploadForm";

const ExcelDataManager = ({ userData }) => {
  const [allUploads, setAllUploads] = useState([]);
  const [siteFilter, setSiteFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const fetchAllUploads = async () => {
    const q = collection(db, "excel_uploads");
    const snap = await getDocs(q);
    setAllUploads(snap.docs.map((doc) => doc.data()));
  };

  useEffect(() => {
    if (["Admin", "Super Admin"].includes(userData.role)) {
      fetchAllUploads();
    }
  }, [userData]);

  const filtered = allUploads.filter((entry) => {
    return (!siteFilter || entry.site === siteFilter) &&
           (!dateFilter || entry.date === dateFilter);
  });

  return (
    <div className="page-container">
      <h2>📄 Excel Data Manager</h2>

      {["Admin", "Super Admin"].includes(userData.role) ? (
        <>
          <h3>All Uploads</h3>
          <div className="filter-row">
            <label>Site:</label>
            <select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
              <option value="">All</option>
              {["Andaman", "Asansol", "Berhampore", "DLF", "GLOBSYN",
                "Infinity-I", "Infinity-II", "Kharagpur", "Mira Tower",
                "New Alipore", "SDF", "Siliguri"].map(site => (
                <option key={site} value={site}>{site}</option>
              ))}
            </select>

            <label>Date:</label>
            <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
          </div>

          <table>
            <thead>
              <tr>
                <th>Sl No</th>
                <th>Site</th>
                <th>Date</th>
                <th>Uploaded By</th>
                <th>Download</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{u.site}</td>
                  <td>{u.date}</td>
                  <td>{u.uploadedBy.name}</td>
                  <td><a href={u.fileUrl} target="_blank" rel="noreferrer">Download</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <ExcelUploadForm userData={userData} />
      )}
    </div>
  );
};

export default ExcelDataManager;
