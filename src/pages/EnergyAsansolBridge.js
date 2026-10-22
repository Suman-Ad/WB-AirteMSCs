import React, { useEffect, useRef, useState } from "react";
import { powerMappingEvent } from "../components/powerMeterMapping";
import AsansolOperationSimulator from "../components/SOP/AsansolOperationSimulator";
import { assessChangeover, advanceChangeover, defaultChangeoverConfig, initialChangeoverState, validateChangeoverConfig } from "./energyChangeoverTrigger";

// Mount with the correct DG first; the unchanged simulator applies selectedDG in an effect.
function SimulatorHost({ dg, siteName }) {
  const [triggeredBy, setTriggeredBy] = useState(undefined);
  useEffect(() => { const timer = setTimeout(() => setTriggeredBy("DG"), 0); return () => clearTimeout(timer); }, []);
  return <AsansolOperationSimulator site={siteName} selectedDG={dg} triggeredBy={triggeredBy} />;
}
function AsansolBridge({ siteId, siteName, meters, now, fromCache }) {
  const storageKey = `energy-monitor:asansol-trigger:v1:${siteId || siteName}`;
  const [config, setConfig] = useState(() => {
    try { return { ...defaultChangeoverConfig, ...JSON.parse(localStorage.getItem(storageKey) || "{}") }; }
    catch { return { ...defaultChangeoverConfig }; }
  });
  const [storageError, setStorageError] = useState("");
  const [event, setEvent] = useState(null), [expanded, setExpanded] = useState(true), [progress, setProgress] = useState(0);
  const detector = useRef(initialChangeoverState()), configVersion = useRef(""), sequence = useRef(0);
  const assessment = assessChangeover(config, meters, now, fromCache);
  useEffect(() => {
    const version = JSON.stringify(config);
    if (configVersion.current !== version) { detector.current = initialChangeoverState(); configVersion.current = version; }
    const next = advanceChangeover(detector.current, assessChangeover(config, meters, now, fromCache), config.confirmations);
    detector.current = next; setProgress(next.count);
    if (next.fired) { sequence.current += 1; setEvent({ id: sequence.current, dg: next.dg, time: now }); setExpanded(true); }
  }, [config, meters, now, fromCache]);
  const change = (field, value) => {
    const next = { ...config, [field]: value }; setConfig(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); window.dispatchEvent(new CustomEvent(powerMappingEvent, { detail: { siteId } })); setStorageError(""); }
    catch { setStorageError("Simulator settings could not be saved on this device."); }
  };
  const meterSelector = (label, field) => <label key={field}>{label}<select aria-label={label} value={config[field]} onChange={(e) => change(field, e.target.value)}><option value="">Select meter</option>{meters.map((m) => <option key={m.id} value={m.id}>{m.name || m.id}</option>)}</select></label>;
  const voltageInput = (label, field) => <label key={field}>{label}<input aria-label={label} type="number" min="0" step="1" value={config[field]} onChange={(e) => change(field, e.target.value === "" ? "" : Number(e.target.value))} /></label>;
  const configError = validateChangeoverConfig(config);
  return <section className="energy-card energy-changeover-bridge"><div className="energy-section-title"><div><h2>Asansol live-triggered operation simulator</h2><p>Starts the existing simulation when mapped Main Incomer failure and DG supply are confirmed by live L-L voltage.</p></div><label><input type="checkbox" checked={config.enabled === true} onChange={(e) => change("enabled", e.target.checked)} /> Enable automatic simulation</label></div>
    <details><summary>Meter mappings & voltage thresholds</summary><div className="energy-changeover-settings">{meterSelector("Main Incomer meter", "mainMeterId")}{meterSelector("DG-1 meter", "dg1MeterId")}{meterSelector("DG-2 meter (optional)", "dg2MeterId")}{voltageInput("Incomer failure below (V L-L)", "failureVoltage")}{voltageInput("Incomer recovery at or above (V L-L)", "recoveryVoltage")}{voltageInput("DG supply at or above (V L-L)", "dgVoltage")}<label>Confirmation reading pairs<input aria-label="Confirmation reading pairs" type="number" min="2" max="10" value={config.confirmations} onChange={(e) => change("confirmations", Number(e.target.value))} /></label></div><p className="energy-muted">Defaults: failure below 100 V L-L, recovery / DG supply at 300 V L-L. Adjust for the installed system. All available phase voltages must agree; otherwise the aggregate L-L reading is used only when phase readings are absent. DG-1 has priority if both DG supplies are detected. Settings save per site on this device.</p></details>
    {config.enabled && configError && <p className="energy-notice" role="alert">{configError}</p>}{storageError && <p role="alert">{storageError}</p>}
    <p role="status">{assessment.message}{assessment.kind === "candidate" ? ` ${Math.min(progress, config.confirmations)}/${config.confirmations} distinct reading pairs confirmed.` : ""}</p>
    <p className="energy-muted">Cached, stale, failed or missing readings cannot trigger. One simulation starts per outage; healthy incomer voltage rearms the detector. This is a timed demonstration, not a live breaker-state display or equipment control.</p>
    {event && <><div className="energy-section-title"><strong>Simulation triggered for {event.dg} · {new Date(event.time).toLocaleString()}</strong><button onClick={() => setExpanded((value) => !value)}>{expanded ? "Hide simulator" : "Show simulator"}</button></div><div hidden={!expanded}><SimulatorHost key={event.id} dg={event.dg} siteName={siteName} /></div></>}
  </section>;
}
export default function EnergyAsansolBridge(props) {
  return /\basansol\b/i.test(props.siteName || "") ? <AsansolBridge key={props.siteId || props.siteName} {...props} /> : null;
}
