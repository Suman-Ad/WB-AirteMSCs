const {test} = require('node:test');
const assert = require('node:assert/strict');
const {reportCommand, siteReportCommand, reportMessages, chunks} = require('./telegram-reports.cjs');
const now = Date.parse('2026-11-02T12:00:00+05:30');

test('each Telegram command respects its site toggle before reading report data',async()=>{
  const fields={meters:'telegramMetersEnabled',fuel:'telegramFuelEnabled',load:'telegramLoadEnabled',pue:'telegramPueEnabled',segr:'telegramSegrEnabled',siteStatus:'telegramSiteStatusEnabled',activity:'telegramActivityEnabled',incident:'telegramIncidentEnabled'};
  for(const [kind,field] of Object.entries(fields)) {
    const app=harness();app.records.set('energyMonitor/site-id/config/notifications',{[field]:false});
    assert.match((await app.report(kind))[0],/paused by an administrator/);
    assert.equal(app.queries.length,0);
  }
});

test('incident reports include only open incidents at the assigned site, with details and full long descriptions',async()=>{
  const app=harness();
  const description='Investigate equipment fault. '.repeat(200);
  app.records.set('incidents/open',{siteId:'site-id',status:'Open',dateKey:'2026-10-01',incidentTitle:'UPS fault',incidentDescription:description,equipmentCategory:'UPS',ttDocketNo:'TT123',actionsTaken:'OEM informed',ownership:'OEM',rcaStatus:'N'});
  app.records.set('incidents/closed',{siteId:'site-id',status:'Closed',incidentTitle:'CLOSED SECRET'});
  app.records.set('incidents/other',{siteId:'other',status:'Open',incidentTitle:'OTHER SECRET'});
  app.records.set('incidents/missing-status',{siteId:'site-id',incidentTitle:'UNKNOWN SECRET'});
  const messages=await app.report('incident');
  const reply=messages.join('\n');
  assert.match(reply,/Open incidents: 1/);
  assert.match(reply,/UPS fault\nStatus: Open\nDocket: TT123/);
  assert.match(reply,/2026-10-01/);
  assert.match(reply,/Actions taken: OEM informed\nOwnership: OEM\nRCA: Pending/);
  assert.doesNotMatch(reply,/SECRET/);
  assert.equal(chunks(messages).join('\n').replace(/\n/g,'').includes(description.replace(/\n/g,'')),true);
  assert.ok(chunks(messages).every(p=>p.length<=3500));
  assert.equal(reportCommand('/incident',''),'incident');
  assert.equal(reportCommand('/incident','other'),null);
  assert.deepEqual(siteReportCommand('/Asansol: incident'),{site:'Asansol',kind:'incident'});
});

test('incident reports require active linking and enforce admin-only named sites',async()=>{
  const app=harness();
  assert.match((await app.report('incident'))[0],/No open incidents/);
  const before=app.queries.length;
  assert.match((await reportMessages(app.db,'42','incident',now,'Asansol'))[0],/Only Admin/);
  assert.equal(app.queries.length,before);
  app.records.get('users/u').role='Admin';
  app.records.set('incidents/admin-site',{siteId:'N19106A',status:' open ',incidentTitle:'Admin view'});
  assert.match((await reportMessages(app.db,'42','incident',now,'Asansol')).join('\n'),/Admin view/);
  app.records.get('users/u').isActive=false;
  const beforeInactive=app.queries.length;
  assert.match((await app.report('incident'))[0],/inactive/);
  assert.equal(app.queries.length,beforeInactive);
});
function harness() {
  const records = new Map([
    ['telegramChats/42', {uid:'u'}],
    ['notificationPreferences/u', {telegramEnabled:true, telegramChatId:'42'}],
    ['users/u', {isActive:true, siteId:'site-id', site:'Asansol'}],
    ['siteConfigs/ASANSOL', {dgCount:1, ebCount:1, dgConfigs:{'DG-1':{externalTankLtrs:0}}}]
  ]);
  const queries = [];
  const collection = (path, filters = []) => ({
    where:(field,op,value) => collection(path,[...filters,{field,op,value}]),
    get:async () => {
      queries.push(path);
      return {docs:[...records].filter(([key,value]) => key.startsWith(path + '/') && !key.slice(path.length + 1).includes('/') && filters.every(f => {
        const actual = value[f.field]?.toMillis ? value[f.field].toMillis() : value[f.field];
        const expected = f.value instanceof Date ? f.value.getTime() : f.value;
        if (typeof actual !== typeof expected) return false;
        return f.op === '==' ? actual === expected : f.op === '>=' ? actual >= expected : actual < expected;
      })).map(([key,value])=>({id:key.split('/').at(-1),data:()=>value}))};
    }
  });
  const db = {
    doc:path => ({get:async () => ({data:() => records.get(path)})}),
    collection
  };
  const row = {Date:'2026-11-01', 'DG-1 Fuel Opening':100, 'DG-1 Fuel Closing':80,
    'DG-1 KWH Opening':1000, 'DG-1 KWH Closing':1060,
    'EB-1 KWH Opening':2000, 'EB-1 KWH Closing':2420,
    'DCPS Load Amps':100, 'UPS Load KWH':4.58, 'Office kW Consumption':24};
  records.set('dailyDGLogs/Asansol/2026-11/2026-11-01', row);
  return {records, queries, db, row, report:kind => reportMessages(db, '42', kind, now)};
}
test('typed phrases and menu commands resolve; unrelated arguments do not', () => {
  for (const [command, args, kind] of [['/meter','data','meters'], ['/present','fuel','fuel'], ['/site','running load','load'], ['/meter_data','','meters'], ['/pue','','pue'], ['/segr','','segr']]) {
    assert.equal(reportCommand(command,args),kind);
  }
  assert.equal(reportCommand('/site','other'),null);
  assert.equal(reportCommand('/pue','other'),null);
});

