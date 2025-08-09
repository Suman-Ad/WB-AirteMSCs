// src/pages/DHRDashboard.js
import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, getDocs, query, orderBy, doc, setDoc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import "../assets/DHRDashboard.css";

export default function DHRDashboard({ userData }) {
  const userName = userData?.name;
  const userRole = userData?.role;
  const userSite = userData?.site;

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [instructionText, setInstructionText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");

  // Filters
  const [filterDate, setFilterDate] = useState("");
  const [filterSite, setFilterSite] = useState("");

  const [selectedTxt, setSelectedTxt] = useState("");
  const [showModal, setShowModal] = useState(false);

  const navigate = useNavigate();
  

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
    const fetchReports = async () => {
      try {
        const q = query(collection(db, "dhr_reports"), orderBy("date", "desc"));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((doc) => doc.data());
        setReports(data);
      } catch (error) {
        console.error("Error fetching DHR reports:", error);
      }
      setLoading(false);
    };

    fetchReports();
  }, []);

  const filteredReports = reports.filter((r) => {
    return (
      (filterDate ? r.date === filterDate : true) &&
      (filterSite ? r.siteName?.toLowerCase().includes(filterSite.toLowerCase()) : true)
    );
  });

  // Convert report to TXT format
  const generateTXT = (r) => {
  return `Date- ${r.date}
Region-${r.region}
Circle-${r.circle}
Site Name- ${r.siteName}
Diesel Available(Ltr's)-: ${r.dieselAvailable} ltr's
DG run hrs yesterday-: ${r.dgRunHrs}
EB run hrs yesterday-: ${r.ebRunHrs}
EB Status-${r.ebStatus}
DG Status-${r.dgStatus}
SMPS Status-${r.smpsStatus}
UPS Status-${r.upsStatus}
PAC Status-${r.pacStatus}
CRV Status-${r.crvStatus}
Major Activity Planned for the -${r.majorActivity}
Inhouse PM-${r.inhousePM}
Fault details if any:- ${r.faultDetails}`;
};


  // Share to WhatsApp
  const shareWhatsApp = (txt) => {
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
  };

  // Share to Telegram
  const shareTelegram = (txt) => {
    window.open(`https://t.me/share/url?url=${encodeURIComponent(txt)}`, "_blank");
  };

  // Download all as Excel
  const downloadExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredReports);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DHR Data");
    XLSX.writeFile(wb, `DHR_Data_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Download all as TXT
  const downloadTXT = () => {
    const txt = filteredReports.map(generateTXT).join("\n\n----------------\n\n");
    const blob = new Blob([txt], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `DHR_Data_${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
  };

  if (loading) {
    return <p className="loading">Loading DHR data...</p>;
  }

  return (
    <div className="dhr-dashboard-container">
      <h2 className="dashboard-header">
        👋 Welcome, <strong>{userName || "Team Member"}</strong>
      </h2>
      <p className="dashboard-subinfo">
        {userRole === "Super Admin" && <span>🔒 <strong>Super Admin</strong></span>}
        {userRole === "Admin" && <span>🛠️ <strong>Admin</strong></span>}
        {userRole === "Super User" && <span>📍 <strong>Super User</strong></span>}
        {userRole === "User" && <span>👤 <strong>User</strong></span>}
        &nbsp; | 🏢 Site: <strong>{userSite || "All"}</strong>
      </p>

      {/* Notice Board */}
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
              <button className="text-blue-600 underline" onClick={() => setIsEditing(true)}>
                Edit Instruction
              </button>
            )}
          </>
        )}
        <h6 style={{ marginLeft: "90%" }}>Thanks & Regards @Suman Adhikari</h6>
      </div>

      {/* Filters */}
      <div className="dhr-filters">
        <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
        <input type="text" placeholder="Search by site" value={filterSite} onChange={(e) => setFilterSite(e.target.value)} />
        <button className="create-dhr-btn" onClick={() => navigate("/create-dhr")}>➕ Create DHR</button>
        <button className="download-btn" onClick={downloadExcel}>⬇️ Download Excel</button>
        <button className="download-btn" onClick={downloadTXT}>⬇️ Download TXT</button>
      </div>

      {/* Data Table */}
      {filteredReports.length === 0 ? (
        <p>No DHR records found.</p>
      ) : (
        <table className="dhr-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Region</th>
              <th>Circle</th>
              <th>Site Name</th>
              <th>Diesel Available</th>
              <th>DG Run Hrs</th>
              <th>EB Run Hrs</th>
              <th>EB Status</th>
              <th>DG Status</th>
              <th>SMPS</th>
              <th>UPS</th>
              <th>PAC</th>
              <th>CRV</th>
              <th>Major Activity</th>
              <th>Inhouse PM</th>
              <th>Fault Details</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredReports.map((r, i) => (
              <tr key={i}>
                <td>{r.date}</td>
                <td>{r.region}</td>
                <td>{r.circle}</td>
                <td>{r.siteName}</td>
                <td>{r.dieselAvailable}</td>
                <td>{r.dgRunHrs}</td>
                <td>{r.ebRunHrs}</td>
                <td>{r.ebStatus}</td>
                <td>{r.dgStatus}</td>
                <td>{r.smpsStatus}</td>
                <td>{r.upsStatus}</td>
                <td>{r.pacStatus}</td>
                <td>{r.crvStatus}</td>
                <td>{r.majorActivity}</td>
                <td>{r.inhousePM}</td>
                <td>{r.faultDetails}</td>
                <td>
                   <button className="view-btn" onClick={() => {
                    setSelectedTxt(generateTXT(r));
                    setShowModal(true);
                  }}>👁 View</button>
                  <button className="share-btn" onClick={() => shareWhatsApp(generateTXT(r))}>📱 WhatsApp</button>
                  <button className="share-btn" onClick={() => shareTelegram(generateTXT(r))}>💬 Telegram</button>
                  {showModal && (
                    <div className="modal-overlay">
                      <div className="modal-content">
                        <pre>{selectedTxt}</pre>
                        <button onClick={() => setShowModal(false)} className="close-btn">Close</button>
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
