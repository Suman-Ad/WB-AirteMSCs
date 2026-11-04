const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const crypto = require('node:crypto');

function harness() {
  let now = Date.now();
  class TestDate extends Date {static now() {return now;}}
  const records = new Map([['users/user', {isActive: true}], ['users/other', {isActive: true}]]);
  const requests = [];
  const deletedField = Symbol('delete');
  const ref = path => ({path, get: async () => snap(path), update: async data => write(path, data, true)});
  const snap = path => ({exists: records.has(path), data: () => records.get(path)});
  const write = (path, data, merge) => {
    const value = {...(merge ? records.get(path) : {}), ...data};
    for (const key of Object.keys(value)) if (value[key] === deletedField) delete value[key];
    records.set(path, value);
  };
  const db = {doc: ref, runTransaction: async fn => fn({
    get: async r => snap(r.path), set: (r, data, options) => write(r.path, data, options?.merge),
    create: (r, data) => {assert.equal(records.has(r.path), false); write(r.path, data);},
    delete: r => records.delete(r.path)
  })};
  let apiError;
  let apiDescription;
  class HttpsError extends Error {constructor(code, text) {super(text); this.code = code;}}
  const exports = {};
  vm.runInNewContext(fs.readFileSync(__dirname + '/telegram-functions.cjs', 'utf8'), {
    exports, console, Buffer, AbortSignal, Date: TestDate, setTimeout:fn => fn(),
    fetch: async (url, options) => {
      requests.push({url, body: JSON.parse(options.body)});
      return {ok: !apiError, status: apiError || 200, json: async () => apiError ? {ok: false, error_code: apiError, description: apiDescription} : {ok: true, result: {message_id: 123}}};
    },
    require: name => ({
      'firebase-functions/v2/https': {onCall: handler => handler, onRequest: (_options, handler) => handler, HttpsError},
      'firebase-functions/v2/firestore': {onDocumentCreated: (_options, handler) => handler},
      'firebase-functions/params': {defineSecret: name => ({value: () => name === 'TELEGRAM_BOT_TOKEN' ? 'private-token' : 'webhook-secret'}), defineString: () => ({value: () => 'msc_test_bot'})},
      'firebase-admin/firestore': {getFirestore: () => db, FieldValue: {delete: () => deletedField, serverTimestamp: () => {const saved = now; return {toMillis: () => saved};}}, Timestamp: {fromMillis: value => ({toMillis: () => value})}},
      'node:crypto': crypto,
      './telegram-reports.cjs': require('./telegram-reports.cjs'),
      './telegram-message.cjs': require('./telegram-message.cjs'),
      './notification-functions.cjs': {notificationData: n => ({title: n.title || 'Alert', body: n.message || 'Update'})}
    })[name]
  });
  async function webhook(text, {secret = 'webhook-secret', type = 'private', chatId = 42, method = 'POST'} = {}) {
    let code = 200;
    const res = {status: value => {code = value; return res;}, send: () => code, sendStatus: value => value};
    return exports.telegramWebhook({method, get: () => secret, body: {message: {chat: {id: chatId, type}, from: {id: chatId}, text}}}, res);
  }
  const event = (id = 'notice', read = false) => ({params: {uid: 'user', id}, data: {data: () => ({title: 'Power', message: 'DG running', read})}});
  async function link(uid = 'user', chatId = 42) {
    const result = await exports.createTelegramLink({auth: {uid}});
    const token = new URL(result.url).searchParams.get('start');
    await webhook(`/start ${token}`, {chatId});
    return token;
  }
  return {exports, records, requests, webhook, event, link, advance: milliseconds => {now += milliseconds;}, fail: (code, description = 'Forbidden: bot was blocked by the user') => {apiError = code; apiDescription = description;}};
}

test('link creation requires authenticated active account and hides raw token in storage', async () => {
  const app = harness();
  await assert.rejects(app.exports.createTelegramLink({}), {code: 'unauthenticated'});
  app.records.set('users/user', {isActive: false});
  await assert.rejects(app.exports.createTelegramLink({auth: {uid: 'user'}}), {code: 'permission-denied'});
  app.records.set('users/user', {isActive: true});
  const {url} = await app.exports.createTelegramLink({auth: {uid: 'user'}});
  const token = new URL(url).searchParams.get('start');
  assert.equal(token.length, 48);
  assert.equal([...app.records.keys()].some(key => key.includes(token)), false);
  await assert.rejects(app.exports.createTelegramLink({auth: {uid: 'user'}}), {code: 'resource-exhausted'});
});

