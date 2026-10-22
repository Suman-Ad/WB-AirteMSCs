// Require fresh, successful, server-confirmed L-L readings on every available phase.
function voltage(meter, now, fromCache) {
  const time = meter?.observedAt?.toMillis?.();
  const valid = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;
  if (fromCache || meter?.status !== "OK" || !valid(time) || time > now + 5000 || now - time > Math.max(30, (Number(meter.uploadIntervalSeconds) || 10) * 3) * 1000) return null;
  const phases = ["R", "Y", "B"].map((phase) => meter[`${phase}_voltage_ll`]);
  if (phases.every(valid)) return { values: phases, time };
  if (phases.some((value) => value !== undefined && value !== null)) return null;
  return valid(meter.voltage_ll) ? { values: [meter.voltage_ll], time } : null;
}
export function assessHeaderPower(config, meters, now, fromCache) {
  if (!config.enabled) return { kind: "disabled", message: "Auto EB → DG off" };
  const ids = [config.mainMeterId, config.dg1MeterId, config.dg2MeterId].filter(Boolean);
  if (!config.mainMeterId || ids.length < 2 || new Set(ids).size !== ids.length) return { kind: "unconfigured", message: "Auto EB → DG: map meters" };
  const main = voltage(meters.find((meter) => meter?.id === config.mainMeterId), now, fromCache);
  if (!main) return { kind: "waiting", message: "Auto EB → DG: waiting for live readings" };
  if (main.values.every((value) => value > 300)) return { kind: "restored", message: "Auto EB → DG: incomer healthy" };
  if (!main.values.every((value) => value === 0)) return { kind: "waiting", message: "Auto EB → DG: incomer must be 0 V" };
  for (const [dg, id] of [["DG-1", config.dg1MeterId], ["DG-2", config.dg2MeterId]]) {
    const sample = voltage(meters.find((meter) => meter?.id === id), now, fromCache);
    if (sample?.values.every((value) => value > 300)) return { kind: "candidate", dg, mainTime: main.time, dgTime: sample.time, message: `Auto EB → DG: ${dg} supply detected` };
  }
  return { kind: "waiting", message: "Auto EB → DG: waiting for DG above 300 V" };
}
