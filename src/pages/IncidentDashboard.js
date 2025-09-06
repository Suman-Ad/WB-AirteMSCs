// src/pages/IncidentDashboard.js
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where, orderBy, setDoc, doc, getDoc } from 'firebase/firestore';
import '../assets/IncidentDashboard.css';
import { Link, useNavigate } from 'react-router-dom';
import { siteList } from "../config/sitelist";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";




const IncidentDashboard = ({ userData }) => {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [instructionText, setInstructionText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const navigate = useNavigate();
  const [summaryData, setSummaryData] = useState([]);

  
  const [filters, setFilters] = useState({
    siteId: userData?.siteId || '',
    status: '',
    equipment: '',
    search: ''
  });


  // New state for modal
  const [selectedIncident, setSelectedIncident] = useState(null);

  // Modal toggle for filter popup
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Equipment Categories
  const equipmentCategories = [
    "ACS","Air Conditioner","BMS","CCTV","Comfort AC","Diesel Generator","Earth Pit",
    "Exhust Fan","FAS","FSS","HT Panel","Inverter","LT Panel","PAS","PFE","SMPS",
    "SMPS BB","Solar System","UPS","UPS BB","DCDB/ACDB","Transformer"
  ];

  // Fetch dashboard instruction
  useEffect(() => {
    const fetchInstruction = async () => {
      const docRef = doc(db, "config", "incident_dashboard_instruction");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setInstructionText(docSnap.data().text || "");
        setEditText(docSnap.data().text || "");
      }
    };
    fetchInstruction();
  }, []);

  // Fetch incidents with filters
  const fetchIncidents = async () => {
    setLoading(true);
    try {
      let q = query(collection(db, 'incidents'), orderBy('dateKey', 'desc'));

      if (filters.siteId) {
        q = query(q, where('siteId', '==', filters.siteId));
      }
      if (filters.status) {
        q = query(q, where('status', '==', filters.status));
      }
      if (filters.equipment) {
        q = query(q, where('equipmentCategory', '==', filters.equipment));
      }

      const snapshot = await getDocs(q);
      let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Universal search filter (client-side)
      if (filters.search) {
        const searchText = filters.search.toLowerCase();
        data = data.filter(item =>
          (item.incidentTitle || "").toLowerCase().includes(searchText) ||
          (item.incidentDescription || "").toLowerCase().includes(searchText) ||
          (item.ttDocketNo || "").toLowerCase().includes(searchText) ||
          (item.siteName || "").toLowerCase().includes(searchText) ||
          (item.ompPartner || "").toLowerCase().includes(searchText) ||
          (item.status || "").toLowerCase().includes(searchText)
        );
      }

      setIncidents(data);
      // 🔹 Compute summary
      const openCount = data.filter(i => i.status === "Open").length;
      const closedCount = data.filter(i => i.status === "Closed").length;
      const rcaReceived = data.filter(i => i.rcaStatus === "Y").length;
      const rcaPending = data.filter(i => i.rcaStatus === "N").length;

      setSummaryData([
        { name: "Open Points", value: openCount },
        { name: "Closed Points", value: closedCount },
        { name: "RCA Received", value: rcaReceived },
        { name: "RCA Pending", value: rcaPending }
      ]);
    } catch (error) {
      console.error('Error fetching incidents:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, [filters]);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}-${month}-${year}`;
  };

  const downloadExcel = () => {
    if (!incidents || incidents.length === 0) {
      alert("No incident data to export!");
      return;
    }
    let sl = 0
    // Convert to plain JSON (remove nested objects if needed)
    const exportData = incidents.map((item, i) => ({
      // ID: item.id,
      Sl_No: i + 1,
      // Region: item.region || "",
      // Circle: item.circle || "",
      Site: item.siteName || "",
      Site_ID: item.siteId || "",
      Issue_Details: item.incidentDescription || "",
      // OEM_Partner: item.ompPartner || "",
      Date: item.dateOfIncident || "",
      TT_Docket: item.ttDocketNo || "",
      Completion_Date: item.closureDate  || "",
      Status: item.status || "",
      Remarks: item.remarks || "",

    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Incidents");

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const data = new Blob([excelBuffer], { type: "application/octet-stream" });

    saveAs(data, `Incident_Report_${new Date().toISOString().split("T")[0]}.xlsx`);
  };


  return (
    <div className="dhr-dashboard-container">
      <h1 className="dashboard-header">
        <strong>🚨 Incident Dashboard</strong>
      </h1>

      {/* 🔹 Summary Chart */}
      <div className="summary-chart-container">
        <h2 className="noticeboard-header">📊 Incident Summary</h2>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={summaryData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label
            >
              {summaryData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={["#FF6384", "#36A2EB", "#4BC0C0", "#FFCE56"][index % 4]} 
                />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Existing Notice Board */}
      <div className="instruction-tab">
        {/* ... (keep existing notice board code) ... */}
        <h2 className="noticeboard-header">📌 Notice Board </h2>
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
                  const docRef = doc(db, "config", "incident_dashboard_instruction");
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
      
      {/* Filter Button */}
      <div className="filters">
        <button className="pm-manage-btn info" onClick={() => setShowFilterModal(true)}>
          🔍 Filter
        </button>

        {(userData.role === "Super User" || userData.role === "Admin" || userData.role === "Super Admin" || userData.role === "User") && (
          <Link to="/incident-management" className="pm-manage-btn"> ➕ Add <strong>"{userData.site || "All"}"</strong> Incidents</Link>
        )}

        <button className="pm-manage-btn" onClick={downloadExcel}>
          ⬇️ Download Excel
        </button>

      </div>

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="noticeboard-header">Filter Options</h2>

            {/* Site Filter */}
            <select
              value={filters.site}
              onChange={(e) => setFilters({...filters, site: e.target.value})}
            >
              <option value="">All Sites</option>
              {Object.keys(siteList).map(region =>
                Object.keys(siteList[region]).map(circle =>
                  siteList[region][circle].map(site => (
                    <option key={site} value={site}>{site}</option>
                  ))
                )
              )}
            </select>

            {/* Status Filter */}
            <select
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
            >
              <option value="">All Statuses</option>
              <option value="Open">Open</option>
              <option value="Closed">Closed</option>
            </select>

            {/* Equipment Filter */}
            <select
              value={filters.equipment}
              onChange={(e) => setFilters({...filters, equipment: e.target.value})}
            >
              <option value="">All Equipment</option>
              {equipmentCategories.map(eq => (
                <option key={eq} value={eq}>{eq}</option>
              ))}
            </select>

            {/* Universal Search */}
            <input
              type="text"
              placeholder="Search incidents..."
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value})}
            />

            <div className="flex gap-2" style={{marginTop:"10px"}}>
              <button className="pm-manage-btn" onClick={() => { fetchIncidents(); setShowFilterModal(false); }}>
                Apply
              </button>
              <button className="pm-manage-btn btn-danger" onClick={() => setShowFilterModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Site ID</th>
                <th>Site</th>
                <th>Date</th>
                <th>Time</th>
                <th>Equipment</th>
                <th>Title</th>
                <th>Description</th>
                <th>OEM Name</th>
                <th>Docket ID</th>
                <th>Clouser Date</th>
                <th>MTTR (Days)</th>
                <th>Status</th>
                {/* <th>Actions</th> */}
              </tr>
            </thead>
            <tbody>
              {incidents.map((incident, index) => (
                <tr key={incident.id} className={`status-${incident.status.toLowerCase()}`} onClick={() => setSelectedIncident(incident)}>
                  <td>{index + 1}</td>
                  <td>{incident.siteId}</td>
                  <td>{incident.siteName}</td>
                  <td>{formatDate(incident.dateKey)}</td>
                  <td>{incident.timeOfIncident}</td>
                  <td>{incident.equipmentCategory}</td>
                  <td>{incident.incidentTitle}</td>
                  <td>{incident.incidentDescription}</td>
                  <td>{incident.ompPartner}</td>
                  <td>{incident.ttDocketNo}</td>
                  <td>{incident.closureDate}</td>
                  <td>{incident.mttr}</td>
                  <td>{incident.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Incident Details Modal */}
      {selectedIncident && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h1 className='noticeboard-header'><strong>🚨Incident Details</strong></h1>
            <div className='child-container'>
              <h1><strong> {selectedIncident.incidentTitle || "N/A"} </strong></h1>
              <h3><strong>Docket No: #{selectedIncident.ttDocketNo || "N/A"}</strong></h3>
              <p><strong>Circle: </strong> {selectedIncident.circle || "N/A"}</p>
              <p><strong>Site Id:</strong> {selectedIncident.siteId || "N/A"}</p>
              <p><strong>Site:</strong> {selectedIncident.siteName || "N/A"}</p>
              <p><strong>OEM Name:</strong> {selectedIncident.ompPartner || "N/A"}</p>
              <p><strong>Date:</strong> {formatDate(selectedIncident.dateKey || "N/A")}</p>
              <p><strong>Time:</strong> {selectedIncident.timeOfIncident || "N/A"}</p>
              <p><strong>SA/NSA:</strong> {selectedIncident.saNsa || "N/A"}</p>
              <p><strong>Equipment:</strong> {selectedIncident.equipmentCategory || "N/A"}</p>
              <p><strong>Title:</strong> {selectedIncident.incidentTitle || "N/A"}</p>
              <p><strong>Type:</strong> {selectedIncident.type || "N/A"}</p>
              <p><strong>Affected Equipment Details:</strong> {selectedIncident.effectedEquipmentDetails || "N/A"}</p>
              <p><strong>ActionsTaken:</strong> {selectedIncident.actionsTaken || "N/A"}</p>
              <p><strong>RCA Status:</strong> {selectedIncident.rcaStatus || "N/A"}</p>
              <p><strong>Ownership:</strong> {selectedIncident.ownership || "N/A"}</p>
              <p><strong>Reason:</strong> {selectedIncident.realReason || "N/A"}</p>
              <p><strong>Impact Type:</strong> {selectedIncident.impactType || "N/A"}</p>
              <p><strong>Remarks:</strong> {selectedIncident.remarks || "N/A"}</p>
              <p><strong>Closure Date:</strong> {selectedIncident.closureDate || "N/A"}</p>
              <p><strong>Closure Time:</strong> {selectedIncident.closureTime || "N/A"}</p>
              <p><strong>Status:</strong> {selectedIncident.status || "N/A"}</p>
              <p><strong>Description:</strong> {selectedIncident.incidentDescription || "N/A"}</p>
              <p><strong>Closure Remarks:</strong> {selectedIncident.closureRemarks || "N/A"}</p>
            </div>
            {/* Edit Button - Role & Site Based Access */}
            {(
              ["Super Admin", "Admin", "Super User"].includes(userData.role) || 
              (selectedIncident.siteName === userData.site) // only own site
            ) && (
              <button 
                // to={`/incident-edit/${incident.id}`} 
                className="pm-manage-btn small"
                onClick={() => navigate(`/incident-edit/${selectedIncident.id}`)}
              >
               ✎ Edit
              </button>
            )}
            <button onClick={() => setSelectedIncident(null)} className='pm-manage-btn btn-danger'>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default IncidentDashboard;