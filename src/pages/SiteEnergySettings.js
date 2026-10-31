import React, { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { siteIdMap } from "../config/siteConfigs";
import { canManageAllPowerMappings } from "../components/powerMeterMapping";
import { currentEnergyMeters } from "./currentEnergyMeters";
import EnergyPowerMapping from "./EnergyPowerMapping";
import EnergyAsansolBridge from "./EnergyAsansolBridge";
import SiteMeterCleanup from "./SiteMeterCleanup";
import "../assets/EnergyMonitor.css";

export default function SiteEnergySettings({ userData, siteId }) {
  const allSites = canManageAllPowerMappings(userData);
  const sites = new Map(Object.entries(siteIdMap).map(([name, id]) => [id, name]));
  if (siteId && !sites.has(siteId)) sites.set(siteId, userData?.site || siteId);
  const [selectedSite, setSelectedSite] = useState("");
  const targetSite = allSites ? selectedSite || siteId || sites.keys().next().value || "" : siteId;
  const siteName = sites.get(targetSite) || userData?.site || targetSite;
  const [data, setData] = useState({ siteId: null, meters: [], fromCache: true, error: "", loading: true });
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!targetSite) return undefined;
    let active = true;
    setData({ siteId: targetSite, meters: [], fromCache: true, error: "", loading: true });
    const stop = onSnapshot(collection(db, "energyMonitor", targetSite, "meters"), { includeMetadataChanges: true }, (snapshot) => {
      if (!active) return;
      const meters = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
      setData({ siteId: targetSite, meters, fromCache: Boolean(snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites), error: "", loading: false });
    }, () => {
      if (active) setData({ siteId: targetSite, meters: [], fromCache: true, error: "Cannot read this site's meters. Check your connection and site access.", loading: false });
    });
    return () => { active = false; stop(); };
  }, [targetSite]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const current = data.siteId === targetSite ? data : { meters: [], fromCache: true, loading: true };
  return <section className="energy-monitor site-energy-settings" aria-label="Energy automation settings">
    <h2>Energy automation</h2><p>Configure the automatic EB/DG switch and the Asansol live-triggered operation simulator.</p>
    {allSites ? <label>Automatic switch settings site<select aria-label="Automatic switch settings site" value={targetSite} onChange={(e) => setSelectedSite(e.target.value)}>{[...sites.entries()].sort((a,b) => a[1].localeCompare(b[1])).map(([id, name]) => <option key={id} value={id}>{name} · {id}</option>)}</select></label> : <p>Settings site: <strong>{siteName || "Unassigned"}</strong> · {targetSite}</p>}
    {!targetSite && <p role="alert">Assign a site ID before configuring energy automation.</p>}
    {current.loading && targetSite && <p role="status">Loading site meters…</p>}
    {current.error && <p role="alert">{current.error}</p>}
    {targetSite && <><SiteMeterCleanup key={`cleanup:${targetSite}`} siteId={targetSite} meters={current.meters} userData={userData} now={now} fromCache={current.fromCache} loading={current.loading} error={current.error} />
      <EnergyPowerMapping key={targetSite} fixedSite siteId={targetSite} meters={currentEnergyMeters(current.meters).meters} userData={userData} />
      <EnergyAsansolBridge key={`simulator:${targetSite}`} siteId={targetSite} siteName={siteName} meters={currentEnergyMeters(current.meters).meters} now={now} fromCache={current.fromCache} /></>}
  </section>;
}
