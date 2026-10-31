import React, { useState } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useMeterDailyHistory, useMeterHistorySettings, useMeterSamples } from "../hooks/useMeterHistory";
import { historyDates, meterDailyRows, reportMeters } from "./energyMeterHistoryData";
import { displayReading } from "./energyMeterData";
import { meterHealth } from "./meterHealth";
import { downloadFile, istDate } from "./energyReportData";

const fmt = value => typeof value === "number" && Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 3 }) : "—";
const time = value => typeof value === "number" && Number.isFinite(value) ? new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "—";
const csv = value => `"${String(typeof value === "string" && /^[=+@-]/.test(value) ? "'" + value : value ?? "").replace(/"/g, '""')}"`;
const exportCSV = (filename, rows) => downloadFile(filename, rows.map(row => row.map(csv).join(",")).join("\r\n"), "text/csv;charset=utf-8");

export default function EnergyMeterHistoryReport({ siteId, date, meters = [], userData, now = Date.now(), fromCache = false }) {
  const daily = useMeterDailyHistory(siteId, date);
  const config = useMeterHistorySettings(siteId);
  const list = reportMeters(meters, daily.records, date);
  const [selection, setSelection] = useState("");
  const selectedKey = list.some(m => m.key === selection) ? selection : list[0]?.key || "";
  const samples = useMeterSamples(siteId, selectedKey, date);
  const [draft, setDraft] = useState(null), [saving, setSaving] = useState(false), [saveError, setSaveError] = useState(""), [saved, setSaved] = useState("");
  const settings = config.settings || { enabled: true, retentionDays: 7 };
  const form = draft?.siteId === siteId ? draft : settings;
  const canEdit = ["Admin", "Super Admin"].includes(userData?.role) && Boolean(userData?.uid);
  const today = istDate();
  const dates = historyDates(date);
  const allRows = list.map(m => ({ ...m, days: meterDailyRows(m.key, daily.records, date) }));
  const columns = ["Date", "Opening (kWh)", "Closing / latest (kWh)", "Usage (kWh)", "First captured (IST)", "Last captured (IST)", "Quality"];
  const sampleReading = (sample, key) => displayReading({ ...sample.readings, status: "OK", energyUnits: sample.energyUnits, powerUnits: sample.powerUnits }, key);
  const patchDraft = patch => { setDraft({ ...form, ...patch, siteId }); setSaved(""); };

  async function saveSettings(event) {
    event.preventDefault(); setSaveError(""); setSaved("");
    const retentionDays = Number(form.retentionDays);
    if (!Number.isInteger(retentionDays) || retentionDays < 7 || retentionDays > 365) { setSaveError("Backup days must be a whole number between 7 and 365."); return; }
    if (!canEdit || config.loading || config.error || config.cached) { setSaveError("Reconnect with an active administrator account before changing settings."); return; }
    setSaving(true);
    try {
      await setDoc(doc(db, "energyMonitor", siteId, "config", "meterHistory"), { enabled: Boolean(form.enabled), retentionDays, updatedBy: userData.uid, updatedAt: serverTimestamp() });
      setDraft(null); setSaved(`Backup settings saved: ${retentionDays} days.`);
    } catch (error) { setSaveError("Backup settings could not be saved. Check site administrator permissions and connection."); }
    finally { setSaving(false); }
  }
  function exportDaily() {
    const rows = [["Site ID", "Meter", "Meter ID", ...columns]];
    allRows.forEach(m => m.days.forEach(row => rows.push([siteId, m.name, m.meterId, row.date, row.opening, row.closing, row.usage, time(row.record?.firstAtMs), time(row.record?.lastAtMs), `${daily.loading ? "Loading saved readings…" : daily.error ? "History unavailable" : row.quality}${row.date === today ? "; provisional" : ""}`])));
    exportCSV(`meter-daily-${siteId}-${date}.csv`, rows);
  }
  const renderRow = row => <tr key={row.date}><td>{row.date}{row.date === today && <small className="energy-history-badge">In progress</small>}</td><td>{fmt(row.opening)}<small className="energy-history-cell-note">{row.carried ? "Previous day closing" : row.record ? "First capture baseline" : "Not captured"}</small></td><td>{fmt(row.closing)}{row.date === today && <small className="energy-history-cell-note">Provisional</small>}</td><td>{fmt(row.usage)}</td><td>{time(row.record?.firstAtMs)}</td><td>{time(row.record?.lastAtMs)}</td><td>{daily.loading ? "Loading saved readings…" : daily.error ? "History unavailable" : row.quality}</td></tr>;

  return <section className="energy-meter-history" aria-label="Live meter daily history">
    <section className="energy-card"><div className="energy-section-title"><div><h2>Live meter daily opening / closing</h2><p>{date} · one row for each current meter, plus retained meters · Asia/Kolkata</p></div><button disabled={daily.loading || Boolean(daily.error) || !daily.records.length} onClick={exportDaily}>Export meter daily CSV</button></div>
      {daily.loading && <p role="status">Loading saved meter daily readings…</p>}
      {daily.error && <p role="alert" className="energy-notice">{daily.error}</p>}
      {daily.cached && <p className="energy-notice">Cached meter registers. Reconnect to confirm the latest saved history.</p>}
      <div className="energy-table-wrap"><table><thead><tr><th>Meter</th><th>Opening (kWh)</th><th>{date === today ? "Latest saved / provisional closing (kWh)" : "Closing (kWh)"}</th><th>Usage (kWh)</th><th>Last captured (IST)</th><th>Quality / live state</th></tr></thead><tbody>{allRows.map(m => { const row = m.days[6]; return <tr key={m.key}><td><strong>{m.name}</strong><small className="energy-history-cell-note">{m.meterId}</small></td><td>{fmt(row.opening)}<small className="energy-history-cell-note">{row.carried ? "Previous day closing" : row.record ? "First capture baseline" : "Not captured"}</small></td><td>{fmt(row.closing)}</td><td>{fmt(row.usage)}</td><td>{time(row.record?.lastAtMs)}</td><td>{daily.loading ? "Loading saved readings…" : daily.error ? "History unavailable" : row.quality}<small className="energy-history-cell-note">{m.meter ? meterHealth(m.meter, now, fromCache) : "Retained meter history"}{date === today && m.meter && meterHealth(m.meter, now, fromCache) === "Live" ? ` · current counter ${fmt(displayReading(m.meter, "fwd_Wh").value)} kWh` : ""}</small></td></tr>; })}</tbody></table></div>
      {!daily.loading && !daily.error && !daily.records.length && <div className="energy-empty">No meter daily backups are saved for this period. History starts when the backup service is active and fresh meter uploads arrive. Current counters cannot reconstruct earlier days.</div>}
      <p className="energy-muted">Opening equals the previous calendar day's saved closing when available. With no previous day, the first observed reading is a partial-day baseline. Closing is the last valid captured counter, not an invented midnight value. Daily checkpoints are taken at most once per minute; check observation times for offline gaps. Counter resets leave consumption unavailable.</p>
    </section>
    <section className="energy-card"><h2>Last 7 days · each meter</h2><p>{dates[0]} to {date}. Choose an earlier report date above to review another seven-day period.</p>
      {!list.length && <p>No current meters or retained daily records are available.</p>}
      {!daily.loading && !daily.error && allRows.map(m => <details className="energy-history-meter" key={`${siteId}:${m.key}`}><summary>{m.name} <span className="energy-muted">· {m.meterId} · {m.days.filter(row => row.record).length}/7 days captured</span></summary><div className="energy-table-wrap"><table><thead><tr>{columns.map(column => <th key={column}>{column}</th>)}</tr></thead><tbody>{m.days.map(renderRow)}</tbody></table></div></details>)}
    </section>
    <section className="energy-card"><div className="energy-section-title"><div><h2>Saved live meter readings · 7-day history</h2><p>One healthy sample per 15-minute interval, where available. Missing intervals remain gaps.</p></div><button disabled={samples.loading || Boolean(samples.error) || !samples.records.length} onClick={() => {
      const keys = [...new Set(samples.records.flatMap(sample => Object.keys(sample.readings || {})))].sort();
      exportCSV(`meter-samples-${siteId}-${date}.csv`, [["Meter", "Meter ID", "Observed at (IST)", "kWh", "Power units", "Energy units", ...keys], ...samples.records.map(sample => [sample.meterName, sample.meterId, time(sample.observedAtMs), sample.kwh, sample.powerUnits, sample.energyUnits, ...keys.map(key => sample.readings?.[key])])]);
    }}>Export meter samples CSV</button></div>
      <label htmlFor="energy-history-meter">History meter<select id="energy-history-meter" value={selectedKey} onChange={e => setSelection(e.target.value)}>{!list.length && <option value="">No meters</option>}{list.map(m => <option key={m.key} value={m.key}>{m.name} · {m.meterId}</option>)}</select></label>
      {samples.loading && selectedKey && <p role="status">Loading saved meter samples…</p>}
      {samples.error && <p className="energy-notice" role="alert">{samples.error}</p>}
      {samples.cached && <p className="energy-notice">Cached meter samples. Reconnect to verify saved history.</p>}
      <div className="energy-history-samples energy-table-wrap"><table><thead><tr>{["Observed at (IST)", "Forward kWh", "Active power (kW)", "R / Y / B current (A)", "Power factor", "All captured fields"].map(column => <th key={column}>{column}</th>)}</tr></thead><tbody>{samples.records.map(sample => <tr key={sample.id}><td>{time(sample.observedAtMs)}</td><td>{fmt(sample.kwh)}</td><td>{fmt(sampleReading(sample, "active_power").value)}</td><td>{["R", "Y", "B"].map(phase => fmt(sample.readings?.[`${phase}_current`])).join(" / ")}</td><td>{fmt(sample.readings?.power_factor)}</td><td><details><summary>Inspect readings</summary><dl>{Object.keys(sample.readings || {}).sort().map(key => { const reading = sampleReading(sample, key); return <div className="energy-history-field" key={key}><dt>{key}</dt><dd>{fmt(reading.value)} {reading.unit}</dd></div>; })}</dl></details></td></tr>)}</tbody></table></div>
      {selectedKey && !samples.loading && !samples.error && !samples.records.length && <div className="energy-empty">No saved samples for this meter in this seven-day period.</div>}
    </section>
    <section className="energy-card"><h2>Backup control settings</h2>
      {config.loading && <p role="status">Loading backup settings…</p>}
      {config.error && <p className="energy-notice" role="alert">{config.error}</p>}
      {config.cached && <p className="energy-notice">Backup settings are cached; reconnect before changing them.</p>}
      {!config.loading && !config.error && <p>{settings.enabled ? "Automatic backup enabled" : "Automatic backup paused"} · retain {settings.retentionDays} calendar days, including today · daily cleanup at 02:15 IST.</p>}
      {canEdit ? <form className="energy-history-settings" onSubmit={saveSettings}><fieldset disabled={saving || config.loading || Boolean(config.error) || config.cached}><label className="energy-history-checkbox"><input type="checkbox" checked={Boolean(form.enabled)} onChange={e => patchDraft({ enabled: e.target.checked })} /> Automatically back up meter readings</label><label htmlFor="meter-backup-days">Backup days to retain<input id="meter-backup-days" type="number" min="7" max="365" step="1" required value={form.retentionDays} onChange={e => patchDraft({ retentionDays: e.target.value })} /></label><button type="submit">{saving ? "Saving…" : "Save backup settings"}</button></fieldset></form> : <p className="energy-muted">Site Admin / Super Admin accounts can change backup retention.</p>}
      <p className="energy-muted">Choose 7–365 days. Retention applies to saved meter daily registers and sampled history. Reducing it removes older records during the next cleanup; increasing it preserves future records but does not recover deleted days. Pausing stops new captures; cleanup continues. Existing Daily DG Log and changeover records are unaffected. New readings are saved only while the site backup service is active.</p>
      {saveError && <p role="alert" className="energy-notice">{saveError}</p>}{saved && <p role="status">{saved}</p>}
    </section>
  </section>;
}

