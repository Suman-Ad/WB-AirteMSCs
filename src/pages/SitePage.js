// src/pages/SitePage.js
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { db } from "../firebase";
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  orderBy,
} from "firebase/firestore";
import "../assets/SitePage.css";

const SitePage = ({ userData }) => {
  const { siteName } = useParams();
  const [reports, setReports] = useState([]);
  const [filterMonth, setFilterMonth] = useState("");
  const [message, setMessage] = useState("");

  const fetchReports = async () => {
    try {
      const q = query(
        collection(db, "pm_reports"),
        where("site", "==", siteName),
        orderBy("timestamp", "desc")
      );
      const snapshot = await getDocs(q);
      let data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      if (filterMonth) {
        data = data.filter((doc) => doc.month === filterMonth);
      }
      setReports(data);
    } catch (err) {
      console.error("Error fetching reports:", err);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [siteName, filterMonth]);

  const canDelete = (report) => {
    if (!userData) return false;
    if (["Admin", "Super Admin"].includes(userData.role)) return true;
    return userData.site === report.site && userData.uid === report.uploadedBy.uid;
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this file?")) return;
    await deleteDoc(doc(db, "pm_reports", id));
    setMessage("✅ Report deleted successfully.");
    fetchReports();
    setTimeout(() => setMessage(""), 4000);
  };

  const renderTable = (type) => {
    const filtered = reports.filter((r) => r.type === type);
    return (
      <div className="sitepage-table-wrapper">
        <h3 className="sitepage-subheading">{type} PM Reports</h3>
        <table className="sitepage-table">
          <thead>
            <tr>
              <th>Month</th>
              <th>{type === "Vendor" ? "Vendor Name" : "Equipment Name"}</th>
              <th>PDF</th>
              <th>Uploaded By</th>
              <th>Uploaded On</th>
              {["Admin", "Super Admin", "Super User"].includes(userData.role) && (
                <th>Action</th>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? (
              filtered.map((report) => (
                <tr key={report.id}>
                  <td>{report.month}</td>
                  <td>{report.vendorName || report.equipmentName || "—"}</td>
                  <td>
                    <a href={report.fileUrl} target="_blank" rel="noreferrer">
                      View PDF
                    </a>
                  </td>
                  <td>{report.uploadedBy?.name}</td>
                  <td>{report.timestamp?.toDate().toLocaleString()}</td>
                  {canDelete(report) && (
                    <td>
                      <button
                        className="delete-btn"
                        onClick={() => handleDelete(report.id)}
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="no-data">
                  No {type} reports found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="sitepage-container">
      <h2 className="sitepage-title">Site: {siteName}</h2>

      <div className="sitepage-filters">
        <label>📅 Filter by Month:</label>
        <input
          type="month"
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
        />
        <button onClick={() => setFilterMonth("")} className="clear-btn">
          ❌ Clear
        </button>
      </div>

      {message && <p className="sitepage-msg">{message}</p>}

      {renderTable("In-House")}
      {renderTable("Vendor")}
    </div>
  );
};

export default SitePage;
