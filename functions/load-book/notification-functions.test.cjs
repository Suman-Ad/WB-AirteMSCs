const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function load({devices = [], enabled = true, send, preference} = {}) {
  const deleted = [];
  const writes = [];
  let claimed = false;
  const delivery = {update: async value => writes.push(value)};
  const db = {
    doc: path => path.startsWith('users/') ? {get: async () => ({exists: true, data: () => ({isActive: enabled})})} :
      path.startsWith('notificationPreferences/') ? {get: async () => ({data: () => preference})} : delivery,
    collection: () => ({where: () => ({get: async () => ({docs: devices.map(token => ({data: () => ({token}), ref: {delete: async () => deleted.push(token)}}))})})}),
    runTransaction: async fn => fn({get: async () => ({exists: claimed}), create: () => {claimed = true;}})
  };
  const exports = {};
  vm.runInNewContext(fs.readFileSync(__dirname + '/notification-functions.cjs', 'utf8'), {
    exports, console, AbortSignal, Buffer,
    fetch: async () => { writes.push('fetch'); return {ok: true, json: async () => ({messages: [{id: 'accepted'}]})}; },
    require: name => ({
      'firebase-functions/v2/firestore': {onDocumentCreated: (_options, handler) => handler},
      'firebase-functions/params': {defineSecret: () => ({value: () => 'secret'}), defineString: (_name, options) => ({value: () => options.default || 'configured'})},
      'firebase-admin/firestore': {getFirestore: () => db, FieldValue: {serverTimestamp: () => 'now'}},
      'firebase-admin/messaging': {getMessaging: () => ({sendEachForMulticast: send})}
    })[name]
  });
  return {exports, deleted, writes};
}
const event = n => ({params: {uid: 'user', id: 'notice'}, data: {data: () => n}});

test('push sends data-only messages to every device and removes expired tokens', async () => {
  const calls = [];
  const app = load({devices: ['first', 'expired'], send: async message => {
    calls.push(message);
    return {failureCount: 1, responses: [{success: true}, {error: {code: 'messaging/registration-token-not-registered'}}]};
  }});
  await app.exports.pushBellNotification(event({title: 'Power', message: 'DG running'}));
  assert.deepEqual(Array.from(calls[0].tokens), ['first', 'expired']);
  assert.equal(calls[0].data.body, 'DG running');
  assert.equal(calls[0].notification, undefined);
  assert.deepEqual(app.deleted, ['expired']);
});
test('inactive users and read notifications do not generate push', async () => {
  const send = async () => assert.fail('must not send');
  await load({enabled: false, devices: ['token'], send}).exports.pushBellNotification(event({}));
  await load({devices: ['token'], send}).exports.pushBellNotification(event({read: true}));
});
test('unsafe deep links fall back to app root', () => {
  const {notificationData} = load().exports;
  for (const url of ['https://outside.test', '//outside.test', '/\\outside.test']) {
    assert.equal(notificationData({url}, 'u', 'n').url, '/');
  }
});

const {dueReminders, notification} = require('./crq-reminders.cjs');
test('CRQ open and close reminders produce device messages with dashboard links', async () => {
 const messages=[];
 const app=load({devices:['device'],send:async message=>{messages.push(message);return {failureCount:0,responses:[{success:true}]};}});
 const sheet={date:'2026-11-01',siteId:'ASL',rows:[{crqNo:'CRQ123',activityStartTime:'10:00',activityEndTime:'11:00'}]};
 for(const reminder of dueReminders(sheet,Date.parse('2026-11-01T10:30:00+05:30'))) await app.exports.pushBellNotification(event(notification(sheet,reminder)));
 assert.equal(messages.length,2);
 assert.equal(messages[0].data.title,'CRQ Pending Open');assert.equal(messages[1].data.title,'CRQ Pending Close');
 assert.ok(messages.every(message=>message.data.url==='/daily-activity-dashboard'&&message.data.body.includes('CRQ123')));
});

test('fuel details for all four DGs survive push/Telegram formatting within the byte budget',()=>{
 const {notificationData}=load().exports;
 const message='DG fuel details '.repeat(90)+'DG-4 backup: 12 h';
 const data=notificationData({actionType:'energy_dg_start',message},'u','n');
 assert.equal(data.body,message);
 const unicode=notificationData({actionType:'energy_mains_restored',message:'⛽'.repeat(2000)},'u','n');
 assert.ok(Buffer.byteLength(unicode.body,'utf8')<=2500);
 assert.ok(!unicode.body.includes('\uFFFD'));
});
