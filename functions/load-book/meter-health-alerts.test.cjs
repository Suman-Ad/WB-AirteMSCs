const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const helpers=require('./meter-health-alerts.cjs');
const {health,advance}=helpers;
test('uses the dashboard freshness threshold and error semantics',()=>{
  const now=1000000;
  const meter={status:'OK',observedAt:{toMillis:()=>now-30000}};
  assert.equal(health(meter,now),'healthy');
  assert.equal(health(meter,now+1),'stale reading');
  assert.equal(health({...meter,uploadIntervalSeconds:60},now+10000),'healthy');
  assert.equal(health({...meter,status:'ERROR'},now),'meter error');
  assert.equal(health({...meter,observedAt:null},now),'timestamp unavailable');
  assert.equal(health({...meter,observedAt:{toMillis:()=>now+6000}},now),'timestamp unavailable');
});
test('confirms sustained outages/recovery, resets brief glitches, and does not count duplicate checks',()=>{
  let s=advance(null,'stale reading',100000).state;
  assert.equal(advance(s,'stale reading',100000).event,undefined);
  assert.equal(advance(s,'stale reading',159999).event,undefined);
  s=advance(s,'healthy',160000).state;
  assert.equal(s.state,'online');
  s=advance(s,'meter error',220000).state;
  let result=advance(s,'stale reading',280000);
  assert.equal(result.event,'offline');assert.equal(result.state.sequence,1);
  s=advance(result.state,'healthy',340000).state;
  s=advance(s,'meter error',400000).state;
  s=advance(s,'healthy',460000).state;
  result=advance(s,'healthy',520000);
  assert.equal(result.event,'online');assert.equal(result.state.sequence,2);
});

function harness() {
  let now=1000000;
  const records=new Map([
    ['users/own',{isActive:true,siteId:'ASL'}],['users/admin',{isActive:true,role:'Admin',siteId:'OTHER'}],
    ['users/super',{isActive:true,role:'Super Admin'}],['users/other',{isActive:true,siteId:'OTHER'}],
    ['users/inactive',{isActive:false,siteId:'ASL'}],
    ['energyMonitor/ASL/meters/m',{name:'Main',pointId:'p',status:'OK',observedAt:{toMillis:()=>1}}]
  ]);
  const snap=path=>({id:path.split('/').at(-1),ref:ref(path),exists:records.has(path),data:()=>records.get(path)});
  const ref=path=>({path,get:async()=>snap(path)});
  let before=()=>{};
  const db={doc:ref,collection:path=>({where(){return this;},get:async()=>({docs:[...records.keys()].filter(key=>key.startsWith(path+'/')&&!key.slice(path.length+1).includes('/')).map(snap)})}),runTransaction:async fn=>{
    before();const writes=[];let wrote=false;
    await fn({get:async r=>{assert.equal(wrote,false);return snap(r.path);},set:(r,v)=>{wrote=true;writes.push([r.path,v]);},create:(r,v)=>{wrote=true;assert.equal(records.has(r.path),false);writes.push([r.path,v]);}});
    for(const [path,v] of writes) records.set(path,v);
  }};
  const exports={};
  vm.runInNewContext(fs.readFileSync(__dirname+'/meter-health-alert-functions.cjs','utf8'),{exports,Date:class extends Date {static now(){return now;}},require:name=>({
    'firebase-functions/v2/scheduler':{onSchedule:(_o,fn)=>fn},
    'firebase-admin/firestore':{getFirestore:()=>db,FieldValue:{serverTimestamp:()=> 'server-time'}},
    './telegram-sites.cjs':{Asansol:'ASL'},'./energy-notifications.cjs':require('./energy-notifications.cjs'),'./meter-health-alerts.cjs':helpers
  })[name]});
  return {run:exports.sendMeterHealthAlerts,records,advance:ms=>{now+=ms;},fresh:()=>{const at=now;records.get('energyMonitor/ASL/meters/m').observedAt={toMillis:()=>at};},before:fn=>{before=fn;},notices:()=>[...records].filter(([p])=>p.startsWith('notifications/'))};
}
test('scheduler alerts site users and global admins once, survives deleted notices, and sends recovery',async()=>{
  const app=harness();
  await app.run();assert.equal(app.notices().length,0);
  app.advance(60000);await app.run();
  assert.equal(app.notices().length,3);
  assert.ok(app.notices().every(([p,n])=>/notifications\/(own|admin|super)\//.test(p)&&n.actionType==='energy_meter_offline'&&n.url==='/energy-monitor'));
  for(const [p] of app.notices()) app.records.delete(p);
  app.advance(60000);await app.run();assert.equal(app.notices().length,0);
  app.fresh();await app.run();app.advance(60000);app.fresh();await app.run();
  // The same-instant re-run cannot advance confirmation; one further distinct check is needed.
  app.advance(60000);app.fresh();await app.run();
  assert.equal(app.notices().length,3);
  assert.ok(app.notices().every(([,n])=>n.actionType==='energy_meter_recovered'));
  app.advance(60000);await app.run();app.advance(60000);await app.run();
  assert.equal(app.notices().length,6);
});
test('disabled settings, removed meters and revoked accounts suppress notifications inside transaction',async()=>{
  for(const change of [app=>app.records.set('energyMonitor/ASL/config/notifications',{healthAlertsEnabled:false}),app=>app.records.delete('energyMonitor/ASL/meters/m'),app=>{for(const key of ['own','admin','super']) app.records.get('users/'+key).isActive=false;}]) {
    const app=harness();await app.run();app.advance(60000);
    app.before(()=>change(app));await app.run();assert.equal(app.notices().length,0);
  }
});

test('recovery alerts can be disabled while outage alerts remain active',async()=>{
  const app=harness();app.records.set('energyMonitor/ASL/config/notifications',{recoveryAlertsEnabled:false});
  await app.run();app.advance(60000);await app.run();assert.equal(app.notices().length,3);
  app.advance(60000);app.fresh();await app.run();app.advance(60000);app.fresh();await app.run();
  assert.equal(app.notices().length,3);
  app.records.set('energyMonitor/ASL/config/notifications',{recoveryAlertsEnabled:true});
  app.advance(60000);app.fresh();await app.run();assert.equal(app.notices().length,3);
});
