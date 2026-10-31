import React, {useCallback, useEffect, useState} from 'react';
import {collection, onSnapshot} from 'firebase/firestore';
import {db} from '../firebase';
import {siteIdMap} from '../config/siteConfigs';
import {currentEnergyMeters} from '../pages/currentEnergyMeters';
import {displayReading} from '../pages/energyMeterData';
import {meterHealth} from '../pages/meterHealth';
import MeterStatus from '../pages/MeterStatus';

export function configuredMeterSites(configs) {
  const known=Object.entries(siteIdMap);
  const sites=new Map();
  Object.entries(configs).forEach(([key,config])=>{
    const names=[key,config.siteName,config.site].filter(value=>typeof value === 'string').map(value=>value.trim().toLowerCase());
    const match=known.find(([label])=>names.includes(label.toLowerCase()));
    if (!match) return;
    const [name,id]=match;
    if (!id || id.includes('/')) return;
    if (!sites.has(id)) sites.set(id,{id,name});
  });
  return [...sites.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
const reading=(meter,key)=>{
  const value=displayReading(meter,key).value;
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '—';
};
const phaseReading=(meter,key)=><div className="live-meter-phases">{['R','Y','B'].map(phase=><span key={phase}>{phase}: {reading(meter,`${phase}_${key}`)}</span>)}</div>;

function SiteLiveMeters({site,now,state,liveMeters}) {
  if (state.error) return <p role="alert">{state.error}</p>;
  if (state.loading) return <p role="status">Connecting to {site.name} meters…</p>;
  if (!state.meters.length) return <p role="status">Waiting for connected meter records…</p>;
  return <>
    <p className="live-meter-note">Showing all {state.meters.length} registered meters · {liveMeters.length} live · {state.meters.length-liveMeters.length} not live{state.cached ? ' · Cached / reconnecting; values are last known readings' : ' · Offline values are last known readings'}</p>
    <div className="live-meter-table-wrap"><table className="live-meter-table" aria-label={`${site.name} live meter readings`}>
      <thead><tr>{['Meter','Status','kW','kVA','kvar','kWh','L-L voltage (V)','L-N voltage (V)','Current (A)','Power factor','Frequency (Hz)','Observed (IST)'].map(label=><th key={label}>{label}</th>)}</tr></thead>
      <tbody>{state.meters.map(meter=>{
        const time=meter.observedAt?.toMillis?.();
        const health=meterHealth(meter,now,state.cached);
        const status=state.cached ? health : health === 'Live' ? 'Live' : 'Offline';
        return <tr key={meter.id}>
          <td><strong>{meter.name || meter.id}</strong><small className="live-meter-id">{meter.id}</small></td>
          <td title={health}><MeterStatus state={status}/></td>
          <td>{reading(meter,'active_power')}</td><td>{reading(meter,'apparent_power')}</td><td>{reading(meter,'reactive_power')}</td><td>{reading(meter,'fwd_Wh')}</td>
          <td>{phaseReading(meter,'voltage_ll')}</td><td>{phaseReading(meter,'voltage_ln')}</td><td>{phaseReading(meter,'current')}</td>
          <td>{reading(meter,'power_factor')}</td><td>{reading(meter,'frequency')}</td>
          <td>{Number.isFinite(time) && time > 0 ? new Date(time).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',hour12:false}) : 'No timestamp'}</td>
        </tr>;
      })}</tbody>
    </table></div>
  </>;
}

function SiteMeterPanel({site,now,defaultOpen,onAvailability}) {
  const [open,setOpen]=useState(defaultOpen);
  const [state,setState]=useState({meters:[],loading:true,error:'',cached:false});
  useEffect(()=>{
    let active=true;
    // Keep the subscription active when collapsed so the header stays live.
    const stop=onSnapshot(collection(db,'energyMonitor',site.id,'meters'),{includeMetadataChanges:true},snapshot=>{
      if (!active) return;
      const meters=currentEnergyMeters(snapshot.docs.map(record=>({...record.data(),id:record.id}))).meters;
      const cached=Boolean(snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites);
      setState({meters,loading:false,error:'',cached});
      onAvailability(site.id,cached ? null : meters.length);
    },error=>{
      if (!active) return;
      setState({meters:[],loading:false,error:`Cannot read ${site.name} meters: ${error.message || error.code}`,cached:false});
      onAvailability(site.id,null);
    });
    return ()=>{active=false;stop();};
  },[site.id,site.name,onAvailability]);
  if (!state.loading && !state.error && !state.cached && !state.meters.length) return null;
  const liveMeters=state.meters.filter(meter=>meterHealth(meter,now,state.cached)==='Live');
  const offline=state.meters.length-liveMeters.length;
  const panelId=`live-meters-${encodeURIComponent(site.id)}`;
  return <section className="live-meter-site">
    <button type="button" className="live-meter-site-toggle" aria-expanded={open} aria-controls={panelId} onClick={()=>setOpen(value=>!value)}>
      <span>{site.name} · {site.id}</span>
      <span className="live-meter-summary" aria-label={`${site.name} meter status`}>
        {state.loading ? 'Checking meters…' : state.error ? 'Unavailable' : state.cached ? 'Reconnecting' : <>
          <span className="live-meter-count-live">Live: {liveMeters.length}</span>
          <span className="live-meter-count-offline">Offline: {offline}</span>
        </>}
      </span>
      <span>{open ? 'Hide readings' : 'View live readings'}</span>
    </button>
    {open && <div id={panelId}><SiteLiveMeters site={site} now={now} state={state} liveMeters={liveMeters}/></div>}
  </section>;
}
export default function AllSitesLiveMeters({siteConfigs,userSiteId,loading}) {
  const sites=configuredMeterSites(siteConfigs);
  const [now,setNow]=useState(Date.now());
  const [availability,setAvailability]=useState({});
  const reportAvailability=useCallback((id,count)=>setAvailability(previous=>previous[id] === count ? previous : {...previous,[id]:count}),[]);
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return ()=>clearInterval(timer);},[]);
  return <section className="all-sites-live-meters" aria-label="Site-wise live meter readings">
    <h2>Live Meter Readings · All Sites</h2>
    <p className="live-meter-note">Expanded tables show all registered meters, including offline meters. Site headers keep Live/Offline counts when collapsed; sites with no meter records are hidden. Readings are read-only and independent of the selected log month.</p>
    {!loading && sites.length > 0 && sites.every(site=>availability[site.id] === 0) && <p>No registered meter readings found for configured sites.</p>}
    {loading ? <p role="status">Loading meter sites…</p> : !sites.length ? <p>No meter site IDs are configured.</p> : sites.map(site=><SiteMeterPanel key={site.id} site={site} now={now} defaultOpen={site.id === userSiteId} onAvailability={reportAvailability}/>)}
  </section>;
}
