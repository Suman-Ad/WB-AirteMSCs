import {useEffect, useState} from 'react';
import {doc, onSnapshot} from 'firebase/firestore';
import {db} from '../firebase';
import {siteIdMap} from '../config/siteConfigs';

export function liveSitePower(manual = {}, state = {}, now = Date.now()) {
  if (state.ready && (!state.activation?.enabled || (state.sharedReady && state.shared?.enabled === false))) {
    return {...manual, authority:'manual', powerSource:manual.powerSource || 'Unknown', stale:false};
  }
  const runtime=state.runtime;
  const source=['EB','DG'].includes(runtime?.powerSource) ? runtime.powerSource : 'Unknown';
  const age=ms=>typeof ms === 'number' && now-ms>=-5000 && now-ms<=30000;
  const fresh=state.ready && state.sharedReady && !state.cached && !state.error && runtime?.enabled === true && age(runtime.evaluatedAtMs) && age(runtime.sourceObservedAtMs);
  return {authority:'server', powerSource:fresh ? source : 'Unknown', lastObservedSource:source,
    selectedDG:runtime?.selectedDG || null, stale:!fresh,
    seconds:runtime?.startAtMs ? Math.max(0,Math.floor((now-runtime.startAtMs)/1000)) : 0,
    status:state.error || (!state.ready || !state.sharedReady ? 'Checking live source' : !fresh ? `Waiting for fresh readings · last observed ${source}` : 'Server detector')};
}

export default function useLiveSitePower(siteNames, manual = {}) {
  const key=JSON.stringify([...new Set(siteNames.filter(Boolean))].sort());
  const [snapshots,setSnapshots]=useState({key:null,sites:{}});
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{
    let active=true;
    setSnapshots({key,sites:{}});
    const update=(site,patch)=>{if(active)setSnapshots(previous=>({key,sites:{...previous.sites,[site]:{...previous.sites[site],...patch}}}));};
    const stops=[];
    for(const name of JSON.parse(key)){
      const site=name.toUpperCase();
      const canonical=Object.keys(siteIdMap).find(value=>value.toUpperCase()===site);
      const id=siteIdMap[canonical];
      if(!id){update(site,{ready:true,activation:null});continue;}
      const watch=(path,receive)=>stops.push(onSnapshot(doc(db,'energyMonitor',id,...path),{includeMetadataChanges:true},receive,()=>update(site,{error:'Live source unavailable'})));
      const confirmed=snapshot=>!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites;
      watch(['config','serverPowerSwitch'],snapshot=>update(site,{ready:confirmed(snapshot),activation:snapshot.exists()?snapshot.data():null}));
      watch(['config','powerSwitch'],snapshot=>update(site,{sharedReady:confirmed(snapshot),shared:snapshot.exists()?snapshot.data():null}));
      watch(['runtime','serverPowerSource'],snapshot=>update(site,{runtime:snapshot.exists()?snapshot.data():null,cached:!confirmed(snapshot)}));
    }
    const timer=setInterval(()=>setNow(Date.now()),1000);
    return ()=>{active=false;stops.forEach(stop=>stop());clearInterval(timer);};
  },[key]);
  return Object.fromEntries(JSON.parse(key).map(name=>{
    const site=name.toUpperCase();
    return [site,liveSitePower(manual[site],snapshots.key===key?snapshots.sites[site]:undefined,now)];
  }));
}
