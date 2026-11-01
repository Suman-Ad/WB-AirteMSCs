const {test} = require('node:test');
const assert = require('node:assert/strict');
const {dueReminders, eligibleUser, reminderId, notification} = require('./crq-reminders.cjs');
const at = value => Date.parse(value + '+05:30');
const row = {rowId:'r1', crqType:'CRQ', crqNo:'CRQ123', activityStartTime:'10:00', activityEndTime:'11:00', pmStatus:'Pending'};
const sheet = {date:'2026-11-01', siteId:'ASL', siteName:'Asansol', rows:[row]};
const types = (time, data=sheet) => dueReminders(data, at(time)).map(r => r.type);
test('open at start, close 30 minutes before end; WIP suppresses opening only', () => {
  assert.deepEqual(types('2026-11-01T09:59:00'), []);
  assert.deepEqual(types('2026-11-01T10:00:00'), ['open']);
  assert.deepEqual(types('2026-11-01T10:29:00'), ['open']);
  assert.deepEqual(types('2026-11-01T10:30:00'), ['open','close']);
  assert.deepEqual(types('2026-11-01T10:30:00', {...sheet,rows:[{...row,pmStatus:'WIP'}]}), ['close']);
});
test('completed/cancelled, non-CRQ and invalid times do not alert', () => {
  for (const patch of [{pmStatus:'Completed'},{pmStatus:'Cancelled'},{crqType:'PE',crqNo:'PE'},{activityStartTime:'25:00',activityEndTime:''}]) {
    assert.deepEqual(types('2026-11-01T10:45:00', {...sheet,rows:[{...row,...patch}]}), []);
  }
});
test('night activity closes next day and old daytime sheets never alert', () => {
  const night = {...sheet,rows:[{...row,activityStartTime:'23:00',activityEndTime:'01:00'}]};
  assert.deepEqual(types('2026-11-01T23:45:00',night), ['open']);
  assert.deepEqual(types('2026-11-02T00:30:00',night), ['open','close']);
  assert.deepEqual(types('2026-11-02T01:01:00',night), []);
  assert.deepEqual(types('2026-11-02T00:30:00'), []);
});
test('legacy timestamp date is interpreted in IST', () => {
  assert.deepEqual(types('2026-11-01T10:00:00',{...sheet,date:{toMillis:()=>at('2026-11-01T00:00:00')}}), ['open']);
});
test('recipients are active site users or global admins, never unrelated users', () => {
  assert.equal(eligibleUser({isActive:true,siteId:'ASL'},sheet), true);
  assert.equal(eligibleUser({isActive:true,site:'Asansol'},sheet), true);
  assert.equal(eligibleUser({isActive:true,siteId:'OTHER',site:'Asansol'},sheet), false);
  assert.equal(eligibleUser({isActive:true,role:'Admin'},sheet), true);
  assert.equal(eligibleUser({isActive:false,role:'Admin'},sheet), false);
  assert.equal(eligibleUser({role:'Admin'},sheet), false);
});
test('stable IDs survive reordering, distinguish open/close, and route to dashboard', () => {
  const reminders=dueReminders(sheet,at('2026-11-01T10:30:00'));
  assert.notEqual(reminderId('s',reminders[0]),reminderId('s',reminders[1]));
  assert.equal(reminderId('s',reminders[0]),reminderId('s',{...reminders[0],row:{...row,pmStatus:'Pending'}}));
  const n=notification(sheet,reminders[0]);
  assert.equal(n.url,'/daily-activity-dashboard');assert.equal(n.read,false);
  assert.match(n.message,/CRQ123/);assert.equal(n.actionType,'crq_open_reminder');
});
