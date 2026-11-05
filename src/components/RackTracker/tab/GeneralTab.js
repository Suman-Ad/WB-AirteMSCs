import React from 'react';
import Field from '../RackFormField';

export default function GeneralTab({ formData, handleChange, editData, floorList, rackType, powerType, rackStatus }) {
  const input = (name, type = 'text', disabled = false) => <input type={type} name={name} value={formData[name] ?? ''} onChange={handleChange} disabled={disabled} />;
  const select = (name, options, disabled = false) => <select name={name} value={formData[name] || ''} onChange={handleChange} disabled={disabled}><option value="">Select</option>{[...new Set([formData[name], ...options].filter(Boolean))].map(value => <option key={value} value={value}>{value}</option>)}</select>;
  return <div className="rack-form-grid">
    <Field label="Site name">{input('siteName', 'text', true)}</Field>
    <Field label="Switch room / equipment location">{select('equipmentLocation', floorList, !!editData)}</Field>
    <Field label="Rack / equipment number">{input('equipmentRackNo', 'text', !!editData)}</Field>
    <Field label="Rack / equipment name">{input('rackName', 'text', !!editData)}</Field>
    <Field label="RFAI number">{input('rfaiNo')}</Field>
    <Field label="Rack power-on date">{input('rackPowerOnDate', 'date')}</Field>
    <Field label="Rack type">{select('rackType', rackType)}</Field>
    <Field label="Power type"><select name="powerType" value={formData.rackType === 'Passive' ? 'None' : formData.powerType || ''} onChange={handleChange} disabled={formData.rackType === 'Passive'}>{formData.rackType === 'Passive' ? <option value="None">None</option> : <><option value="">Select power type</option>{powerType.map(value => <option key={value} value={value}>{value}</option>)}</>}</select></Field>
    <Field label="Rack status">{select('rackStatus', rackStatus)}</Field>
    {formData.rackStatus === 'Switched-OFF' && <Field label="Switched-off date">{input('switchedOffDate', 'date')}</Field>}
    <Field label="Rack description" wide><textarea name="rackDescription" value={formData.rackDescription ?? ''} onChange={handleChange} rows={3} /></Field>
  </div>;
}
