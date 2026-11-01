const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(){
 const store=new Map([['energyChangeovers/A/runs/r',{siteName:'Site A',meterId:'dg2',status:'Completed',cooldownStatus:'Cooling',cooldownStartAtMs:100000}],['sitePowerStatus/Site A',{powerSource:'EB'}]]);
 const snap=path=>({id:path.split('/').at(-1),ref:{path},exists:store.has(path),data:()=>store.get(path)});
 let writes=0;
 const db={doc:path=>({path}),collection:path=>({where(){return this;},get:async()=>({docs:[...store.keys()].filter(p=>p.startsWith(path+'/')&&store.get(p).cooldownStatus==='Cooling').map(snap)})}),runTransaction:async fn=>fn({get:async ref=>snap(ref.path),set:(ref,data)=>{writes++;store.set(ref.path,{...store.get(ref.path),...data});}})};
 const exports={};vm.runInNewContext(fs.readFileSync(__dirname+'/energy-cooldown-functions.cjs','utf8'),{exports,Date,require:name=>({'firebase-functions/v2/firestore':{onDocumentWritten:(_opts,fn)=>fn},'firebase-admin/firestore':{getFirestore:()=>db,FieldValue:{serverTimestamp:()=> 'now'}},'./energy-cooldown.cjs':require('./energy-cooldown.cjs')})[name]});
 const event=(id='dg2',voltage_ll=0)=>({time:new Date(220000).toISOString(),params:{siteId:'A',meterId:id},data:{after:{exists:true,data:()=>({status:'OK',voltage_ll,observedAt:{toMillis:()=>220000}})}}});
 return {store,event,run:exports.captureEnergyCooldown,writes:()=>writes};
}
test('correct DG voltage-zero update saves cooldown once and preserves closing kWh fields',async()=>{
 const app=setup();app.store.get('energyChangeovers/A/runs/r').closing={kwh:123};
 await app.run(app.event('dg1'));assert.equal(app.writes(),0);
 await app.run(app.event('dg2',415));assert.equal(app.writes(),0);
 await app.run(app.event());await app.run(app.event());
 const run=app.store.get('energyChangeovers/A/runs/r');assert.equal(run.cooldownSeconds,120);assert.equal(run.cooldownStatus,'Completed');assert.equal(run.closing.kwh,123);assert.equal(app.writes(),1);
});
test('a new DG run interrupts old cooldown instead of measuring across the next outage',async()=>{
 const app=setup();app.store.set('sitePowerStatus/Site A',{powerSource:'DG'});await app.run(app.event());assert.equal(app.store.get('energyChangeovers/A/runs/r').cooldownStatus,'Interrupted');
});
