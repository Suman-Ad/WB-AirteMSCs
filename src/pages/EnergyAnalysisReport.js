import EnergyChangeoverReport from "./EnergyChangeoverReport";
import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { dailyEnergyRows, consumption, dgMonth, downloadFile, istDate, numberValue, runHours } from "./energyReportData";
const fmt = (v) => typeof v === "number" && Number.isFinite(v) ? v.toLocaleString(undefined, { maximumFractionDigits: 3 }) : "—";
const csv = (value) => `"${String(typeof value === "string" && /^[=+@-]/.test(value) ? "'" + value : value ?? "").replace(/"/g, '""')}"`;
export default function EnergyAnalysisReport({ siteName, siteId }) {
  const [date, setDate] = useState(istDate), [dailyState, setDaily] = useState(null), [runState, setRuns] = useState(null);
  const scope = `${siteName}/${date}`;
  useEffect(() => {
    if (!siteName || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
    let active = true;
    const stopDaily = onSnapshot(query(collection(db, "dailyDGLogs", siteName, date.slice(0, 7)), where("Date", "==", date)), { includeMetadataChanges: true }, (snapshot) => active && setDaily({ scope, records: snapshot.docs.map((d) => ({ ...d.data(), id: d.id })), cached: snapshot.metadata.fromCache }), () => active && setDaily({ scope, records: [], error: "Daily opening/closing records could not be read. Check site access and connection." }));
    const stopRuns = onSnapshot(collection(db, "dgLogs", siteName, dgMonth(date), date, "runs"), { includeMetadataChanges: true }, (snapshot) => active && setRuns({ scope, records: snapshot.docs.map((d) => ({ ...d.data(), id: d.id })), cached: snapshot.metadata.fromCache }), () => active && setRuns({ scope, records: [], error: "DG run records could not be read. Check site access and connection." }));
    return () => { active = false; stopDaily(); stopRuns(); };
  }, [siteName, date, scope]);
  const daily = dailyState?.scope === scope ? dailyState : null;
  const runs = runState?.scope === scope ? runState : null;
  const energy = dailyEnergyRows(daily?.records || []);
  const completedRuns = (runs?.records || []).map((r) => ({ ...r, hours: runHours(r), opening: numberValue(r.kwhMeterStart), closing: numberValue(r.kwhMeterEnd) }));
  const hours = completedRuns.map((r) => r.hours).filter((v) => v !== null);
  const exportReport = () => {
    const rows = [["Site", "Date", "Section", "Equipment", "Opening kWh", "Closing kWh", "Energy kWh", "Start", "Stop", "Run hours"]];
    energy.forEach((r) => rows.push([siteName, date, "Daily recorded energy", r.label, r.opening, r.closing, r.usage, "", "", ""]));
    completedRuns.forEach((r) => rows.push([siteName, date, "Recorded DG run", r.dgNumber, r.opening, r.closing, consumption(r.opening, r.closing), r.startTime, r.stopTime || r.endTime, r.hours]));
    downloadFile(`energy-report-${date}.csv`, rows.map((row) => row.map(csv).join(",")).join("\r\n"), "text/csv;charset=utf-8");
  };
  return <div className="energy-tab-content"><section className="energy-card energy-toolbar"><div><h2>Analysis Report</h2><p>Saved daily energy and DG runs · {siteName || "Site not assigned"} · Asia/Kolkata</p></div><div className="energy-detail-actions"><label htmlFor="energy-report-date">Report date<input id="energy-report-date" type="date" value={date} max={istDate()} onChange={(e) => setDate(e.target.value)} /></label><button disabled={!energy.length && !completedRuns.length} onClick={exportReport}>Export CSV</button></div></section>
    {!siteName && <div className="energy-notice" role="alert">Assign a site name to read this site's daily and DG logs.</div>}
    {siteName && (!daily || !runs) && date && <p role="status">Loading saved report records…</p>}
    {[daily?.error, runs?.error].filter(Boolean).map((error) => <p className="energy-notice" role="alert" key={error}>{error}</p>)}
    {(daily?.cached || runs?.cached) && <p className="energy-notice">Showing cached report records; reconnect to confirm the latest saved data.</p>}
    <div className="energy-metrics"><article className="energy-card"><span className="energy-muted">Daily energy registers</span><div className="energy-number">{energy.length}</div></article><article className="energy-card"><span className="energy-muted">Recorded DG runs</span><div className="energy-number">{completedRuns.length}</div></article><article className="energy-card"><span className="energy-muted">Recorded DG equipment-hours</span><div className="energy-number">{fmt(hours.length ? hours.reduce((a, b) => a + b, 0) : null)} <small>h</small></div><small className="energy-muted">Sum across DGs; simultaneous runs overlap. {completedRuns.length - hours.length} runs have no valid duration.</small></article></div>
    <EnergyChangeoverReport siteId={siteId} date={date} />
    <section className="energy-card"><h2>Daily opening / closing · kWh</h2><p>Recorded EB, DG and other energy registers from the site's Daily DG Log.</p><div className="energy-table-wrap"><table><thead><tr><th>Energy register</th><th>Opening (kWh)</th><th>Closing (kWh)</th><th>Consumption / generation (kWh)</th><th>Quality</th></tr></thead><tbody>{energy.map((r) => <tr key={r.id}><td>{r.label}</td><td>{fmt(r.opening)}</td><td>{fmt(r.closing)}</td><td>{fmt(r.usage)}</td><td>{r.reset ? "Counter decreased / reset" : r.usage === null ? "Incomplete readings" : "Recorded"}</td></tr>)}</tbody></table></div>{daily && !daily.error && !energy.length && <div className="energy-empty">No saved daily opening/closing kWh records for this date. Enter them in Daily DG Log; a current live counter cannot reconstruct midnight readings.</div>}</section>
    <section className="energy-card"><h2>DG run analysis</h2><div className="energy-table-wrap"><table><thead><tr>{["DG", "Start", "Stop", "Run hours", "Opening kWh", "Closing kWh", "Generation kWh", "Fuel (L)", "Remarks"].map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{completedRuns.map((r) => <tr key={r.id}><td>{r.dgNumber || "—"}</td><td>{r.startTime || "—"}</td><td>{r.stopTime || r.endTime || "—"}</td><td>{fmt(r.hours)}</td><td>{fmt(r.opening)}</td><td>{fmt(r.closing)}</td><td>{fmt(consumption(r.opening, r.closing))}</td><td>{fmt(numberValue(r.fuelConsumption))}</td><td>{r.remarks || "—"}</td></tr>)}</tbody></table></div>{runs && !runs.error && !completedRuns.length && <div className="energy-empty">No recorded DG runs for this date.</div>}</section>
    <p className="energy-muted">Daily register totals and DG run energy describe different records and are not added together. Meter-level daily history requires saved collector readings; this report does not substitute browser-session values.</p>
  </div>;
}
