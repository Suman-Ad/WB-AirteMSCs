import { resolvePowerMapping } from "../components/powerMeterMapping";
import { displayReading } from "./energyMeterData";
import { meterHealth } from "./meterHealth";

function supplyState(meter, now, fromCache, threshold = 300) {
  if (!meter || meterHealth(meter, now, fromCache) !== "Live") return "unknown";
  const valid = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;
  const phases = ["R", "Y", "B"].map((phase) => meter[`${phase}_voltage_ll`]);
  let values;
  if (phases.every(valid)) values = phases;
  else if (phases.some((value) => value != null)) return "unknown";
  else if (valid(meter.voltage_ll)) values = [meter.voltage_ll];
  if (values) return values.every((value) => value > threshold) ? "on" : values.every((value) => value === 0) ? "off" : "unknown";
  const kw = displayReading(meter, "active_power").value;
  return kw !== null && Math.abs(kw) > 0.001 ? "on" : "unknown";
}

export function energySupplyMeter(meters, config, now, fromCache) {
  const mapping = resolvePowerMapping(config, meters);
  const main = meters.find((meter) => meter.id === mapping.mainMeterId);
  const ht = meters.find((meter) => meter.id === mapping.htMeterId);
  const dg = [mapping.dg1MeterId, mapping.dg2MeterId].filter(Boolean).map((id) => meters.find((meter) => meter.id === id)).find((meter) => supplyState(meter, now, fromCache) === "on");
  const mainState = supplyState(main, now, fromCache, 0);
  // A confirmed failed LT incomer takes precedence over an upstream HT reading.
  const utility = mainState === "on" ? main : mainState !== "off" && supplyState(ht, now, fromCache, 0) === "on" ? ht : null;
  const source = utility || dg || null;
  return { source, sourceType: utility ? "Utility" : dg ? "DG" : "Unavailable", defaultMeter: source || main || ht || meters[0] || null };
}
