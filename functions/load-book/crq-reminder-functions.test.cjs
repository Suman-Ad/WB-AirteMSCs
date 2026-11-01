const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const helpers = require('./crq-reminders.cjs');
function setup() {
  let now=Date.parse('2026-11-01T10:30:00+05:30');
  const records=new Map();
  const sheet={date:'2026-11-01',siteId:'ASL',rows:[{rowId:'r',crqNo:'CRQ1',activityStartTime:'10:00',activityEndTime:'11:00'}]};
  const users={own:{isActive:true,siteId:'ASL'},other:{isActive:true,siteId:'OTHER'},admin:{isActive:true,role:'Admin'},inactive:{isActive:false,siteId:'ASL'}};
  records.set('daily_activity_sheets/s',sheet);
  for(const [id,user] of Object.entries(users)) records.set('users/'+id,user);
  const snap=path=>{const value=records.get(path);return {id:path.split('/').at(-1),ref:{path},exists:records.has(path),data:()=>value};};
  let beforeTransaction=()=>{};
  const db={doc:path=>({path}),collection:name=>({where(){return this;},get:async()=>({docs:name==='users'?Object.keys(users).map(id=>snap('users/'+id)):[snap('daily_activity_sheets/s')]})}),
    runTransaction:async fn=>{beforeTransaction(); const writes=[];await fn({get:async ref=>snap(ref.path),create:(ref,data)=>writes.push([ref.path,data])});for(const [path,data] of writes) {assert.equal(records.has(path),false);records.set(path,data);}}};
  const exports={};let options;
  vm.runInNewContext(fs.readFileSync(__dirname+'/crq-reminder-functions.cjs','utf8'),{exports,Date:class extends Date {static now(){return now;}},require:name=>({
    'firebase-functions/v2/scheduler':{onSchedule:(config,fn)=>{options=config;return fn;}},
    'firebase-admin/firestore':{getFirestore:()=>db,FieldValue:{serverTimestamp:()=> 'server-time'}},
    './crq-reminders.cjs':helpers,
  })[name]});
  return {run:exports.sendCRQReminders,records,sheet,options,setBefore:fn=>{beforeTransaction=fn;}};
}
test('scheduler creates bell records for site users/admins once across repeated runs',async()=>{
 const app=setup();assert.equal(app.options.schedule,'every 1 minutes');
 await app.run();await app.run();
 const notices=[...app.records.entries()].filter(([path])=>path.startsWith('notifications/'));
 assert.equal(notices.length,4);
 assert.ok(notices.every(([path,n])=>(path.startsWith('notifications/own/')||path.startsWith('notifications/admin/'))&&n.createdAt==='server-time'&&n.url==='/daily-activity-dashboard'));
});
test('transaction rechecks completion/deletion and recipient deactivation',async()=>{
 for(const change of [app=>{app.sheet.rows[0].pmStatus='Completed';},app=>app.records.delete('daily_activity_sheets/s'),app=>{app.records.get('users/own').isActive=false;app.records.get('users/admin').isActive=false;}]) {
  const app=setup();app.setBefore(()=>change(app));await app.run();
  assert.equal([...app.records.keys()].filter(path=>path.startsWith('notifications/')).length,0);
 }
});

test('deleting a bell item does not replay the reminder',async()=>{
 const app=setup();await app.run();
 const paths=[...app.records.keys()].filter(path=>path.startsWith('notifications/'));
 for(const path of paths) app.records.delete(path);
 await app.run();
 assert.equal([...app.records.keys()].filter(path=>path.startsWith('notifications/')).length,0);
 assert.equal([...app.records.keys()].filter(path=>path.includes('/crqReminders/')).length,4);
});
