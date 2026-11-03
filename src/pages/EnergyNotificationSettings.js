import React, { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { canManageAllPowerMappings } from "../components/powerMeterMapping";
import { siteFunctionControls, notificationDefaults, normalizeNotifications } from "./siteFunctionControls";

const intervals = [30, 60, 120, 240, 360, 720, 1440];
export default function EnergyNotificationSettings({siteId, userData}) {
  const [config, setConfig] = useState(notificationDefaults);
  const [savedConfig, setSavedConfig] = useState(notificationDefaults);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    setReady(false); setMessage(""); setConfig(notificationDefaults);
    if (!siteId) return undefined;
    return onSnapshot(doc(db, "energyMonitor", siteId, "config", "notifications"), {includeMetadataChanges: true}, snapshot => {
      if (snapshot.metadata?.fromCache) return;
      const value = snapshot.data() || {};
      setConfig(normalizeNotifications(value));
      setSavedConfig(normalizeNotifications(value));
      setReady(true);
    }, () => {setReady(false); setMessage("Unable to load meter notification settings. Check your connection and site access.");});
  }, [siteId]);
  const canEdit = Boolean(siteId && canManageAllPowerMappings(userData));
  const save = async () => {
    if (!canEdit || !ready || saving) return;
    setSaving(true); setMessage("");
    try {
      await setDoc(doc(db, "energyMonitor", siteId, "config", "notifications"), {...config, updatedBy: userData.uid, updatedAt: serverTimestamp()}, {merge:true});
      setSavedConfig(config);
      setMessage("Meter notification settings saved for this site.");
    } catch (_) {setMessage("Unable to save meter notification settings. Please retry.");}
    finally {setSaving(false);}
  };
  const dirty = JSON.stringify(config) !== JSON.stringify(savedConfig);
  const disabled = !canEdit || !ready || saving;
  const activeCount = Object.values(config).filter(value=>value === true).length;
  const update = (field,value) => {setConfig({...config,[field]:value});setMessage("");};
  const toggle = (field,label,description) => <label className="settings-toggle-row" key={field}>
    <span className="settings-toggle-copy"><strong>{label}</strong>{description && <small>{description}</small>}</span>
    <span className="settings-switch"><input aria-label={label} type="checkbox" checked={config[field]} disabled={disabled} onChange={event=>update(field,event.target.checked)} /><span className="settings-switch-track" aria-hidden="true" /></span>
  </label>;
  return <section className="energy-card settings-functions" aria-label="Meter notification settings">
    <header className="settings-card-heading"><div><span className="settings-eyebrow">DELIVERY & AUTOMATION</span><h3>Site function controls</h3><p>Choose what runs for this site. Save to apply your changes.</p></div><span className="settings-count-badge">{activeCount} enabled</span></header>
    {!canEdit && <p className="settings-feedback">Read-only access. Admin and Super Admin accounts can change these controls.</p>}
    <div className="settings-control-group">
      <div className="settings-group-heading"><h4>Scheduled notifications</h4><p>Reading summaries and power changeover updates.</p></div>
      {toggle('enabled','Enable periodic meter updates','Send meter summaries to site users through the bell and their connected delivery channels.')}
      <label className="settings-frequency">Update frequency<select aria-label="Meter update frequency" value={config.intervalMinutes} disabled={disabled} onChange={event=>update('intervalMinutes',Number(event.target.value))}>
        {intervals.map(minutes=><option key={minutes} value={minutes}>{minutes < 60 ? `${minutes} minutes` : `${minutes/60} hours`}</option>)}
      </select><small>Schedules follow IST, starting at midnight.</small></label>
      {toggle('dailyEnabled','Send daily opening / closing kWh at 12:00 AM IST',"Report the previous day's readings. Daily meter history must be enabled.")}
      {toggle('changeoverEnabled','Send mains / DG changeover alerts','Notify site users and Admins when saved mains / DG changeovers occur.')}
    </div>
    <div className="settings-control-group">
      <div className="settings-group-heading"><h4>Availability & reminders</h4><p>Track meter reading interruptions and scheduled CRQ actions.</p></div>
      {siteFunctionControls.slice(0,3).map(([field,label])=>toggle(field,label,{
        healthAlertsEnabled:'Confirm unhealthy readings across two checks at least one minute apart.',
        recoveryAlertsEnabled:'Send a recovery update after healthy readings return. Availability monitoring must be enabled.',
        crqRemindersEnabled:'Remind users to open CRQs at the start and close them before the activity ends.'
      }[field]))}
    </div>
    <div className="settings-control-group">
      <div className="settings-group-heading"><h4>Telegram capabilities</h4><p>Control which reports and imports are available in the linked bot.</p></div>
      <div className="settings-telegram-grid">{siteFunctionControls.slice(3).map(([field,label])=>toggle(field,label,field === 'telegramCrqImportEnabled' ? 'Combine CRQs in existing activity rows from a table image.' : field === 'telegramIncidentEnabled' ? 'Show all open incidents for the requested site.' : field === 'telegramActivityEnabled' ? "Show today's scheduled activities and CRQs." : 'Available to authorized, linked accounts.'))}</div>
    </div>
    <footer className="settings-save-bar"><div><strong>{!ready ? 'Connecting to settings…' : dirty ? 'You have unsaved changes' : 'Settings are up to date'}</strong><small>Changes apply to this site after saving.</small></div>{canEdit && <button className="settings-primary-button" disabled={!ready || saving || !dirty} onClick={save}>{saving ? 'Saving…' : 'Save notification settings'}</button>}</footer>
    {message && <p className="settings-feedback" role="status">{message}</p>}
  </section>;
}
