import {useEffect, useState} from "react";
import {doc, onSnapshot} from "firebase/firestore";
import {db} from "../firebase";
import useSitePowerMapping from "./useSitePowerMapping";

export default function useServerPowerSource(siteId) {
  const shared = useSitePowerMapping(siteId);
  const [state, setState] = useState({});
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let active = true;
    setState({siteId, ready: !siteId});
    if (!siteId) return;
    const update = patch => { if (active) setState(previous => ({...previous, ...patch, siteId})); };
    const options = {includeMetadataChanges: true};
    const configStop = onSnapshot(doc(db, "energyMonitor", siteId, "config", "serverPowerSwitch"), options, snapshot => {
      update({ready: !snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites, enabled: snapshot.exists() && snapshot.data().enabled === true, error: ""});
    }, () => update({ready: false, error: "Server automatic switch settings unavailable"}));
    const runtimeStop = onSnapshot(doc(db, "energyMonitor", siteId, "runtime", "serverPowerSource"), options, snapshot => {
      update({runtime: snapshot.exists() ? snapshot.data() : null, cached: snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites});
    }, () => update({runtime: null, error: "Server automatic switch status unavailable"}));
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {active = false; configStop(); runtimeStop(); clearInterval(timer);};
  }, [siteId]);
  const current = state.siteId === siteId ? state : {};
  const runtime = current.runtime;
  const controlled = !!siteId && (!current.ready || (current.enabled === true && (!shared.ready || !shared.exists || shared.config.enabled !== false)));
  const fresh = !current.cached && runtime?.enabled === true && now - runtime.evaluatedAtMs >= 0 && now - runtime.evaluatedAtMs <= 30000 && now - runtime.sourceObservedAtMs >= 0 && now - runtime.sourceObservedAtMs <= 30000;
  const source = ["EB", "DG"].includes(runtime?.powerSource) ? runtime.powerSource : "Unknown";
  const status = current.error || (!current.ready ? "Server automatic switch: loading site settings" : !fresh ? "Server automatic switch: waiting for fresh readings (last observed source)" : runtime.message || "Server automatic switch enabled");
  return {controlled, runtime, source, fresh, status, seconds: runtime?.startAtMs ? Math.max(0, Math.floor((now - runtime.startAtMs) / 1000)) : 0};
}
