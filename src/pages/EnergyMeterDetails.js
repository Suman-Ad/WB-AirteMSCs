import React from "react";
import { vectors, phases, displayReading, isNumber } from "./energyMeterData";

const format = (v) => isNumber(v) ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—";
const panel = { background: "var(--app-surface)", border: "1px solid var(--app-border)", borderRadius: 10, padding: 16 };
const cell = { padding: "10px 12px", borderBottom: "1px solid var(--app-border)", textAlign: "left" };

export default function EnergyMeterDetails({ meter, state, vectorOnly = false, omitVectors = false }) {
  const rows = vectors(meter);
  const vmax = Math.max(1, ...rows.map((r) => r.voltage || 0));
  const imax = Math.max(1, ...rows.map((r) => r.current || 0));
  const reading = (key) => {
    const { value, unit } = displayReading(meter, key);
    return `${format(value)}${unit ? ` ${unit}` : ""}`;
  };
  const arrow = (angle, length, color, dashed, label) => {
    const rad = angle * Math.PI / 180;
    const x = 200 + length * Math.cos(rad), y = 165 - length * Math.sin(rad);
    const side = (a) => `${x - 9 * Math.cos(rad + a)},${y + 9 * Math.sin(rad + a)}`;
    return <g key={label}>
      <line x1="200" y1="165" x2={x} y2={y} stroke={color} strokeWidth="2.5" strokeDasharray={dashed ? "6 4" : undefined} />
      <polyline points={`${side(-0.45)} ${x},${y} ${side(0.45)}`} stroke={color} strokeWidth="2.5" fill="none" />
      <text x={x + 8} y={y - 8} fill={color} fontSize="13">{label}</text>
    </g>;
  };
  const phaseMetrics = [["Voltage L-N", "voltage_ln"], ["Voltage L-L (R-Y / Y-B / B-R)", "voltage_ll"],
    ["Current", "current"], ["Active power", "active_power"], ["Apparent power", "apparent_power"],
    ["Reactive power", "reactive_power"], ["Power factor", "power_factor"], ["Frequency", "frequency"],
    ["Voltage phase angle", "voltage_phase_angle"], ["Current phase angle", "current_phase_angle"]];
  const qualityMetrics = [["Voltage THD", "voltage_thd"], ["Current THD", "current_thd"], ["Phase load", "load_percent"], ["Interruptions", "interruptions"]];
  const qualityKeys = qualityMetrics.flatMap(([, key]) => phases.map((p) => `custom_${p.toLowerCase()}_${key}`));
  const additional = Object.keys(meter).filter((key) => key.startsWith("custom_") && !qualityKeys.includes(key));
  const metadata = [["Meter ID", meter.meterId || meter.id], ["Profile", meter.profileName || meter.profileId],
    ["Equipment", meter.equipmentType], ["Bus", meter.busId], ["Modbus address", meter.modbusId ?? meter.slaveId],
    ["Communication", meter.communicationState], ["Successful scans", meter.successfulScans], ["Failed scans", meter.failedScans],
    ["Consecutive failures", meter.consecutiveFailures], ["Read duration (s)", meter.readSeconds], ["Collector sequence", meter.collectorSequence]];
  const vectorPanel = (
    <section style={panel}>
      <h2>Phase vectors · {state}</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center" }}>
        <svg viewBox="0 0 400 330" role="img" aria-label="Voltage and current phase vectors for selected meter" style={{ width: "100%", maxWidth: 420 }}>
          {[60, 120].map((r) => <circle key={r} cx="200" cy="165" r={r} fill="none" stroke="var(--app-border)" />)}
          <path d="M60 165H340 M200 25V305" stroke="var(--app-border)" />
          {rows.flatMap((r) => [
            r.voltage > 0 ? arrow(r.reference, 120 * r.voltage / vmax, r.color, false, `V${r.phase}`) : null,
            r.phi !== null ? arrow(r.reference - r.phi, 120 * r.current / imax, r.color, true, `I${r.phase}`) : null,
          ])}
        </svg>
        <div>
          <p>Solid: voltage · Dashed: current. Voltage and current lengths use separate scales.</p>
          {rows.map((r) => <p key={r.phase} style={{ color: r.color }}>
            <strong>{r.phase}</strong>: {format(r.voltage)} V · {format(r.current)} A · φ {format(r.phi)}° · {r.source}
          </p>)}
          <p>{meter.voltageAnglesNominal ? "Voltage angles are fixed nominal references supplied by the collector, not measured voltage angles. Current angles are shown as reported." : "Measured angles are used when both angle registers are available."} Otherwise, phase displacement is estimated from P/Q using nominal R/Y/B references of 0° / −120° / +120°.</p>
          <p>No power-factor-only or zero-value angle substitutions are made.</p>
        </div>
      </div>
    </section>
  );
  if (vectorOnly) return vectorPanel;
  return <>
    <section className="energy-card"><h2>Meter & collector</h2><dl className="energy-meter-metadata">{metadata.filter(([, value]) => value !== undefined && value !== null && value !== "").map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{typeof value === "number" ? format(value) : String(value)}</dd></div>)}</dl>{meter.error && <p className="energy-notice" role="alert">{String(meter.error)}</p>}</section>
    <section style={{ ...panel, overflowX: "auto" }}>
      <h2>Each phase · selected meter</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>{["Measurement", "R phase", "Y phase", "B phase"].map((s) => <th key={s} style={cell}>{s}</th>)}</tr></thead>
        <tbody>{phaseMetrics.map(([title, key]) => <tr key={key}>
          <th style={cell}>{title}</th>{phases.map((p) => <td key={p} style={cell}>{reading(`${p}_${key}`)}</td>)}
        </tr>)}</tbody>
      </table>
      <p>— means unavailable or a failed reading. Displayed values retain the selected meter's timestamp and status.</p>
    </section>
    {!omitVectors && vectorPanel}
    <section style={{ ...panel, overflowX: "auto" }}>
      <h2>Energy counters and runtime</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}><tbody>
        {[["Forward active energy", "fwd_Wh"], ["Forward apparent energy", "fwd_VAh"],
          ["Forward reactive energy", "fwd_VARh"], ["Capacitive reactive energy", "fwd_VARh_capacitive"],
          ["Forward runtime", "fwd_runsec"]].map(([title, key]) => <tr key={key}><th style={cell}>{title}</th><td style={cell}>{reading(key)}</td></tr>)}
      </tbody></table>
      <p>Energy counters are displayed in kWh / kVAh / kvarh; forward runtime is in seconds. Wh-based reader counters are divided by 1,000 unless the collector explicitly marks them as kilo units.</p>
    </section>
    {qualityKeys.some((key) => key in meter) && <section className="energy-card"><h2>Power quality & phase loading</h2><div className="energy-table-wrap"><table><thead><tr><th>Measurement</th>{phases.map((p) => <th key={p}>{p} phase</th>)}</tr></thead><tbody>{qualityMetrics.map(([label, key]) => <tr key={key}><th>{label}</th>{phases.map((p) => <td key={p}>{reading(`custom_${p.toLowerCase()}_${key}`)}</td>)}</tr>)}</tbody></table></div><p className="energy-muted">THD and loading are collector-reported percentages. Interruption registers are cumulative counts.</p></section>}
    {additional.length > 0 && <section style={panel}>
      <h2>Additional meter readings</h2>
      <dl className="energy-meter-metadata">{additional.map((key) => <div key={key}><dt>{meter.fieldDefinitions?.[key]?.label || key.replace(/^custom_/, "").replace(/_/g, " ")}</dt><dd>{reading(key)}</dd></div>)}</dl>
    </section>}
    {Array.isArray(meter.warnings) && meter.warnings.length > 0 && <section style={panel}><h2>Meter diagnostics</h2>{meter.warnings.map((w, i) => <p key={i}>{w}</p>)}</section>}
  </>;
}
