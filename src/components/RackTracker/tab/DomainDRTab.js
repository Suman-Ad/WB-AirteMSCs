import React from 'react';
import Field from '../RackFormField';

export default function DomainDRTab({ formData, handleChange }) {
  return <div className="rack-form-grid">
    <Field label="Rack domain"><select name="rackDomainType" value={formData.rackDomainType || ''} onChange={handleChange}><option value="">Select domain</option>{['TNG', 'Core', 'Others'].map(value => <option key={value} value={value}>{value}</option>)}</select></Field>
    <Field label="Rack owner (name and phone)"><input type="text" name="rackOwnerName" value={formData.rackOwnerName ?? ''} onChange={handleChange} /></Field>
    <Field label="DR test status"><select name="drTestStatus" value={formData.drTestStatus || ''} onChange={handleChange}><option value="">Select status</option>{['Pending', 'Completed', 'Failed'].map(value => <option key={value} value={value}>{value}</option>)}</select></Field>
    <Field label="DR test date"><input type="date" name="drTestDate" value={formData.drTestDate ?? ''} onChange={handleChange} /></Field>
  </div>;
}
