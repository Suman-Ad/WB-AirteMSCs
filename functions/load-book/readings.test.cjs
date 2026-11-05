const {test} = require('node:test');
const assert = require('node:assert/strict');
const {buildEntry} = require('./readings.cjs');
const at = Date.parse('2026-10-23T02:30:10Z');
const meter = () => ({status:'OK',observedAt:{toMillis:()=>at},R_voltage_ll:415,Y_voltage_ll:416,B_voltage_ll:414,R_voltage_ln:240,Y_voltage_ln:241,B_voltage_ln:239,R_current:0,Y_current:10,B_current:20,power_factor:0.95,fwd_Wh:123456});
test('IST slot and base counter conversion, preserves zero current',()=>{
 const entry=buildEntry(meter(),at); assert.equal(entry.time,'08:00'); assert.equal(entry.date,'2026-10-23'); assert.equal(entry.kwh,'123.456'); assert.equal(entry.currentR,'0'); assert.equal(entry.tempR,'');
});
test('rejects stale, future, failed and incomplete readings',()=>{
 assert.equal(buildEntry(meter(),at+120001),null); assert.equal(buildEntry(meter(),at-6000),null);
 assert.equal(buildEntry({...meter(),status:'ERROR'},at),null); assert.equal(buildEntry({...meter(),Y_current:null},at),null);
});
test('does not fabricate prior slots and handles IST midnight',()=>{
 const late=Date.parse('2026-10-23T02:35:00Z'); assert.equal(buildEntry({...meter(),observedAt:{toMillis:()=>late}},late),null);
 const midnight=Date.parse('2026-10-22T18:30:10Z'); const result=buildEntry({...meter(),observedAt:{toMillis:()=>midnight}},midnight);
 assert.equal(result.date,'2026-10-23'); assert.equal(result.time,'00:00');
});
test('already scaled energy and invalid values',()=>{
 assert.equal(buildEntry({...meter(),energyUnits:'kWh'},at).kwh,'123456');
 assert.equal(buildEntry({...meter(),fwd_Wh:NaN},at),null); assert.equal(buildEntry({...meter(),power_factor:1.1},at),null);
});
const fs = require('node:fs');
const vm = require('node:vm');
function harness(existing=false) {
 const writes=[];
 const entries={where(){return this;},doc(id){return {id};}};
 const tx={get:async ref=>ref===entries ? {empty:!existing} : {data:()=>({enabled:true,lt1MeterId:'m1',lt2MeterId:'m2',siteName:'Site'})},create:(ref,data)=>writes.push({ref,data})};
 const db={doc:()=>({}),collection:()=>entries,runTransaction:fn=>fn(tx)};
 const exports={};
 vm.runInNewContext(fs.readFileSync(require.resolve('./index.js'),'utf8'),{exports, require(name){
  if(name==='firebase-functions/v2/firestore') return {onDocumentWritten:(_opts,fn)=>fn};
  if(name==='firebase-admin/app') return {initializeApp(){}};
  if(name==='firebase-admin/firestore') return {getFirestore:()=>db,FieldValue:{serverTimestamp:()=> 'server-time'}};
  if(name==='./readings.cjs') return {buildEntry};
  if(name==='./meter-history-functions.cjs' || name==='./crq-reminder-functions.cjs' || name==='./server-run-history-functions.cjs' || name==='./server-power-functions.cjs' || name==='./meter-health-alert-functions.cjs') return {};
  if(name==='./energy-cooldown-functions.cjs' || name==='./energy-changeover-functions.cjs' || name==='./energy-notification-functions.cjs' || name==='./notification-functions.cjs' || name==='./telegram-functions.cjs') return {};
  throw Error(name);
 }});
 return {writes,run:exports.autoSaveLTLoadBook};
}
test('each mapped meter saves to its own panel; repeats preserve existing entry',async()=>{
 for (const [id,panel] of [['m1','LT Panel-1'],['m2','LT Panel-2']]) {
  const h=harness(); await h.run({time:new Date(at).toISOString(),params:{siteId:'site',meterId:id},data:{after:{exists:true,data:meter}}});
  assert.equal(h.writes.length,1); assert.equal(h.writes[0].data.equipmentId,panel); assert.equal(h.writes[0].data.meterId,id);
 }
 const h=harness(true); await h.run({time:new Date(at).toISOString(),params:{siteId:'site',meterId:'m1'},data:{after:{exists:true,data:meter}}}); assert.equal(h.writes.length,0);
 const other=harness(); await other.run({time:new Date(at).toISOString(),params:{siteId:'site',meterId:'other'},data:{after:{exists:true,data:meter}}}); assert.equal(other.writes.length,0);
});
