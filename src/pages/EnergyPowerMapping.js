import React, { useEffect, useState } from "react";
import { powerMappingEvent, readPowerMapping, resolvePowerMapping, savePowerMapping } from "../components/powerMeterMapping";
export default function EnergyPowerMapping({ siteId, meters }) {
  const [config, setConfig] = useState(() => readPowerMapping(siteId)), [error, setError] = useState("");
  useEffect(() => {
    const load = () => setConfig(readPowerMapping(siteId));
    load(); window.addEventListener(powerMappingEvent, load); window.addEventListener("storage", load);
    return () => { window.removeEventListener(powerMappingEvent, load); window.removeEventListener("storage", load); };
  }, [siteId]);
  const change = (field, value) => {
    const next = { ...config, [field]: value }; setConfig(next);
    try { savePowerMapping(siteId, next); setError(""); } catch { setError("Meter mappings could not be saved on this device."); }
  };
  const resolved = resolvePowerMapping(config, meters);
  return <section className="energy-card"><details><summary>Existing header EB/DG switch · automatic meter mapping</summary><p>The existing EB/DG slider switches to DG when Main Incomer is 0 V and a DG is above 300 V L-L, confirmed by two fresh reading pairs.</p><div className="energy-changeover-settings">
    <label><input type="checkbox" checked={config.enabled} onChange={(event) => change("enabled", event.target.checked)} /> Enable automatic switching of the existing EB/DG slider</label>
    {[["Main Incomer", "mainMeterId"], ["HT panel (optional)", "htMeterId"], ["DG-1", "dg1MeterId"], ["DG-2 (optional)", "dg2MeterId"]].map(([label, field]) => <label key={field}>{label}<select aria-label={`Power switch ${label} meter`} value={config[field]} onChange={(event) => change(field, event.target.value)}><option value="">Auto-detect by meter name</option>{meters.map((meter) => <option key={meter.id} value={meter.id}>{meter.name || meter.id}</option>)}</select><small>Using: {meters.find((meter) => meter.id === resolved[field])?.name || resolved[field] || "Map a meter"}</small></label>)}
    </div><p className="energy-muted">Settings apply immediately on this device, including outside Energy Monitor. Clear names such as Main Incomer, DG-1 and DG-2 are detected only when unique. Manual switching and DG stop logging use the same slider.</p>{error && <p role="alert">{error}</p>}</details></section>;
}
