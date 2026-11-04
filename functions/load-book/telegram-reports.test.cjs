const {test} = require('node:test');
const assert = require('node:assert/strict');
const {reportCommand, siteReportCommand, reportMessages, chunks} = require('./telegram-reports.cjs');
const now = Date.parse('2026-11-02T12:00:00+05:30');

test('each Telegram command respects its site toggle before reading report data',async()=>{
  const fields={dhr:'telegramDhrEnabled',summary:'telegramSummaryEnabled',meters:'telegramMetersEnabled',fuel:'telegramFuelEnabled',load:'telegramLoadEnabled',pue:'telegramPueEnabled',segr:'telegramSegrEnabled',siteStatus:'telegramSiteStatusEnabled',activity:'telegramActivityEnabled',incident:'telegramIncidentEnabled'};
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
  assert.match((await app.report('fuel'))[0], /2026-11-01.*\nPresent fuel: 2026-11-02 \(IST\)\nPresent fuel = opening fuel - day consumption\nDG-1: Opening fuel 80 L \| Day consumption 0 L \| Present fuel 80 L \| External 0 L/);
  assert.match((await app.report('load'))[0], /daily average\): 20 kW/);
  assert.match((await app.report('pue'))[0], /PUE: 1.9/);
  assert.match((await app.report('segr'))[0], /DG-1: 3 kWh\/L\nOverall: 3 kWh\/L/);
  assert.ok(app.queries.every(path => path.startsWith('dailyDGLogs/Asansol/') || path === 'dgLogs/Asansol/Nov-2026/2026-11-02/runs'));
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
  assert.match(status,/Site Name:-Asansol MSC\nSite On DG-2 Running\./);
  assert.match(status,/IST/);
  await reportMessages(app.db,'42','fuel',now,'kharagpur');
  assert.ok(app.queries.includes('dailyDGLogs/Kharagpur/2026-11'));
  const count = app.queries.length;
  assert.match((await reportMessages(app.db,'42','meters',now,'../bad'))[0],/Unknown site/);
  assert.equal(app.queries.length,count);
  app.records.get('users/u').isActive = false;
  assert.match((await reportMessages(app.db,'42','siteStatus',now,'Asansol'))[0],/inactive/);
});

test('site status formats saved stock and backup without hard-coding outage details', async () => {
  const app = harness();
  app.records.get('siteConfigs/ASANSOL').designCph = {'DG-1':10};
  app.row['DG-3 Fuel Closing'] = 0;
  app.row['DG-4 Fuel Closing'] = 0;
  app.row['DG-3 External Fuel Stock'] = 999;
  app.records.set('sitePowerStatus/Asansol', {powerSource:'DG',dgNumber:'DG-1',mainsFailReason:'H.T. line maintenance.',expectedRestoration:'8:30 am'});
  const reply = (await app.report('siteStatus'))[0];
  assert.match(reply, /Diesel stock:-\nDG-1: 80 Ltrs\nExternal metal drum stock-0 L\nTotal stock-80 liters\./);
  assert.match(reply, /Diesel Backup :- Approximately 8\.00 hrs\./);
  assert.doesNotMatch(reply, /DG-3|DG-4|999/);
  assert.match(reply, /Mains fail happened due to H.T. line maintenance\./);
  assert.match(reply, /power will be restored approximately 8:30 am/);
  app.records.set('sitePowerStatus/Asansol', {powerSource:'EB'});
  const restored = (await app.report('siteStatus'))[0];
  assert.match(restored, /Site On EB Supply\./);
  assert.match(restored, /Diesel Backup :- Unavailable/);
  assert.doesNotMatch(restored, /maintenance|8:30/);
});

