import React from 'react';

export default function CapacityAnalysisTab({ formData }) {
  const metrics = [
    ['Total running load', formData.totalLoadBoth, 'A'],
    ['Cable load capacity', formData.bothCableCapacity, ''],
    ['Load on output cable', formData.bothPctLoadCable, '%'],
    ['Load on output MCB', formData.bothPctLoadMcb, '%'],
    ['Matching source MCB ratings', formData.isBothMcbSame, ''],
    ['Source type', formData.sourceType, ''],
    ['Rack occupied', formData.pctRackOccupied, '%'],
  ];
  return <><p className="rack-form-hint">Values are calculated from the equipment and power source details.</p><dl className="rack-capacity-grid">{metrics.map(([title, value, unit]) => <div key={title}><dt>{title}</dt><dd>{value === '' || value === undefined || value === null ? '—' : `${value}${unit ? ` ${unit}` : ''}`}</dd></div>)}</dl></>;
}
