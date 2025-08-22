import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, setDoc } from 'firebase/firestore';
import IncidentEditorPage from '../components/IncidentEditorPage';
import '../assets/IncidentManagement.css';

const IncidentManagement = ({ userData }) => {
  const [instructionText, setInstructionText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");
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

  const handleFormChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    const requiredFields = [
      'region', 'circle', 'siteName', 'dateOfIncident',
      'timeOfIncident', 'equipmentCategory', 'incidentTitle'
    ];
    
    for (const field of requiredFields) {
      if (!formData[field]) {
        alert(`Please fill in ${field}`);
        return false;
      }
    }
    return true;
  };

  // const [isSubmitting, setIsSubmitting] = useState(false);
  const handleSubmit = async () => {
    if (!validateForm()) return;
    // setIsSubmitting(true);
    try {
      const incidentDate = new Date(formData.dateOfIncident);
      const year = incidentDate.getFullYear();
      const month = String(incidentDate.getMonth() + 1).padStart(2, '0');
      const day = String(incidentDate.getDate()).padStart(2, '0');
      
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

      alert('Incident reported successfully!');
      
      // Proper form reset
      // setFormData(prev => {
      //   const resetData = {};
      //   for (const key in prev) {
      //     resetData[key] = key === 'siteName' ? userData?.site || '' : '';
      //   }
      //   return resetData;
      // });

      // Simple and effective form reset
      setFormData({
      region: userData?.region ||'',
      circle: userData?.circle ||'',
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
    } finally {
    // setIsSubmitting(false);
  }
  };

  

  return (
    <div className="dhr-dashboard-container">
      <h1 className="dashboard-header">
        <strong>🚨 Incident Management</strong>
      </h1>
      {/* Notice Board */}
      <div className="instruction-tab">
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
            <p className="dashboard-instruction-panel">
              {instructionText || "No instructions available."}
            </p>
            {["Admin", "Super Admin"].includes(userData?.role) && (
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
      <IncidentEditorPage 
        formData={formData}
        onFormChange={handleFormChange}
        onSubmit={handleSubmit}
        userData={userData}
      />

      {/* <button disabled={isSubmitting}>
        {isSubmitting ? 'Submitting...' : 'Submit Incident'}
      </button> */}
    </div>
  );
};

export default IncidentManagement;