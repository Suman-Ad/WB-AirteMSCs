import React, { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import EnergyMeterDetails from "./EnergyMeterDetails";
import { displayReading } from "./energyMeterData";

const numeric = (v) => typeof v === "number" && Number.isFinite(v);
const format = (v) => numeric(v) ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—";
const panel = { background: "#fff", border: "1px solid #dce5ed", borderRadius: 12, padding: 20 };
const power = (m) => numeric(m.active_power) ? m.active_power / (m.powerUnits === "base" ? 1000 : 1) : null;
const staleAfter = (m) => Math.max(30, (Number(m?.uploadIntervalSeconds) || 10) * 3);

export default function EnergyMonitor({ userData }) {
  const siteId = userData?.siteId;
  const [meters, setMeters] = useState([]);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [trend, setTrend] = useState([]);

  useEffect(() => {
    setMeters([]); setSelected(""); setError(""); setLoading(true); setFromCache(true);
    if (!siteId) { setLoading(false); return undefined; }
    return onSnapshot(collection(db, "energyMonitor", siteId, "meters"),
      { includeMetadataChanges: true }, (snapshot) => {
        const incoming = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
        // Once multi-meter sync is active, retire the original test document from the display.
        const current = incoming.some((m) => /^meter-\d+$/.test(m.id))
          ? incoming.filter((m) => /^meter-\d+$/.test(m.id)) : incoming;
        setMeters(current.sort((a, b) => (a.slaveId || 0) - (b.slaveId || 0)));
        setFromCache(snapshot.metadata.fromCache);
        setLoading(false); setError("");
      }, () => {
        setError("Cannot read meter data. Check your connection and site access permissions.");
        setMeters([]); setLoading(false);
      });
  }, [siteId]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const meter = meters.find((m) => m.id === selected) || meters[0];
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
  const state = error ? "Unavailable" : fromCache ? "Cached / reconnecting" :
    age === null ? "Waiting for data" : age > staleAfter(meter) ? "Stale / offline" :
    meter?.status !== "OK" ? "Meter error" : "Live";
  const value = (key) => meter?.status === "OK" ? meter[key] : null;
  const powerLabel = ["base", "kilo"].includes(units) ? "kW" : "raw · units unverified";
  const cards = [
    ["Voltage L-L", value("voltage_ll"), "V"],
    ["Voltage L-N", value("voltage_ln"), "V"],
    ["Average current", value("current"), "A"],
    ["Active power", readingPower, powerLabel],
    ["Apparent power", displayReading(meter, 'apparent_power').value, displayReading(meter, 'apparent_power').unit],
    ["Reactive power", displayReading(meter, 'reactive_power').value, displayReading(meter, 'reactive_power').unit],
    ["Power factor", value("power_factor"), ""],
    ["Frequency", value("frequency"), "Hz"],
    ["Forward energy counter", value("fwd_Wh"), "reader value · verify counter units"],
  ];

  return <main style={{ background: "#f3f7fa", padding: 24, color: "#172b42", minHeight: "80vh" }}>
    <header style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
      <div><h1 style={{ marginBottom: 6 }}>Energy Monitor</h1>
        <p>EnergyBook · Live meter monitoring · Site: {siteId || "Unassigned"} · {meters.length} meter(s)</p></div>
      <div style={{ ...panel, alignSelf: "center", color: state === "Live" ? "#08794c" : "#925400" }}>
        <strong role="status">{state}</strong>
      </div>
    </header>
    {!siteId && <p role="alert">Your account needs a site ID before meter data can be shown.</p>}
    {error && <p role="alert">{error}</p>}
    {loading && siteId && <p>Connecting to Firestore…</p>}
    {!loading && siteId && !error && !meters.length && <p>No meter readings yet. Configure the EnergyBook collector for this site and start monitoring.</p>}
    {meter && <>
      <section style={{ ...panel, margin: "16px 0", overflowX: "auto" }}>
        <h2>All monitored meters</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead><tr>{["Meter", "Status", "Voltage L-L (V)", "Current (A)", "Active power", "Last reading"].map((h) =>
            <th key={h} style={{ padding: 10, borderBottom: "1px solid #dce5ed" }}>{h}</th>)}</tr></thead>
          <tbody>{meters.map((m) => {
            const time = m.observedAt?.toMillis?.();
            const old = !time || (now - time) / 1000 > staleAfter(m);
            const status = fromCache ? "Cached" : old ? "Stale / offline" : m.status === "OK" ? "Live" : "Meter error";
            return <tr key={m.id} style={{ background: m.id === meterId ? "#eaf6f7" : "transparent" }}>
              <td style={{ padding: 10 }}><button type="button" onClick={() => setSelected(m.id)}>{m.name || m.id}{m.slaveId ? ` (ID ${m.slaveId})` : ""}</button></td>
              <td>{status}</td>
              <td>{format(m.status === "OK" ? m.voltage_ll : null)}</td>
              <td>{format(m.status === "OK" ? m.current : null)}</td>
              <td>{format(m.status === "OK" ? power(m) : null)} {["base", "kilo"].includes(m.powerUnits) ? "kW" : "raw"}</td>
              <td>{time ? new Date(time).toLocaleString() : "—"}</td>
            </tr>;
          })}</tbody>
        </table>
      </section>
      <section style={{ ...panel, margin: "16px 0" }}>
        <label htmlFor="energy-meter">Meter: </label>
        <select id="energy-meter" value={meter.id} onChange={(e) => setSelected(e.target.value)} style={{ padding: 8 }}>
          {meters.map((m) => <option key={m.id} value={m.id}>{m.name || m.id}</option>)}
        </select>
        <p>Last reading: {observed ? new Date(observed).toLocaleString() : "Unavailable"}
          {age !== null ? ` · ${age}s ago` : ""}</p>
        <small>Upload interval: {Number(meter.uploadIntervalSeconds) || 10}s. Values older than {staleAfter(meter)}s are marked stale.</small>
        <p>Data format: {meter.schemaVersion >= 2 ? "Full meter readings" : "Summary only — update EnergyBook to upload phase and vector readings"}
          {meter.availableFields ? ` · ${meter.availableFields.length} available measurement(s)` : ""}</p>
      </section>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
        {cards.map(([label, v, unit]) => <article key={label} style={panel}>
          <div>{label}</div><div style={{ fontSize: 28, fontWeight: 700, margin: "12px 0" }}>{format(v)}</div>
          <small>{unit}</small>
        </article>)}
      </section>
      <EnergyMeterDetails meter={meter} state={state} />
      <section style={{ ...panel, marginTop: 20 }}>
        <h2>Load trend <small>({powerLabel})</small></h2>
        <p>Latest 60 updates received while this page is open.</p>
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend}>
              <XAxis dataKey="time" tickFormatter={(t) => new Date(t).toLocaleTimeString()} minTickGap={40} />
              <YAxis /><Tooltip labelFormatter={(t) => new Date(t).toLocaleTimeString()} />
              <Line dataKey="value" name="Active power" stroke="#087f8c" dot={false} connectNulls={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </>}
  </main>;
}
