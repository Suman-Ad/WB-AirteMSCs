const {test}=require('node:test');
const assert=require('node:assert/strict');
const {meterNotificationStatus}=require('./meter-notification-status.cjs');
const now=1793803200000;
const meter={status:'OK',observedAt:{toMillis:()=>now}};
test('only fresh successful meter readings are green',()=>{
 assert.equal(meterNotificationStatus(meter,now).meterState,'live');
 for(const m of [{...meter,status:'ERROR'},{...meter,communicationState:'OFFLINE'},{...meter,observedAt:{toMillis:()=>now-31000}},null])assert.equal(meterNotificationStatus(m,now).meterState,'offline');
});
test('retry and reconnect use amber even when the last retained status was OK',()=>{
 for(const m of [{...meter,status:'RETRY'},{...meter,communicationState:'RECONNECTING'},{...meter,status:'ERROR',communicationState:'RETRYING'}])assert.deepEqual(meterNotificationStatus(m,now),{meterState:'retry',readingState:'Retrying',statusObservedAtMs:now,statusAssessedAtMs:now});
});
test('missing and future timestamps stay amber, and stale retries cannot stay green or amber forever',()=>{
 for(const m of [{status:'OK'},{...meter,observedAt:{toMillis:()=>now+6000}}])assert.equal(meterNotificationStatus(m,now).meterState,'retry');
 assert.equal(meterNotificationStatus({...meter,communicationState:'RETRYING',observedAt:{toMillis:()=>now-31000}},now).meterState,'offline');
 assert.equal(meterNotificationStatus({...meter,uploadIntervalSeconds:60,observedAt:{toMillis:()=>now-60000}},now).meterState,'live');
});
