// src/pages/Dashboard.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import UploadForm from "../components/UploadForm";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "../firebase"; // make sure this is your firestore instance
import "../assets/Dashboard.css";
import { doc, getDoc, setDoc } from "firebase/firestore";


const siteList = [
  "Andaman", "Asansol", "Berhampore", "DLF", "GLOBSYN",
  "Infinity-I", "Infinity-II", "Kharagpur", "Mira Tower",
  "New Alipore", "SDF", "Siliguri"
];

const Dashboard = ({ userData }) => {
  const navigate = useNavigate();
  const [uploadCount, setUploadCount] = useState(0);
  const [lastUploadTime, setLastUploadTime] = useState(null);
  // Add new states
  const [instructionText, setInstructionText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");

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

        // Count all uploads by this user
        const userUploadsQuery = query(
          reportsRef,
          where("uploadedBy.email", "==", userData.email)
        );
        const snapshot = await getDocs(userUploadsQuery);
        setUploadCount(snapshot.size);

        // Get latest upload with timestamp
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
          } else {
            console.warn("Missing or invalid timestamp:", latestDoc);
          }
        } else {
          console.log("No uploads found for this user.");
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
      <h3 className="dashboard-header">📢 Instruction</h3>
      {isEditing ? (
        <>
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={4}
            className="w-full border p-2 rounded mb-2"
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
          <p className="mb-2">{instructionText || "No instructions available."}</p>
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
