import React from 'react';
import '../assets/IncidentEditor.css';

const IncidentEditorPage = ({ formData, onFormChange, onSubmit }) => {
  const equipmentCategories = [
    'PAC', 'DG', 'SMPS', 'UPS', 'WLD', 'VESDA', 
    'iBMS', 'Panel', 'Transformer', 'PLC', 'Battery', 'Other'
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
    { label: 'Region', name: 'region', type: 'text' },
    { label: 'Circle', name: 'circle', type: 'text' },
    { label: 'Site Name', name: 'siteName', type: 'text' },
    { label: 'O&M Partner', name: 'ompPartner', type: 'text' },
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
    { label: 'MTTR (Days)', name: 'mttr', type: 'number' },
    { label: 'Learning Shared', name: 'learningShared', type: 'select', options: ['Y', 'N'] },
    { label: 'Closure Remarks', name: 'closureRemarks', type: 'textarea' },
    { label: 'TT/Docket No', name: 'ttDocketNo', type: 'text' },
  ];

  return (
    <div className="incident-editor">
      <h2>New Incident Report Form</h2>
      <div className="form-container">
        {fields.map((field) => (
          <div key={field.name} className={`form-group ${field.disabled ? 'read-only-field' : ''}`}>
            <label>{field.label}</label>
            {renderInput(
              field.name, 
              formData[field.name] || '', 
              field.type, 
              field.options
            )}
          </div>
        ))}
      </div>
      <button onClick={onSubmit} className="submit-btn">
        Submit Incident
      </button>
    </div>
  );
};

export default IncidentEditorPage;