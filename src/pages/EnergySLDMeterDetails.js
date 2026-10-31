import React, { useEffect, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend } from "recharts";
import { EnergyPowerDial } from "./EnergyOverviewMeter";
import MeterStatus from "./MeterStatus";
import EnergyMeterDetails from "./EnergyMeterDetails";
import { displayReading, phases, isNumber } from "./energyMeterData";

export default function EnergySLDMeterDetails({ meter, state, onOpen }) {
  const [trend, setTrend] = useState([]);
  const time = meter.observedAt?.toMillis?.();
  const value = displayReading(meter, "active_power").value;
  useEffect(() => {
    if (state !== "Live" || !isNumber(time)) return;
    setTrend((previous) => previous.some((p) => p.time === time) ? previous : [...previous, { time, value }].slice(-60));
  }, [time, value, state]);
  const harmonics = phases.map((phase) => ({ phase,
    voltage: displayReading(meter, `custom_${phase.toLowerCase()}_voltage_thd`).value,
    current: displayReading(meter, `custom_${phase.toLowerCase()}_current_thd`).value }));
  const chartStyle = { background: "var(--app-surface)", borderColor: "var(--app-border)", color: "var(--app-text)" };
  return <section className="energy-sld-inspector" aria-label="Selected SLD meter details">
    <div className="energy-section-title"><div><span className="energy-eyebrow">METER INSPECTOR</span><h2>{meter.name || meter.id} · detailed readings</h2></div><div className="energy-detail-actions"><MeterStatus state={state} /><button onClick={() => onOpen(meter.id)}>Full dashboard →</button></div></div>
    <div className="energy-sld-compact-summary">
      <div className={`energy-sld-main-dial energy-instrument ${state === "Live" ? "is-online" : ""}`}><EnergyPowerDial meter={meter} state={state} /></div>
      <div className="energy-sld-parameter-grid">{[["Apparent power", "apparent_power"], ["Reactive power", "reactive_power"], ["Power factor", "power_factor"], ["Frequency", "frequency"], ["Average voltage", "voltage_ll"], ["Average current", "current"], ["Forward energy", "fwd_Wh"], ["Average load", "custom_average_load_percent"]].map(([label,key]) => { const r=displayReading(meter,key); return <div key={key}><span>{label}</span><strong>{isNumber(r.value) ? r.value.toLocaleString(undefined,{maximumFractionDigits:2}) : "—"} <small>{r.unit}</small></strong></div>; })}</div>
    </div>
    <div className="energy-sld-inspector-grid"><div className="energy-sld-compact-vector"><EnergyMeterDetails meter={meter} state={state} vectorOnly /></div><div className="energy-sld-charts">
      <section className="energy-card"><h3>Active power trend · kW</h3><p>Latest 60 live readings since this meter was opened. Reopening a meter resets the trend.</p>{trend.filter((p) => isNumber(p.value)).length < 2 ? <div className="energy-empty">Waiting for two live readings.</div> : <div className="energy-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend}><CartesianGrid stroke="var(--app-border)" strokeDasharray="3 3" /><XAxis dataKey="time" tickFormatter={(t) => new Date(t).toLocaleTimeString()} minTickGap={40} /><YAxis /><Tooltip contentStyle={chartStyle} labelFormatter={(t) => new Date(t).toLocaleTimeString()} /><Line dataKey="value" name="Active power" unit=" kW" stroke="var(--theme-primary)" dot={false} connectNulls={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>}</section>
      <section className="energy-card"><h3>Harmonic distortion · THD %</h3><p>Voltage and current total harmonic distortion per phase. Individual harmonic orders are not provided by this meter.</p>{harmonics.some((p) => isNumber(p.voltage) || isNumber(p.current)) ? <div className="energy-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={harmonics}><CartesianGrid stroke="var(--app-border)" strokeDasharray="3 3" /><XAxis dataKey="phase" /><YAxis unit="%" /><Tooltip contentStyle={chartStyle} /><Legend /><Bar dataKey="voltage" name="Voltage THD" unit="%" fill="#3b82f6" radius={[4, 4, 0, 0]} isAnimationActive={false} /><Bar dataKey="current" name="Current THD" unit="%" fill="#a87800" radius={[4, 4, 0, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer></div> : <div className="energy-empty">No valid THD readings available.</div>}</section>
    </div></div>
    <details className="energy-sld-registers"><summary>All phase parameters, energy counters & collector diagnostics</summary><div><EnergyMeterDetails meter={meter} state={state} omitVectors /></div></details>
  </section>;
}