test('site status subtracts today run consumption once and recalculates total and backup', async () => {
  const app = harness();
  app.records.get('siteConfigs/ASANSOL').designCph = {'DG-1':10};
  app.records.set('sitePowerStatus/Asansol', {powerSource:'DG',dgNumber:'DG-1'});
  const path = 'dgLogs/Asansol/Nov-2026/2026-11-02/runs';
  app.records.set(`${path}/one`, {dgNumber:'DG-1',fuelConsumption:12});
  app.records.set(`${path}/two`, {dgNumber:'DG-1',fuelConsumption:'8'});
  app.records.set(`${path}/unused`, {dgNumber:'DG-4',fuelConsumption:999});
  let reply = (await app.report('siteStatus'))[0];
  assert.match(reply, /DG-1: 60 Ltrs/);
  assert.match(reply, /Total stock-60 liters/);
  assert.match(reply, /Approximately 6\.00 hrs/);
  // A saved closing value already contains the deduction; use today's opening instead.
  app.records.set('dailyDGLogs/Asansol/2026-11/2026-11-02', {Date:'2026-11-02','DG-1 Fuel Opening':80,'DG-1 Fuel Closing':60});
  reply = (await app.report('siteStatus'))[0];
  assert.match(reply, /DG-1: 60 Ltrs/);
  app.records.set(`${path}/bad`, {dgNumber:'DG-1',fuelConsumption:'invalid'});
  assert.match((await app.report('siteStatus'))[0], /DG-1: Unavailable/);
});


test('present fuel deducts today consumption per DG from opening stock without deducting closing twice', async () => {
  const app = harness();
  app.records.get('siteConfigs/ASANSOL').dgCount = 2;
  app.row['DG-2 Fuel Closing'] = 150;
  const path = 'dgLogs/Asansol/Nov-2026/2026-11-02/runs';
  app.records.set(`${path}/one`, {dgNumber:'DG-1',fuelConsumption:12});
  app.records.set(`${path}/two`, {dgNumber:'DG-1',fuelConsumption:'8'});
  app.records.set(`${path}/three`, {dgNumber:'DG-2',fuelConsumption:30});
  app.records.set('dgLogs/Asansol/Nov-2026/2026-11-01/runs/old', {dgNumber:'DG-1',fuelConsumption:999});
  let reply = (await app.report('fuel'))[0];
  assert.match(reply, /DG-1: Opening fuel 80 L \| Day consumption 20 L \| Present fuel 60 L/);
  assert.match(reply, /DG-2: Opening fuel 150 L \| Day consumption 30 L \| Present fuel 120 L/);
  app.records.set('dailyDGLogs/Asansol/2026-11/2026-11-02', {Date:'2026-11-02','DG-1 Fuel Opening':80,'DG-1 Fuel Closing':60});
  reply = (await app.report('fuel'))[0];
  assert.match(reply, /DG-1: Opening fuel 80 L \| Day consumption 20 L \| Present fuel 60 L/);
  assert.match(reply, /DG-2: Opening fuel Unavailable L \| Day consumption 30 L \| Present fuel Unavailable L/);
  app.records.set(`${path}/bad`, {dgNumber:'DG-1',fuelConsumption:'invalid'});
  assert.match((await app.report('fuel'))[0], /DG-1: Opening fuel 80 L \| Day consumption Unavailable L \| Present fuel Unavailable L/);
  app.records.set(`${path}/bad`, {dgNumber:'DG-1',fuelConsumption:100});
  assert.match((await app.report('fuel'))[0], /Day consumption 120 L \| Present fuel Unavailable L/);
});

