import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where, orderBy, setDoc, doc, getDoc } from 'firebase/firestore';
import '../assets/IncidentDashboard.css';
import { Link, useNavigate } from 'react-router-dom';

const IncidentDashboard = ({ userData }) => {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [instructionText, setInstructionText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    site: userData?.site || '',
    status: '',
    startDate: '',
    endDate: '',
    equipment: ''
    });

  // New state for modal
  const [selectedIncident, setSelectedIncident] = useState(null);

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

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      let q = query(collection(db, 'incidents'), orderBy('dateKey', 'desc'));

      if (filters.site) {
        q = query(q, where('siteId', '==', filters.site));
      }
      if (filters.status) {
        q = query(q, where('status', '==', filters.status));
      }
      if (filters.startDate && filters.endDate) {
        q = query(
          q,
          where('dateKey', '>=', filters.startDate),
          where('dateKey', '<=', filters.endDate)
        );
      }
      if (filters.equipment) {
        q = query(q, where('equipmentCategory', '==', filters.equipment));
      }

      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setIncidents(data);
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

  return (
    <div className="dhr-dashboard-container">
      <h1 className="dashboard-header">
        <strong>🚨 Incident Dashboard</strong>
      </h1>
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
      
      <div className="filters">
        <select
          value={filters.site}
          onChange={(e) => setFilters({...filters, site: e.target.value})}
        >
          <option value="">All Sites</option>
          <option value="Asansol">Asansol</option>
          <option value="Site1">Site 1</option>
          <option value="Site2">Site 2</option>
        </select>

        <select
          value={filters.status}
          onChange={(e) => setFilters({...filters, status: e.target.value})}
        >
          <option value="">All Statuses</option>
          <option value="Open">Open</option>
          <option value="Closed">Closed</option>
        </select>

        <select
          value={filters.equipment}
          onChange={(e) => setFilters({...filters, equipment: e.target.value})}
        >
          <option value="">All Equipment</option>
          <option value="PAC">
            {equipmentCategories.map((field) => (
            <div key={field.name} className={`form-group ${field.disabled ? 'read-only-field' : ''}`}>

            </div>
            ))}
          </option>
          {/* <option value="DG">DG</option> */}
        </select>

        <input
          type="date"
          value={filters.startDate}
          onChange={(e) => setFilters({...filters, startDate: e.target.value})}
          placeholder="From Date"
        />

        <input
          type="date"
          value={filters.endDate}
          onChange={(e) => setFilters({...filters, endDate: e.target.value})}
          placeholder="To Date"
        />

        <button onClick={fetchIncidents}>Apply Filters</button>

        {(userData.role === "Super User" || userData.role === "Admin" || userData.role === "Super Admin" || userData.role === "User") && (
          <Link to="/incident-management" className="pm-manage-btn">Add <strong>"{userData.site || "All"}"</strong> Incidents ✎ </Link>
        )}
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Site</th>
                <th>Date</th>
                <th>Time</th>
                <th>Equipment</th>
                <th>Title</th>
                <th>Description</th>
                <th>Docket ID</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((incident, index) => (
                <tr key={incident.id} className={`status-${incident.status.toLowerCase()}`}>
                  <td>{index + 1}</td>
                  <td>{incident.siteName}</td>
                  <td>{formatDate(incident.dateKey)}</td>
                  <td>{incident.timeOfIncident}</td>
                  <td>{incident.equipmentCategory}</td>
                  <td>{incident.incidentTitle}</td>
                  <td>{incident.incidentDescription}</td>
                  <td>{incident.ttDocketNo}</td>
                  <td>{incident.status}</td>
                  <td>
                    {/* View Button */}
                    <button
                      className='pm-manage-btn small'
                      onClick={() => setSelectedIncident(incident)}
                    >
                      View
                    </button>

                    {/* Edit Button - Role & Site Based Access */}
                    {(
                      ["Super Admin", "Admin"].includes(userData.role) || 
                      (incident.siteId === userData.site && !userData.role=== 'User') // only own site
                    ) && (
                      <button 
                        // to={`/incident-edit/${incident.id}`} 
                        className="pm-manage-btn small warning"
                        onClick={() => navigate(`/incident-edit/${incident.id}`)}
                      >
                        Edit
                      </button>
                    )}
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
              <h3><strong>Docket No: {selectedIncident.ttDocketNo || "N/A"}</strong></h3>
              <p><strong>Circle:</strong> {selectedIncident.circle || "N/A"}</p>
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
            <button onClick={() => setSelectedIncident(null)} className='pm-manage-btn btn-danger'>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default IncidentDashboard;