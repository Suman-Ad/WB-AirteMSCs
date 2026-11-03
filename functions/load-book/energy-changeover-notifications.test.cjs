const {test}=require('node:test');
const assert=require('node:assert/strict');
const {transition,reading,changeoverNotification,changeoverId,eligibleChangeoverUser}=require('./energy-changeover-notifications.cjs');
const at=Date.parse('2026-11-01T23:55:00+05:30');
const sample=(kwh,time=at)=>({kwh,observedAtMs:time,quality:'Captured'});
const run={siteId:'A',siteName:'Site A',dgNumber:'DG-1',meterId:'dg',status:'Running',startAtMs:at,endAtMs:at+600000,opening:sample(100),closing:sample(105,at+600000),ebFailure:{kwh:null,lastKnownKwh:500,lastKnownAtMs:at-10000,quality:'Stale'},ebRestoration:sample(501,at+600000),runSeconds:600,trigger:'Automatic'};
test('only start and restore transitions produce alerts; checkpoints and deletes do not',()=>{
 assert.equal(transition(null,run),'start');assert.equal(transition(run,{...run,status:'Completed'}),'restore');
 assert.equal(transition(null,{...run,status:'Completed'}),'restore');
 for(const [before,after] of [[run,{...run,latest:sample(102)}],[{status:'Completed'},{status:'Completed'}],[run,null]])assert.equal(transition(before,after),null);
});
test('start includes labeled last-known mains and DG opening with timestamps',()=>{
 const n=changeoverNotification(run,'start','A');assert.match(n.message,/500 kWh/);assert.match(n.message,/Last known reading/);assert.match(n.message,/DG start register: 100 kWh/);assert.equal(n.actionType,'energy_dg_start');assert.equal(n.url,'/energy-monitor');
});
test('restoration reports closing, mains return, generation, duration and restoration date',()=>{
 const n=changeoverNotification({...run,status:'Completed'},'restore','A');assert.match(n.message,/DG closing register: 105 kWh/);assert.match(n.message,/DG generation: 5 kWh/);assert.match(n.message,/Run duration: 10 minutes/);assert.equal(n.date,'2026-11-02');
});
test('missing counters, resets and last-valid closing quality are explicit',()=>{
 const reset=changeoverNotification({...run,closing:sample(1)},'restore','A');assert.match(reset.message,/generation: Unavailable/);assert.equal(reset.counterReset,true);
 const missing=changeoverNotification({...run,opening:null},'restore','A');assert.match(missing.message,/DG start register: Unavailable/);assert.match(missing.message,/generation: Unavailable/);
 const fallback=changeoverNotification({...run,closing:{...sample(105),quality:'Last valid reading before restoration'}},'restore','A');assert.match(fallback.message,/Last valid reading before restoration/);
 assert.match(reading('Main',{...sample(900,at+60000)},at),/Unavailable/);
});
test('manual changes retain their source and stable IDs distinguish run, site and phase',()=>{
 assert.match(changeoverNotification({...run,trigger:'Manual'},'start','A').message,/Manual changeover/);
 const id=changeoverId('A','run','start');assert.equal(id,changeoverId('A','run','start'));
 for(const args of [['A','run','restore'],['B','run','start'],['A','other','start']])assert.notEqual(id,changeoverId(...args));
});


test('changeover recipients include active global admins and retain site-only ordinary users',()=>{
 for(const role of ['Admin','Super Admin']) {
  assert.equal(eligibleChangeoverUser({role,isActive:true,siteId:'B'},'A'),true);
  assert.equal(eligibleChangeoverUser({role,isActive:true},'A'),true);
  assert.equal(eligibleChangeoverUser({role,isActive:false},'A'),false);
 }
 assert.equal(eligibleChangeoverUser({role:'User',isActive:true,siteId:'A'},'A'),true);
 for(const role of ['User','Super User','Viewer'])assert.equal(eligibleChangeoverUser({role,isActive:true,siteId:'B'},'A'),false);
 assert.equal(eligibleChangeoverUser({role:'Admin'},'A'),false);
});
