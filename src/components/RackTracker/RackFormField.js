import React from 'react';

export default function RackFormField({ label, children, wide = false }) {
  return <label className={`rack-form-field${wide ? ' rack-form-field-wide' : ''}`}><span>{label}</span>{children}</label>;
}
