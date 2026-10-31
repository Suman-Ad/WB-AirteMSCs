const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSample, historySettings, meterIdentity, planDailyCapture, shiftDate, istDate } = require('./meter-history.cjs');
const at = Date.parse('2026-10-31T18:29:50Z');
const meter = (value, ms = at, extra = {}) => ({ name: 'LT Panel - 01', status: 'OK', fwd_Wh: value * 1000, powerUnits: 'base', R_current: 0, active_power: 2000, observedAt: { toMillis: () => ms }, ...extra });
const sample = (value, ms = at) => buildSample(meter(value, ms), 'meter-24', ms);

test('healthy counters preserve zero, normalize units and include all numeric readings', () => {
 const record = buildSample(meter(0), 'meter-24', at);
 assert.equal(record.kwh, 0); assert.equal(record.readings.R_current, 0); assert.equal(record.date, '2026-10-31');
 assert.equal(buildSample(meter(1, at, {fwd_Wh:3,energyUnits:'kWh'}), 'm', at).kwh, 3);
 assert.equal(buildSample(meter(1, at, {fwd_Wh:3,energyUnits:'kilo'}), 'm', at).kwh, 3);
});
test('rejects stale, errored, future, negative, missing and unknown-unit counters', () => {
 for(const changed of [{status:'ERROR'}, {fwd_Wh:NaN}, {fwd_Wh:-1}, {fwd_Wh:undefined}, {energyUnits:'unknown'}, {observedAt:{toMillis:()=>at-120001}}, {observedAt:{toMillis:()=>at+5001}}]) assert.equal(buildSample(meter(1,at,changed),'m',at), null);
});
test('IST dates and sampling buckets cross midnight, months and leap days correctly', () => {
 assert.equal(sample(1,at).date,'2026-10-31');
 assert.equal(sample(1,at+10000).date,'2026-11-01');
 assert.notEqual(sample(1,at).bucket,sample(1,at+10000).bucket);
 assert.equal(shiftDate('2026-11-01',-1),'2026-10-31');
 assert.equal(shiftDate('2024-03-01',-1),'2024-02-29');
 assert.equal(istDate(at+10000),'2026-11-01');
});
test('meter identity survives address changes without merging distinct explicit points', () => {
 assert.equal(meterIdentity(meter(1),'old'),meterIdentity({...meter(1),name:'LT Panel_1'},'new'));
 assert.notEqual(meterIdentity({...meter(1),pointId:'P1'},'old'),meterIdentity({...meter(1),pointId:'P2'},'new'));
 assert.equal(meterIdentity({...meter(1),pointId:'a/b'},'m'),'point%3Aa%2Fb');
});
test('default retention is seven days, allows 365, and honors pause', () => {
 assert.deepEqual(historySettings(),{enabled:true,retentionDays:7});
 assert.deepEqual(historySettings({enabled:false,retentionDays:365}),{enabled:false,retentionDays:365});
 for(const retentionDays of [0,6,366,7.5,'30',NaN]) assert.equal(historySettings({retentionDays}).retentionDays,7);
});
test('day opening equals previous closing, while first installation is clearly a baseline', () => {
 const initial = planDailyCapture(sample(120),null,{closingKwh:100},null).daily;
 assert.equal(initial.openingKwh,100); assert.equal(initial.closingKwh,120); assert.equal(initial.openingSource,'previous-day-closing');
 const baseline = planDailyCapture(sample(0),null,null,null).daily;
 assert.equal(baseline.openingKwh,0); assert.equal(baseline.openingSource,'first-captured-reading');
});
test('out-of-order observations never replace a newer closing and synchronize the following day', () => {
 const initial = planDailyCapture(sample(120),null,null,null).daily;
 const earlier = planDailyCapture(sample(110,at-120000),initial,null,{openingKwh:99,closingKwh:150}).daily;
 assert.equal(earlier.firstKwh,110); assert.equal(earlier.openingKwh,110); assert.equal(earlier.closingKwh,120); assert.equal(earlier.lastAtMs,at);
 const plan = planDailyCapture(sample(125,at+60000),initial,null,{openingKwh:120,closingKwh:150});
 assert.equal(plan.nextPatch.openingKwh,125); assert.equal(plan.nextPatch.openingSource,'previous-day-closing');
});
test('counter resets remain flagged even after counter recovers above opening', () => {
 const initial = planDailyCapture(sample(120),null,{closingKwh:100},null).daily;
 const reset = planDailyCapture(sample(2,at+60000),initial,{closingKwh:100},null).daily;
 assert.equal(reset.counterReset,true);
 const later = planDailyCapture(sample(130,at+120000),reset,{closingKwh:100},null).daily;
 assert.equal(later.counterReset,true);
});
test('retained opening survives deletion of the previous day by retention cleanup', () => {
 const current = planDailyCapture(sample(120),null,{closingKwh:100},null).daily;
 const later = planDailyCapture(sample(125,at+60000),current,null,null).daily;
 assert.equal(later.openingKwh,100); assert.equal(later.openingSource,'previous-day-closing');
});