test('summary command supports assigned sites, admin named sites and admin-only all sites', async () => {
  assert.equal(reportCommand('/summary',''),'summary');
  assert.equal(reportCommand('/summary','all'),'summaryAll');
  assert.equal(reportCommand('/summary','other'),null);
  assert.deepEqual(siteReportCommand('/Asansol: SUMMARY'),{site:'Asansol',kind:'summary'});
  const app = harness();
  for (const role of ['User','Super User',undefined]) {
    app.records.get('users/u').role = role;
    assert.match((await app.report('summaryAll'))[0],/Only Admin/);
    assert.match((await reportMessages(app.db,'42','summary',now,'Globsyn'))[0],/Only Admin/);
  }
  assert.equal(app.queries.length,0);
  const own = (await app.report('summary')).join('\n');
  assert.match(own,/Asansol/);
  assert.doesNotMatch(own,/Today:|Current EB consumption:/);
  assert.match(own,/Monthly summary: 2026-11/);
  assert.match(own,/EB consumption: 420 kWh/);
  assert.match(own,/DG generation: 60 kWh/);
  assert.doesNotMatch(own,/Globsyn/);
  app.records.get('users/u').role = 'Admin';
  const named = (await reportMessages(app.db,'42','summary',now,'globsyn')).join('\n');
  assert.match(named,/Globsyn/);
  assert.match(named,/No saved daily logs this month/);
  for (const role of ['Admin','Super Admin']) {
    app.records.get('users/u').role = role;
    const all = await app.report('summaryAll');
    assert.ok(all.some(m => m.includes('Asansol\nMonthly summary')));
    assert.ok(all.some(m => m.includes('Globsyn\nMonthly summary')));
    assert.ok(chunks(all).every(m => m.length <= 3500));
  }
  app.records.get('users/u').isActive = false;
  const before = app.queries.length;
  assert.match((await app.report('summaryAll'))[0],/inactive/);
  assert.equal(app.queries.length,before);
});

test('monthly-only summary does not read live meters or DG runs',async()=>{
  const app=harness();
  const reply=(await app.report('summary')).join('\n');
  assert.match(reply,/Monthly summary: 2026-11/);
  assert.doesNotMatch(reply,/Today:|Live source:|Current EB consumption:|Power fail/);
  assert.ok(app.queries.every(p=>p==='dailyDGLogs/Asansol/2026-11'));
});

test('summary monthly formulas match the All Sites dashboard and exclude other months and future logs', async () => {
  const {readFileSync} = require('node:fs');
  const {runInNewContext} = require('node:vm');
  const source = readFileSync(require.resolve('../../src/pages/AllSitesDGLogs.js'),'utf8');
  const calc = readFileSync(require.resolve('../../src/utils/calculatedDGLogs.js'),'utf8').replace('export const calculateFields','const calculateFields');
  const a=source.indexOf('    function getMonthlySummary('), b=source.indexOf('    // Excel export function',a);
  const dashboard=runInNewContext(calc+'\n'+source.slice(a,b)+'\ngetMonthlySummary');
  const {getMonthlySummary}=require('./telegram-summary.cjs');
  const app=harness(), config=app.records.get('siteConfigs/ASANSOL');
  app.row['DG-1 Hour Opening']=10; app.row['DG-1 Hour Closing']=12;
  assert.deepEqual(JSON.parse(JSON.stringify(getMonthlySummary([app.row],config))),JSON.parse(JSON.stringify(dashboard([app.row],config))));
  app.records.set('dailyDGLogs/Asansol/2026-11/2026-11-03',{...app.row,Date:'2026-11-03','DG-1 Fuel Filling':9999});
  app.records.set('dailyDGLogs/Asansol/2026-10/2026-10-31',{...app.row,Date:'2026-10-31','DG-1 Fuel Filling':9999});
  const reply=(await app.report('summary'))[0];
  assert.match(reply,/1 saved day\(s\); latest log 2026-11-01/);
  assert.match(reply,/Fuel consumption: 20 L/);
  assert.match(reply,/Average DG CPH: 10 L\/h/);
  assert.doesNotMatch(reply,/9,999/);

});