test('activity reports today in IST with combined CRQs and timestamp sheets, excluding other sites and dates', async () => {
  const app = harness();
  const row = {nodeName:'BMS',activityDetails:'OEM PM',crqNo:'CRQ123456, CRQ234567',activityStartTime:'10:00',activityEndTime:'18:00',pmStatus:'Pending',notes:'Keep access ready'};
  app.records.set('daily_activity_sheets/current',{siteId:'site-id',date:'2026-11-02',rows:[row]});
  app.records.set('daily_activity_sheets/legacy',{siteId:'site-id',date:{toMillis:()=>Date.parse('2026-11-02T00:00:00+05:30')},rows:[{...row,nodeName:'PAC'}]});
  app.records.set('daily_activity_sheets/other',{siteId:'other',siteName:'Asansol',date:'2026-11-02',rows:[{nodeName:'SECRET'}]});
  app.records.set('daily_activity_sheets/old',{siteId:'site-id',date:'2026-11-01',rows:[{nodeName:'OLD'}]});
  const reply = (await app.report('activity')).join('\n');
  assert.match(reply,/Activities: 2026-11-02 \(IST\)\n2 activity/);
  assert.match(reply,/CRQ123456, CRQ234567/);
  assert.match(reply,/10:00 to 18:00 IST\nStatus: Pending/);
  assert.match(reply,/PAC/);
  assert.doesNotMatch(reply,/SECRET|OLD/);
  assert.equal(reportCommand('/activity',''),'activity');
  assert.equal(reportCommand('/activity','other'),null);
  assert.deepEqual(siteReportCommand('/Asansol: activity'),{site:'Asansol',kind:'activity'});
});

