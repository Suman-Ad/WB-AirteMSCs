const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const helpers = require('./energy-notifications.cjs');
function setup() {
 const now=Date.parse('2026-11-01T02:00:00+05:30'), records=new Map();
 for(const [id,data] of Object.entries({own:{siteId:'A',site:'Site A',isActive:true},other:{siteId:'B',role:'Admin',isActive:true},inactive:{siteId:'A',isActive:false}})) records.set('users/'+id,data);
 records.set('energyMonitor/A/meters/m',{name:'Main',status:'OK',fwd_Wh:1000,observedAt:{toMillis:()=>now}});
 const snap=path=>({id:path.split('/').at(-1),ref:{path},exists:records.has(path),data:()=>records.get(path)});
 const list=prefix=>[...records.keys()].filter(p=>p.startsWith(prefix+'/')&&!p.slice(prefix.length+1).includes('/')).map(snap);
 let before=()=>{};
 const db={doc:path=>({path,get:async()=>snap(path)}),collection:path=>{let filter=()=>true;return {where(field,op,value){filter=d=>d.data()[field]===value;return this;},get:async()=>({docs:list(path).filter(filter)})}},runTransaction:async fn=>{before();const writes=[];await fn({get:async ref=>snap(ref.path),create:(ref,data)=>writes.push([ref.path,data])});for(const [path,data] of writes){assert.equal(records.has(path),false);records.set(path,data);}}};
 const exports={};vm.runInNewContext(fs.readFileSync(__dirname+'/energy-notification-functions.cjs','utf8'),{exports,Date:class extends Date{static now(){return now;}},require:name=>({
 'firebase-functions/v2/scheduler':{onSchedule:(_options,fn)=>fn},'firebase-admin/firestore':{getFirestore:()=>db,FieldValue:{serverTimestamp:()=> 'server-time'}},'./energy-notifications.cjs':helpers,'./meter-history.cjs':require('./meter-history.cjs'),'./energy-daily-notifications.cjs':require('./energy-daily-notifications.cjs')
 })[name]});
 return {records,runDaily:exports.sendDailyEnergyReadings,run:exports.sendEnergyMeterUpdates,setBefore:fn=>{before=fn;}};
}
test('scheduler delivers only to active site users; repeats and deleted bell items are deduplicated',async()=>{
 const app=setup();await app.run();await app.run();
 const notices=[...app.records.entries()].filter(([p])=>p.startsWith('notifications/'));
 assert.equal(notices.length,1);assert.ok(notices[0][0].startsWith('notifications/own/'));assert.equal(notices[0][1].actionType,'energy_meter_update');
 app.records.delete(notices[0][0]);await app.run();assert.equal([...app.records.keys()].filter(p=>p.startsWith('notifications/')).length,0);
});
test('disabled config prevents delivery',async()=>{const app=setup();app.records.set('energyMonitor/A/config/notifications',{enabled:false});await app.run();assert.equal([...app.records.keys()].filter(p=>p.startsWith('notifications/')).length,0);});
test('transaction rechecks site transfer, opt out, and meter deletion',async()=>{
 for(const change of [a=>{a.records.get('users/own').siteId='B';},a=>a.records.set('energyMonitor/A/config/notifications',{enabled:false}),a=>a.records.delete('energyMonitor/A/meters/m')]){
  const app=setup();app.setBefore(()=>change(app));await app.run();assert.equal([...app.records.keys()].filter(p=>p.startsWith('notifications/')).length,0);
 }
});

test('midnight report uses previous IST day, site-only recipients and persistent duplicate claims',async()=>{
 const app=setup();
 const date='2026-10-31', key='name%3Amain';
 app.records.set(`energyMonitor/A/dailyReadings/${date}__${key}`,{date,meterKey:key,meterId:'m',meterName:'Main',openingKwh:100,closingKwh:125,firstAtMs:Date.parse(date+'T00:01:00+05:30'),lastAtMs:Date.parse(date+'T23:59:00+05:30'),openingSource:'first-captured-reading'});
 await app.runDaily({scheduleTime:'2026-10-31T18:30:00Z'});await app.runDaily({scheduleTime:'2026-10-31T18:30:00Z'});
 const notices=[...app.records.entries()].filter(([p])=>p.startsWith('notifications/'));
 assert.equal(notices.length,1);assert.ok(notices[0][0].startsWith('notifications/own/'));
 assert.equal(notices[0][1].date,date);assert.equal(notices[0][1].actionType,'energy_daily_kwh');assert.match(notices[0][1].message,/25 kWh/);
 app.records.delete(notices[0][0]);await app.runDaily({scheduleTime:'2026-10-31T18:30:00Z'});
 assert.equal([...app.records.keys()].filter(p=>p.startsWith('notifications/')).length,0);
});
test('daily toggle is independent of periodic toggle and missing records are explicit',async()=>{
 const app=setup();app.records.set('energyMonitor/A/config/notifications',{enabled:false,dailyEnabled:true});
 await app.runDaily();
 const notice=[...app.records.entries()].find(([p])=>p.startsWith('notifications/'))[1];
 assert.equal(notice.incompleteCoverage,true);assert.match(notice.message,/Opening: Unavailable/);
 const disabled=setup();disabled.records.set('energyMonitor/A/config/notifications',{dailyEnabled:false});await disabled.runDaily();
 assert.equal([...disabled.records.keys()].filter(p=>p.startsWith('notifications/')).length,0);
});
test('daily transaction rechecks recipient membership and daily opt out',async()=>{
 for(const change of [a=>{a.records.get('users/own').isActive=false;},a=>{a.records.get('users/own').siteId='B';},a=>a.records.set('energyMonitor/A/config/notifications',{dailyEnabled:false})]) {
  const app=setup();app.setBefore(()=>change(app));await app.runDaily();assert.equal([...app.records.keys()].filter(p=>p.startsWith('notifications/')).length,0);
 }
});
test('removed meters with daily registers are still reported',async()=>{
 const app=setup();app.records.delete('energyMonitor/A/meters/m');
 app.records.set('energyMonitor/A/dailyReadings/2026-10-31__point%3A1',{date:'2026-10-31',meterKey:'point%3A1',meterName:'Removed meter',meterId:'old',openingKwh:1,closingKwh:2});
 await app.runDaily();assert.equal([...app.records.keys()].filter(p=>p.startsWith('notifications/')).length,1);
});
