// src/pages/PMHistoryPage.js
import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import "../assets/PMHistoryPage.css"; // optional for styling

const PMHistoryPage = ({ userData }) => {
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUploads = async () => {
      setLoading(true);
      try {
        const uploadsRef = collection(db, "pm_reports");

        let q;
        if (userData.role === "Admin" || userData.role === "Super Admin") {
          q = query(uploadsRef, orderBy("timestamp", "desc"));
        } else {
          q = query(
            uploadsRef,
            where("site", "==", userData.site),
            orderBy("timestamp", "desc")
          );
        }

        const querySnapshot = await getDocs(q);
        const result = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setUploads(result);
      } catch (error) {
        console.error("Error fetching uploads:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUploads();
  }, [userData]);

  return (
    <div className="pm-history-container">
      <h2 className="pm-history-title">📁 Uploaded PM History</h2>

      {loading ? (
        <p className="loading">Loading...</p>
      ) : uploads.length === 0 ? (
        <p className="no-data">No uploads found.</p>
      ) : (
        <div className="pm-history-wrapper">
          <table className="pm-history-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Type</th>
                <th>Site</th>
                <th>Vendor / Equipment</th>
                <th>Uploaded By</th>
                <th>Uploaded On</th>
                <th>View</th>
              </tr>
            </thead>
            <tbody>
              {uploads.map((upload) => (
                <tr key={upload.id}>
                  <td>{upload.month}</td>
                  <td>{upload.type}</td>
                  <td>{upload.site}</td>
                  <td>
                    {upload.type === "Vendor"
                      ? upload.vendorName || "—"
                      : upload.equipmentName || "—"}
                  </td>
                  <td>{upload.uploadedBy?.name}</td>
                  <td>{upload.timestamp?.toDate().toLocaleString()}</td>
                  <td>
                    <a href={upload.fileUrl} target="_blank" rel="noreferrer" className="view-link">
                      View PDF
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PMHistoryPage;
