import React, { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { canEditPowerMapping } from "../components/powerMeterMapping";

const intervals = [30, 60, 120, 240, 360, 720, 1440];
export default function EnergyNotificationSettings({siteId, userData}) {
  const [config, setConfig] = useState({enabled: true, dailyEnabled: true, changeoverEnabled: true, intervalMinutes: 120});
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!siteId) return undefined;
    return onSnapshot(doc(db, "energyMonitor", siteId, "config", "notifications"), {includeMetadataChanges: true}, snapshot => {
      if (snapshot.metadata?.fromCache) return;
      const value = snapshot.data() || {};
      setConfig({enabled: value.enabled !== false, dailyEnabled: value.dailyEnabled !== false, changeoverEnabled: value.changeoverEnabled !== false, intervalMinutes: intervals.includes(value.intervalMinutes) ? value.intervalMinutes : 120});
      setReady(true);
    }, () => {setReady(false); setMessage("Unable to load meter notification settings. Check your connection and site access.");});
  }, [siteId]);
  const canEdit = canEditPowerMapping(userData, siteId);
  const save = async () => {
    if (!canEdit || !ready || saving) return;
    setSaving(true); setMessage("");
    try {
      await setDoc(doc(db, "energyMonitor", siteId, "config", "notifications"), {...config, updatedBy: userData.uid, updatedAt: serverTimestamp()});
      setMessage("Meter notification settings saved for this site.");
    } catch (_) {setMessage("Unable to save meter notification settings. Please retry.");}
    finally {setSaving(false);}
  };
  return <section className="energy-card" aria-label="Meter notification settings">
    <h3>Meter notification updates</h3>
    <p>Each meter sends a reading summary to active users assigned to this site. Updates appear in their existing bell, enabled device alerts and connected personal Telegram chats.</p>
    <div className="energy-changeover-settings">
      <label><input type="checkbox" checked={config.enabled} disabled={!canEdit || !ready || saving} onChange={event => {setConfig({...config, enabled: event.target.checked}); setMessage("");}} /> Enable periodic meter updates</label>
      <label>Update frequency<select aria-label="Meter update frequency" value={config.intervalMinutes} disabled={!canEdit || !ready || saving} onChange={event => {setConfig({...config, intervalMinutes: Number(event.target.value)}); setMessage("");}}>
        {intervals.map(minutes => <option key={minutes} value={minutes}>{minutes < 60 ? `${minutes} minutes` : `${minutes / 60} hours`}</option>)}
      </select></label>
    </div>
    <label><input type="checkbox" checked={config.dailyEnabled} disabled={!canEdit || !ready || saving} onChange={event => {setConfig({...config, dailyEnabled: event.target.checked}); setMessage("");}} /> Send daily opening / closing kWh at 12:00 AM IST</label>
    <p>The midnight report covers the previous day for every meter, including recorded consumption and observation times. Missing readings, incomplete coverage and counter resets are marked. Daily reports can stay enabled when periodic updates are off. Daily meter history must be enabled to capture readings.</p>
    <label><input type="checkbox" checked={config.changeoverEnabled} disabled={!canEdit || !ready || saving} onChange={event => {setConfig({...config, changeoverEnabled: event.target.checked}); setMessage("");}} /> Send mains / DG changeover alerts</label>
    <p>DG start alerts include the last mains register and DG opening kWh. Restoration alerts include mains restored and DG closing kWh, generation and duration. Missing or last-known readings are labeled. Alerts follow saved header changeovers; automatic detection requires meter mapping and an authorized app session running. Manual changes are labeled manual.</p>
    <p>Default: every 2 hours, at 00:00, 02:00, 04:00 and so on (IST). Other frequencies also start at midnight. Delivery may take a few minutes. Stale or unavailable readings are clearly marked.</p>
    {canEdit && <button disabled={!ready || saving} onClick={save}>{saving ? "Saving…" : "Save notification settings"}</button>}
    {message && <p role="status">{message}</p>}
  </section>;
}
