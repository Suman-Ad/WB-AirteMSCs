// src/pages/Dashboard.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import UploadForm from "../components/UploadForm";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "../firebase"; // make sure this is your firestore instance
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

  const canAccessSite = (site) => {
    if (!userData) return false;
    return userData.role === "Super Admin" || userData.role === "Admin" || userData.site === site;
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const uploadsRef = collection(db, "uploads");
        const userUploadsQuery = query(
          uploadsRef,
          where("uploadedBy", "==", userData.email)
        );
        const snapshot = await getDocs(userUploadsQuery);
        setUploadCount(snapshot.size);

        const latestUploadQuery = query(
          uploadsRef,
          where("uploadedBy", "==", userData.email),
          orderBy("uploadedAt", "desc"),
          limit(1)
        );
        const latestSnapshot = await getDocs(latestUploadQuery);
        if (!latestSnapshot.empty) {
          const latestDoc = latestSnapshot.docs[0].data();
          setLastUploadTime(latestDoc.uploadedAt.toDate().toLocaleString());
        }
      } catch (err) {
        console.error("Error fetching upload stats:", err);
      }
    };

    if (userData?.email) {
      fetchStats();
    }
  }, [userData]);

  return (
    <div className="dashboard-container">
      <h2 className="dashboard-header">Welcome, {userData?.name}</h2>
      <p className="dashboard-subinfo">
        Role: <strong>{userData?.role}</strong> | Site: <strong>{userData?.site || "All"}</strong>
      </p>

      {/* Quick Stats Panel */}
      <div className="dashboard-container">
        <h3 className="dashboard-header">📊 Quick Stats</h3>
        <p className="dashboard-subinfo">Total Uploads: <strong>{uploadCount}</strong></p>
        <p>Last Upload: <strong>{lastUploadTime || "N/A"}</strong></p>
      </div>

      {/* Site Cards */}
      <div className="dashboard-container">
        {siteList.map((site) =>
          canAccessSite(site) ? (
            <div
              key={site}
              className={`dashboard-container rounded shadow bg-white ${
                userData.site === site ? "border-green-500" : ""
              }`}
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
