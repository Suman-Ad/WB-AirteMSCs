import React, { useEffect, useState } from 'react';
import '../assets/IncidentEditor.css';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db } from "../firebase";

const IncidentEditorPage = ({ formData, onFormChange, onSubmit, userData, incidentId }) => {
  const [calculatedMttr, setCalculatedMttr] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [rcaFileUrl, setRcaFileUrl] = useState(formData.rcaFileUrl || "");

  // 🔹 Recalculate MTTR whenever incidentDate or closureDate changes
  useEffect(() => {
    if (formData.dateOfIncident) {
      const incidentDate = new Date(formData.dateOfIncident);
      const closureDate = formData.closureDate ? new Date(formData.closureDate) : new Date();
      const diffTime = closureDate - incidentDate;
      const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      setCalculatedMttr(days >= 0 ? days : 0);

      // also push into parent formData so it saves correctly
      onFormChange("mttr", days >= 0 ? days : 0);
    }
  }, [formData.dateOfIncident, formData.closureDate]);

    // 🔹 RCA File Upload Handler
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedTypes = [
      "application/pdf",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ];
    if (!allowedTypes.includes(file.type)) {
      alert("Only PDF and Excel files are allowed!");
      return;
    }

    try {
      setUploading(true);
      const storage = getStorage();
      const storageRef = ref(storage, `rca_files/${incidentId || "temp"}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setRcaFileUrl(url);
      onFormChange("rcaFileUrl", url); // save link in formData
      alert("RCA file uploaded successfully!");
    } catch (err) {
      console.error("File upload error:", err);
      alert("Failed to upload file.");
    } finally {
      setUploading(false);
    }
  };

  const equipmentCategories = [
    "ACS","Air Conditioner","BMS","CCTV","Comfort AC","Diesel Generator","Earth Pit",
    "Exhust Fan","FAS","FSS","HT Panel","Inverter","LT Panel","PAS","PFE","SMPS",
    "SMPS BB","Solar System","UPS","UPS BB","DCDB/ACDB","Transformer"
  ];

  const renderInput = (name, value, type = 'text', options = [], disabled = false) => {
    const commonProps = {
      value,
      onChange: (e) => onFormChange(name, e.target.value),
      className: "form-input",
      disabled
    };
    switch (type) {
      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => onFormChange(name, e.target.value)}
            className="form-input"
          />
        );
      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => onFormChange(name, e.target.value)}
            className="form-input"
          >
            <option value="">Select</option>
            {options.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        );
      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => onFormChange(name, e.target.value)}
            className="form-input"
          />
        );
      case 'time':
        return (
          <input
            type="time"
            value={value}
            onChange={(e) => onFormChange(name, e.target.value)}
            className="form-input"
          />
        );
      default:
        return (
          <input
            type={type}
            value={value}
            onChange={(e) => onFormChange(name, e.target.value)}
            className="form-input"
          />
        );
    }
  };

  const fields = [
    { label: 'TT/Docket No', name: 'ttDocketNo', type: 'text' },
    { label: 'Region', name: 'region', type: 'text' },
    { label: 'Circle', name: 'circle', type: 'text' },
    { label: 'Site ID', name: 'siteId', type: 'text' },
    { label: 'Site Name', name: 'siteName', type: 'text' },
    { label: 'O&M Partner', name: 'ompPartner', type: 'select', options: ['Vertiv PAC', 'Vertiv UPS', 'Vertiv SMPS', 'Delta SMPS', 'Honeywell', 'Solus', 'Cummins', 'Kirlosker', 'Amararaja', 'HBL', 'ADN Fire', 'Hitachi'] },
    { label: 'Date of Incident', name: 'dateOfIncident', type: 'date' },
    { label: 'Time of Incident', name: 'timeOfIncident', type: 'time' },
    { label: 'SA/NSA', name: 'saNsa', type: 'select', options: ['SA', 'NSA'] },
    { label: 'Equipment Category', name: 'equipmentCategory', type: 'select', options: equipmentCategories },
    { label: 'Incident Title', name: 'incidentTitle', type: 'text' },
    { label: 'Incident Description', name: 'incidentDescription', type: 'textarea' },
    { label: 'Type', name: 'type', type: 'select', options: ['Alarm', 'Fault', 'Incident'] },
    { label: 'Effect', name: 'effect', type: 'text' },
    { label: 'Effected Equipment Details', name: 'effectedEquipmentDetails', type: 'textarea' },
    { label: 'Actions Taken', name: 'actionsTaken', type: 'textarea' },
    { label: 'RCA Status', name: 'rcaStatus', type: 'select', options: ['Y', 'N'] },
    { label: 'Ownership', name: 'ownership', type: 'text' },
    { label: 'Reason Category', name: 'reasonCategory', type: 'text' },
    { label: 'Real Reason', name: 'realReason', type: 'text' },
    { label: 'Impact Type', name: 'impactType', type: 'select', options: ['Partial', 'Full'] },
    { label: 'Remarks', name: 'remarks', type: 'text' },
    { label: 'Closure Date', name: 'closureDate', type: 'date' },
    { label: 'Closure Time', name: 'closureTime', type: 'time' },
    { label: 'Status', name: 'status', type: 'select', options: ['Open', 'Closed'] },
    { label: 'MTTR (Days)', name: 'mttr', type: 'text', disabled: true },
    { label: 'Learning Shared', name: 'learningShared', type: 'select', options: ['Y', 'N'] },
    { label: 'Closure Remarks', name: 'closureRemarks', type: 'textarea' },
  ];

  return (
    <div className="incident-editor">
      <h2 className='noticeboard-header'>
        <strong>
          {incidentId 
            ? `Edit Incident Report (${formData.siteName || userData?.site})` 
            : `${userData?.site} New Incident Report Form`}
        </strong>
      </h2>

      <div className="form-container child-container">
        {fields.map((field) => (
          <div key={field.name} className={`form-group ${field.disabled ? 'read-only-field' : ''}`}>
            <label><strong>{field.label}</strong></label>
            {field.name === "mttr"
              ? <input type="text" value={calculatedMttr} className="form-input" disabled />
              : renderInput(
              field.name, 
              formData[field.name] || '', 
              field.type, 
              field.options,
              field.disabled
            )}
          </div>
        ))}

        {/* 🔹 RCA File Upload (only if RCA Status = Y) */}
        {formData.rcaStatus === "Y" && (
          <div className="form-group">
            <label>Upload RCA File (PDF/Excel)</label>
            <input 
              type="file" 
              accept=".pdf,.xls,.xlsx"
              onChange={handleFileUpload}
              disabled={uploading}
            />
            {uploading && <p>Uploading...</p>}
            {rcaFileUrl && (
              <p>
                ✅ File uploaded: <a href={rcaFileUrl} target="_blank" rel="noopener noreferrer">View RCA File</a>
              </p>
            )}
          </div>
        )}
      </div>

      <button onClick={onSubmit} className="submit-btn pm-manage-btn secondary">
        {incidentId ? "Update Incident" : "Submit Incident"}
      </button>
    </div>
  );
};

export default IncidentEditorPage;
