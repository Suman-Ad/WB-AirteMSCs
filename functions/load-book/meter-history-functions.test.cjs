const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const model = require('./meter-history.cjs');
const now = Date.parse('2026-11-01T12:00:00+05:30');
function harness(config = {}) {
 const store = new Map([['energyMonitor/site/config/meterHistory', {enabled:true,retentionDays:7,...config}]]);
 const writes = [];
 const snapshot = reference => ({ref:reference,id:reference.path.split('/').at(-1),exists:store.has(reference.path),data:()=>store.get(reference.path)});
 function ref(path) {
  return {path,collection:name=>ref(`${path}/${name}`),doc:id=>ref(`${path}/${id}`),get:async()=> path.split('/').length % 2 === 0 ? snapshot(ref(path)) : queryResult(path),where(field,op,value){return queryRef(path,field,op,value);}};
 }
 function queryResult(path, field, op, value, cap=Infinity) {
  const docs=[...store.entries()].filter(([p,d])=>p.startsWith(path+'/') && p.split('/').length===path.split('/').length+1 && (!field || (op==='<' ? d[field]<value : d[field]===value))).slice(0,cap).map(([p])=>snapshot(ref(p)));
  return {docs,empty:!docs.length,size:docs.length};
 }
 function queryRef(path,field,op,value,cap) {return {limit:n=>queryRef(path,field,op,value,n),get:async()=>queryResult(path,field,op,value,cap)};}
 const db={doc:ref,collection:ref,runTransaction:async fn=>{
  const pending=[];let writing=false;
  const tx={get:async reference=>{assert.equal(writing,false,'all transaction reads must precede writes');return snapshot(reference);},set:(r,d,o)=>{writing=true;pending.push(['set',r,d,o]);},update:(r,d)=>{writing=true;pending.push(['set',r,d,{merge:true}]);},create:(r,d)=>{writing=true;assert.equal(store.has(r.path),false,'duplicate sample');pending.push(['set',r,d]);}};
  await fn(tx); pending.forEach(([kind,r,d,o])=>{store.set(r.path,o?.merge?{...store.get(r.path),...d}:d);writes.push({path:r.path,data:d});});
 },batch:()=>{const paths=[];return {delete:r=>paths.push(r.path),commit:async()=>paths.forEach(p=>store.delete(p))};}};
 const exports={};
 vm.runInNewContext(fs.readFileSync(require.resolve('./meter-history-functions.cjs'),'utf8'),{exports,Date:class extends Date{static now(){return now;}},require(name){
  if(name==='firebase-functions/v2/firestore')return {onDocumentWritten:(_options,fn)=>fn};
  if(name==='firebase-functions/v2/scheduler')return {onSchedule:(_options,fn)=>fn};
  if(name==='firebase-admin/firestore')return {getFirestore:()=>db,FieldValue:{serverTimestamp:()=> 'server-time'}};
  if(name==='./meter-history.cjs')return model;
  throw Error(name);
 }});
 async function capture(kwh, iso, extra={}) {
  const ms=Date.parse(iso);
  return exports.captureMeterHistory({time:new Date(ms).toISOString(),params:{siteId:'site',meterId:'meter-1'},data:{after:{exists:true,data:()=>({name:'Main',status:'OK',fwd_Wh:kwh*1000,powerUnits:'base',observedAt:{toMillis:()=>ms},...extra})}}});
 }
 return {store,writes,capture,prune:exports.pruneMeterHistory};
}
const key=model.meterIdentity({name:'Main'},'meter-1');
const day=date=>`energyMonitor/site/dailyReadings/${date}__${key}`;
test('trigger retries are idempotent, minute checkpoints are bounded and history samples are 15-minute buckets',async()=>{
 const h=harness();await h.capture(100,'2026-11-01T00:00:00+05:30');const count=h.writes.length;
 await h.capture(100,'2026-11-01T00:00:00+05:30');await h.capture(101,'2026-11-01T00:00:30+05:30');assert.equal(h.writes.length,count);
 await h.capture(102,'2026-11-01T00:01:01+05:30');assert.equal(h.store.get(day('2026-11-01')).closingKwh,102);
 assert.equal([...h.store.keys()].filter(p=>p.includes('/samples/')).length,1);
 await h.capture(110,'2026-11-01T00:16:00+05:30');assert.equal([...h.store.keys()].filter(p=>p.includes('/samples/')).length,2);
 assert.equal(h.store.get(day('2026-11-01')).captureCount,3);
});
test('midnight rollover and delayed previous-day closing stay synchronized',async()=>{
 const h=harness();await h.capture(100,'2026-10-31T23:58:00+05:30');await h.capture(110,'2026-11-01T00:00:10+05:30');
 assert.equal(h.store.get(day('2026-11-01')).openingKwh,100);
 await h.capture(105,'2026-10-31T23:59:20+05:30');
 assert.equal(h.store.get(day('2026-10-31')).closingKwh,105);assert.equal(h.store.get(day('2026-11-01')).openingKwh,105);
 await h.capture(112,'2026-11-01T00:01:20+05:30');assert.equal(h.store.get(day('2026-11-01')).openingKwh,105);
});
test('immediate counter reset is recorded even inside checkpoint interval',async()=>{
 const h=harness();await h.capture(100,'2026-11-01T00:00:00+05:30');await h.capture(2,'2026-11-01T00:00:05+05:30');
 assert.equal(h.store.get(day('2026-11-01')).closingKwh,2);assert.equal(h.store.get(day('2026-11-01')).counterReset,true);
});
test('paused settings, errors and expired delayed events create no history',async()=>{
 const paused=harness({enabled:false});await paused.capture(100,'2026-11-01T00:00:00+05:30');assert.equal(paused.writes.length,0);
 const h=harness();await h.capture(100,'2026-11-01T00:00:00+05:30',{status:'ERROR'});await h.capture(100,'2026-10-01T00:00:00+05:30');assert.equal(h.writes.length,0);
});
test('retention cleanup uses current settings and preserves cutoff day and other collections',async()=>{
 const h=harness({enabled:false});h.store.set('energyMonitor/site',{meterHistoryVersion:1});h.store.set(`energyMonitor/site/historyMeters/${key}`,{meterKey:key});
 h.store.set(day('2026-10-25'),{date:'2026-10-25'});h.store.set(day('2026-10-26'),{date:'2026-10-26'});
 const samplePath=`energyMonitor/site/historyMeters/${key}/samples/old`;
 h.store.set(samplePath,{date:'2026-10-25'});h.store.set('dailyDGLogs/site/2026-10/manual',{date:'2026-10-01'});
 await h.prune();assert.equal(h.store.has(day('2026-10-25')),false);assert.equal(h.store.has(samplePath),false);assert.equal(h.store.has(day('2026-10-26')),true);assert.equal(h.store.has('dailyDGLogs/site/2026-10/manual'),true);
});

test('an out-of-order counter reset is not hidden by a later recovered closing',async()=>{
 const h=harness();await h.capture(100,'2026-11-01T00:00:00+05:30');await h.capture(130,'2026-11-01T00:03:00+05:30');
 await h.capture(2,'2026-11-01T00:01:00+05:30');
 assert.equal(h.store.get(day('2026-11-01')).closingKwh,130);assert.equal(h.store.get(day('2026-11-01')).counterReset,true);
});
