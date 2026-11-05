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
  const db = {collection:path=>({get:async()=>({docs:[...records.entries()].filter(([key])=>key.startsWith(path+'/')&&!key.slice(path.length+1).includes('/')).map(([key,value])=>({id:key.split('/').at(-1),data:()=>value}))})}), doc: ref, runTransaction: async fn => fn({
    get: async r => snap(r.path), set: (r, data, options) => write(r.path, data, options?.merge),
    create: (r, data) => {assert.equal(records.has(r.path), false); write(r.path, data);},
    delete: r => records.delete(r.path)
  })};
  let apiError;
  let photoOnlyError;
  let apiDescription;
  class HttpsError extends Error {constructor(code, text) {super(text); this.code = code;}}
  const exports = {};
  vm.runInNewContext(fs.readFileSync(__dirname + '/telegram-functions.cjs', 'utf8'), {
    exports, console, Buffer, AbortSignal, FormData, Blob, Date: TestDate, setTimeout:fn => fn(),
    fetch: async (url, options) => {
      requests.push({url, body: options.body instanceof FormData ? Object.fromEntries(options.body.entries()) : JSON.parse(options.body)});
      const requestError = apiError || (url.endsWith('/sendPhoto') ? photoOnlyError : null);
      return {ok: !requestError, status: requestError || 200, json: async () => requestError ? {ok: false, error_code: requestError, description: apiDescription || 'Photo unavailable'} : {ok: true, result: {message_id: 123}}};
    },
    require: name => ({
      'firebase-functions/v2/https': {onCall: handler => handler, onRequest: (_options, handler) => handler, HttpsError},
      'firebase-functions/v2/firestore': {onDocumentCreated: (_options, handler) => handler},
      'firebase-functions/params': {defineSecret: name => ({value: () => name === 'TELEGRAM_BOT_TOKEN' ? 'private-token' : 'webhook-secret'}), defineString: () => ({value: () => 'msc_test_bot'})},
      'firebase-admin/firestore': {getFirestore: () => db, FieldValue: {delete: () => deletedField, serverTimestamp: () => {const saved = now; return {toMillis: () => saved};}}, Timestamp: {fromMillis: value => ({toMillis: () => value})}},
      'node:crypto': crypto,
      './telegram-reports.cjs': require('./telegram-reports.cjs'),
      './telegram-message.cjs': require('./telegram-message.cjs'),
      './telegram-alert-style.cjs': require('./telegram-alert-style.cjs'),
      './notification-functions.cjs': {notificationData: n => ({title: n.title || 'Alert', body: n.message || 'Update'})}
    })[name]
  });
  async function webhook(text, {secret = 'webhook-secret', type = 'private', chatId = 42, method = 'POST', updateId, date} = {}) {
    let code = 200;
    const res = {status: value => {code = value; return res;}, send: () => code, sendStatus: value => value};
    return exports.telegramWebhook({method, get: () => secret, body: {update_id:updateId,message: {date,chat: {id: chatId, type}, from: {id: chatId}, text}}}, res);
  }
  const event = (id = 'notice', read = false) => ({params: {uid: 'user', id}, data: {data: () => ({title: 'Power', message: 'DG running', read})}});
  async function link(uid = 'user', chatId = 42) {
    const result = await exports.createTelegramLink({auth: {uid}});
    const token = new URL(result.url).searchParams.get('start');
    await webhook(`/start ${token}`, {chatId});
    return token;
  }
  return {exports, records, requests, webhook, event, link, failPhoto: code => {photoOnlyError=code;}, advance: milliseconds => {now += milliseconds;}, fail: (code, description = 'Forbidden: bot was blocked by the user') => {apiError = code; apiDescription = description;}};
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


