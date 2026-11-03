import React, {useEffect, useState} from 'react';
import {collection, doc, onSnapshot, serverTimestamp, setDoc} from 'firebase/firestore';
import {db} from '../firebase';
import {canManageAllPowerMappings, canEditPowerMapping, normalizePowerMapping, readPowerMapping, resolvePowerMapping} from '../components/powerMeterMapping';
import useSitePowerMapping from '../hooks/useSitePowerMapping';
import {siteIdMap} from '../config/siteConfigs';
import {currentEnergyMeters} from './currentEnergyMeters';

export default function EnergyPowerMapping({siteId, meters, userData, fixedSite = false}) {
  const allSites=canManageAllPowerMappings(userData) && !fixedSite;
  const [selectedSite,setSelectedSite]=useState(siteId || Object.values(siteIdMap)[0] || '');
  const targetSite=allSites ? selectedSite || siteId : siteId;
  const [remote,setRemote]=useState({siteId:null,meters:[],error:''});
  useEffect(()=>{
    if (!allSites || !targetSite || targetSite === siteId) return;
    let active=true;
    const stop=onSnapshot(collection(db,'energyMonitor',targetSite,'meters'), snapshot=>{
      if (active) setRemote({siteId:targetSite,meters:currentEnergyMeters(snapshot.docs.map(d=>({...d.data(),id:d.id}))).meters,error:''});
    },error=>{if(active) setRemote({siteId:targetSite,meters:[],error:`Cannot read this site's meters: ${error.message || error.code}`});});
    return ()=>{active=false;stop();};
  },[allSites,targetSite,siteId]);
  if (!canEditPowerMapping(userData,targetSite)) return null;
  const sites=new Map(Object.entries(siteIdMap).map(([name,id])=>[id,name]));
  if (siteId && !sites.has(siteId)) sites.set(siteId,userData?.site || siteId);
  const targetMeters=targetSite === siteId ? meters : remote.siteId === targetSite ? remote.meters : [];
  return <div>
    {allSites && <label>Automatic switch settings site <select aria-label="Automatic switch settings site" value={targetSite} onChange={e=>setSelectedSite(e.target.value)}>
      {[...sites.entries()].sort((a,b)=>a[1].localeCompare(b[1])).map(([id,name])=><option key={id} value={id}>{name} · {id}</option>)}
    </select></label>}
    {remote.siteId === targetSite && remote.error && <p role="alert">{remote.error}</p>}
    <PowerMappingEditor key={targetSite} siteId={targetSite} meters={targetMeters} userData={userData}/>
  </div>;
}

function PowerMappingEditor({siteId, meters, userData}) {
  const shared=useSitePowerMapping(siteId);
  const [draft,setDraft]=useState(null), [saving,setSaving]=useState(false), [message,setMessage]=useState('');
  const canEdit=canEditPowerMapping(userData,siteId);
  if (!canEdit) return null;
  const config=draft || (shared.exists ? shared.config : normalizePowerMapping(readPowerMapping(siteId)));
  const resolved=resolvePowerMapping(config,meters);
  const change=(field,value)=>{setDraft({...config,[field]:value});setMessage('');};
  const save=async()=>{
    if (!canEdit || !shared.ready || saving) return;
    const ids=['mainMeterId','dg1MeterId','dg2MeterId'].map(field=>resolved[field]).filter(Boolean);
    if (config.enabled && (!resolved.mainMeterId || !resolved.dg1MeterId && !resolved.dg2MeterId || new Set(ids).size !== ids.length)) {
      setMessage('Select a Main Incomer and at least one DG, using different meters.');return;
    }
    setSaving(true);
    try {
      await setDoc(doc(db,'energyMonitor',siteId,'config','powerSwitch'),{...normalizePowerMapping(config),updatedBy:userData.uid,updatedAt:serverTimestamp()});
      setDraft(null);setMessage('Automatic switch settings saved for this site.');
    } catch(error) {setMessage(`Settings could not be saved: ${error.message || error.code}`);}
    finally {setSaving(false);}
  };
  return <section className="energy-card"><details><summary>Existing header EB/DG switch · automatic meter mapping</summary>
    <p>Settings site: <strong>{siteId}</strong></p>
    <p>Automatic mode disables the manual EB/DG slider for every role. EB → DG requires incomer 0 V and 0 A (or an offline incomer) plus a live DG above 300 V L-L carrying positive current. DG → EB requires live incomer above 300 V L-L carrying positive current and two distinct fresh idle-load readings from the recorded running DG (all valid phase currents at or below 5 A, or verified zero active power). If that DG goes offline after a live idle reading while mains carries load, the reading may be retained for up to five minutes; two distinct fresh loaded mains observations then confirm restoration. DG voltage may remain available during cooldown; an offline standby meter does not block transfer. Any other fresh DG meter carrying load blocks restoration. Cooldown runs from the first confirmed idle-load observation until DG voltage reaches 0 V and is saved separately. Each direction requires two distinct live reading pairs. Positive current means load is present; a continuously rising current is not required.</p>
    <div className="energy-changeover-settings">
      <label><input type="checkbox" checked={config.enabled} disabled={!shared.ready || saving} onChange={e=>change('enabled',e.target.checked)}/> Enable automatic switching of the existing EB/DG slider</label>
      {[["Main Incomer","mainMeterId"],["HT panel (optional)","htMeterId"],["DG-1","dg1MeterId"],["DG-2 (optional)","dg2MeterId"]].map(([label,field])=><label key={field}>{label}<select aria-label={`Power switch ${label} meter`} value={config[field]} disabled={!shared.ready || saving} onChange={e=>change(field,e.target.value)}>
        <option value="">Auto-detect by meter name</option>
        {config[field] && !meters.some(m=>m.id===config[field]) && <option value={config[field]}>{config[field]} (unavailable)</option>}
        {meters.map(m=><option key={m.id} value={m.id}>{m.name || m.id}</option>)}
      </select><small>Using: {meters.find(m=>m.id===resolved[field])?.name || resolved[field] || 'Map a meter'}</small></label>)}
    </div>
    <button type="button" disabled={!shared.ready || saving} onClick={save}>{saving ? 'Saving…' : 'Save site switch settings'}</button>
    <p className="energy-muted">Settings are shared with this site's users after saving. Admins can edit every site's settings; Super Users can edit only their assigned site's settings. An authorized site session must remain open for the existing automatic header switch to run.</p>
    {shared.error && <p role="alert">{shared.error}</p>}{message && <p role="status">{message}</p>}
  </details></section>;
}
