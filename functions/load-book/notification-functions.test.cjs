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
    exports, console, AbortSignal,
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
