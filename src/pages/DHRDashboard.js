// src/pages/DHRDashboard.js
import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import "../assets/DHRStyle.css";

// Import Recharts components
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

export default function DHRDashboard({ userData }) {
  const userName = userData?.name;
  const userRole = userData?.role;
  const userSite = userData?.site;

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [instructionText, setInstructionText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const today = new Date().toISOString().split("T")[0];
  const [filterDate, setFilterDate] = useState(today);
  const [filterSite, setFilterSite] = useState("");
  const [selectedTxt, setSelectedTxt] = useState("");
  const [showModal, setShowModal] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchInstruction = async () => {
      const docRef = doc(db, "config", "dhr_dashboard_instruction");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setInstructionText(docSnap.data().text || "");
        setEditText(docSnap.data().text || "");
      }
    };
    fetchInstruction();
  }, []);

  useEffect(() => {
    const dhrRef = collection(db, "dhr_reports");
    const q = query(dhrRef, orderBy("isoDate", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let data = [];
        snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
        setReports(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching DHR reports:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const formatFilterDate = (dateStr) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return "";
    return `${parts[2]}.${parts[1]}.${parts[0]}`; // dd.MM.yyyy
  };

  const filteredReports = reports.filter((r) => {
    const formattedFilterDate = formatFilterDate(filterDate);
    return (
      (filterDate ? r.date === formattedFilterDate : true) &&
      (filterSite
        ? r.siteName?.toLowerCase().includes(filterSite.toLowerCase())
        : true)
    );
  });

  // --- Summary Stats Calculations ---

  // Sum dieselAvailable (convert to number safely)
  const totalDieselAvailable = filteredReports.reduce((acc, r) => {
    const val = parseFloat(r.dieselAvailable);
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  // Total EB fail count (assuming ebStatus === 'Fail' or similar)
  const totalEbFail = filteredReports.reduce((acc, r) => {
    return acc + (r.ebStatus?.toLowerCase() === "fail" ? 1 : 0);
  }, 0);

  // Total DG run hours sum
  const totalDgRunHrs = filteredReports.reduce((acc, r) => {
    const val = parseFloat(r.dgRunHrsYesterday);
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  // Total EB run hours sum
  const totalEbRunHrs = filteredReports.reduce((acc, r) => {
    const val = parseFloat(r.ebRunHrsYesterday);
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  // Prepare chart data grouped by siteName (sum dieselAvailable & dgRunHrs)
  // Could limit to top N or all sites
  const siteDataMap = {};
  filteredReports.forEach((r) => {
    if (!r.siteName) return;
    if (!siteDataMap[r.siteName]) {
      siteDataMap[r.siteName] = {
        siteName: r.siteName,
        dieselAvailable: 0,
        dgRunHrsYesterday: 0,
        ebRunHrsYesterday: 0,
      };
    }
    const dieselVal = parseFloat(r.dieselAvailable);
    const dgVal = parseFloat(r.dgRunHrsYesterday);
    const ebVal = parseFloat(r.ebRunHrsYesterday);
    siteDataMap[r.siteName].dieselAvailable += isNaN(dieselVal) ? 0 : dieselVal;
    siteDataMap[r.siteName].dgRunHrs += isNaN(dgVal) ? 0 : dgVal;
    siteDataMap[r.siteName].ebRunHrs += isNaN(ebVal) ? 0 : ebVal;
  });

  const chartData = Object.values(siteDataMap);

  const generateTXT = (r) => {
    return `Date: ${r.date}
Region: ${r.region}
Circle: ${r.circle}
Site Name: ${r.siteName}
Diesel Available (Ltr's): ${r.dieselAvailable}
DG run hrs yesterday: ${r.dgRunHrsYesterday}
EB run hrs yesterday: ${r.ebRunHrsYesterday}
EB Status: ${r.ebStatus}
DG Status: ${r.dgStatus}
SMPS Status: ${r.smpsStatus}
UPS Status: ${r.upsStatus}
PAC Status: ${r.pacStatus}
CRV Status: ${r.crvStatus}
Major Activity Planned for the day: ${r.majorActivity}
Inhouse PM: ${r.inhousePM}
Fault details if any: ${r.faultDetails}
`;
  };

  const shareWhatsApp = (txt) => {
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
  };

  const shareTelegram = (txt) => {
    window.open(`https://t.me/share/url?url=${encodeURIComponent(txt)}`, "_blank");
  };

  const downloadExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredReports);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DHR Data");
    XLSX.writeFile(wb, `DHR_Data_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

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
        {userRole === "Super Admin" && (
          <span>
            🔒 <strong>Super Admin</strong>
          </span>
        )}
        {userRole === "Admin" && (
          <span>
            🛠️ <strong>Admin</strong>
          </span>
        )}
        {userRole === "Super User" && (
          <span>
            📍 <strong>Super User</strong>
          </span>
        )}
        {userRole === "User" && (
          <span>
            👤 <strong>User</strong>
          </span>
        )}
        &nbsp; | 🏢 Site: <strong>{userSite || "All"}</strong> | &nbsp; 🛡️ Site ID:{" "}
        <strong>{userData.siteId || "All"}</strong>
      </p>
      <h1>
        <strong>⚡ DHR Dashboard</strong>
      </h1>

      {/* Summary Stats Panel */}
      <div className="summary-stats">
        <div className="stat-card">
          <h3>Total Diesel Available (Ltrs)</h3>
          <p>{totalDieselAvailable.toFixed(2)}</p>
        </div>
        <div className="stat-card">
          <h3>Total DG Run Hours</h3>
          <p>{totalDgRunHrs.toFixed(2)}</p>
        </div>
        <div className="stat-card">
          <h3>Total EB Run Hours</h3>
          <p>{totalEbRunHrs.toFixed(2)}</p>
        </div>
        <div className="stat-card">
          <h3>Total EB Fail Count</h3>
          <p>{totalEbFail}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="chart-container">
        <h3>Diesel Available & DG / EB Run Hours by Site</h3>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData} margin={{ top: 20, right: 40, left: 20, bottom: 20 }}>
            <CartesianGrid stroke="#f5f5f5" />
            <XAxis dataKey="siteName" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="dieselAvailable" barSize={40} fill="#413ea0" name="Diesel Available (L)" />
            <Line type="monotone" dataKey="dgRunHrs" stroke="#ff7300" name="DG Run Hrs" />
            <Line type="monotone" dataKey="ebRunHrs" stroke="#387908" name="EB Run Hrs" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Notice Board */}
      <div className="instruction-tab">
        <h2 className="dashboard-header">📌 Notice Board </h2>
        {/* <h3 className="dashboard-header">📘 App Overview </h3> */}
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
                  const docRef = doc(db, "config", "dhr_dashboard_instruction");
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
            <p className="dashboard-instruction-panel">
              {instructionText || "No instructions available."}
            </p>
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
        <h6 style={{ marginLeft: "90%" }}>Thanks & Regards @Suman Adhikari</h6>
      </div>

      {/* Filters */}
      <div className="dhr-filters">
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
        />
        <input
          type="text"
          placeholder="Search by site"
          value={filterSite}
          onChange={(e) => setFilterSite(e.target.value)}
        />
        <button className="create-dhr-btn" onClick={() => navigate("/create-dhr")}>
          ➕ Create / Edit DHR
        </button>
        <button className="download-btn" onClick={downloadExcel}>
          ⬇️ Download Excel
        </button>
        <button className="download-btn" onClick={downloadTXT}>
          ⬇️ Download TXT
        </button>
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
              <th>Last Edited By</th>
              <th>Last Edit Time</th>
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
                <td>{r.dgRunHrsYesterday}</td>
                <td>{r.ebRunHrsYesterday}</td>
                <td>{r.ebStatus}</td>
                <td>{r.dgStatus}</td>
                <td>{r.smpsStatus}</td>
                <td>{r.upsStatus}</td>
                <td>{r.pacStatus}</td>
                <td>{r.crvStatus}</td>
                <td>{r.majorActivity}</td>
                <td>{r.inhousePM}</td>
                <td>{r.faultDetails}</td>
                <td>{r.lastEditor || "Unknown"}</td>
                <td>
                  {r.lastEditTime
                    ? format(new Date(r.lastEditTime), "dd.MM.yyyy HH:mm")
                    : "N/A"}
                </td>
                <td>
                  <button
                    className="view-btn"
                    onClick={() => {
                      setSelectedTxt(generateTXT(r));
                      setShowModal(true);
                    }}
                  >
                    👁 View
                  </button>
                  <button
                    className="share-btn"
                    onClick={() => shareWhatsApp(generateTXT(r))}
                    title="Share WhatsApp"
                  >
                    📱
                  </button>
                  <button
                    className="share-btn"
                    onClick={() => shareTelegram(generateTXT(r))}
                    title="Share Telegram"
                  >
                    💬
                  </button>
                  {showModal && (
                    <div className="modal-overlay">
                      <div className="modal-content">
                        <pre>{selectedTxt}</pre>
                        <button
                          onClick={() => setShowModal(false)}
                          className="close-btn"
                        >
                          Close
                        </button>
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
