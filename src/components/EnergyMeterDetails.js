import React, { useState } from "react";
import { rmsReadings, forwardReadings, phaseVectors, phaseDisplacements, findReading, flattenReadings } from "../utils/energyReadings";

const display = (v) => typeof v === "number" ? v.toLocaleString(undefined, { maximumFractionDigits: 3 }) : v ?? "—";
export function MeterReadingPanels({ meter }) {
  return <div className="energy-reading-panels">{[["RMS readings", rmsReadings(meter)], ["FWD energy registers", forwardReadings(meter)]].map(([title, rows]) => <section className="energy-card energy-reading-panel" key={title}><h2>{title}</h2><div className="energy-table-wrap"><table><thead><tr><th>Reading</th><th>Value</th><th>Unit</th></tr></thead><tbody>{rows.map((row) => <tr key={row.key || row.label}><td title={row.key}>{row.label}</td><td>{meter?.status === "OK" ? display(row.value) : "—"}</td><td>{row.unit}</td></tr>)}</tbody></table></div></section>)}</div>;
}

export function MeterVectorDiagram({ meter, status }) {
  const [showReference, setShowReference] = useState(true);
  const vectors = meter?.status === "OK" ? phaseVectors(meter) : [];
  const displacement = phaseDisplacements(meter);
  const angleRegisters = flattenReadings(meter).filter(([key]) => /angle/i.test(key));
  const pf = meter?.status === "OK" ? findReading(meter, ["power_factor", "average_power_factor", "pf"])?.value : null;
  const pfAngle = typeof pf === "number" && Math.abs(pf) <= 1 ? Math.acos(Math.abs(pf)) * 180 / Math.PI : null;
  const point = (v) => {
    const maximum = Math.max(...vectors.filter((other) => other.kind === v.kind).map((other) => other.magnitude), 1);
    const radius = 105 * v.magnitude / maximum;
    return { x: 170 + radius * Math.cos(v.angle * Math.PI / 180), y: 170 - radius * Math.sin(v.angle * Math.PI / 180) };
  };
  return <section className="energy-card"><div className="energy-section-title"><div><h2>Phase angle & vector diagram</h2><p>{meter?.name || meter?.id} · {status} · {vectors.length}/6 measured vectors</p></div><label className="energy-reference-toggle"><input type="checkbox" checked={showReference} onChange={(e) => setShowReference(e.target.checked)} /> Balanced reference</label></div>
    <div className="energy-vector-layout"><div><svg className="energy-vector" viewBox="0 0 340 340" role="img" aria-label="Phase vector diagram with measured vectors and optional balanced reference">
      {[35, 70, 105].map((r) => <circle key={r} cx="170" cy="170" r={r} fill="none" stroke="var(--app-border)" />)}
      <path d="M25 170H315 M170 25V315" stroke="var(--app-border)" /><text x="300" y="160">0°</text><text x="178" y="30">90°</text><text x="10" y="160">180°</text><text x="178" y="325">270°</text>
      {showReference && [["R", 0], ["Y", -120], ["B", 120]].map(([phase, angle]) => <g key={phase} className="energy-vector-reference"><line x1="170" y1="170" x2={170 + 125 * Math.cos(angle * Math.PI / 180)} y2={170 - 125 * Math.sin(angle * Math.PI / 180)} /><text x={170 + 138 * Math.cos(angle * Math.PI / 180)} y={170 - 138 * Math.sin(angle * Math.PI / 180)}>{phase} ref</text></g>)}
      {vectors.map((v) => { const p = point(v); const color = { r: "#ef4444", y: "#ca8a04", b: "#3b82f6" }[v.phase]; return <g key={`${v.phase}-${v.kind}`} stroke={color} fill={color}><line x1="170" y1="170" x2={p.x} y2={p.y} strokeWidth="3" strokeDasharray={v.kind === "current" ? "6 4" : undefined} /><path d="M0 0L-9 -4L-9 4Z" transform={`translate(${p.x} ${p.y}) rotate(${-v.angle})`} /><text x={p.x + 6} y={p.y - 7} stroke="none">{v.kind === "voltage" ? "V" : "I"}{v.phase.toUpperCase()}</text></g>; })}
    </svg><p className="energy-muted">R: red · Y: amber · B: blue. Voltage: solid; current: dashed. Separate V/A scales; angles counterclockwise from 0°.</p></div>
    <div><h3>Measured phase angles</h3><div className="energy-table-wrap"><table><thead><tr><th>Phase</th><th>Voltage ∠</th><th>Current ∠</th><th>V–I displacement</th></tr></thead><tbody>{["r", "y", "b"].map((phase) => <tr key={phase}><td>{phase.toUpperCase()}</td>{["voltage", "current"].map((kind) => <td key={kind}>{display(vectors.find((v) => v.phase === phase && v.kind === kind)?.angle)}°</td>)}<td>{meter?.status === "OK" ? display(displacement.find((d) => d.phase === phase)?.reading?.value) : "—"}°</td></tr>)}</tbody></table></div>
      <p className="energy-muted">PF-equivalent angle magnitude: {display(pfAngle)}° {pfAngle !== null && "(calculated from aggregate PF; lead/lag and phase sequence unavailable)"}</p>
      {angleRegisters.length > 0 && <details className="energy-angle-registers"><summary>All received angle registers ({angleRegisters.length})</summary><table><thead><tr><th>Register</th><th>Received value</th></tr></thead><tbody>{angleRegisters.map(([key, value]) => <tr key={key}><td>{key}</td><td>{value}</td></tr>)}</tbody></table></details>}
      {vectors.length > 0 && <div className="energy-table-wrap"><table><thead><tr><th>Vector</th><th>RMS magnitude</th><th>Angle</th></tr></thead><tbody>{vectors.map((v) => <tr key={`${v.phase}-${v.kind}`}><td>{v.kind} {v.phase.toUpperCase()}</td><td>{display(v.magnitude)} {v.kind === "voltage" ? "V" : "A"}</td><td>{display(v.angle)}°</td></tr>)}</tbody></table></div>}
      {vectors.length < 6 && <p className="energy-notice">{vectors.length ? "Some measured phase vectors are missing." : "No measured phase vectors in this reading."} Vectors require both a phase RMS magnitude and its absolute angle. V–I displacement alone is not an absolute angle.</p>}
      {showReference && <p className="energy-muted">Grey R/Y/B reference lines show assumed 0° / −120° / +120° positions for orientation only. They are not meter measurements.</p>}
    </div></div>
  </section>;
}
