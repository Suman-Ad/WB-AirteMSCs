import React from "react";
import { vectors, phases, displayReading, isNumber } from "./energyMeterData";

const format = (v) => isNumber(v) ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—";
const panel = { background: "var(--app-surface)", border: "1px solid var(--app-border)", borderRadius: 10, padding: 16 };
const cell = { padding: "10px 12px", borderBottom: "1px solid var(--app-border)", textAlign: "left" };

export default function EnergyMeterDetails({ meter, state }) {
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
  return <>
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
          <p>Measured angles are used when both angle registers are available. Otherwise, phase displacement is estimated from P/Q using nominal R/Y/B references of 0° / −120° / +120°.</p>
          <p>No power-factor-only or zero-value angle substitutions are made.</p>
        </div>
      </div>
    </section>
    <section style={{ ...panel, overflowX: "auto" }}>
      <h2>Energy counters and runtime</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}><tbody>
        {[["Forward active energy", "fwd_Wh"], ["Forward apparent energy", "fwd_VAh"],
          ["Forward reactive energy", "fwd_VARh"], ["Capacitive reactive energy", "fwd_VARh_capacitive"],
          ["Forward runtime", "fwd_runsec"]].map(([title, key]) => <tr key={key}><th style={cell}>{title}</th><td style={cell}>{reading(key)}</td></tr>)}
      </tbody></table>
      <p>Energy counters are displayed in kWh / kVAh / kvarh; forward runtime is in seconds. Wh-based reader counters are divided by 1,000 unless the collector explicitly marks them as kilo units.</p>
    </section>
    {Object.keys(meter).some((key) => key.startsWith("custom_")) && <section style={panel}>
      <h2>Additional meter readings</h2>
      {Object.keys(meter).filter((key) => key.startsWith("custom_")).map((key) => <p key={key}>{key.replace(/^custom_/, "").replace(/_/g, " ")}: {reading(key)}</p>)}
    </section>}
    {Array.isArray(meter.warnings) && meter.warnings.length > 0 && <section style={panel}><h2>Meter diagnostics</h2>{meter.warnings.map((w, i) => <p key={i}>{w}</p>)}</section>}
  </>;
}
