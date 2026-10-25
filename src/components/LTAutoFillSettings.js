import React, {useEffect, useState} from 'react';
import {collection, doc, onSnapshot, serverTimestamp, setDoc} from 'firebase/firestore';
import {db} from '../firebase';

export default function LTAutoFillSettings({userData}) {
  const siteId = userData?.siteId;
  const canEdit = ['Admin', 'Super Admin'].includes(userData?.role);
  const [meters, setMeters] = useState([]);
  const [settings, setSettings] = useState({enabled:false, lt1MeterId:'', lt2MeterId:''});
  const [message, setMessage] = useState('');
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const suggested = panel => {
    const matches = meters.filter(m => new RegExp(`^lt\\s*panel\\s*[-_]?\\s*0?${panel}$`, 'i').test(String(m.name || '').trim()));
    return matches.length === 1 ? matches[0].id : '';
  };
  useEffect(() => {
    setReady(false); setMeters([]); setSettings({enabled:false, lt1MeterId:'', lt2MeterId:''});
    if (!siteId) return;
    const stopMeters = onSnapshot(collection(db,'energyMonitor',siteId,'meters'), snap => setMeters(snap.docs.map(d => ({...d.data(), id:d.id}))), () => setMessage('Unable to read meters.'));
    const stopConfig = onSnapshot(doc(db,'energyMonitor',siteId,'config','loadBook'), snap => {
      setSettings(snap.exists() ? snap.data() : {enabled:false,lt1MeterId:'',lt2MeterId:''}); setReady(true);
    }, () => setMessage('Unable to read automatic LT settings.'));
    return () => {stopMeters(); stopConfig();};
  }, [siteId]);
  const save = async () => {
    if (!canEdit || !ready || saving) return;
    if (settings.enabled && (!settings.lt1MeterId || !settings.lt2MeterId || settings.lt1MeterId === settings.lt2MeterId)) {
      setMessage('Select a different meter for each LT panel.'); return;
    }
    setSaving(true);
    try {
      await setDoc(doc(db,'energyMonitor',siteId,'config','loadBook'), {
        enabled:settings.enabled, lt1MeterId:settings.lt1MeterId, lt2MeterId:settings.lt2MeterId,
        siteName:userData?.site || siteId, updatedAt:serverTimestamp()
      });
      setMessage('Settings saved. Server function must be deployed for automatic entries.');
    } catch (error) {setMessage(`Settings could not be saved: ${error.message}`);}
    finally {setSaving(false);}
  };
  return <section style={{padding:16, marginBottom:20, border:'1px solid var(--app-border)', borderRadius:10, background:'var(--app-surface)', color:'var(--app-text)'}}>
    <h3>Automatic LT Load Book</h3>
    <p>Slots: 00:00, 04:00, 08:00, 12:00, 16:00 and 20:00 IST. Each panel saves its first healthy meter reading within five minutes after the slot, even with this page closed. Existing entries are kept.</p>
    <label><input type="checkbox" disabled={!canEdit || !ready || saving} checked={settings.enabled} onChange={e => setSettings({...settings,enabled:e.target.checked})}/> Enable automatic saving for both LT panels</label>
    <div style={{display:'flex',flexWrap:'wrap',gap:16,marginBlock:12}}>{[1,2].map(panel => {
      const field = `lt${panel}MeterId`;
      return <label key={panel}>LT Panel-{panel} meter{' '}
        <select disabled={!canEdit || !ready || saving} value={settings[field]} onChange={e => setSettings({...settings,[field]:e.target.value})}>
          <option value="">Select meter</option>
          {settings[field] && !meters.some(m => m.id === settings[field]) && <option value={settings[field]}>{settings[field]} (unavailable)</option>}
          {meters.map(m => <option key={m.id} value={m.id}>{m.name || m.id} ({m.id})</option>)}
        </select>
      </label>;
    })}</div>
    <p>Voltage, phase currents, power factor and kWh come from the meter. Temperatures remain blank for manual entry. Missing or failed readings are skipped.</p>
    {canEdit && <button type="button" disabled={!ready || saving || !suggested(1) || !suggested(2)} onClick={() => setSettings({...settings,lt1MeterId:suggested(1),lt2MeterId:suggested(2)})}>Use matching LT panel meters</button>}
    {canEdit && <button type="button" disabled={!ready || saving} onClick={save}>{saving ? 'Saving…' : 'Save automatic LT settings'}</button>}
    <p role="status">{message}</p>
  </section>;
}