test('DHR follows Preview & Share fields and yesterday run-hour calculation',async()=>{
  const app=harness();
  Object.assign(app.records.get('users/u'),{region:'East',circle:'WB'});
  Object.assign(app.records.get('siteConfigs/ASANSOL'),{ebStatus:'Healthy',dgStatus:'Standby',smpsStatus:'OK',upsStatus:'OK',pacStatus:'OK',crvStatus:'OK',majorActivity:'CRQ123',inHousePm:'Completed',faultDetails:'No faults'});
  const path='dgLogs/Asansol/Nov-2026/2026-11-01/runs';
  app.records.set(`${path}/on`,{dgNumber:'DG-1',remarks:'On Load',totalRunHours:2.5});
  app.records.set(`${path}/off`,{dgNumber:'DG-1',remarks:'No Load',totalRunHours:'0.1'});
  app.records.set('dgLogs/Asansol/Nov-2026/2026-11-02/runs/today',{totalRunHours:20,remarks:'On Load'});
  const reply=(await app.report('dhr'))[0];
  assert.match(reply,/DHR Date: 02.11.2026/);
  assert.match(reply,/Region: East\n.*Circle: WB/);
  assert.match(reply,/Diesel Available: 80.00 Ltrs/);
  assert.match(reply,/DG Run Hrs \(Yesterday\): 02:30 \(HH:MM\)/);
  assert.match(reply,/EB Run Hrs \(Yesterday\): 21:30 \(HH:MM\)/);
  assert.match(reply,/EB Status: Healthy/);
  assert.match(reply,/DG Status: Standby/);
  for(const label of ['SMPS','UPS','PAC','CRV']) assert.ok(reply.includes(`${label} Status: OK`));
  assert.match(reply,/Major Activity: CRQ123/);
  assert.match(reply,/Inhouse PM: Completed/);
  assert.match(reply,/Fault Details: No faults/);
  assert.match(reply,/Total kW Unit: 480.000 kWh/);
  assert.match(reply,/Run date: 2026-11-01 \(IST\)/);
  assert.ok(!app.queries.some(p=>p.includes('/2026-11-02/runs')));
  assert.equal(reportCommand('/dhr',''),'dhr');
  assert.equal(reportCommand('/dhr','other'),null);
  assert.deepEqual(siteReportCommand('/Asansol: DHR'),{site:'Asansol',kind:'dhr'});
});

test('DHR uses IST yesterday across year boundary and protects named-site access',async()=>{
  const app=harness(), at=Date.parse('2026-12-31T18:35:00Z');
  const path='dgLogs/Asansol/Dec-2026/2026-12-31/runs';
  app.records.set(`${path}/on`,{remarks:'On Load',totalRunHours:1.25});
  let reply=(await reportMessages(app.db,'42','dhr',at))[0];
  assert.match(reply,/DHR Date: 01.01.2027/);
  assert.match(reply,/DG Run Hrs \(Yesterday\): 01:15/);
  assert.match(reply,/EB Run Hrs \(Yesterday\): 22:45/);
  assert.ok(app.queries.includes(path));
  assert.match(reply,/Fuel \/ energy saved log: Unavailable/);
  for(const role of ['User','Super User']) {
    app.records.get('users/u').role=role;
    const before=app.queries.length;
    assert.match((await reportMessages(app.db,'42','dhr',at,'Globsyn'))[0],/Only Admin/);
    assert.equal(app.queries.length,before);
  }
  app.records.get('users/u').role='Admin';
  app.records.get('users/u').region='Own region';
  app.records.set('siteConfigs/GLOBSYN',{region:'Target region',circle:'Target circle'});
  reply=(await reportMessages(app.db,'42','dhr',at,'globsyn'))[0];
  assert.match(reply,/Globsyn — Daily Health Report/);
  assert.match(reply,/Region: Target region/);
  assert.doesNotMatch(reply,/Own region/);
  assert.match(reply,/DG Run Hrs \(Yesterday\): 00:00/);
  assert.match(reply,/EB Run Hrs \(Yesterday\): 24:00/);
  app.records.get('users/u').isActive=false;
  assert.match((await app.report('dhr'))[0],/inactive/);
});
