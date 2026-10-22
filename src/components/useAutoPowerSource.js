import { useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { advanceChangeover, initialChangeoverState } from "../pages/energyChangeoverTrigger";
import { captureMeter } from "../services/energyChangeoverHistory";
import { assessHeaderPower } from "./headerPowerTrigger";
import { powerMappingEvent, readPowerMapping, resolvePowerMapping } from "./powerMeterMapping";

export default function useAutoPowerSource({ siteId, canToggle, powerSource, onTrigger, onMeterData }) {
  const [savedConfig, setSavedConfig] = useState(() => readPowerMapping(siteId));
  useEffect(() => {
    const load = () => setSavedConfig(readPowerMapping(siteId));
    load(); window.addEventListener("storage", load); window.addEventListener(powerMappingEvent, load); window.addEventListener("focus", load);
    return () => { window.removeEventListener("storage", load); window.removeEventListener(powerMappingEvent, load); window.removeEventListener("focus", load); };
  }, [siteId]);
  const [readings, setReadings] = useState({ siteId, meters: [], fromCache: true });
  const meters = useMemo(() => readings.siteId === siteId ? readings.meters : [], [readings, siteId]);
  const fromCache = readings.siteId !== siteId || readings.fromCache;
  const [connectionError, setConnectionError] = useState("");
  const [now, setNow] = useState(Date.now()), [error, setError] = useState("");
  const config = useMemo(() => resolvePowerMapping(savedConfig, meters), [savedConfig, meters]);
  const configKey = JSON.stringify(config);
  const detector = useRef(initialChangeoverState()), busy = useRef(false);
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
  useEffect(() => { detector.current = initialChangeoverState(); setError(""); }, [configKey]);
  useEffect(() => {
    if (!canToggle || busy.current) return;
    const assessment = assessHeaderPower(config, meters, now, fromCache);
    const next = advanceChangeover(detector.current, assessment, 2);
    detector.current = next;
    if (!next.fired || powerSource !== "EB") return;
    busy.current = true;
    Promise.resolve().then(() => trigger.current(next.dg)).then((result) => {
      if (result === false) detector.current = initialChangeoverState();
      else setError("");
    }).catch((failure) => {
      detector.current = initialChangeoverState();
      setError(failure?.code === "permission-denied" ? "Auto switch blocked: publish the updated Firestore rules for changeover history." : "Auto EB → DG save failed. Check connection and site permissions.");
    }).finally(() => { busy.current = false; });
  }, [config, meters, now, fromCache, canToggle, powerSource]);
  const assessment = assessHeaderPower(config, meters, now, fromCache);
  return { config, status: error || connectionError || (!canToggle ? "Automatic switch: awaiting power-change permission" : assessment.message) };
}
