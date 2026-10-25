import {useEffect, useState} from 'react';
import {collection, onSnapshot} from 'firebase/firestore';
import {db} from '../firebase';

export const istDateKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Kolkata', year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(date);
  const part = type => parts.find(p => p.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};
export const shiftDateKey = (date, days) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0,10);
};
export const loadBookKW = entry => {
  const n = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  if (entry.equipmentType === 'SMPS') return n(entry.dcVoltage) * n(entry.dcCurrent) / 1000;
  if (entry.equipmentType === 'UPS') return n(entry.runningKWR) + n(entry.runningKWY) + n(entry.runningKWB);
  const voltage = (n(entry.voltageRY) + n(entry.voltageYB) + n(entry.voltageBR)) / 3;
  const current = (n(entry.currentR) + n(entry.currentY) + n(entry.currentB)) / 3;
  return 1.732 * voltage * current * n(entry.powerFactor ?? 0.9) / 1000;
};
const minutes = value => {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return 0;
  const h = Number(match[1]);
  return (match[3] ? h % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0) : h) * 60 + Number(match[2]);
};
export function subscribeLoadBookDay(siteId, date, receive) {
  let active = true;
  const key = `${siteId}/${date}`;
  receive({key, data:[], loading:true, error:'', cached:false});
  if (!siteId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    receive({key,data:[],loading:false,error:'Select a valid site and date.',cached:false});
    return () => {active = false;};
  }
  const stop = onSnapshot(collection(db,'loadData',siteId,'dailyData',date,'entries'), {includeMetadataChanges:true}, snapshot => {
    if (!active) return;
    const data = snapshot.docs.map(record => {
      const entry = record.data();
      return {...entry,id:record.id,date,loadKW:loadBookKW(entry)};
    }).sort((a,b) => minutes(a.time) - minutes(b.time) || String(a.equipmentId || '').localeCompare(String(b.equipmentId || '')));
    receive({key,data,loading:false,error:'',cached:Boolean(snapshot.metadata?.fromCache)});
  }, error => {
    if (active) receive({key,data:[],loading:false,error:`Unable to load ${date}: ${error.message || error.code || 'Connection failed'}`,cached:false});
  });
  return () => {active=false;stop();};
}
export function useLoadBookDay(siteId, date) {
  const [state, setState] = useState({key:'', data:[], loading:true, error:'', cached:false});
  const key = `${siteId}/${date}`;
  useEffect(() => subscribeLoadBookDay(siteId,date,setState), [siteId,date]);
  return state.key === key ? state : {data:[],loading:true,error:'',cached:false};
}
