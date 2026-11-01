const {test}=require('node:test'),assert=require('node:assert/strict');
const {stoppedAt,cooldownPatch}=require('./energy-cooldown.cjs');
const start=100000,now=220000;
const run={status:'Completed',cooldownStatus:'Cooling',cooldownStartAtMs:start};
const meter=(volts=0,at=now)=>({status:'OK',voltage_ll:volts,observedAt:{toMillis:()=>at}});
test('cooldown ends at observed zero voltage, not zero-load transfer or processing time',()=>{
 assert.equal(cooldownPatch(run,meter(415),now,'EB'),null);
 assert.deepEqual(cooldownPatch(run,meter(0,now-10000),now,'EB'),{cooldownStatus:'Completed',cooldownEndAtMs:210000,cooldownSeconds:110});
});
test('offline, stale, partial, disagreeing and future voltages cannot finish cooldown',()=>{
 for(const m of [{...meter(),status:'ERROR'},{...meter(),communicationState:'OFFLINE'},meter(0,1),meter(0,now+6000),{...meter(),R_voltage_ll:0},{...meter(),R_voltage_ll:0,Y_voltage_ll:1,B_voltage_ll:0}])assert.equal(stoppedAt(m,now),null);
 assert.equal(stoppedAt({...meter(),R_voltage_ll:0,Y_voltage_ll:0,B_voltage_ll:0},now),now);
});
test('restarts interrupt pending cooldown; unknown source, historical or completed records do not change',()=>{
 assert.deepEqual(cooldownPatch(run,meter(415),now,'DG'),{cooldownStatus:'Interrupted'});
 assert.equal(cooldownPatch(run,meter(),now,undefined),null);
 assert.equal(cooldownPatch({...run,cooldownStatus:'Completed'},meter(),now,'EB'),null);
 assert.equal(cooldownPatch({...run,cooldownStartAtMs:now+1000},meter(),now,'EB'),null);
});
