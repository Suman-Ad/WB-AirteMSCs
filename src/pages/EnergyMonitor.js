import { currentEnergyMeters } from "./currentEnergyMeters";
import React, { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import EnergyMeterDetails from "./EnergyMeterDetails";
import { displayReading } from "./energyMeterData";
import EnergySLD from "./EnergySLD";
import useSitePowerMapping from "../hooks/useSitePowerMapping";
import { energySupplyMeter } from "./energySupplyMeter";
import MeterStatus from "./MeterStatus";
import EnergyOverviewMeter from "./EnergyOverviewMeter";
import { meterHealth } from "./meterHealth";
import EnergyAnalysisReport from "./EnergyAnalysisReport";
import "../assets/EnergyMonitor.css";

const numeric = (v) => typeof v === "number" && Number.isFinite(v);
const format = (v) => numeric(v) ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—";
const power = (m) => displayReading(m, "active_power").value;
const staleAfter = (m) => Math.max(30, (Number(m?.uploadIntervalSeconds) || 10) * 3);

export default function EnergyMonitor({ userData }) {
  const siteId = userData?.siteId;
  const [tab, setTab] = useState("dashboard");
  const [openedTabs, setOpenedTabs] = useState({});
  const activateTab = (id) => { setTab(id); setOpenedTabs((opened) => opened[id] ? opened : { ...opened, [id]: true }); };
  const [meters, setMeters] = useState([]);
  const [selected, setSelected] = useState("");
  const {config: supplyMapping} = useSitePowerMapping(siteId);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [trend, setTrend] = useState([]);

  useEffect(() => {
    setMeters([]); setSelected(""); setError(""); setLoading(true); setFromCache(true);
    if (!siteId) { setLoading(false); return undefined; }
    let active = true;
    const stop = onSnapshot(collection(db, "energyMonitor", siteId, "meters"),
      { includeMetadataChanges: true }, (snapshot) => {
        if (!active) return;
        const incoming = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
        const {meters: current, aliases} = currentEnergyMeters(incoming);
        setMeters(current);
        setSelected(previous => aliases[previous] || previous);
        setFromCache(snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites);
        setLoading(false); setError("");
      }, () => {
        if (!active) return;
        setError("Cannot read meter data. Check your connection and site access permissions.");
        setMeters([]); setLoading(false);
      });
    return () => { active = false; stop(); };
  }, [siteId]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const supply = energySupplyMeter(meters, supplyMapping, now, fromCache || Boolean(error));
  const meter = meters.find((m) => m.id === selected) || supply.defaultMeter;
  const meterId = meter?.id;
  const observed = meter?.observedAt?.toMillis?.();
  const readingPower = meter?.status === "OK" ? power(meter) : null;
  const units = meter?.powerUnits;
  useEffect(() => { setTrend([]); }, [siteId, meterId, units]);
  useEffect(() => {
    if (!observed || !meterId) return;
    setTrend((previous) => previous.some((p) => p.time === observed) ? previous :
      [...previous, { time: observed, value: readingPower }].slice(-60));
  }, [observed, meterId, readingPower, units]);

  const age = observed ? Math.max(0, Math.floor((now - observed) / 1000)) : null;
  const state = meterHealth(meter, now, fromCache, Boolean(error));
  const statusOf = (m) => meterHealth(m, now, fromCache, Boolean(error));
  const live = meters.filter((m) => statusOf(m) === "Live");
  const powerKeys = [["Active power", "active_power", "kW"], ["Apparent power", "apparent_power", "kVA"], ["Reactive power", "reactive_power", "kvar"]];
  const total = (key) => supply.source ? displayReading(supply.source, key).value : null;
  const alarms = meters.flatMap((m) => {
    const list = statusOf(m) === "Live" ? [] : [{ meter: m, message: statusOf(m), type: "Connection / meter health" }];
    for (const field of ["warnings", "alarms"]) {
      const values = Array.isArray(m[field]) ? m[field] : m[field] ? [m[field]] : [];
      values.forEach((item) => list.push({ meter: m, message: typeof item === "string" ? item : String(item?.message || item?.label || item?.code || JSON.stringify(item)), type: field === "alarms" ? "Collector alarm" : "Collector warning" }));
    }
    return list;
  });
  const tabs = [["dashboard", "Energy Dashboard"], ["overview", "Site Overview"], ["sld", "Electrical SLD"], ["analysis", "Analysis Report"], ["alarms", `Alarms (${alarms.length})`]];
  const openMeter = (id) => { setSelected(id); setTab("dashboard"); };
  const card = (label, value, unit = "", note = "") => <article className="energy-card" key={label}><span className="energy-muted">{label}</span><div className="energy-number">{format(value)} <small>{unit}</small></div>{note && <small className="energy-muted">{note}</small>}</article>;

  return <main className={`energy-monitor ${tab === "overview" ? "energy-site-view" : ""}`}>
    <header className="energy-header"><div><span className="energy-eyebrow">WB-AIRTEL MSC · ENERGYBOOK</span><h1>Energy Monitor</h1><p>Live electrical readings, distribution and daily energy analysis.</p></div><div className="energy-site"><span className="energy-muted">CURRENT SITE</span><strong>{userData?.site || siteId || "Unassigned"}</strong><MeterStatus state={state} /></div></header>
    <div className="energy-tabs" role="tablist" aria-label="Energy Monitor pages">{tabs.map(([id, label], index) => <button key={id} id={`energy-tab-${id}`} role="tab" aria-selected={tab === id} aria-controls={`energy-panel-${id}`} tabIndex={tab === id ? 0 : -1} onClick={() => activateTab(id)} onKeyDown={(e) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
      e.preventDefault(); const next = e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : (index + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      activateTab(tabs[next][0]); document.getElementById(`energy-tab-${tabs[next][0]}`)?.focus();
    }}>{label}</button>)}</div>
    {!siteId && <div className="energy-notice" role="alert">Your account needs a site ID before meter data can be shown.</div>}
    {error && <div className="energy-notice" role="alert">{error}</div>}
    {loading && siteId && <div className="energy-empty" role="status">Connecting to Firestore…</div>}
    {!loading && siteId && !error && !meters.length && ["dashboard", "overview"].includes(tab) && <div className="energy-empty">No meter readings yet. Configure the EnergyBook collector for this site to start monitoring.</div>}
    <section className="energy-tab-content" role="tabpanel" id={`energy-panel-${tab}`} aria-labelledby={`energy-tab-${tab}`}>
      {tab === "dashboard" && <><div className="energy-section-title"><h2>Energy Dashboard</h2><span className="energy-muted">{live.length}/{meters.length} meters live</span></div>
        {meter && <><section className="energy-card energy-toolbar"><div><label htmlFor="energy-meter">Selected meter</label><select id="energy-meter" value={meter.id} onChange={(e) => setSelected(e.target.value)}>{meters.map((m) => <option key={m.id} value={m.id}>{m.name || m.id}</option>)}</select></div><div className="energy-muted"><MeterStatus state={statusOf(meter)} /> · {observed ? new Date(observed).toLocaleString() : "No timestamp"}{age !== null ? ` · ${age}s ago` : ""}<br /><small>Upload {Number(meter.uploadIntervalSeconds) || 10}s · stale after {staleAfter(meter)}s · {meter.schemaVersion >= 2 ? "Full meter readings" : "Summary only"}</small></div></section>
          {!["base", "kilo"].includes(units) && <div className="energy-notice">Collector power units are unverified; kW / kVA / kvar readings are withheld until powerUnits is base or kilo.</div>}
          <div className="energy-metrics">{powerKeys.map(([label, key, unit]) => card(label, displayReading(meter, key).value, unit))}{card("Forward active energy", displayReading(meter, "fwd_Wh").value, "kWh")}{card("Power factor", displayReading(meter, "power_factor").value)}{card("Frequency", displayReading(meter, "frequency").value, "Hz")}</div>
          <EnergyMeterDetails meter={meter} state={statusOf(meter)} />
          <section className="energy-card"><h2>Active power trend · kW</h2><p>Latest 60 readings received while this page is open. Changing meter resets the trend; cached or stale readings may be included.</p>{trend.filter((p) => numeric(p.value)).length < 2 ? <div className="energy-empty">Waiting for two valid readings.</div> : <div className="energy-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend}><XAxis dataKey="time" tickFormatter={(t) => new Date(t).toLocaleTimeString()} minTickGap={40} /><YAxis /><Tooltip contentStyle={{ background: "var(--app-surface)", borderColor: "var(--app-border)", color: "var(--app-text)" }} labelFormatter={(t) => new Date(t).toLocaleTimeString()} /><Line dataKey="value" name="Active power" unit=" kW" stroke="var(--theme-primary)" dot={false} connectNulls={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>}</section>
        </>}
      </>}
      {tab === "overview" && <div className="energy-overview"><div className="energy-section-title"><h2>Site Overview</h2><span className="energy-muted">{meters.length} monitored meters · {live.length} live · {alarms.length} alarms</span></div><div className="energy-metrics">{powerKeys.map(([label, key, unit]) => card(`Monitored ${label.toLowerCase()}`, total(key), unit))}</div><p className="energy-muted">{supply.source ? `Supply: ${supply.sourceType} · ${supply.source.name || supply.source.id}. Values use this supply meter only.` : "Supply reading unavailable. Map Main Incomer / HT panel and DG meters; waiting for a fresh energized supply reading."}</p><div className="energy-network">{meters.map((m) => <EnergyOverviewMeter key={m.id} meter={m} state={statusOf(m)} now={now} onOpen={openMeter} />)}</div></div>}
      {openedTabs.sld && <div hidden={tab !== "sld"}><EnergySLD canEdit={["Super Admin", "Admin"].includes(userData?.role)} key={siteId || "unassigned"} siteId={siteId} meters={meters} statusOf={statusOf} onSelect={openMeter} /></div>}
      {openedTabs.analysis && <div hidden={tab !== "analysis"}><EnergyAnalysisReport key={`${siteId}/${userData?.site || "unassigned"}`} siteId={siteId} siteName={userData?.site} meters={meters} userData={userData} now={now} fromCache={fromCache || Boolean(error)} /></div>}
      {tab === "alarms" && <><div className="energy-section-title"><h2>Alarms</h2><span className="energy-muted">Current meter health and collector diagnostics</span></div>{alarms.length ? <section className="energy-card"><div className="energy-table-wrap"><table><thead><tr><th>Meter</th><th>Type</th><th>Message</th><th>Action</th></tr></thead><tbody>{alarms.map((alarm, i) => <tr key={`${alarm.meter.id}-${i}`}><td>{alarm.meter.name || alarm.meter.id}</td><td>{alarm.type}</td><td className="energy-raw-value">{alarm.message}</td><td><button onClick={() => openMeter(alarm.meter.id)}>Inspect meter</button></td></tr>)}</tbody></table></div></section> : <div className="energy-empty">{error ? "Alarm status is unavailable while the meter connection has an error." : !meters.length ? "Waiting for meter data to evaluate alarms." : "No active meter health or collector alarms."}</div>}<p className="energy-muted">Alarms reflect connection freshness, meter status and collector-provided warnings. This view does not acknowledge or clear device alarms.</p></>}
    </section>
  </main>;
}
