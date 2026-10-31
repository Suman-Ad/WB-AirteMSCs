import React from "react";
import { displayReading, isNumber, phases } from "./energyMeterData";
import MeterStatus from "./MeterStatus";

const format = (value) => isNumber(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—";
export function dialMaximum(value) {
  const target = Math.max(1, Math.abs(value || 0) * 1.2);
  const magnitude = 10 ** Math.floor(Math.log10(target));
  return [1, 2, 5, 10].find((step) => step * magnitude >= target) * magnitude;
}
const point = (fraction, radius) => {
  const angle = (150 + fraction * 240) * Math.PI / 180;
  return { x: 160 + radius * Math.cos(angle), y: 148 + radius * Math.sin(angle) };
};
const arc = (radius) => {
  const a = point(0, radius), b = point(1, radius);
  return `M${a.x},${a.y} A${radius},${radius} 0 1 1 ${b.x},${b.y}`;
};

export function EnergyPowerDial({ meter, state }) {
  const live = state === "Live";
  const power = displayReading(meter, "active_power").value;
  const maximum = dialMaximum(power), reverse = isNumber(power) && power < 0;
  const minimum = reverse ? -maximum : 0, upper = reverse ? 0 : maximum;
  const fraction = isNumber(power) ? Math.max(0, Math.min(1, (power - minimum) / maximum)) : null;
  const read = () => `${format(power)} kW`;
  return (
    <div className="energy-dial">
      <svg viewBox="0 0 320 250" role="img" aria-label={`Active power ${read("active_power")}; auto scale ${minimum} to ${upper} kW; ${state}`}>
        <path d={arc(111)} className="energy-dial-track" />
        {fraction !== null && <path d={arc(111)} className="energy-dial-fill" pathLength="100" strokeDasharray={`${fraction * 100} 100`} />}
        {Array.from({ length: 41 }, (_, i) => {
          const major = i % 5 === 0, outer = point(i / 40, 100), inner = point(i / 40, major ? 88 : 94), label = point(i / 40, 74);
          return <g key={i}><line x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y} className={major ? "energy-dial-tick major" : "energy-dial-tick"} />{major && <text x={label.x} y={label.y} className="energy-dial-scale">{format(minimum + maximum * i / 40)}</text>}</g>;
        })}
        <text x="160" y="112" className="energy-dial-caption">ACTIVE POWER</text>
        {fraction !== null && <g transform="translate(160 148)"><g className="energy-dial-needle" style={{ transform: `rotate(${150 + fraction * 240}deg)` }}><path d="M-15,-3 L84,0 L-15,3 Z" /></g></g>}
        <circle cx="160" cy="148" r="8" className="energy-dial-hub" />
        <text x="160" y="199" className="energy-dial-value">{format(power)}</text><text x="160" y="218" className="energy-dial-unit">kW{reverse ? " · REVERSE" : ""}</text>
      </svg>
      <div className="energy-dial-note">Auto scale · {format(minimum)}–{format(upper)} kW <span>{live ? "Live reading" : "Last received · " + state}</span></div>
    </div>
  );
}

export default function EnergyOverviewMeter({ meter, state, now, onOpen }) {
  const live = state === "Live";
  const read = (key) => { const r = displayReading(meter, key); return `${format(r.value)}${r.unit ? ` ${r.unit}` : ""}`; };
  const observed = meter.observedAt?.toMillis?.();
  const age = isNumber(observed) ? Math.max(0, Math.floor((now - observed) / 1000)) : null;
  return <article className={`energy-card energy-site-meter energy-instrument ${live ? "is-online" : "is-inactive"}`}>
    <div className="energy-section-title"><div><span className="energy-instrument-id">{meter.meterId || meter.id}{meter.busId ? ` · ${meter.busId}` : ""}</span><h3>{meter.name || meter.id}</h3></div><MeterStatus state={state} /></div>
    <EnergyPowerDial meter={meter} state={state} />
    <div className="energy-site-power">{[["Apparent", "apparent_power"], ["Reactive", "reactive_power"], ["Power factor", "power_factor"]].map(([label, key]) => <span key={key}><small className="energy-muted">{label}</small><b>{read(key)}</b></span>)}</div>
    <div className="energy-table-wrap"><table><thead><tr><th>RMS</th>{phases.map((p) => <th key={p} className={`energy-phase-${p.toLowerCase()}`}>{p}</th>)}</tr></thead><tbody>{[["Current (A)", "current"], ["Voltage L-N (V)", "voltage_ln"], ["Voltage L-L (V)", "voltage_ll"]].map(([label, key]) => <tr key={key}><td>{label}</td>{phases.map((phase) => <td key={phase}>{format(displayReading(meter, `${phase}_${key}`).value)}</td>)}</tr>)}</tbody></table></div>
    <div className="energy-instrument-stats"><span>Frequency<b>{read("frequency")}</b></span><span>Average load<b>{read("custom_average_load_percent")}</b></span><span>FWD energy<b>{read("fwd_Wh")}</b></span><span>Load unbalance<b>{read("custom_unbalanced_load_percent")}</b></span></div>
    <details className="energy-instrument-details"><summary>Energy & power quality</summary><div className="energy-mini-readings">{[["FWD apparent", "fwd_VAh"], ["FWD reactive", "fwd_VARh"], ["Neutral current", "custom_neutral_current"], ...phases.map((p) => [`${p} voltage / current THD`, `custom_${p.toLowerCase()}_voltage_thd`, `custom_${p.toLowerCase()}_current_thd`])].map(([label, key, other]) => <span key={key}>{label}<b>{read(key)}{other ? ` / ${read(other)}` : ""}</b></span>)}</div></details>
    <div className="energy-card-footer"><small className="energy-muted">{isNumber(observed) ? `${new Date(observed).toLocaleString()} · ${age}s ago` : "No timestamp"} · Upload {Number(meter.uploadIntervalSeconds) || 10}s</small><button onClick={() => onOpen(meter.id)}>Open readings & vector →</button></div>
  </article>;
}
