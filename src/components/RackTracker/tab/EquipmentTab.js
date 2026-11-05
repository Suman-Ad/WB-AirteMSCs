import React from 'react';
import Field from '../RackFormField';

export default function EquipmentTab({ formData, handleChange, rackEquipments, setRackEquipments, recomputeUSpaceFromEquipments, computeCapacityAnalysis, setFormData }) {
  const applyEquipment = list => {
    setRackEquipments(list);
    const updated = { ...formData, ...recomputeUSpaceFromEquipments(list, formData.totalRackUSpace) };
    setFormData({ ...updated, ...computeCapacityAnalysis(updated) });
  };
  const blankEquipment = () => ({ id: Date.now().toString(), name: '', startU: '', endU: '', sizeU: 0, remarks: '' });
  const updateEquipment = (index, field, value) => {
    const list = rackEquipments.map((equipment, i) => i === index ? { ...equipment, [field]: value } : equipment);
    if (field === 'startU' || field === 'endU') {
      const start = Number(list[index].startU), end = Number(list[index].endU);
      list[index].sizeU = start && end && start >= end ? start - end + 1 : 0;
    }
    applyEquipment(list);
  };
  return <>
    <section className="rack-form-subsection"><h3>Rack dimensions</h3><div className="rack-form-grid">
      {['Height', 'Width', 'Depth'].map(dimension => <Field label={`${dimension} (mm)`} key={dimension}><input type="number" name={`rack${dimension}`} value={formData[`rack${dimension}`] ?? ''} onChange={handleChange} /></Field>)}
      <Field label="Rack size (H × W × D)"><input value={`${formData.rackHeight || '—'} × ${formData.rackWidth || '—'} × ${formData.rackDepth || '—'}`} disabled /></Field>
      <Field label="Total rack space (U)"><input type="number" name="totalRackUSpace" value={formData.totalRackUSpace ?? ''} onChange={handleChange} /></Field>
    </div></section>
    <section className="rack-form-subsection"><div className="rack-form-equipment-heading"><div><h3>Installed equipment</h3><p className="rack-form-hint">Enter the start and end U positions. Equipment size is calculated automatically.</p></div><button type="button" onClick={() => applyEquipment([...rackEquipments, blankEquipment()])}>+ Add equipment</button></div>
      <div className="rack-form-equipment-list">{rackEquipments.map((equipment, index) => <section key={equipment.id || index} className="rack-form-equipment-card" aria-label={`Equipment ${index + 1}`}>
        <div className="rack-form-equipment-heading"><h4>Equipment {String(index + 1).padStart(2, '0')}</h4><button type="button" className="rack-form-remove" aria-label={`Remove equipment ${index + 1}`} onClick={() => { const list = rackEquipments.filter((_, i) => i !== index); applyEquipment(list.length ? list : [blankEquipment()]); }}>Remove</button></div>
        <div className="rack-form-equipment-grid">
          <Field label="Equipment name"><input value={equipment.name || ''} onChange={event => updateEquipment(index, 'name', event.target.value)} /></Field>
          <Field label="Start U"><input type="number" value={equipment.startU ?? ''} onChange={event => updateEquipment(index, 'startU', Number(event.target.value) || 0)} /></Field>
          <Field label="End U"><input type="number" value={equipment.endU ?? ''} onChange={event => updateEquipment(index, 'endU', Number(event.target.value) || 0)} /></Field>
          <Field label="Size (U)"><input type="number" value={equipment.sizeU || 0} readOnly /></Field>
        </div>
        <Field label="Equipment details / remarks" wide><textarea rows={3} value={equipment.remarks || ''} placeholder="Make, model, serial number, and other details" onFocus={() => { if (!equipment.remarks) updateEquipment(index, 'remarks', 'Make:- \nModel No:- \nSl. No:-'); }} onChange={event => updateEquipment(index, 'remarks', event.target.value)} /></Field>
      </section>)}</div>
    </section>
    <div className="rack-form-grid"><Field label="Used rack space (U)"><input type="number" name="usedRackUSpace" value={formData.usedRackUSpace ?? ''} onChange={handleChange} /></Field><Field label="Free rack space (U)"><input type="number" name="freeRackUSpace" value={formData.freeRackUSpace ?? ''} disabled /></Field></div>
  </>;
}
