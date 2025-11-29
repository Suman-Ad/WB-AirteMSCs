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
  const [textSummary, setTextSummary] = useState({ total: 0, sites: {} });


  const [filters, setFilters] = useState({
    siteId: userData?.siteId || '',
    status: '',
    equipment: '',
    rcaStatus: '',
    search: '',
    ompPartner: '',
    dateOfIncident: ''
  });


  // New state for modal
  const [selectedIncident, setSelectedIncident] = useState(null);

  // Modal toggle for filter popup
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Equipment Categories
  const equipmentCategories = [
    "ACS", "Air Conditioner", "BMS", "CCTV", "Comfort AC", "Diesel Generator", "Earth Pit",
    "Exhust Fan", "FAS", "FSS", "HT Panel", "Inverter", "LT Panel", "PAS", "PFE", "SMPS",
    "SMPS BB", "Solar System", "UPS", "UPS BB", "DCDB/ACDB", "Transformer"
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
      // ✅ Fetch all incidents once
      const snapshot = await getDocs(collection(db, 'incidents'));
      let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // ✅ Apply filters client-side
      if (filters.siteId) {
        data = data.filter(i => i.siteId === filters.siteId);
      }
      if (filters.status) {
        data = data.filter(i => i.status === filters.status);
      }
      if (filters.equipment) {
        data = data.filter(i => i.equipmentCategory === filters.equipment);
      }
      if (filters.rcaStatus) {
        data = data.filter(i => i.rcaStatus === filters.rcaStatus);
      }
      if (filters.ompPartner) {
        data = data.filter(i => (i.ompPartner || "").toLowerCase() === filters.ompPartner.toLowerCase());
      }
      if (filters.search) {
        const searchText = filters.search.toLowerCase();
        data = data.filter(item =>
          (item.incidentTitle || "").toLowerCase().includes(searchText) ||
          (item.incidentDescription || "").toLowerCase().includes(searchText) ||
          (item.ttDocketNo || "").toLowerCase().includes(searchText) ||
          (item.siteName || "").toLowerCase().includes(searchText) ||
          (item.ompPartner || "").toLowerCase().includes(searchText) ||
          (item.status || "").toLowerCase().includes(searchText) ||
          (item.dateOfIncident || "").toLowerCase().includes(searchText) ||
          (item.dateKey || "").toLowerCase().includes(searchText)
        );
      }

      // ✅ Sort by dateKey descending (client-side)
      data.sort((a, b) => (b.dateKey || "").localeCompare(a.dateKey || ""));

      setIncidents(data);
      localStorage.setItem("incidents", JSON.stringify(data));

      // 🔹 Summary counts
      const openCount = data.filter(i => i.status === "Open").length;
      const closedCount = data.filter(i => i.status === "Closed").length;
      const rcaReceived = data.filter(i => i.rcaStatus === "Y").length;
      const rcaPending = data.filter(i => i.rcaStatus === "N").length;

      // 🔹 Site-wise counts
      const siteCounts = {};
      data.forEach(i => {
        if (i.siteName) {
          siteCounts[i.siteName] = (siteCounts[i.siteName] || 0) + 1;
        }
      });

      setSummaryData([
        { name: "Open Points", value: openCount },
        { name: "Closed Points", value: closedCount },
        { name: "RCA Received", value: rcaReceived },
        { name: "RCA Pending", value: rcaPending }
      ]);
      localStorage.setItem("incidentSummary", JSON.stringify([
        { name: "Open Points", value: openCount },
        { name: "Closed Points", value: closedCount },
        { name: "RCA Received", value: rcaReceived },
        { name: "RCA Pending", value: rcaPending }
      ]));

      // Save text stats
      setTextSummary({
        total: data.length,
        sites: siteCounts
      });
      localStorage.setItem("incidentTextSummary", JSON.stringify({
        total: data.length,
        sites: siteCounts
      }));

    } catch (error) {
      console.error('Error fetching incidents:', error);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchIncidents();
    const cached = localStorage.getItem("incidents");
    const cached1 = localStorage.getItem("incidentSummary");
    const cached2 = localStorage.getItem("incidentTextSummary");
    if (cached2) {
      setTextSummary(JSON.parse(cached2));
    }
    if (cached1) {
      setSummaryData(JSON.parse(cached1));
    }
      if (cached) {
        setIncidents(JSON.parse(cached));
      }
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
    // Convert to plain JSON (remove nested objects if needed)
    const exportData = incidents.map((item, i) => ({
      // ID: item.id,
      Sl_No: i + 1,
      Region: item.region || "",
      Circle: item.circle || "",
      Site_ID: item.siteId || "",
      Site_Name: item.siteName || "",
      OEM_Partner: item.ompPartner || "",
      Date: item. dateOfIncident || "",
      Time: item. timeOfIncident || "",
      SA_NSA: item.saNsa ||"",
      Equipment_Category: item.equipmentCategory || "",
      Title: item.incidentTitle || "",
      Issue_Details: item.incidentDescription || "",
      Type: item.type || "",
      Effect: item.effect || "",
      Effect_Equipment_Details: item.effectedEquipmentDetails || "",
      Action_Taken: item.actionsTaken || "",
      RCA_Status: item.rcaStatus || "",
      Ownership: item.ownership|| "",
      Reason_Category: item.reasonCategory || "",
      Real_Reason: item.realReason || "",
      Impact_Type: item.impactType || "",
      Remarks: item.remarks || "",
      Closure_Date: item.closureDate || "",
      Clouser_Time: item.closureTime || "",
      Status: item.status || "",
      MTTR : item.mttr || "",
      Learning: item.learningShared || "",
      Clouser_Remarks: item.closureRemarks || "",
      TT_Docket: item.ttDocketNo || "",
      RCA_File: item.rcaFileUrl ? "Received" : "Pending",   // ✅ Added
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
      <h1 style={{textAlign:"center", paddingBottom:"20px"}}>
        <strong>🚨 Incident Dashboard</strong>
      </h1>

      {/* Existing Notice Board */}
      {/* <div className="instruction-tab">
        <h2 className="noticeboard-header">📌 Notice Board </h2>
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
        <h6 style={{ marginLeft: "90%" }}>Thanks & Regurds @Suman Adhikari</h6>
      </div> */}

      {/* Universal Search */}
      <input
        type="text"
        placeholder="🔍Search incidents..."
        value={filters.search}
        onChange={(e) => setFilters({ ...filters, search: e.target.value })}
      />

      {/* 🔹 Summary Chart */}
      <div className="summary-chart-container">
        <h2 className="noticeboard-header">📊 Incident Status & RCA</h2>
        <div className="summary-chart-container">
          <p><strong>Total Incidents:</strong> {textSummary.total}</p>
          <ul>
            {Object.keys(textSummary.sites).map(site => (
              <li key={site}>
                <strong>{site}:</strong> {textSummary.sites[site]}
              </li>
            ))}
          </ul>
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
      </div>

      {/* Filter Button */}
      <div className="filters">
        <button className="pm-manage-btn info" onClick={() => setShowFilterModal(true)}>
          🔍 Filter Options
        </button>

        {(userData.role === "Super User" || userData.role === "Admin" || userData.role === "Super Admin" || userData.role === "User") && (
          <Link to="/incident-management" className="pm-manage-btn"> ➕ Add <strong>"{userData.site || "All"}"</strong> Incidents</Link>
        )}

      </div>

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="noticeboard-header">Filter Options</h2>

            {/* Site Filter */}
            <select
              value={filters.siteId}
              onChange={(e) => setFilters({ ...filters, siteId: e.target.value })}
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
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">All Statuses</option>
              <option value="Open">Open</option>
              <option value="Closed">Closed</option>
            </select>

            {/* Equipment Filter */}
            <select
              value={filters.equipment}
              onChange={(e) => setFilters({ ...filters, equipment: e.target.value })}
            >
              <option value="">All Equipment</option>
              {equipmentCategories.map(eq => (
                <option key={eq} value={eq}>{eq}</option>
              ))}
            </select>

            {/* OEM Partner Filter */}
            <select
              value={filters.ompPartner}
              onChange={(e) => setFilters({ ...filters, ompPartner: e.target.value })}
            >
              <option value="">All OEM Partners</option>
              {/* Dynamically extract unique OEM names from incidents */}
              {[...new Set(incidents.map(i => i.ompPartner).filter(Boolean))].map(oem => (
                <option key={oem} value={oem}>{oem}</option>
              ))}
            </select>

            {/* RCA Filter */}
            <select
              value={filters.rcaStatus}
              onChange={(e) => setFilters({ ...filters, rcaStatus: e.target.value })}
            >
              <option value="">All RCA Statuses</option>
              <option value="N">N</option>
              <option value="Y">Y</option>
            </select>

            <div className="flex gap-2" style={{ marginTop: "10px" }}>
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

      
      {(userData?.role === "Super Admin" || userData?.role === "Admin" || userData?.role === "Super User") && (
        <button className="pm-manage-btn" onClick={downloadExcel}>
          ⬇️ Download Excel
        </button>
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
                <th>RCA Status</th>
                <th>RCA File</th>
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
                  <td>{incident.ttDocketNo || "To be raised"}</td>
                  <td>{incident.closureDate || "--/--/--"}</td>
                  <td>{incident.mttr}</td>
                  <td>{incident.status}</td>
                  <td>{incident.rcaStatus}</td>
                  <td>
                    {incident.rcaFileUrl?
                      <Link to={incident.rcaFileUrl}>
                        👁️‍🗨️
                      </Link> : "N/A"}
                  </td>
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
              <h1><strong> {selectedIncident.incidentTitle || "⚠️Missing"} </strong></h1>
              <h3><strong>Docket No: #{selectedIncident.ttDocketNo || "To Be Raised"}</strong></h3>
              <p><strong>Circle: </strong> {selectedIncident.circle || "⚠️Missing"}</p>
              <p><strong>Site Id:</strong> {selectedIncident.siteId || "⚠️Missing"}</p>
              <p><strong>Site:</strong> {selectedIncident.siteName || "⚠️Missing"}</p>
              <p><strong>OEM Name:</strong> {selectedIncident.ompPartner || "⚠️Missing"}</p>
              <p><strong>Date:</strong> {formatDate(selectedIncident.dateKey || "⚠️Missing")}</p>
              <p><strong>Time:</strong> {selectedIncident.timeOfIncident || "⚠️Missing"}</p>
              <p><strong>SA/NSA:</strong> {selectedIncident.saNsa || "⚠️Missing"}</p>
              <p><strong>Equipment:</strong> {selectedIncident.equipmentCategory || "⚠️Missing"}</p>
              <p><strong>Title:</strong> {selectedIncident.incidentTitle || "⚠️Missing"}</p>
              <p><strong>Type:</strong> {selectedIncident.type || "⚠️Missing"}</p>
              <p><strong>Affected Equipment Details:</strong> {selectedIncident.effectedEquipmentDetails || "⚠️Missing"}</p>
              <p><strong>ActionsTaken:</strong> {selectedIncident.actionsTaken || "⚠️Missing"}</p>
              <p><strong>RCA Status:</strong> {selectedIncident.rcaStatus || "⚠️Missing"}</p>
              <p><strong>Ownership:</strong> {selectedIncident.ownership || "⚠️Missing"}</p>
              <p><strong>Reason:</strong> {selectedIncident.realReason || "⚠️Missing"}</p>
              <p><strong>Impact Type:</strong> {selectedIncident.impactType || "⚠️Missing"}</p>
              <p><strong>Remarks:</strong> {selectedIncident.remarks || "⚠️Missing"}</p>
              <p><strong>Closure Date:</strong> {selectedIncident.closureDate || "⚠️Missing"}</p>
              <p><strong>Closure Time:</strong> {selectedIncident.closureTime || "⚠️Missing"}</p>
              <p><strong>Status:</strong> {selectedIncident.status || "⚠️Missing"}</p>
              <p><strong>Description:</strong> {selectedIncident.incidentDescription || "⚠️Missing"}</p>
              <p><strong>Closure Remarks:</strong> {selectedIncident.closureRemarks || "⚠️Missing"}</p>
              {selectedIncident.rcaFileUrl && (
                <p>
                  <strong>RCA File:</strong>{""}
                  <a href={selectedIncident.rcaFileUrl} target="_blank" rel="noopener noreferrer">
                    👁️‍🗨️ View File
                  </a>
                </p>
              )}
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