test('report commands route spaced phrases and bot mentions through account checks', async () => {
  const app = harness();
  for (const command of ['/METER@msc_test_bot   DATA', '/present fuel', '/site running load', '/pue', '/segr', '/present_fuel', '/activity', '/ACTIVITY@msc_test_bot', '/incident', '/INCIDENT@msc_test_bot', '/summary', '/SUMMARY@msc_test_bot', '/summary all', '/dhr', '/DHR@msc_test_bot']) {
    assert.equal(await app.webhook(command), 200);
    assert.match(app.requests.at(-1).body.text, /Connect Telegram from the app/);
  }
  await app.webhook('/help');
  assert.match(app.requests.at(-1).body.text, /\/meter data/);
  await app.webhook('/Asansol: Site Status');
  assert.match(app.requests.at(-1).body.text, /Connect Telegram from the app/);
  await app.link();
  await app.webhook('/Globsyn: meter data');
  assert.match(app.requests.at(-1).body.text, /Only Admin and Super Admin/);
});
test('webhook refuses forged requests, groups and non-POST methods', async () => {
  const app = harness();
  assert.equal(await app.webhook('/help', {secret: 'forged'}), 403);
  assert.equal(await app.webhook('/help', {method: 'GET'}), 405);
  assert.equal(await app.webhook('/help', {type: 'group'}), 200);
  assert.equal(app.requests.length, 0);
});
test('link is one-time, expires and cannot take over another account chat', async () => {
  const app = harness();
  const token = await app.link();
  assert.equal(app.records.get('notificationPreferences/user').telegramChatId, '42');
  await app.webhook(`/start ${token}`, {chatId: 43});
  assert.equal(app.records.has('telegramChats/43'), false);
  const result = await app.exports.createTelegramLink({auth: {uid: 'other'}});
  await app.webhook(`/start ${new URL(result.url).searchParams.get('start')}`);
  assert.equal(app.records.get('telegramChats/42').uid, 'user');
  const key = [...app.records.keys()].find(key => key.startsWith('telegramLinks/'));
  app.records.get(key).expiresAt = {toMillis: () => 0};
  await app.webhook(`/start ${new URL(result.url).searchParams.get('start')}`, {chatId: 43});
  assert.equal(app.records.has('telegramChats/43'), false);
});
test('notifications send only after linking, are not replayed, and stop command disables delivery', async () => {
  const app = harness();
  await app.exports.telegramBellNotification(app.event());
  assert.equal(app.requests.length, 0);
  await app.link();
  await app.webhook('/status');
  assert.match(app.requests.at(-1).body.text, /Connected\. Notification updates are enabled\./);
  await app.exports.telegramBellNotification(app.event());
  await app.exports.telegramBellNotification(app.event());
  assert.equal(app.requests.filter(r => r.body.text.includes('📬 Power') && r.body.text.includes('DG running')).length, 1);
  assert.equal(app.records.get('notificationDeliveries/user/telegramItems/notice').status, 'sent');
  await app.webhook('/stop');
  await app.exports.telegramBellNotification(app.event('later'));
  assert.equal(app.records.get('notificationPreferences/user').telegramEnabled, false);
  assert.equal(app.records.has('telegramChats/42'), false);
  assert.equal(app.records.has('notificationDeliveries/user/telegramItems/later'), false);
});
test('disconnect invalidates pending links and blocked bots disable their connection', async () => {
  const app = harness();
  const {url} = await app.exports.createTelegramLink({auth: {uid: 'user'}});
  await app.exports.disconnectTelegram({auth: {uid: 'user'}});
  await app.webhook(`/start ${new URL(url).searchParams.get('start')}`);
  assert.equal(app.records.has('telegramChats/42'), false);
  app.records.get('notificationPreferences/user').linkRequestedAt = {toMillis: () => 0};
  await app.link();
  app.fail(403);
  await app.exports.telegramBellNotification(app.event());
  assert.equal(app.records.get('notificationPreferences/user').telegramEnabled, false);
  assert.equal(app.records.get('notificationDeliveries/user/telegramItems/notice').status, 'failed');
});
test('read notifications, inactive accounts and mismatched bindings never send', async () => {
  const app = harness();
  await app.link();
  const count = app.requests.length;
  await app.exports.telegramBellNotification(app.event('read', true));
  app.records.set('users/user', {isActive: false});
  await app.exports.telegramBellNotification(app.event('inactive'));
  app.records.set('users/user', {isActive: true});
  app.records.set('telegramChats/42', {uid: 'other'});
  await app.exports.telegramBellNotification(app.event('mismatch'));
  assert.equal(app.requests.length, count);
});