test('activity reports enforce linking and site-prefix roles, and use IST at midnight', async () => {
  const app = harness();
  assert.match((await app.report('activity'))[0],/No activities scheduled/);
  assert.match((await reportMessages(app.db,'42','activity',now,'Asansol'))[0],/Only Admin/);
  app.records.get('users/u').role = 'Admin';
  app.records.set('daily_activity_sheets/today',{siteId:'N19106A',date:'2026-11-03',rows:[{nodeName:'UPS',activityDetails:'PM'}]});
  const reply = await reportMessages(app.db,'42','activity',Date.parse('2026-11-02T18:31:00Z'),'Asansol');
  assert.match(reply.join('\n'),/2026-11-03.*\n1 activity/);
  app.records.delete('telegramChats/42');
  const before=app.queries.length;
  assert.match((await app.report('activity'))[0],/Connect Telegram/);
  assert.equal(app.queries.length,before);
});
test('reports require linked active account and matching preference before reading site data', async () => {
  const app = harness();
  app.records.delete('telegramChats/42');
  assert.match((await app.report('fuel'))[0], /Connect Telegram/);
  app.records.set('telegramChats/42',{uid:'u'});
  app.records.get('users/u').isActive = false;
  assert.match((await app.report('meters'))[0], /inactive/);
  app.records.get('users/u').isActive = true;
  app.records.get('notificationPreferences/u').telegramChatId = '99';
  assert.match((await app.report('meters'))[0], /inactive/);
  assert.equal(app.queries.length,0);
});
test('saved fuel, daily average load, PUE and SEGR use dated site logs', async () => {
  const app = harness();
  assert.match((await app.report('fuel'))[0], /2026-11-01.*\nFuel stock.*\nDG-1: Day tank 80 L \| External 0 L/);
  assert.match((await app.report('load'))[0], /daily average\): 20 kW/);
  assert.match((await app.report('pue'))[0], /PUE: 1.9/);
  assert.match((await app.report('segr'))[0], /DG-1: 3 kWh\/L\nOverall: 3 kWh\/L/);
  assert.ok(app.queries.every(path => path.startsWith('dailyDGLogs/Asansol/')));
});
test('missing readings and counter resets are unavailable instead of misleading zeros', async () => {
  const app = harness();
  delete app.row['EB-1 KWH Closing'];
  assert.match((await app.report('load'))[0], /Unavailable/);
  assert.match((await app.report('pue'))[0], /PUE: Unavailable/);
  app.row['DG-1 KWH Closing'] = 1;
  assert.match((await app.report('segr'))[0], /DG-1: Unavailable/);
});
test('meter report returns all equipment with reading health and normalized units', async () => {
  const app = harness();
  for (let i = 1; i <= 2; i++) app.records.set(`energyMonitor/site-id/meters/meter-${i}`, {
    name:`Meter ${i}`, meterId:`meter-${i}`, status:'OK', observedAt:{toMillis:() => now - 600000},
    powerUnits:'base', active_power:20000, fwd_Wh:100000, R_voltage_ln:230
  });
  const messages = await app.report('meters');
  assert.equal(messages.length,2);
  assert.match(messages[0], /Stale reading/);
  assert.match(messages[0], /100 kWh \| Power: 20 kW/);
  assert.match(messages[1], /Meter 2/);
});
test('long reports split without dropping text', () => {
  const input = 'x'.repeat(9000);
  const parts = chunks([input]);
  assert.ok(parts.every(p => p.length <= 3500));
  assert.equal(parts.join(''), input);
});

test('site commands accept case and spaces in site names', () => {
  assert.deepEqual(siteReportCommand('/Asansol: Site Status'), {site:'Asansol',kind:'siteStatus'});
  assert.deepEqual(siteReportCommand('/Mira Tower: METER   data'), {site:'Mira Tower',kind:'meters'});
  assert.deepEqual(siteReportCommand('/Kharagpur: present fuel'), {site:'Kharagpur',kind:'fuel'});
  assert.equal(siteReportCommand('/meter data'),null);
  assert.equal(siteReportCommand('/Asansol: unsupported').kind,null);
});

test('only current active Admin and Super Admin roles can read a named site', async () => {
  const app = harness();
  const user = app.records.get('users/u');
  for (const role of ['User','Super User','admin',undefined]) {
    user.role = role;
    assert.match((await reportMessages(app.db,'42','meters',now,'Globsyn'))[0], /Only Admin and Super Admin/);
  }
  assert.equal(app.queries.length,0);
  for (const role of ['Admin','Super Admin']) {
    user.role = role;
    delete user.siteId;
    await reportMessages(app.db,'42','meters',now,'gLoBsYn');
    assert.equal(app.queries.at(-1),'energyMonitor/N19114A/meters');
  }
  const reads = app.queries.length;
  user.role = 'User';
  await reportMessages(app.db,'42','fuel',now,'Kharagpur');
  assert.equal(app.queries.length, reads);
});

test('admin named-site fuel and status use canonical site paths; unknown sites are refused', async () => {
  const app = harness();
  app.records.get('users/u').role = 'Admin';
  app.records.set('sitePowerStatus/Asansol', {powerSource:'DG',dgNumber:'DG-2',updatedAt:{toMillis:() => now}});
  const status = (await reportMessages(app.db,'42','siteStatus',now,'asansol'))[0];
  assert.match(status,/Power source: DG\nRunning DG: DG-2/);
  assert.match(status,/IST/);
  await reportMessages(app.db,'42','fuel',now,'kharagpur');
  assert.ok(app.queries.includes('dailyDGLogs/Kharagpur/2026-11'));
  const count = app.queries.length;
  assert.match((await reportMessages(app.db,'42','meters',now,'../bad'))[0],/Unknown site/);
  assert.equal(app.queries.length,count);
  app.records.get('users/u').isActive = false;
  assert.match((await reportMessages(app.db,'42','siteStatus',now,'Asansol'))[0],/inactive/);
});