for (const [actionType, heading] of [['energy_dg_start','DG START'],['energy_mains_restored','EB RESTORED']]) {
 test(`changeover ${actionType} sends the glow header and complete highlighted text once`,async()=>{
  const app=harness();await app.link();const event=app.event(actionType);
  event.data.data=()=>({title:'Changeover',actionType,message:'Asansol · DG-1\nDG generation: 34.78 kWh\nRun duration: 7.13 minutes',read:false});
  const count=app.requests.length;await app.exports.telegramBellNotification(event);
  const sent=app.requests.slice(count);assert.equal(sent.length,2);
  assert.ok(sent[0].url.endsWith('/sendPhoto'));assert.equal(sent[0].body.photo.type,'image/png');assert.ok(sent[0].body.photo.size>1000);assert.equal(sent[0].body.disable_notification,'true');assert.ok(sent[0].body.caption.includes('Asansol'));
  assert.ok(sent[1].url.endsWith('/sendMessage'));assert.ok(sent[1].body.text.includes(heading));assert.ok(sent[1].body.text.includes('<b>DG generation: 34.78 kWh</b>'));
  await app.exports.telegramBellNotification(event);assert.equal(app.requests.length,count+2);
  assert.equal(app.records.get(`notificationDeliveries/user/telegramItems/${actionType}`).photoMessageId,123);
 });
}


test('failed optional image upload still delivers complete text without revoking connection',async()=>{
 const app=harness();await app.link();app.failPhoto(400);const event=app.event('photo-fallback');
 event.data.data=()=>({title:'DG Start',actionType:'energy_dg_start',message:'Asansol\nDG start register: 137000 kWh\nEND OF DETAILS',read:false});
 await app.exports.telegramBellNotification(event);
 assert.ok(app.requests.at(-1).body.text.includes('END OF DETAILS'));
 assert.equal(app.records.get('notificationDeliveries/user/telegramItems/photo-fallback').status,'sent');
 assert.equal(app.records.get('notificationPreferences/user').telegramEnabled,true);
});


for(const actionType of ['energy_meter_update','energy_daily_kwh']){
 for(const [meterState,marker] of [['live','🟢'],['retry','🟠'],['offline','🔴']]){
  test(`${actionType} ${meterState} has matching image, color and meter identity`,async()=>{
   const app=harness();await app.link();const event=app.event(actionType+meterState);
   event.data.data=()=>({title:'Meter update · Main Incomer',actionType,meterState,readingState:meterState,message:'Asansol\nOpening: 100 kWh\nClosing: 125 kWh\nDaily coverage: Incomplete',read:false});
   const count=app.requests.length;await app.exports.telegramBellNotification(event);
   const sent=app.requests.slice(count);assert.equal(sent.length,2);
   assert.equal(sent[0].body.photo.name,`telegram-meter-${meterState}.png`);
   assert.ok(sent[0].body.caption.includes('Main Incomer'));
   assert.ok(sent[1].body.text.includes(marker));assert.ok(sent[1].body.text.includes('Main Incomer'));
   assert.ok(sent[1].body.text.includes('Incomplete'));assert.ok(sent[1].body.text.includes('125 kWh'));
  });
 }
}


test('/meter data returns individually colored live, retry and offline meter cards with full readings',async()=>{
 const app=harness();await app.link();app.records.get('users/user').siteId='ASL';app.records.get('users/user').site='Asansol';
 for(const [id,status,communicationState] of [['Live meter','OK','ONLINE'],['Retry meter','ERROR','RETRYING'],['Offline meter','ERROR','OFFLINE']])app.records.set(`energyMonitor/ASL/meters/${id}`,{name:id,status,communicationState,fwd_Wh:125000,powerUnits:'base',active_power:12000,observedAt:{toMillis:()=>Date.now()}});
 const count=app.requests.length;assert.equal(await app.webhook('/meter data'),200);
 const sent=app.requests.slice(count);assert.equal(sent.length,3);
 for(const [index,state,marker] of [[0,'live','🟢'],[1,'retry','🟠'],[2,'offline','🔴']]){
  assert.equal(sent[index].body.photo.name,`telegram-meter-${state}.png`);
  assert.ok(sent[index].body.caption.includes(marker));assert.ok(sent[index].body.caption.includes('meter'));assert.ok(sent[index].body.caption.length<=1024);
 }
 assert.ok(sent[0].body.caption.includes('125 kWh'));assert.ok(sent[0].body.caption.includes('12 kW'));
 app.failPhoto(400);assert.equal(await app.webhook('/meter data'),200);assert.ok(app.requests.at(-1).body.text.includes('Offline meter'));
});


