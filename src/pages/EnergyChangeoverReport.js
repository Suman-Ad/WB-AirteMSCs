import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { downloadFile } from "./energyReportData";
import { displayReading } from "./energyMeterData";
const fmt = (value) => typeof value === "number" && Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 3 }) : "—";
const time = (value) => typeof value === "number" ? new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "—";
export default function EnergyChangeoverReport({ siteId, date }) {
  const [state, setState] = useState(null);
  const scope = `${siteId}/${date}`;
  useEffect(() => {
    if (!siteId || !date) return undefined;
    let active = true;
    const stop = onSnapshot(query(collection(db, "energyChangeovers", siteId, "runs"), where("date", "==", date)), { includeMetadataChanges: true }, (snapshot) => {
      if (active) setState({ scope, cached: snapshot.metadata.fromCache, rows: snapshot.docs.map((record) => ({ ...record.data(), id: record.id })).sort((a, b) => (b.startAtMs || 0) - (a.startAtMs || 0)) });
    }, () => { if (active) setState({ scope, rows: [], error: "Meter changeover history could not be loaded. Check site permissions and connection." }); });
    return () => { active = false; stop(); };
  }, [siteId, date, scope]);
  const result = state?.scope === scope ? state : null;
  return <section className="energy-card"><div className="energy-section-title"><div><h2>Meter-recorded EB / DG changeovers</h2><p>Saved opening and closing kWh for every header changeover · run start date · Asia/Kolkata</p></div><button disabled={!result?.rows.length} onClick={() => downloadFile(`meter-dg-runs-${date}.json`, JSON.stringify(result.rows, null, 2), "application/json")}>Export meter run data</button></div>
    {!siteId && <p>Assign a site ID to view meter changeovers.</p>}
    {siteId && !result && <p role="status">Loading meter changeovers…</p>}
    {result?.error && <p role="alert">{result.error}</p>}
    {result?.cached && <p className="energy-notice">Cached changeover history; reconnect to confirm saved readings.</p>}
    <div className="energy-table-wrap"><table><thead><tr>{["DG / meter", "State", "EB fail / DG start", "EB restore / DG stop", "Run hours", "Opening kWh", "Closing kWh", "Generation kWh", "Cooldown", "Reading quality"].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{result?.rows.map((run) => <tr key={run.id}>
      <td>{run.dgNumber}<small className="energy-muted"> · {run.meterId || "Unmapped meter"}</small></td><td>{run.status}</td><td>{time(run.startAtMs)}</td><td>{time(run.endAtMs)}</td><td>{fmt(run.runSeconds == null ? null : run.runSeconds / 3600)}</td><td>{fmt(run.opening?.kwh)}</td><td>{fmt(run.closing?.kwh)}</td><td>{fmt(run.generationKwh)}</td><td>{run.cooldownSeconds != null ? `${fmt(run.cooldownSeconds / 60)} min` : run.cooldownStatus || "Not recorded"}<br /><small>Transfer: {time(run.loadTransferAtMs)}<br />DG voltage 0: {time(run.cooldownEndAtMs)}</small></td><td>{run.counterReset ? "Counter decreased / reset" : run.status === "Running" ? "Waiting for restoration" : run.closing?.quality || "Incomplete"}<br /><small>Closing sample: {time(run.closing?.observedAtMs)}</small>
      <details><summary>Captured readings</summary>{[["DG opening", run.opening], ["DG latest", run.latest], ["DG closing", run.closing], ["EB failure", run.ebFailure], ["EB restoration", run.ebRestoration]].map(([label, sample]) => <div key={label}><strong>{label}</strong><p>{sample?.quality || "Not captured"} · {time(sample?.observedAtMs)}</p>{sample?.lastKnownKwh != null && <p>Last known register: {fmt(sample.lastKnownKwh)} kWh at {time(sample.lastKnownAtMs)}</p>}<table><tbody>{Object.keys(sample?.readings || {}).sort().map((key) => { const reading = displayReading({ ...sample.readings, status: "OK", powerUnits: sample.powerUnits, energyUnits: sample.energyUnits }, key); return <tr key={key}><td>{key}</td><td>{fmt(reading.value)} {reading.unit}</td></tr>; })}</tbody></table></div>)}</details></td>
    </tr>)}</tbody></table></div>
    {result && !result.error && !result.rows.length && <div className="energy-empty">No meter changeovers saved for this run start date.</div>}
    <p className="energy-muted">If a DG meter goes offline at stop, its last saved valid counter is retained and labelled with its sample time. Missing opening readings and counter resets remain incomplete. Cooldown is measured from the first of two confirmed zero-load / loaded-mains reading pairs until the first captured DG voltage-zero reading. A restarted DG interrupts pending cooldown. Missing voltage data stays pending; historical cooldown is not fabricated. Earlier runs cannot be reconstructed from a current counter.</p>
  </section>;
}
