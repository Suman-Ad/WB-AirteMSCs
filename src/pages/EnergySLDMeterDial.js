import React from "react";
import { dialMaximum } from "./EnergyOverviewMeter";
import { displayReading, isNumber } from "./energyMeterData";

export default function EnergySLDMeterDial({ node, meter, state }) {
  const value = displayReading(meter, "active_power").value;
  const max = dialMaximum(value), reverse = isNumber(value) && value < 0;
  const min = reverse ? -max : 0;
  const fraction = isNumber(value) ? (value - min) / max : null;
  const position = (f, r) => { const a = (180 + 180 * f) * Math.PI / 180; return [45 + r * Math.cos(a), 42 + r * Math.sin(a)]; };
  const height = Math.min(54, node.h * .5);
  return <svg x={node.x + 5} y={node.y + node.h - height - 3} width={node.w - 10} height={height} viewBox="0 0 200 57" className={`energy-sld-mini-dial ${state === "Live" ? "is-online" : ""}`} aria-label={`${meter.name || meter.id} speedometer, ${state}`}>
    <title>Active power · {value ?? "Unavailable"} kW · Auto scale {min} to {reverse ? 0 : max} kW · {state}</title>
    <rect width="200" height="57" rx="6" fill="var(--app-surface)" />
    <path d="M9 42 A36 36 0 0 1 81 42" fill="none" stroke="var(--app-border)" strokeWidth="4" />
    {fraction !== null && <path d="M9 42 A36 36 0 0 1 81 42" fill="none" stroke="currentColor" strokeWidth="4" pathLength="100" strokeDasharray={`${Math.max(0, Math.min(1, fraction)) * 100} 100`} strokeLinecap="round" />}
    {Array.from({length: 9}, (_, i) => { const a = position(i / 8, 34), b = position(i / 8, i % 2 ? 30 : 27); return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="var(--app-text-muted)" />; })}
    {fraction !== null && <g transform={`translate(45 42)`}><g className="energy-sld-mini-needle" style={{transform: `rotate(${180 + Math.max(0, Math.min(1, fraction)) * 180}deg)`}}><path d="M-5,-2 L29,0 L-5,2 Z" fill="currentColor" /></g></g>}
    <circle cx="45" cy="42" r="3" fill="currentColor" />
    <text x="45" y="24" textAnchor="middle" style={{fontSize:6}}>{min + max / 2}</text>
    <text x="9" y="53" style={{fontSize:7}}>{min}</text><text x="81" y="53" textAnchor="end" style={{fontSize:7}}>{reverse ? 0 : max}</text>
    <text x="95" y="24" style={{fontSize:17,fontWeight:750}}>{isNumber(value) ? value.toLocaleString(undefined, {maximumFractionDigits:1}) : "—"} kW</text>
    <text x="95" y="39" style={{fontSize:9}}>{state === "Live" ? "LIVE · AUTO SCALE" : state}</text>
    <text x="95" y="51" style={{fontSize:8}}>Click to inspect</text>
  </svg>;
}