test('connected accounts survive ten minutes and expiration of an unused reconnect link', async () => {
  const app = harness();
  await app.link();
  app.advance(11 * 60 * 1000);
  await app.webhook('/status');
  assert.match(app.requests.at(-1).body.text, /Connected\. Notification updates are enabled\./);
  const {url} = await app.exports.createTelegramLink({auth: {uid: 'user'}});
  app.advance(11 * 60 * 1000);
  await app.webhook(`/start ${new URL(url).searchParams.get('start')}`);
  assert.equal(app.records.get('notificationPreferences/user').telegramEnabled, true);
  assert.equal(app.records.get('notificationPreferences/user').telegramChatId, '42');
  await app.exports.telegramBellNotification(app.event());
  assert.equal(app.records.get('notificationDeliveries/user/telegramItems/notice').status, 'sent');
});

test('generic Telegram 403 failures do not delete a saved connection', async () => {
  const app = harness();
  await app.link();
  app.fail(403, 'Forbidden');
  await app.exports.telegramBellNotification(app.event());
  assert.equal(app.records.get('notificationPreferences/user').telegramEnabled, true);
  assert.equal(app.records.get('telegramChats/42').uid, 'user');
  assert.equal(app.records.get('notificationDeliveries/user/telegramItems/notice').status, 'failed');
});

test('CRQ open and close notifications reach a linked Telegram account',async()=>{
 const {dueReminders,notification}=require('./crq-reminders.cjs');
 const app=harness();await app.link();
 const sheet={date:'2026-11-01',siteId:'ASL',rows:[{crqNo:'CRQ123',activityStartTime:'10:00',activityEndTime:'11:00'}]};
 for(const reminder of dueReminders(sheet,Date.parse('2026-11-01T10:30:00+05:30'))) {
  const n=notification(sheet,reminder);
  await app.exports.telegramBellNotification({params:{uid:'user',id:reminder.type},data:{data:()=>n}});
  assert.ok(app.requests.at(-1).body.text.includes(n.title));
  assert.ok(app.requests.at(-1).body.text.includes('CRQ123'));
 }
 assert.equal(app.records.get('notificationDeliveries/user/telegramItems/open').status,'sent');
 assert.equal(app.records.get('notificationDeliveries/user/telegramItems/close').status,'sent');
});

test('plain private start replies without linking and failed replies request webhook retry',async()=>{
 const app=harness();assert.equal(await app.webhook('/start'),200);
 assert.match(app.requests.at(-1).body.text,/To connect/);
 app.fail(500,'Internal server error');assert.equal(await app.webhook('/start'),503);
 app.fail(401,'Unauthorized');assert.equal(await app.webhook('/start'),503);
 app.fail(403,'Forbidden: bot was blocked by the user');assert.equal(await app.webhook('/start'),200);
});


test('command replies and full notification bodies use safe formatted pages', async () => {
  const app=harness();
  await app.webhook('/help');
  assert.match(app.requests.at(-1).body.text,/<b>📖 Bot commands<\/b>/);
  assert.equal(app.requests.at(-1).body.parse_mode,'HTML');
  await app.link();
  const description='Fault <DG> & UPS '.repeat(400)+'END OF DETAILS';
  const event=app.event('long-notice');
  event.data.data=()=>({title:'Power <alert>',message:description,read:false});
  const before=app.requests.length;
  await app.exports.telegramBellNotification(event);
  const pages=app.requests.slice(before).map(r=>r.body);
  assert.ok(pages.length>1);
  assert.ok(pages.every(p=>p.parse_mode==='HTML' && !p.text.includes('<DG>')));
  assert.match(pages.at(-1).text,/END OF DETAILS/);
  assert.equal(app.records.get('notificationDeliveries/user/telegramItems/long-notice').messageIds.length,pages.length);
});
