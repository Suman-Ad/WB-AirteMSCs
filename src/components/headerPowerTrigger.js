const valid = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;
function fresh(meter, now) {
  const time = meter?.observedAt?.toMillis?.();
  return meter?.status === "OK" && !/offline|disconnected/i.test(meter.communicationState || "") && valid(time) && time <= now + 5000 && now - time <= Math.max(30, (Number(meter.uploadIntervalSeconds) || 10) * 3) * 1000;
}
function values(meter, field) {
  const phases = ["R", "Y", "B"].map((phase) => meter?.[`${phase}_${field}`]);
  if (phases.every(valid)) return phases;
  if (phases.some((v) => v !== undefined && v !== null)) return null;
  return valid(meter?.[field]) ? [meter[field]] : null;
}
export function assessHeaderPower(config, meters, now, fromCache, powerSource = "EB") {
  const waiting = (message) => ({kind:"waiting", message:`Auto switch: ${message}`});
  if (!config.enabled) return {kind:"disabled",message:"Automatic switch off"};
  const ids = [config.mainMeterId, config.dg1MeterId, config.dg2MeterId].filter(Boolean);
  if (!config.mainMeterId || ids.length < 2 || new Set(ids).size !== ids.length) return {kind:"unconfigured",message:"Auto switch: map meters"};
  if (fromCache) return waiting("waiting for server-confirmed readings");
  const main = meters.find((m) => m.id === config.mainMeterId);
  const mainFresh = fresh(main, now), mainV = mainFresh ? values(main,"voltage_ll") : null, mainA = mainFresh ? values(main,"current") : null;
  const dgMeters = [["DG-1",config.dg1MeterId],["DG-2",config.dg2MeterId]].filter(([,id]) => id).map(([dg,id]) => ({dg,meter:meters.find((m) => m.id === id)}));
  if (powerSource === "DG") {
    if (!mainV?.every((v) => v > 300) || !mainA?.some((a) => a > 0)) return waiting("EB return needs incomer above 300 V and positive current");
    const samples = dgMeters.map(({meter}) => fresh(meter,now) ? {amps:values(meter,"current"),time:meter.observedAt.toMillis()} : null);
    if (!samples.every((s) => s?.amps?.every((a) => a < 50))) return waiting("EB return needs every mapped DG current below 50 A");
    return {kind:"candidate",dg:"EB",mainTime:main.observedAt.toMillis(),dgTime:Math.min(...samples.map((s) => s.time)),message:"Auto DG → EB: incomer loaded and DG current below 50 A"};
  }
  const mainTime = main?.observedAt?.toMillis?.();
  const offline = Boolean(main && ((main.status && main.status !== "OK") || /offline|disconnected/i.test(main.communicationState || "") || (valid(mainTime) && now - mainTime > Math.max(30,(Number(main.uploadIntervalSeconds) || 10)*3)*1000)));
  const zero = mainV?.every((v) => v === 0) && mainA?.every((a) => a === 0);
  if (!offline && !zero) return mainV?.every((v) => v > 300) ? {kind:"restored",message:"Auto switch: incomer healthy"} : waiting("incomer must be 0 V / 0 A or offline");
  for (const {dg,meter} of dgMeters) {
    if (!fresh(meter,now)) continue;
    const volts=values(meter,"voltage_ll"), amps=values(meter,"current");
    if (volts?.every((v) => v > 300) && amps?.some((a) => a > 0)) {
      const time=meter.observedAt.toMillis();
      return {kind:"candidate",dg,mainTime:offline ? time : main.observedAt.toMillis(),dgTime:time,message:`Auto EB → DG: ${dg} loaded; incomer ${offline ? "offline" : "0 V / 0 A"}`};
    }
  }
  return waiting("waiting for DG above 300 V with positive current");
}
