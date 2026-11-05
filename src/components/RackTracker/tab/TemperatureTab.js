import React from 'react';
import Field from '../RackFormField';

export default function TemperatureTab({ formData, handleChange }) {
  return <div className="rack-temperature-sections">{['Front', 'Back'].map(side => <section className="rack-form-subsection" key={side}><h3>{side} of rack</h3><div className="rack-form-grid">{['Top', 'Middle', 'Bottom'].map(position => {
    const name = `${side.toLowerCase()}${position}Temp`;
    return <Field key={name} label={`${position} temperature (°C)`}><input type="number" name={name} value={formData[name] ?? ''} onChange={handleChange} /></Field>;
  })}</div></section>)}</div>;
}