test('/meter data keeps full long readings outside the photo caption and honors paused reports',async()=>{
 const app=harness();await app.link();Object.assign(app.records.get('users/user'),{siteId:'ASL',site:'&'.repeat(100)});
 app.records.set('energyMonitor/ASL/meters/m',{name:'&'.repeat(100),status:'OK',powerUnits:'base',active_power:12000,observedAt:{toMillis:()=>Date.now()}});
 const count=app.requests.length;assert.equal(await app.webhook('/meter data'),200);
 const sent=app.requests.slice(count);assert.ok(sent[0].url.endsWith('/sendPhoto'));
 assert.ok(sent.slice(1).some(request=>request.url.endsWith('/sendMessage')&&request.body.text.includes('Frequency:')));
 app.records.set('energyMonitor/ASL/config/notifications',{telegramMetersEnabled:false});
 const paused=app.requests.length;assert.equal(await app.webhook('/meter data'),200);
 assert.equal(app.requests.length,paused+1);assert.ok(app.requests.at(-1).url.endsWith('/sendMessage'));assert.ok(app.requests.at(-1).body.text.includes('paused'));
});


test('/summary all uses the same monthly-only format as /summary with one site per reply',async()=>{
 const app=harness();await app.link();Object.assign(app.records.get('users/user'),{siteId:'N19106A',site:'Asansol',role:'Admin'});
 const date=require('./meter-history.cjs').istDate(Date.now()),month=date.slice(0,7);
 app.records.set('siteConfigs/ASANSOL',{dgCount:1,ebCount:1});
 app.records.set(`dailyDGLogs/Asansol/${month}/${date}`,{Date:date,'DG-1 KWH Opening':100,'DG-1 KWH Closing':125,'EB-1 KWH Opening':200,'EB-1 KWH Closing':300});
 let before=app.requests.length;assert.equal(await app.webhook('/summary'),200);
 const own=app.requests.slice(before).map(r=>r.body.text).join('\n');
 assert.ok(own.includes('Monthly summary:'));assert.ok(own.includes('100 kWh'));
 before=app.requests.length;assert.equal(await app.webhook('/summary all'),200);
 const reports=app.requests.slice(before);const names=Object.keys(require('./telegram-sites.cjs'));
 assert.equal(reports.length,names.length);
 assert.ok(reports.every(r=>r.url.endsWith('/sendMessage')&&r.body.text.startsWith('<b>📊 Monthly site summary')));
 const asansol=reports.find(r=>r.body.text.includes('<b>Asansol</b>'));
 assert.ok(asansol.body.text.includes('100 kWh'));assert.ok(asansol.body.text.includes('DG generation:'));
 assert.ok(!asansol.body.text.includes('Globsyn'));
 assert.doesNotMatch(reports.map(r=>r.body.text).join('\n'),/1\. Today:|2\. Monthly summary:|Current EB consumption:/);
});


test('repeated Telegram update IDs acknowledge without restarting /summary all',async()=>{
 const app=harness();await app.link();Object.assign(app.records.get('users/user'),{siteId:'N19106A',site:'Asansol',role:'Admin'});
 const before=app.requests.length;assert.equal(await app.webhook('/summary all',{updateId:7001}),200);
 const delivered=app.requests.length-before;assert.ok(delivered>1);
 for(let i=0;i<3;i++)assert.equal(await app.webhook('/summary all',{updateId:7001}),200);
 assert.equal(app.requests.length,before+delivered);
 assert.equal(app.records.get('notificationDeliveries/telegramWebhook/updates/update-7001').status,'completed');
});
test('in-progress updates and failed deliveries are acknowledged without replay',async()=>{
 const app=harness();await app.link();
 app.records.set('notificationDeliveries/telegramWebhook/updates/update-7002',{status:'processing'});
 const before=app.requests.length;assert.equal(await app.webhook('/summary all',{updateId:7002}),200);assert.equal(app.requests.length,before);
 app.fail(500);assert.equal(await app.webhook('/help',{updateId:7003}),200);
 const failed=app.requests.length;app.fail(null);assert.equal(await app.webhook('/help',{updateId:7003}),200);assert.equal(app.requests.length,failed);
 assert.equal(await app.webhook('/help',{updateId:7004}),200);assert.equal(app.requests.length,failed+1);
});


test('old /summary all retries are drained without starting another report',async()=>{
 const app=harness();await app.link();Object.assign(app.records.get('users/user'),{siteId:'N19106A',site:'Asansol',role:'Admin'});
 const count=app.requests.length;
 assert.equal(await app.webhook('/summary all',{updateId:7005,date:Math.floor(Date.now()/1000)-180}),200);
 assert.equal(app.requests.length,count);
});
