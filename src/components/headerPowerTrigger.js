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
export const DG_IDLE_CURRENT_AMPS = 5;
export const DG_RESTORATION_EVIDENCE_MS = 5 * 60000;
function loadReading(meter) {
  // Small auxiliary/CT residual current remains after the site load transfers.
  const current = values(meter,"current");
  const idle = current?.every(value => value <= DG_IDLE_CURRENT_AMPS) === true;
  // Prefer verified active power for load; current is the fallback for summary meters.
  if (["base", "kilo"].includes(meter?.powerUnits)) {
    const phases=["R","Y","B"].map(p=>meter[`${p}_active_power`]);
    const numeric=v=>typeof v === "number" && Number.isFinite(v);
    if(phases.every(numeric)) return {values:phases,unit:meter.powerUnits === "base" ? "W" : "kW",idle};
    if(phases.some(v=>v!=null)) return null;
    if(numeric(meter.active_power)) return {values:[meter.active_power],unit:meter.powerUnits === "base" ? "W" : "kW",idle};
  }
  const amps=values(meter,"current");
  return amps ? {values:amps,unit:"A",idle} : null;
}
export function assessHeaderPower(config, meters, now, fromCache, powerSource = "EB", activeDG = null, restorationEvidence = null) {
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
    const running = dgMeters.find(item => item.dg === activeDG) || (!activeDG && dgMeters.length === 1 ? dgMeters[0] : null);
    if (!running) return waiting("identify the running DG from saved site power status");
    const live = fresh(running.meter,now);
    const evidenceTime = restorationEvidence?.observedAt?.toMillis?.();
    const retained = !live && restorationEvidence?.id === running.meter?.id && valid(evidenceTime) && fresh(restorationEvidence,evidenceTime) && evidenceTime <= now && now - evidenceTime <= DG_RESTORATION_EVIDENCE_MS && main.observedAt.toMillis() >= evidenceTime;
    if (!live && !retained) return waiting(`${running.dg} running meter is offline, stale or in error; no recent confirmed idle reading is available`);
    const source = live ? running.meter : restorationEvidence;
    const load = loadReading(source);
    if (!load) return waiting(`${running.dg} current readings are missing or incomplete; verified load is unavailable`);
    if (!load.idle && !load.values.every(value => value === 0)) return waiting(`${running.dg} still reports load: ${load.values.join(" / ")} ${load.unit}; waiting for idle load (all phases at or below ${DG_IDLE_CURRENT_AMPS} A)`);
    const otherLoaded = dgMeters.find(item => {
      const reading = fresh(item.meter,now) ? loadReading(item.meter) : null;
      return item.dg !== running.dg && reading && !reading.idle && reading.values.some(value => value !== 0);
    });
    if (otherLoaded) return waiting(`${otherLoaded.dg} still carries load`);
    return {kind:"candidate",dg:"EB",confirmMain:!live,confirmDG:live,evidenceMode:live ? "live" : "retained",mainTime:main.observedAt.toMillis(),dgTime:source.observedAt.toMillis(),transferAtMs:live ? Math.max(main.observedAt.toMillis(),source.observedAt.toMillis()) : source.loadTransferAtMs ?? evidenceTime,message:live ? `Auto DG → EB: confirming idle load from ${running.dg} (up to ${DG_IDLE_CURRENT_AMPS} A per phase) while mains carries load` : `Auto DG → EB: ${running.dg} offline after confirmed idle load; confirming two fresh loaded mains readings`};
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
