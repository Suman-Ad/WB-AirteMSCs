import React, { useEffect, useState } from 'react';
import '../assets/IncidentEditor.css';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

const IncidentEditorPage = ({ formData, onFormChange, isSubmitting, onSubmit, userData, incidentId }) => {
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
    const props = {id:`incident-${name}`,name,value,onChange:e=>onFormChange(name,e.target.value),className:'form-input',disabled:disabled || isSubmitting};
    if (type === 'textarea') return <textarea {...props} rows={4} />;
    if (type === 'select') return <select {...props}><option value="">Select</option>{options.map(option=><option key={option} value={option}>{option}</option>)}</select>;
    return <input {...props} type={type} />;
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

  const groups = [
    {title:'Site & ownership',description:'Identify the location and partner responsible for this report.',names:['ttDocketNo','region','circle','siteId','siteName','ompPartner']},
    {title:'Incident details',description:'Record what happened, when it occurred and the affected equipment.',names:['incidentTitle','dateOfIncident','timeOfIncident','equipmentCategory','type','saNsa','incidentDescription']},
    {title:'Impact & response',description:'Capture service impact, immediate actions and the investigation.',names:['effect','impactType','effectedEquipmentDetails','actionsTaken','ownership','reasonCategory','realReason','remarks']},
    {title:'Resolution & RCA',description:'Track the current status, closure and shared learnings.',names:['status','rcaStatus','closureDate','closureTime','mttr','learningShared','closureRemarks']},
  ];
  return <div className="incident-editor" aria-busy={isSubmitting}>
    <header className="incident-form-heading"><div><span className="incident-eyebrow">{incidentId ? 'UPDATE REPORT' : 'CREATE REPORT'}</span><h2>{incidentId ? 'Edit incident report' : 'New incident report'}</h2><p>Complete the report below. Site details are prefilled from your account.</p></div><span className="incident-status-badge">{formData.status || 'Open'}</span></header>
    {groups.map((group,index)=><fieldset className="incident-fieldset" key={group.title} disabled={isSubmitting}>
      <legend><span aria-hidden="true">{String(index+1).padStart(2,'0')}</span> {group.title}</legend><p className="incident-group-description">{group.description}</p>
      <div className="incident-fields-grid">{group.names.map(name=>{
        const field=fields.find(item=>item.name===name);
        return <div key={name} className={`form-group ${field.type === 'textarea' || name === 'incidentTitle' ? 'incident-field-wide' : ''}`}>
          <label htmlFor={`incident-${name}`}>{field.label}{field.disabled && <small>Calculated</small>}</label>
          {renderInput(name,name === 'mttr' ? calculatedMttr : formData[name] || '',field.type,field.options,field.disabled)}
        </div>;
      })}
      {group.title === 'Resolution & RCA' && formData.rcaStatus === 'Y' && <div className="form-group incident-field-wide incident-rca-upload">
        <label htmlFor="incident-rca-file">Upload RCA File (PDF/Excel)</label><input id="incident-rca-file" type="file" accept=".pdf,.xls,.xlsx" onChange={handleFileUpload} disabled={uploading || isSubmitting}/>
        {uploading && <p role="status">Uploading RCA file…</p>}
        {rcaFileUrl && <p><a href={rcaFileUrl} target="_blank" rel="noopener noreferrer">View uploaded RCA file ↗</a></p>}
      </div>}
      </div>
    </fieldset>)}
    <footer className="incident-submit-bar"><div><strong>{incidentId ? 'Ready to update this incident?' : 'Ready to submit your report?'}</strong><p>Review the details before saving.</p></div><button type="button" onClick={onSubmit} className="submit-btn" disabled={isSubmitting || uploading}>
      {incidentId ? (isSubmitting ? 'Updating…' : 'Update Incident') : (isSubmitting ? 'Submitting…' : 'Submit Incident')}
    </button></footer>
    {isSubmitting && <p className="incident-save-status" role="status">Saving your incident. Please wait…</p>}
  </div>;
};

export default IncidentEditorPage;
