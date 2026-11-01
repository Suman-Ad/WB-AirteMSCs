export const defaultChangeoverConfig = { enabled: false, mainMeterId: "", dg1MeterId: "", dg2MeterId: "", failureVoltage: 100, recoveryVoltage: 300, dgVoltage: 300, confirmations: 2 };
export function validateChangeoverConfig(config) {
  if (!config.mainMeterId || (!config.dg1MeterId && !config.dg2MeterId)) return "Map Main Incomer and at least one DG meter.";
  const ids = [config.mainMeterId, config.dg1MeterId, config.dg2MeterId].filter(Boolean);
  if (new Set(ids).size !== ids.length) return "Use different meters for Main Incomer, DG-1 and DG-2.";
  if (![config.failureVoltage, config.recoveryVoltage, config.dgVoltage].every((v) => typeof v === "number" && Number.isFinite(v)) || config.failureVoltage < 0 || config.recoveryVoltage <= config.failureVoltage || config.dgVoltage <= config.failureVoltage) return "Use nonnegative voltages with recovery and DG thresholds above the failure threshold.";
  if (!Number.isInteger(config.confirmations) || config.confirmations < 2 || config.confirmations > 10) return "Require 2–10 distinct reading pairs.";
  return "";
}
function voltageSample(meter, now, fromCache) {
  const time = meter?.observedAt?.toMillis?.();
  const staleMs = Math.max(30, (Number(meter?.uploadIntervalSeconds) || 10) * 3) * 1000;
  if (fromCache || meter?.status !== "OK" || typeof time !== "number" || !Number.isFinite(time) || now - time > staleMs || time - now > 5000) return null;
  const phases = ["R", "Y", "B"].map((p) => meter[`${p}_voltage_ll`]);
  const valid = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0;
  if (phases.every(valid)) return { low: Math.min(...phases), high: Math.max(...phases), time };
  if (phases.some((v) => v !== undefined && v !== null)) return null;
  return valid(meter.voltage_ll) ? { low: meter.voltage_ll, high: meter.voltage_ll, time } : null;
}
export function assessChangeover(config, meters, now, fromCache) {
  if (config.enabled !== true) return { kind: "disabled", message: "Automatic simulator trigger is disabled." };
  const error = validateChangeoverConfig(config);
  if (error) return { kind: "unconfigured", message: error };
  const main = voltageSample(meters.find((m) => m.id === config.mainMeterId), now, fromCache);
  if (!main) return { kind: "waiting", message: "Waiting for a fresh, server-confirmed Main Incomer voltage reading." };
  if (main.low >= config.recoveryVoltage) return { kind: "restored", message: "Main Incomer supply is healthy; the next outage can trigger a simulation." };
  if (main.high >= config.failureVoltage) return { kind: "uncertain", message: "Main voltage is between configured conditions or phases disagree; no total-failure trigger." };
  for (const [dg, id] of [["DG-1", config.dg1MeterId], ["DG-2", config.dg2MeterId]]) {
    const sample = voltageSample(meters.find((m) => m.id === id), now, fromCache);
    if (sample && sample.low >= config.dgVoltage) return { kind: "candidate", dg, mainTime: main.time, dgTime: sample.time, message: `Main Incomer failure and ${dg} supply detected.` };
  }
  return { kind: "waiting-dg", message: "Main Incomer voltage is below the failure threshold; waiting for a fresh DG supply reading." };
}
export const initialChangeoverState = () => ({ latched: false, count: 0, dg: null, mainTime: null, dgTime: null });
export function advanceChangeover(previous, assessment, confirmations) {
  if (assessment.kind === "restored" || assessment.kind === "disabled" || assessment.kind === "unconfigured") return { ...initialChangeoverState(), fired: false };
  if (previous.latched) return { ...previous, fired: false };
  if (assessment.kind !== "candidate") return { ...initialChangeoverState(), fired: false };
  const sameDG = previous.dg === assessment.dg;
  if (sameDG && previous.mainTime !== null && ((assessment.confirmMain !== false && assessment.mainTime <= previous.mainTime) || assessment.dgTime <= previous.dgTime)) return { ...previous, fired: false };
  const count = sameDG ? previous.count + 1 : 1;
  const fired = count >= confirmations;
  return { latched: fired, count, dg: assessment.dg, mainTime: assessment.mainTime, dgTime: assessment.dgTime, ...(assessment.transferAtMs != null ? {transferAtMs: sameDG && previous.count ? previous.transferAtMs ?? assessment.transferAtMs : assessment.transferAtMs} : {}), fired };
}
