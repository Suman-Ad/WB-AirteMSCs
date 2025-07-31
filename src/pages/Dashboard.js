// src/pages/Dashboard.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import UploadForm from "../components/UploadForm";
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import "../assets/Dashboard.css";

const siteList = [
  "Andaman", "Asansol", "Berhampore", "DLF", "GLOBSYN",
  "Infinity-I", "Infinity-II", "Kharagpur", "Mira Tower",
  "New Alipore", "SDF", "Siliguri"
];

const Dashboard = ({ userData }) => {
  const navigate = useNavigate();
  const [uploadCount, setUploadCount] = useState(0);
  const [lastUploadTime, setLastUploadTime] = useState(null);
  const [instructionText, setInstructionText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [uploadSummary, setUploadSummary] = useState({});
  const [summarySiteFilter, setSummarySiteFilter] = useState("");
  const [summaryMonthFilter, setSummaryMonthFilter] = useState("");

  const canAccessSite = (site) => {
    if (!userData) return false;
    return userData.role === "Super Admin" || userData.role === "Admin" || userData.site === site;
  };

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
    const fetchStats = async () => {
      try {
        const reportsRef = collection(db, "pm_reports");

        const userUploadsQuery = query(
          reportsRef,
          where("uploadedBy.email", "==", userData.email)
        );
        const snapshot = await getDocs(userUploadsQuery);
        setUploadCount(snapshot.size);

        const latestUploadQuery = query(
          reportsRef,
          where("uploadedBy.email", "==", userData.email),
          orderBy("timestamp", "desc"),
          limit(1)
        );
        const latestSnapshot = await getDocs(latestUploadQuery);

        if (!latestSnapshot.empty) {
          const latestDoc = latestSnapshot.docs[0].data();
          if (latestDoc.timestamp?.toDate) {
            setLastUploadTime(latestDoc.timestamp.toDate().toLocaleString());
          }
        }

      } catch (err) {
        console.error("Error fetching upload stats:", err);
      }
    };

    if (userData?.email) {
      fetchStats();
    }
  }, [userData]);

  useEffect(() => {
    const fetchUploadSummary = async () => {
      try {
        const snapshot = await getDocs(collection(db, "pm_reports"));
        const data = snapshot.docs.map((doc) => doc.data());

        const summary = {};
        data.forEach((doc) => {
          const { site, month, type } = doc;
          if (!site || !month || !type) return;
          summary[site] = summary[site] || {};
          summary[site][month] = summary[site][month] || { "In-House": 0, "Vendor": 0 };
          summary[site][month][type] += 1;
        });

        setUploadSummary(summary);
      } catch (err) {
        console.error("Failed to fetch upload summary:", err);
      }
    };

    if (["Admin", "Super Admin"].includes(userData.role)) {
      fetchUploadSummary();
    }
  }, [userData]);

  return (
    <div className="dashboard-container">
      <h3 className="dashboard-header">📢 Instruction</h3>
      {isEditing ? (
        <>
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={4}
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
          {["Admin", "Super Admin"].includes(userData.role) && (
            <button
              className="text-blue-600 underline"
              onClick={() => setIsEditing(true)}
            >
              Edit Instruction
            </button>
          )}
        </>
      )}

      <h2 className="dashboard-header">Welcome, {userData?.name}</h2>
      <p className="dashboard-subinfo">
        Role: <strong>{userData?.role}</strong> | Site: <strong>{userData?.site || "All"}</strong>
      </p>

      {/* Quick Stats */}
      <div className="dashboard-container">
        <h3 className="dashboard-header">📊 Quick Stats</h3>
        <p className="dashboard-subinfo">Total Uploads: <strong>{uploadCount}</strong></p>
        <p>Last Upload: <strong>{lastUploadTime || "N/A"}</strong></p>
      </div>

      {/* Upload Summary Table (Visible to Admins) */}
      {["Admin", "Super Admin"].includes(userData.role) && (
        <div className="dashboard-summary-table">
          <h3 className="dashboard-header">📄 Upload Count Summary</h3>

          {/* Filters */}
          <div className="dashboard-filter-row">
            <label>Site:</label>
            <select
              value={summarySiteFilter}
              onChange={(e) => setSummarySiteFilter(e.target.value)}
            >
              <option value="">All Sites</option>
              {siteList.map((site) => (
                <option key={site} value={site}>
                  {site}
                </option>
              ))}
            </select>

            <label style={{ marginLeft: "1rem" }}>Month:</label>
            <input
              type="month"
              value={summaryMonthFilter}
              onChange={(e) => setSummaryMonthFilter(e.target.value)}
            />
          </div>

          {/* Table */}
          <table className="summary-table">
            <thead>
              <tr>
                <th>Site</th>
                <th>Month</th>
                <th>In-House</th>
                <th>Vendor</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(uploadSummary).map((site) => {
                if (summarySiteFilter && site !== summarySiteFilter) return null;
                return Object.keys(uploadSummary[site])
                  .filter((month) =>
                    summaryMonthFilter ? month === summaryMonthFilter : true
                  )
                  .sort()
                  .map((month) => (
                    <tr key={`${site}-${month}`}>
                      <td>{site}</td>
                      <td>{month}</td>
                      <td>{uploadSummary[site][month]["In-House"] || 0}</td>
                      <td>{uploadSummary[site][month]["Vendor"] || 0}</td>
                    </tr>
                  ));
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Site Upload Form Panels */}
      <div className="dashboard-container">
        {siteList.map((site) =>
          canAccessSite(site) ? (
            <div
              key={site}
              className="dashboard-container rounded shadow bg-white"
            >
              <h3 className="dashboard-header">{site}</h3>
              <button
                className="dashboard-subinfo"
                onClick={() => navigate(`/site/${site}`)}
              >
                Go to Site
              </button>
              <UploadForm userData={userData} site={site} />
            </div>
          ) : null
        )}
      </div>
    </div>
  );
};

export default Dashboard;
