import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import IncidentEditorPage from '../components/IncidentEditorPage';
import '../assets/IncidentManagement.css';

const IncidentManagement = ({ userData }) => {
  const [formData, setFormData] = useState({
    region: '',
    circle: '',
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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleSubmit = async () => {
    if (!validateForm()) return;
    setIsSubmitting(true);
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
      region: '',
      circle: '',
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
    setIsSubmitting(false);
  }
  };

  

  return (
    <div className="incident-management">
      <IncidentEditorPage 
        formData={formData}
        onFormChange={handleFormChange}
        onSubmit={handleSubmit}
      />

      <button disabled={isSubmitting}>
        {isSubmitting ? 'Submitting...' : 'Submit Incident'}
      </button>
    </div>
  );
};

export default IncidentManagement;