import { useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { advanceChangeover, initialChangeoverState } from "../pages/energyChangeoverTrigger";
import { captureMeter } from "../services/energyChangeoverHistory";
import { assessHeaderPower } from "./headerPowerTrigger";
import { resolvePowerMapping } from "./powerMeterMapping";

import useSitePowerMapping from "../hooks/useSitePowerMapping";

export default function useAutoPowerSource({ siteId, canToggle, powerSource, activeDG, onTrigger, onMeterData }) {
  const sharedMapping = useSitePowerMapping(siteId);
  const savedConfig = sharedMapping.config;
  const [readings, setReadings] = useState({ siteId, meters: [], fromCache: true });
  const meters = useMemo(() => readings.siteId === siteId ? readings.meters : [], [readings, siteId]);
  const fromCache = readings.siteId !== siteId || readings.fromCache;
  const [connectionError, setConnectionError] = useState("");
  const [now, setNow] = useState(Date.now()), [error, setError] = useState("");
  const config = useMemo(() => resolvePowerMapping(savedConfig, meters), [savedConfig, meters]);
  const configKey = JSON.stringify(config);
  const detector = useRef(initialChangeoverState()), busy = useRef(false);
  const restorationEvidence = useRef(null);
  const trigger = useRef(onTrigger);
  trigger.current = onTrigger;
  const report = useRef(onMeterData), lastGood = useRef({}), lastGoodSite = useRef(siteId);
  report.current = onMeterData;
  useEffect(() => {
    if (lastGoodSite.current !== siteId) { lastGood.current = {}; lastGoodSite.current = siteId; }
    if (!fromCache) meters.forEach((meter) => {
      const sample = captureMeter({ meters, fromCache }, meter.id, now);
      if (sample.quality === "Captured" && sample.kwh !== null) lastGood.current[meter.id] = sample;
    });
    report.current?.({ siteId, config, meters, fromCache, lastGood: lastGood.current });
  }, [siteId, config, meters, fromCache, now]);
  useEffect(() => () => report.current?.(null), []);
  useEffect(() => {
    if (!siteId) return undefined;
    let active = true;
    const stop = onSnapshot(collection(db, "energyMonitor", siteId, "meters"), { includeMetadataChanges: true }, (snapshot) => {
      if (!active) return;
      setReadings({ siteId, meters: snapshot.docs.map((record) => ({ ...record.data(), id: record.id })), fromCache: snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites });
      setConnectionError("");
    }, () => { if (active) { setReadings({ siteId, meters: [], fromCache: true }); setConnectionError("Auto EB → DG: meter connection unavailable"); } });
    return () => { active = false; stop(); };
  }, [siteId]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { detector.current = initialChangeoverState(); restorationEvidence.current = null; setError(""); }, [siteId, configKey, powerSource, activeDG]);
  useEffect(() => {
    if (!sharedMapping.ready) { detector.current = initialChangeoverState(); restorationEvidence.current = null; return; }
    if (!canToggle) { detector.current = initialChangeoverState(); restorationEvidence.current = null; return; }
    if (busy.current) return;
    const assessment = assessHeaderPower(config, meters, now, fromCache, powerSource, activeDG, restorationEvidence.current);
    if (assessment.dg === "EB" && assessment.evidenceMode === "live") {
      const id = activeDG === "DG-2" ? config.dg2MeterId : activeDG === "DG-1" ? config.dg1MeterId : config.dg1MeterId || config.dg2MeterId;
      const meter = meters.find(meter => meter.id === id);
      const previous = restorationEvidence.current;
      const loadTransferAtMs = previous?.id === id ? Math.min(previous.loadTransferAtMs, assessment.transferAtMs) : assessment.transferAtMs;
      restorationEvidence.current = meter ? {...meter,loadTransferAtMs} : null;
    } else if (assessment.kind !== "candidate") restorationEvidence.current = null;
    const next = advanceChangeover(detector.current, assessment, 2);
    detector.current = next;
    if (!next.fired) return;
    busy.current = true;
    Promise.resolve().then(() => next.dg === "EB" ? trigger.current(next.dg, {loadTransferAtMs: next.transferAtMs}) : trigger.current(next.dg)).then((result) => {
      if (result === false) detector.current = initialChangeoverState();
      else setError("");
    }).catch((failure) => {
      detector.current = initialChangeoverState();
      setError(failure?.code === "permission-denied" ? "Auto switch blocked: publish the updated Firestore rules for changeover history." : "Automatic source change save failed. Check connection and site permissions.");
    }).finally(() => { busy.current = false; });
  }, [config, meters, now, fromCache, canToggle, powerSource, activeDG, sharedMapping.ready]);
  const assessment = assessHeaderPower(config, meters, now, fromCache, powerSource, activeDG, restorationEvidence.current);
  return { config, manualDisabled: savedConfig.enabled !== false, status: sharedMapping.error || error || connectionError || (!sharedMapping.ready ? "Automatic switch: loading site settings" : !canToggle ? "Automatic switch: awaiting power-change permission" : assessment.message) };
}
