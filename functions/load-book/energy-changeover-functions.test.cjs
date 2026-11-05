const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs');
function setup(){
 const records=new Map(Object.entries({'users/own':{siteId:'A',isActive:true},'users/other':{siteId:'B',isActive:true,role:'User'},'users/inactive':{siteId:'A',isActive:false}}));
 const snap=path=>({id:path.split('/').at(-1),ref:{path},exists:records.has(path),data:()=>records.get(path)});
 let before=()=>{};let options;
 const db={doc:path=>({path,get:async()=>snap(path)}),collection:path=>({filters:[],where(field,op,value){this.filters.push([field,value]);return this;},async get(){return {docs:[...records.keys()].filter(p=>p.startsWith(path+'/')).map(snap).filter(doc=>this.filters.every(([field,value])=>doc.data()[field]===value))};}}),runTransaction:async fn=>{before();const writes=[];const result=await fn({get:async ref=>snap(ref.path),create:(ref,data)=>writes.push([ref.path,data])});for(const [path,data]of writes){assert.equal(records.has(path),false);records.set(path,data);}return result;}};
 const exports={};vm.runInNewContext(fs.readFileSync(__dirname+'/energy-changeover-functions.cjs','utf8'),{exports,require:name=>({
 'firebase-functions/v2/firestore':{onDocumentWritten:(opts,fn)=>{options=opts;return fn;}},'firebase-admin/firestore':{getFirestore:()=>db,FieldValue:{serverTimestamp:()=> 'now'}},
 './energy-changeover-fuel.cjs':require('./energy-changeover-fuel.cjs'),'./energy-notifications.cjs':require('./energy-notifications.cjs'),'./energy-changeover-notifications.cjs':require('./energy-changeover-notifications.cjs')
 })[name]});
 const at=Date.parse('2026-11-01T10:00:00+05:30');const run={siteId:'A',siteName:'Site A',status:'Running',startAtMs:at,opening:{kwh:100,observedAtMs:at},dgNumber:'DG-1',trigger:'Automatic'};
 const event=(old,next)=>({params:{siteId:'A',runId:'r'},data:{before:{exists:!!old,data:()=>old},after:{exists:!!next,data:()=>next}}});
 return {records,run,event,options,send:exports.notifyEnergyChangeover,sendServer:exports.notifyServerEnergyChangeover,setBefore:fn=>{before=fn;}};
}
test('start and stop alert only site users, once per phase; deleted bells are not replayed',async()=>{
 const app=setup();assert.equal(app.options.retry,true);
 const start=app.event(null,app.run);await app.send(start);await app.send(start);
 let notices=[...app.records.entries()].filter(([p])=>p.startsWith('notifications/'));assert.equal(notices.length,1);assert.ok(notices[0][0].startsWith('notifications/own/'));
 app.records.delete(notices[0][0]);await app.send(start);assert.equal([...app.records.keys()].filter(p=>p.startsWith('notifications/')).length,0);
 const completed={...app.run,status:'Completed',endAtMs:app.run.startAtMs+60000,closing:{kwh:101,observedAtMs:app.run.startAtMs+60000}};
 await app.send(app.event(app.run,completed));await app.send(app.event(app.run,completed));
 notices=[...app.records.entries()].filter(([p])=>p.startsWith('notifications/'));assert.equal(notices.length,1);assert.equal(notices[0][1].actionType,'energy_mains_restored');
});
test('checkpoint, deletion and mismatched site do not notify',async()=>{
 const app=setup();for(const e of [app.event(app.run,{...app.run,latest:{kwh:101}}),app.event(app.run,null),app.event(null,{...app.run,siteId:'B'})])await app.send(e);
 assert.equal([...app.records.keys()].filter(p=>p.startsWith('notifications/')).length,0);
});
test('changeover setting is independent, opt-out and changed memberships are rechecked',async()=>{
 for(const change of [a=>a.records.set('energyMonitor/A/config/notifications',{changeoverEnabled:false}),a=>{a.records.get('users/own').isActive=false;},a=>{a.records.get('users/own').siteId='B';}]){
  const app=setup();app.setBefore(()=>change(app));await app.send(app.event(null,app.run));assert.equal([...app.records.keys()].filter(p=>p.startsWith('notifications/')).length,0);
 }
 const app=setup();app.records.set('energyMonitor/A/config/notifications',{enabled:false,dailyEnabled:false,changeoverEnabled:true});await app.send(app.event(null,app.run));assert.equal([...app.records.keys()].filter(p=>p.startsWith('notifications/')).length,1);
});
test('late start event still retains opening snapshot after completion alert',async()=>{
 const app=setup();await app.send(app.event(app.run,{...app.run,status:'Completed',closing:{kwh:102},endAtMs:app.run.startAtMs+60000}));await app.send(app.event(null,app.run));
 const notices=[...app.records.entries()].filter(([p])=>p.startsWith('notifications/'));assert.equal(notices.length,2);assert.ok(notices.some(([,n])=>n.actionType==='energy_dg_start'&&n.message.includes('100 kWh')));
});


