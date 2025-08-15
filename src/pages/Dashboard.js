// src/pages/Dashboard.js
import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import UploadForm from "../components/UploadForm";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import * as XLSX from "xlsx";
import "../assets/Dashboard.css";

const siteList = [
  "Andaman", "Asansol", "Berhampore", "DLF", "Globsyn",
  "Infinity-I", "Infinity-II", "Kharagpur", "Mira Tower",
  "New Alipore", "SDF", "Siliguri"
];

const Dashboard = ({ userData }) => {
  const role = userData?.role;
  const navigate = useNavigate();
  const [uploadCount, setUploadCount] = useState(0);
  const [lastUploadTime, setLastUploadTime] = useState(null);
  const [instructionText, setInstructionText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [uploadSummary, setUploadSummary] = useState({});
  const [summarySiteFilter, setSummarySiteFilter] = useState("");
  const [summaryMonthFilter, setSummaryMonthFilter] = useState("");
  const [pmCalendarSummary, setPmCalendarSummary] = useState({});
  const [pmSummaryFilters, setPmSummaryFilters] = useState({
    site: "",
    month: "",
    type: ""
  });

  const canAccessSite = (site) => {
    if (!userData) return false;
    return userData.role === "Super Admin" || userData.role === "Admin" || userData.site === site;
  };

  // Fetch dashboard instruction
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

  // Fetch user upload stats
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

  // Fetch upload summary (existing logic)
  useEffect(() => {
    const fetchUploadSummary = async () => {
      try {
        const reportsSnap = await getDocs(collection(db, "pm_reports"));
        const data = reportsSnap.docs.map((doc) => doc.data());

        const configSnap = await getDocs(collection(db, "config"));
        const configMap = {};
        configSnap.docs.forEach(doc => {
          configMap[doc.id] = doc.data().list || [];
        });

        const summary = {};

        data.forEach((doc) => {
          const { site, month, type } = doc;
          if (!site || !month || !type) return;

          if (!summary[site]) summary[site] = {};
          if (!summary[site][month]) {
            summary[site][month] = {
              "In-House": { total: configMap["inhouse_equipment"]?.length || 0, done: 0 },
              "Vendor": { total: configMap["vendor_equipment"]?.length || 0, done: 0 },
            };
          }

          if (type === "In-House" && doc.equipmentName) {
            summary[site][month]["In-House"].done++;
          }
          if (type === "Vendor" && doc.vendorName) {
            summary[site][month]["Vendor"].done++;
          }
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

  // NEW: Fetch and process PM Calendar data
  useEffect(() => {
    if (!["Admin", "Super Admin", "Super User"].includes(userData.role)) return;

    const fetchPmCalendarSummary = async () => {
      try {
        // 1. Fetch PM Calendar data
        const calendarSnap = await getDocs(collection(db, "pm_calendar"));
        const calendarData = {};
        calendarSnap.forEach(doc => {
          const [site, year] = doc.id.split("_");
          calendarData[site] = doc.data();
        });

        // 2. Fetch PM Reports
        const reportsSnap = await getDocs(collection(db, "pm_reports"));
        const reportsData = reportsSnap.docs.map(doc => doc.data());

        // 3. Process combined data
        const summary = {};

        // Process In-House PMs
        Object.keys(calendarData).forEach(site => {
          const calendar = calendarData[site];
          
          Object.keys(calendar.inhouse || {}).forEach(month => {
            calendar.inhouse[month].forEach(item => {
              const key = `${site}_${month}_In-House_${item.equipment}`;
              if (!summary[key]) {
                summary[key] = {
                  circle: item.circle || "",
                  site,
                  equipment_category: item.equipment_category || "",
                  equipment: item.equipment,
                  frequency: item.frequency || "Monthly",
                  month,
                  type: "In-House",
                  plan_date: item.plan_date || "",
                  done_date: "",
                  status: "Pending",
                  pending: 1,
                  done_percent: "0%"
                };
              }
            });
          });

          // Process Vendor PMs
          Object.keys(calendar.vendor || {}).forEach(qtr => {
            calendar.vendor[qtr].forEach(item => {
              const key = `${site}_${qtr}_Vendor_${item.equipment}`;
              if (!summary[key]) {
                summary[key] = {
                  region: item.region || "",
                  circle: item.circle || "",
                  site,
                  equipment_category: item.equipment_category || "",
                  equipment: item.equipment,
                  make: item.make || "",
                  capacity: item.capacity || "",
                  qty: item.qty || 1,
                  amc_partner: item.amc_partner || "",
                  frequency: item.frequency || "Quarterly",
                  month: qtr,
                  type: "Vendor",
                  plan_date: item.plan_date || "",
                  done_date: "",
                  status: "Pending",
                  pending: 1,
                  done_percent: "0%"
                };
              }
            });
          });
        });

        // Match with uploads
        reportsData.forEach(report => {
          const key = report.type === "In-House" 
            ? `${report.site}_${report.month}_In-House_${report.equipmentName}`
            : `${report.site}_${report.quarter}_Vendor_${report.vendorName}`;
          
          if (summary[key]) {
            summary[key].done_date = report.timestamp?.toDate()?.toISOString().split('T')[0];
            summary[key].status = "Completed";
            summary[key].pending = 0;
            summary[key].done_percent = "100%";
          }
        });

        setPmCalendarSummary(summary);
      } catch (err) {
        console.error("Failed to process PM calendar summary:", err);
      }
    };

    fetchPmCalendarSummary();
  }, [userData.role]);

  // NEW: Export to Excel
  const exportPmSummaryToExcel = (type) => {
    const data = Object.values(pmCalendarSummary)
      .filter(item => item.type === type)
      .map(item => ({
        ...item,
        // Format for Excel export
        "Planned Date": item.plan_date,
        "Completed Date": item.done_date,
        "Completion Status": item.status,
        "Pending Count": item.pending,
        "Completion %": item.done_percent
      }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "PM Summary");
    XLSX.writeFile(workbook, `PM_${type}_Summary_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Filter PM Calendar summary data
  const filteredPmSummary = Object.values(pmCalendarSummary).filter(item => {
    return (
      (!pmSummaryFilters.site || item.site === pmSummaryFilters.site) &&
      (!pmSummaryFilters.month || item.month.includes(pmSummaryFilters.month)) &&
      (!pmSummaryFilters.type || item.type === pmSummaryFilters.type)
    );
  });

  return (
    <div className="dhr-dashboard-container">
      <h1>
        <strong>🛠️ PM Dashboard</strong>
      </h1>
      {/* Existing Notice Board */}
      <div className="instruction-tab">
        {/* ... (keep existing notice board code) ... */}
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
        <h6 style={{marginLeft: "90%"}}>Thanks & Regurds @Suman Adhikari</h6>
      </div>

      {/* Quick Stats */}
      <div className="dashboard-container">
        <h3 className="dashboard-header">📊 Quick Stats</h3>
        <p className="dashboard-subinfo">Total Uploads: <strong>{uploadCount}</strong></p>
        <p>Last Upload: <strong>{lastUploadTime || "N/A"}</strong></p>
      </div>

      {/* NEW: PM Calendar Summary Section */}
      {["Admin", "Super Admin", "Super User"].includes(userData.role) && (
        <div className="dashboard-summary-section">
          <h3 className="dashboard-header">📅 PM Calendar Status</h3>
          
          {/* Filters */}
          <div className="dashboard-filter-row">
            <select
              value={pmSummaryFilters.site}
              onChange={(e) => setPmSummaryFilters({...pmSummaryFilters, site: e.target.value})}
            >
              <option value="">All Sites</option>
              {siteList.map(site => (
                <option key={site} value={site}>{site}</option>
              ))}
            </select>

            <input
              type="month"
              value={pmSummaryFilters.month}
              onChange={(e) => setPmSummaryFilters({...pmSummaryFilters, month: e.target.value})}
              placeholder="Filter by month"
            />

            <select
              value={pmSummaryFilters.type}
              onChange={(e) => setPmSummaryFilters({...pmSummaryFilters, type: e.target.value})}
            >
              <option value="">All Types</option>
              <option value="In-House">In-House</option>
              <option value="Vendor">Vendor</option>
            </select>

          {(role === "Super User" || role === "Admin" || role === "Super Admin") && (
          <Link to="/pm-calendar" className="pm-manage-btn">
            📅 Management PM Calendar
          </Link>
          )}
            <button 
              onClick={() => exportPmSummaryToExcel("In-House")}
              className="export-btn"
            >
              Export In-House
            </button>
            <button 
              onClick={() => exportPmSummaryToExcel("Vendor")}
              className="export-btn"
            >
              Export Vendor
            </button>
          </div>

          {/* In-House Summary Table */}
          <div className="summary-table-container">
            <h4>In-House PM Summary</h4>
            <table className="summary-table">
              <thead>
                <tr>
                  <th>Circle</th>
                  <th>Site</th>
                  <th>Category</th>
                  <th>Equipment</th>
                  <th>Month</th>
                  <th>Plan Date</th>
                  <th>Done Date</th>
                  <th>Status</th>
                  <th>Done %</th>
                </tr>
              </thead>
              <tbody>
                {filteredPmSummary
                  .filter(item => item.type === "In-House")
                  .map((item, index) => (
                    <tr key={`inhouse-${index}`}>
                      <td>{item.circle}</td>
                      <td>{item.site}</td>
                      <td>{item.equipment_category}</td>
                      <td>{item.equipment}</td>
                      <td>{item.month}</td>
                      <td>{item.plan_date || "Not set"}</td>
                      <td>{item.done_date || "Pending"}</td>
                      <td style={{ color: item.status === "Completed" ? "green" : "red" }}>
                        {item.status}
                      </td>
                      <td>{item.done_percent}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Vendor Summary Table */}
          <div className="summary-table-container">
            <h4>Vendor PM Summary</h4>
            <table className="summary-table">
              <thead>
                <tr>
                  <th>Region</th>
                  <th>Circle</th>
                  <th>Site</th>
                  <th>AMC Partner</th>
                  <th>Equipment</th>
                  <th>Quarter</th>
                  <th>Plan Date</th>
                  <th>Done Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredPmSummary
                  .filter(item => item.type === "Vendor")
                  .map((item, index) => (
                    <tr key={`vendor-${index}`}>
                      <td>{item.region}</td>
                      <td>{item.circle}</td>
                      <td>{item.site}</td>
                      <td>{item.amc_partner}</td>
                      <td>{item.equipment}</td>
                      <td>{item.month}</td>
                      <td>{item.plan_date || "Not set"}</td>
                      <td>{item.done_date || "Pending"}</td>
                      <td style={{ color: item.status === "Completed" ? "green" : "red" }}>
                        {item.status}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Existing Upload Count Summary Table */}
      {["Admin", "Super Admin"].includes(userData.role) && (
        <div className="dashboard-summary-table">
          <h3 className="dashboard-header">📄 Upload Count Summary</h3>
          {/* ... (keep existing upload summary table code) ... */}
        </div>
      )}

      {/* Site Upload Forms */}
      <div className="dashboard-container">
        {siteList.map((site) =>
          canAccessSite(site) ? (
            <div key={site} className="dashboard-container rounded shadow bg-white">
              <h3 className="dashboard-header">{site}</h3>
              <button className="dashboard-subinfo" onClick={() => navigate(`/site/${site}`)}>
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