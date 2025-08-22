import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where, orderBy, setDoc, doc, getDoc } from 'firebase/firestore';
import '../assets/IncidentDashboard.css';
import { Link } from 'react-router-dom';

const IncidentDashboard = ({ userData }) => {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [instructionText, setInstructionText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [filters, setFilters] = useState({
    site: userData?.site || '',
    status: '',
    startDate: '',
    endDate: '',
    equipment: ''
    });

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
      <h1>
        <strong>🚨 Incident Dashboard</strong>
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
          <option value="PAC">PAC</option>
          <option value="DG">DG</option>
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
                <th>Type</th>
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
                  <td>{incident.type}</td>
                  <td>{incident.status}</td>
                  <td>
                    <button 
                      onClick={() => console.log('View details:', incident)}
                    >
                      View
                    </button>
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

export default IncidentDashboard;