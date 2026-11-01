const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs');
function setup(){
 const records=new Map(Object.entries({'users/own':{siteId:'A',isActive:true},'users/other':{siteId:'B',isActive:true,role:'Admin'},'users/inactive':{siteId:'A',isActive:false}}));
 const snap=path=>({id:path.split('/').at(-1),ref:{path},exists:records.has(path),data:()=>records.get(path)});
 let before=()=>{};let options;
 const db={doc:path=>({path,get:async()=>snap(path)}),collection:path=>({where(){return this;},get:async()=>({docs:[...records.keys()].filter(p=>p.startsWith(path+'/')).map(snap)})}),runTransaction:async fn=>{before();const writes=[];await fn({get:async ref=>snap(ref.path),create:(ref,data)=>writes.push([ref.path,data])});for(const [path,data]of writes){assert.equal(records.has(path),false);records.set(path,data);}}};
 const exports={};vm.runInNewContext(fs.readFileSync(__dirname+'/energy-changeover-functions.cjs','utf8'),{exports,require:name=>({
 'firebase-functions/v2/firestore':{onDocumentWritten:(opts,fn)=>{options=opts;return fn;}},'firebase-admin/firestore':{getFirestore:()=>db,FieldValue:{serverTimestamp:()=> 'now'}},
 './energy-notifications.cjs':require('./energy-notifications.cjs'),'./energy-changeover-notifications.cjs':require('./energy-changeover-notifications.cjs')
 })[name]});
 const at=Date.parse('2026-11-01T10:00:00+05:30');const run={siteId:'A',siteName:'Site A',status:'Running',startAtMs:at,opening:{kwh:100,observedAtMs:at},dgNumber:'DG-1',trigger:'Automatic'};
 const event=(old,next)=>({params:{siteId:'A',runId:'r'},data:{before:{exists:!!old,data:()=>old},after:{exists:!!next,data:()=>next}}});
 return {records,run,event,options,send:exports.notifyEnergyChangeover,setBefore:fn=>{before=fn;}};
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
