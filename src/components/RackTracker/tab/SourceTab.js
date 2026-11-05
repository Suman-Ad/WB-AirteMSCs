import React from 'react';
import Field from '../RackFormField';

const groups = [
  ['Source distribution', [
    ['dbNumber', 'Source DB number', 'text'], ['dbVoltage', 'DB voltage (V)'], ['incomerRating', 'DB incomer rating (A)'],
    ['cableSize', 'PP–DB cable size (mm²)', 'text'], ['cableRun', 'PP–DB cable runs', 'text'], ['cableLength', 'PP–DB cable length (m)', 'text'], ['rackCableTagging', 'Rack / node cable tagging', 'select'],
  ]],
  ['Rack connection', [['equipmentRackNo', 'Equipment rack number', 'text'], ['rackName', 'Rack / equipment name', 'text']]],
  ['Incoming cable & protection', [
    ['rackIncomingCableSize', 'Incoming power cable size (mm²)'], ['rackCableLength', 'Incoming cable length (m)'], ['rackCableRun', 'DB–rack DB cable runs'],
    ['dbMcbNumber', 'DB MCB number', 'text'], ['dbMcbLabel', 'DB MCB label', 'select'], ['dbMcbRating', 'DB MCB rating (A)'], ['tempOnMcb', 'MCB / fuse temperature (°C)', 'text'], ['runningLoad', 'Running load (A)'],
  ]],
  ['Calculated cable loading', [['cableCapacity', 'Cable load capacity (A)', 'calculated'], ['pctLoadCable', 'Load on output cable (%)', 'calculated'], ['pctLoadMcb', 'Load on output MCB (%)', 'calculated']]],
  ['Rack-end distribution', [
    ['rackEndVoltage', 'Rack-end voltage (V)'], ['rackEndNoDb', 'Number of DBs / power strips'], ['rackEndDcdbName', 'DCDB / power strip name', 'text'],
    ['rackEndRunningLoad', 'Rack-end DB running load (A)'], ['rackEndMcbRating', 'Rack-end DB MCB rating (A)'], ['rackEndPctLoadMcb', 'Load on input MCB (%)', 'calculated'], ['remarks', 'Remarks', 'text'],
  ]],
];

export default function SourceTab({ formData, handleChange, siteConfig, source }) {
  const get = name => formData[`${name}${source}`] ?? '';
  const name = key => `${key}${source}`;
  const sourceKind = formData.powerType === 'AC' ? 'UPS' : formData.powerType === 'DC' ? 'SMPS' : 'SMPS / UPS';
  const configs = formData.powerType === 'DC' ? siteConfig?.smpsConfigs : siteConfig?.upsConfigs;
  const count = formData.powerType === 'DC' ? siteConfig?.smpsCount : siteConfig?.upsCount;
  const rating = get('smpsRating') || (formData.powerType === 'DC' ? configs?.[get('smpsName')]?.capacityAmp : configs?.[get('smpsName')]?.capacityKva) || '';
  return <div className="rack-form-source">
    <section className="rack-form-subsection"><h3>Source {source} · power supply</h3><div className="rack-form-grid">
      <Field label={`${sourceKind} name`}>
        {formData.powerType === 'AC+DC' ? <input name={name('smpsName')} value={get('smpsName')} onChange={handleChange} placeholder="Enter source name" /> : <select name={name('smpsName')} value={get('smpsName')} onChange={handleChange}><option value="">Select source</option>{Array.from({ length: count || 0 }, (_, index) => `${sourceKind}-${index + 1}`).filter(key => configs?.[key]?.active !== false).map(key => <option key={key} value={key}>{key}</option>)}</select>}
      </Field>
      <Field label={`${sourceKind} rating (${formData.powerType === 'AC' ? 'kVA' : 'A / kW'})`}><input type="number" name={name('smpsRating')} value={rating} onChange={handleChange} /></Field>
    </div></section>
    {groups.map(([title, fields]) => <section className="rack-form-subsection" key={title}><h3>{title}</h3><div className="rack-form-grid">{fields.map(([key, title, type = 'number']) => <Field label={title} key={key}>{type === 'select' ? <select name={name(key)} value={get(key)} onChange={handleChange}><option value="">Select</option><option value="Yes">Yes</option><option value="No">No</option></select> : <input type={type === 'calculated' ? 'number' : type} name={name(key)} value={get(key)} onChange={handleChange} disabled={type === 'calculated'} />}</Field>)}</div></section>)}
  </div>;
}
