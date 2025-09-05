import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { 
  collection, addDoc, serverTimestamp, 
  doc, getDoc, setDoc, updateDoc 
} from 'firebase/firestore';
import IncidentEditorPage from '../components/IncidentEditorPage';
import { useParams, useNavigate } from 'react-router-dom';
import '../assets/IncidentManagement.css';

const IncidentManagement = ({ userData }) => {
  const { incidentId } = useParams();   // detect edit mode if id is present
  const navigate = useNavigate();

  const [instructionText, setInstructionText] = useState("");
  const [isEditingNotice, setIsEditingNotice] = useState(false);
  const [editText, setEditText] = useState("");

  const [formData, setFormData] = useState({
    region: userData?.region || '',
    circle: userData?.circle || '',
    siteName: userData?.site || '',
    ompPartner: '',
    dateOfIncident: '',
    timeOfIncident: '',
    saNsa: 'NSA',
    equipmentCategory: '',
    incidentTitle: '',
    incidentDescription: '',
    type: 'Alarm',
    effect: '',
    effectedEquipmentDetails: '',
    actionsTaken: '',
    rcaStatus: 'N',
    ownership: '',
    reasonCategory: '',
    realReason: '',
    impactType: 'Partial',
    remarks: '',
    closureDate: '',
    closureTime: '',
    status: 'Open',
    mttr: 0,
    learningShared: 'N',
    closureRemarks: '',
    ttDocketNo: ''
  });

  // 🔹 Fetch Notice Board Text
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

  // 🔹 Load existing incident in edit mode
  useEffect(() => {
    const fetchIncident = async () => {
      if (!incidentId) return;
      const docRef = doc(db, "incidents", incidentId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();

        // Role + Site restriction
        if (
          !["Admin", "Super Admin"].includes(userData.role) &&
          data.siteName !== userData.site
        ) {
          alert("You don’t have permission to edit this incident.");
          navigate("/incident-dashboard");
          return;
        }

        setFormData(data);
      } else {
        alert("Incident not found.");
        navigate("/incident-dashboard");
      }
    };
    fetchIncident();
  }, [incidentId, userData, navigate]);

  // 🔹 Form change handler
  const handleFormChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 🔹 Validate required fields
  const validateForm = () => {
    const requiredFields = [
      'region', 'circle', 'siteName', 'ompPartner', 'dateOfIncident',
      'timeOfIncident', 'saNsa', 'equipmentCategory', 'incidentTitle', 'incidentDescription',
      'effectedEquipmentDetails', 'actionsTaken', 'ttDocketNo'
    ];
    for (const field of requiredFields) {
      if (!formData[field]) {
        alert(`Please fill in ${field}`);
        return false;
      }
    }
    return true;
  };

  // 🔹 Submit handler (Create or Update)
  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      const incidentDate = new Date(formData.dateOfIncident);
      const year = incidentDate.getFullYear();
      const month = String(incidentDate.getMonth() + 1).padStart(2, '0');
      const day = String(incidentDate.getDate()).padStart(2, '0');

      if (incidentId) {
        // 🔸 Update existing incident
        await updateDoc(doc(db, "incidents", incidentId), {
          ...formData,
          updatedAt: serverTimestamp()
        });
        alert("Incident updated successfully!");
      } else {
        // 🔸 Create new incident
        await addDoc(collection(db, 'incidents'), {
          ...formData,
          reportedBy: userData.email,
          reportedById: userData.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          siteId: userData.site,
          year,
          month,
          day,
          dateKey: `${year}-${month}-${day}`,
          siteDateKey: `${userData.site}_${year}-${month}-${day}`
        });
        alert("Incident reported successfully!");
      }

      navigate("/incident-dashboard"); // go back after success
    } catch (err) {
      console.error("Error saving incident:", err);
      alert("Failed to save incident.");
    }
  };

  return (
    <div className="dhr-dashboard-container">
      <h1 className="dashboard-header">
        <strong>🚨 {incidentId ? "Edit Incident" : "Incident Management"}</strong>
      </h1>

      {/* Notice Board */}
      <div className="instruction-tab">
        <h2 className="noticeboard-header">📌 Notice Board </h2>
        {isEditingNotice ? (
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
                  setIsEditingNotice(false);
                }}
              >
                Save
              </button>
              <button
                className="bg-gray-400 text-white px-3 py-1 rounded"
                onClick={() => setIsEditingNotice(false)}
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
            {["Admin", "Super Admin"].includes(userData?.role) && (
              <button
                className="text-blue-600 underline"
                onClick={() => setIsEditingNotice(true)}
              >
                Edit Instruction
              </button>
            )}
          </>
        )}
        <h6 style={{ marginLeft: "90%" }}>Thanks & Regards @Suman Adhikari</h6>
      </div>

      {/* Incident Editor Form */}
      <IncidentEditorPage 
        formData={formData}
        onFormChange={handleFormChange}
        onSubmit={handleSubmit}
        userData={userData}
        incidentId={incidentId}
      />
    </div>
  );
};

export default IncidentManagement;