test('captured start and restore readings go to own-site users plus all active admins once',async()=>{
 const app=setup();
 app.records.get('users/own').role='Admin';
 app.records.set('users/global-admin',{siteId:'B',isActive:true,role:'Admin'});
 app.records.set('users/global-super',{isActive:true,role:'Super Admin'});
 app.records.set('users/inactive-admin',{siteId:'B',isActive:false,role:'Admin'});
 const start=app.event(null,app.run);
 const completed={...app.run,status:'Completed',endAtMs:app.run.startAtMs+60000,closing:{kwh:101,observedAtMs:app.run.startAtMs+60000},ebRestoration:{kwh:501,observedAtMs:app.run.startAtMs+60000}};
 const restore=app.event(app.run,completed);
 for(const event of [start,start,restore,restore])await app.send(event);
 const notices=[...app.records.entries()].filter(([p])=>p.startsWith('notifications/'));
 assert.equal(notices.length,6);
 for(const uid of ['own','global-admin','global-super']){
  const messages=notices.filter(([path])=>path.startsWith(`notifications/${uid}/`)).map(([,n])=>n);
  assert.equal(messages.length,2);
  assert.ok(messages.some(n=>n.title==='EB-DG: DG Start'&&n.message.includes('DG start register: 100 kWh')));
  assert.ok(messages.some(n=>n.title==='DG-EB: Mains Restore'&&n.message.includes('DG closing register: 101 kWh')&&n.message.includes('Mains restored register: 501 kWh')));
 }
});

test('cross-site admin eligibility is rechecked after demotion or deactivation',async()=>{
 for(const patch of [{role:'User'},{isActive:false}]){
  const app=setup();app.records.set('users/admin',{siteId:'B',isActive:true,role:'Admin'});
  app.setBefore(()=>Object.assign(app.records.get('users/admin'),patch));
  await app.send(app.event(null,app.run));
  assert.equal([...app.records.keys()].filter(p=>p.startsWith('notifications/admin/')).length,0);
 }
});


test('fuel stock is captured once per phase and is the same for admins and site users',async()=>{
 const app=setup();app.records.set('siteConfigs/SITE A',{dgCount:2,designCph:{'DG-1':20,'DG-2':10}});
 const path='dailyDGLogs/Site A/2026-11/2026-11-01';
 app.records.set(path,{Date:'2026-11-01','DG-1 Fuel Closing':100,'DG-1 External Fuel Stock':300,'DG-2 Fuel Closing':50,'DG-2 External Fuel Stock':50});
 app.records.set('users/admin',{isActive:true,role:'Admin',siteId:'B'});
 const start=app.event(null,app.run);await app.send(start);
 const messages=[...app.records.entries()].filter(([p])=>p.startsWith('notifications/')).map(([,n])=>n.message);
 assert.equal(messages.length,2);assert.equal(messages[0],messages[1]);
 assert.match(messages[0],/DG-1: Day tank 100 L \| External tank 300 L \| Est. backup 20 h/);
 app.records.get(path)['DG-1 Fuel Closing']=999;
 app.records.set('users/new-admin',{isActive:true,role:'Admin'});await app.send(start);
 const next=[...app.records.entries()].find(([p])=>p.startsWith('notifications/new-admin/'))[1];
 assert.equal(next.message,messages[0]);
 const completed={...app.run,status:'Completed',endAtMs:app.run.startAtMs+60000};await app.send(app.event(app.run,completed));
 const restore=[...app.records.entries()].find(([p,n])=>p.startsWith('notifications/own/')&&n.actionType==='energy_mains_restored')[1];
 assert.match(restore.message,/DG-1: Day tank 999 L/);
});


test('server runs produce one start and restoration bell for Telegram delivery without browser sessions',async()=>{
 const app=setup();
 await app.sendServer(app.event(null,app.run));await app.sendServer(app.event(null,app.run));
 const complete={...app.run,status:'Completed',endAtMs:app.run.startAtMs+60000,closing:{kwh:102,observedAtMs:app.run.startAtMs+60000}};
 await app.sendServer(app.event(app.run,complete));await app.sendServer(app.event(app.run,complete));
 const notices=[...app.records.entries()].filter(([p])=>p.startsWith('notifications/'));
 assert.equal(notices.length,2);
 assert.ok(notices.some(([,n])=>n.actionType==='energy_dg_start'));
 assert.ok(notices.some(([,n])=>n.actionType==='energy_mains_restored'));
});
