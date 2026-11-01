const {test} = require('node:test');
const assert = require('node:assert/strict');
const {settings, slotAt, eligibleUser, currentMeters, notification, notificationId} = require('./energy-notifications.cjs');
const now = Date.parse('2026-11-01T02:00:00+05:30');
const meter = {name:'Main',status:'OK',powerUnits:'base',energyUnits:'Wh',active_power:12000,fwd_Wh:456000,R_voltage_ln:230,R_current:20,observedAt:{toMillis:()=>now}};
test('default is two hours aligned to IST; disabled and off-slot sends nothing',()=>{
 assert.equal(settings().intervalMinutes,120);
 assert.equal(slotAt(now), '2026-11-01-0120');
 assert.equal(slotAt(now+4*60000),slotAt(now));
 assert.equal(slotAt(now+5*60000),null);
 assert.equal(slotAt(now,{enabled:false}),null);
 assert.equal(slotAt(now+30*60000,{intervalMinutes:30}), '2026-11-01-0150');
 assert.equal(settings({intervalMinutes:-1}).intervalMinutes,120);
 assert.equal(slotAt(Date.parse('2026-11-02T00:00:00+05:30')),'2026-11-02-0000');
});
test('site isolation applies to admins as well, and inactive/unassigned users are excluded',()=>{
 assert.ok(eligibleUser({siteId:'A',isActive:true},'A'));
 for(const user of [{siteId:'B',isActive:true,role:'Admin'},{isActive:true,role:'Super Admin'},{siteId:'A',isActive:false}]) assert.equal(eligibleUser(user,'A'),false);
});
test('summary normalizes units and marks stale, error and unknown-unit readings',()=>{
 const n=notification(meter,'m','A','Site A',now);
 assert.match(n.message,/456 kWh.*12 kW/);assert.equal(n.readingState,'Live');
 assert.equal(n.url,'/energy-monitor');assert.equal(n.read,false);
 assert.equal(notification(meter,'m','A','',now+120000).readingState,'Stale reading');
 const unknown=notification({...meter,powerUnits:'raw'},'m','A','',now);assert.match(unknown.message,/Power: Unavailable/);
 const error=notification({...meter,status:'ERROR'},'m','A','',now);assert.equal(error.readingState,'Meter error');assert.match(error.message,/Energy: Unavailable/);
});
test('freshest physical meter wins and retired test meter is skipped',()=>{
 const doc=(id,data)=>({id,data:()=>data});
 const docs=[doc('test-meter',meter),doc('old',{...meter,pointId:'1',observedAt:{toMillis:()=>now-1000}}),doc('new',{...meter,pointId:'1'}),doc('other',{...meter,pointId:'2'})];
 assert.deepEqual(currentMeters(docs,now).map(d=>d.id),['new','other']);
 assert.equal(notificationId('A',meter,'m',slotAt(now)),notificationId('A',meter,'alias',slotAt(now)));
 assert.notEqual(notificationId('B',meter,'m',slotAt(now)),notificationId('A',meter,'m',slotAt(now)));
});
