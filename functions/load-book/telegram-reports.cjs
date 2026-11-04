const {currentMeters, notification} = require('./energy-notifications.cjs');
const {istDate} = require('./meter-history.cjs');
const {numeric, fuelSnapshot, loadFuelSnapshot} = require('./energy-changeover-fuel.cjs');
const sites = require('./telegram-sites.cjs');
const {summaryMessages} = require('./telegram-summary.cjs');
const {dhrMessages} = require('./telegram-dhr.cjs');

const help = [
  'WB Airtel MSC',
  '📊 Site reports',
  '/summary — monthly site summary',
  '/dhr — daily health report with yesterday’s run hours',
  '/meter data — every meter reading',
  '/present fuel — opening fuel minus day consumption',
  '/site running load — latest daily average load',
  '/pue — latest daily PUE',
  '/segr — latest DG-wise SEGR',
  '',
  '📋 Operations',
  '/activity — today’s activities, CRQs, times and status (IST)',
  '/incident — open site incident details',
  'Send a daily activity table photo or JPG/PNG file to combine CRQs in existing activities (Super User/Admin/Super Admin).',
  '',
  '🌐 Administrator reports',
  'Admin and Super Admin only:',
  '/summary all — summaries for all sites',
  '/Asansol: summary — summary for a named site',
  '/Asansol: dhr — DHR for a named site',
  '/Asansol: Site Status — saved site power status',
  'Site prefixes also support activity, incident, meter data, present fuel, site running load, pue and segr.',
  '',
  '🔗 Your connection',
  '/status — connection status',
  '/stop — disconnect',
  'Connect your account using the notification bell in the app.'
].join('\n');
const aliases = {'/dhr':'dhr','/summary':'summary','/incident':'incident', '/activity':'activity', '/meter':'meters', '/meters':'meters', '/meter_data':'meters', '/present':'fuel', '/fuel':'fuel', '/present_fuel':'fuel', '/site':'load', '/load':'load', '/site_running_load':'load', '/pue':'pue', '/segr':'segr'};
function siteReportCommand(text) {
  const match = /^\/([^:\n]+):\s*(.+)$/i.exec(text.trim());
  if (!match) return null;
  const phrase = match[2].trim().toLowerCase().replace(/\s+/g, ' ');
  const kinds = {'dhr':'dhr','summary':'summary','incident':'incident', 'activity':'activity', 'site status':'siteStatus', 'meter data':'meters', 'present fuel':'fuel', 'site running load':'load', 'pue':'pue', 'segr':'segr'};
  return {site:match[1].trim(), kind:kinds[phrase] || null};
}
function reportCommand(command, args) {
  if (command === '/summary' && args === 'all') return 'summaryAll';
  if (command === '/meter' && args && args !== 'data') return null;
  if (command === '/present' && args !== 'fuel') return null;
  if (command === '/site' && args !== 'running load') return null;
  if (!['/meter', '/present', '/site'].includes(command) && args) return null;
  return aliases[command] || null;
}
const format = value => value !== null && Number.isFinite(value) ? value.toLocaleString('en-IN', {maximumFractionDigits:2}) : 'Unavailable';
const segment = value => typeof value === 'string' && value.trim() && !value.includes('/') && value !== '.' && value !== '..';
async function deductDayConsumption(db, stock, siteName, now) {
  const today = istDate(now);
  const monthKey = new Date(`${today}T12:00:00+05:30`).toLocaleString('en-US', {month:'short',timeZone:'Asia/Kolkata'}) + '-' + today.slice(0,4);
  const runs = (await db.collection(`dgLogs/${siteName}/${monthKey}/${today}/runs`).get()).docs.map(doc => doc.data());
  for (const generator of stock.generators) {
    const opening = stock.stockDate === today ? generator.openingLitres : generator.dayLitres;
    const values = runs.filter(run => run.dgNumber === generator.dg).map(run => numeric(run.fuelConsumption));
    const remaining = opening !== null && values.every(value => value !== null)
    ? opening - values.reduce((sum,value) => sum + value,0) : null;
    generator.openingLitres = opening;
    generator.dayConsumption = values.every(value => value !== null) ? values.reduce((sum,value) => sum + value,0) : null;
    generator.dayLitres = remaining !== null && remaining >= 0 ? remaining : null;
  }
  return today;
}
async function reportMessages(db, chatId, kind, now = Date.now(), requestedSite = null) {
  const binding = (await db.doc(`telegramChats/${chatId}`).get()).data();
  if (!binding) return ['Connect Telegram from the app notification bell to view site data.'];
  const [prefDoc, userDoc] = await Promise.all([
    db.doc(`notificationPreferences/${binding.uid}`).get(), db.doc(`users/${binding.uid}`).get()
  ]);
  const pref = prefDoc.data(), user = userDoc.data();
  if (!user || user.isActive !== true || binding.uid === 'n89Dopqa4ybdE8VX6B5zUwJYMcx1' || !pref?.telegramEnabled || pref.telegramChatId !== chatId) {
    return ['Your Telegram connection is inactive. Connect an active account from the app notification bell.'];
  }
  if (kind === 'summaryAll') {
    if (!['Admin', 'Super Admin'].includes(user.role)) return ['Only Admin and Super Admin users can request all-site summaries. Use /summary for your assigned site.'];
    const messages = [];
    const names = Object.keys(sites);
    for (let i = 0; i < names.length; i += 4) {
      const batch = await Promise.all(names.slice(i, i + 4).map(name => reportMessages(db, chatId, 'summary', now, name)));
      messages.push(...batch.flat());
    }
    return [messages.join('\n\n')];
  }
  let siteId = user.siteId, siteName = segment(user.site) ? user.site.trim() : siteId;
  if (requestedSite !== null) {
    // Check the current stored role before resolving or reading any other site.
    if (!['Admin', 'Super Admin'].includes(user.role)) return ['Only Admin and Super Admin users can request data by site name. Use the regular commands for your assigned site.'];
    const name = Object.keys(sites).find(name => name.toLowerCase() === requestedSite.toLowerCase());
    if (!name) return ['Unknown site. Use a site name from the app, for example /Asansol: Site Status.'];
    siteName = name; siteId = sites[name];
  }
  if (!segment(siteId)) return ['No site is assigned to your account. Update your app profile first.'];
  const controlFields = {dhr:'telegramDhrEnabled',summary:'telegramSummaryEnabled',meters:'telegramMetersEnabled',fuel:'telegramFuelEnabled',load:'telegramLoadEnabled',pue:'telegramPueEnabled',segr:'telegramSegrEnabled',siteStatus:'telegramSiteStatusEnabled',activity:'telegramActivityEnabled',incident:'telegramIncidentEnabled'};
  const controls = (await db.doc(`energyMonitor/${siteId}/config/notifications`).get()).data() || {};
  if (controls[controlFields[kind]] === false) return [`${siteName}: This Telegram report is paused by an administrator.`];
  if (kind === 'dhr') {
    if (!segment(siteName)) return ['No site name is assigned to your account. Update your app profile to view DHR.'];
    return dhrMessages(db, siteName, siteId, now, user);
  }
  if (kind === 'summary') {
    if (!segment(siteName)) return ['No site name is assigned to your account. Update your app profile to view the summary.'];
    return summaryMessages(db, siteName, siteId, now);
  }
  if (kind === 'incident') {
    const snapshot = await db.collection('incidents').where('siteId','==',siteId).get();
    const rows = snapshot.docs.map(doc => ({...doc.data(),id:doc.id}))
      .filter(row => String(row.status || '').trim().toLowerCase() === 'open')
      .sort((a,b) => String(b.dateKey || '').localeCompare(String(a.dateKey || '')) || a.id.localeCompare(b.id));
    if (!rows.length) return [`${siteName}: No open incidents.`];
    return [`${siteName}\nOpen incidents: ${rows.length}`, ...rows.map((row,index) => [
      `${index + 1}. ${row.incidentTitle || 'Untitled incident'}`,
      `Status: Open`,
      `Docket: ${row.ttDocketNo || 'To be raised'}`,
      `Date/time: ${row.dateKey || row.dateOfIncident || 'Unavailable'} ${row.timeOfIncident || ''}`.trim(),
      `Equipment: ${row.equipmentCategory || 'Unspecified'}`,
      `Description: ${row.incidentDescription || 'Not provided'}`,
      row.type && `Type: ${row.type}`,
      row.saNsa && `SA/NSA: ${row.saNsa}`,
      row.effectedEquipmentDetails && `Affected equipment: ${row.effectedEquipmentDetails}`,
      row.ompPartner && `OEM partner: ${row.ompPartner}`,
      row.actionsTaken && `Actions taken: ${row.actionsTaken}`,
      row.ownership && `Ownership: ${row.ownership}`,
      `RCA: ${row.rcaStatus === 'Y' ? 'Received' : row.rcaStatus === 'N' ? 'Pending' : 'Not specified'}`,
      row.remarks && `Remarks: ${row.remarks}`
    ].filter(Boolean).join('\n'))];
  }
  if (kind === 'activity') {
    const date = istDate(now);
    const start = new Date(`${date}T00:00:00+05:30`);
    const end = new Date(start.getTime() + 86400000);
    const collection = db.collection('daily_activity_sheets');
    const snapshots = await Promise.all([
      collection.where('date', '==', date).get(),
      collection.where('date', '>=', start).where('date', '<', end).get()
    ]);
    const normalize = value => String(value || '').trim().toLowerCase();
    const sheets = [...new Map(snapshots.flatMap(s => s.docs).map(d => [d.id, d.data()])).values()];
    const rows = sheets.filter(sheet => sheet.siteId ? sheet.siteId === siteId : normalize(sheet.siteName) === normalize(siteName))
      .flatMap(sheet => Array.isArray(sheet.rows) ? sheet.rows.filter(row => row && typeof row === 'object') : [])
      .sort((a,b) => String(a.activityStartTime || '').localeCompare(String(b.activityStartTime || '')));
    const heading = `${siteName}\nActivities: ${date} (IST)`;
    if (!rows.length) return [`${heading}\nNo activities scheduled for today.`];
    return [heading + `\n${rows.length} activity row(s)`, ...rows.map((row,index) => [
      `${index + 1}. ${row.nodeName || 'Node unspecified'} — ${row.activityDetails || 'Activity unspecified'}`,
      `CRQ/PE: ${row.crqNo || 'Not assigned'}`,
      `Time: ${row.activityStartTime || '—'} to ${row.activityEndTime || '—'} IST`,
      `Status: ${row.pmStatus || 'Pending'}`,
      row.activityType && `Type: ${row.activityType}`,
      row.notes && `Notes: ${row.notes}`
    ].filter(Boolean).join('\n'))];
  }
  if (kind === 'siteStatus') {
    const status = (await db.doc(`sitePowerStatus/${siteName}`).get()).data();
    if (!status) return [`${siteName}: No saved site status available.`];
    const source = ['EB','DG'].includes(status.powerSource) ? status.powerSource : 'Unavailable';
    const dg = String(status.dgNumber || status.selectedDG || 'Unavailable').slice(0,100);
    const stock = await loadFuelSnapshot(db, {siteName, startAtMs:now, dgNumber:source === 'DG' ? dg : undefined}, 'start', siteId);
    const today = await deductDayConsumption(db, stock, siteName, now);
    const litres = value => value !== null && Number.isFinite(value) ? String(Math.round(value * 100) / 100) : 'Unavailable';
    const complete = stock.generators.length > 0 && stock.generators.every(g => g.dayLitres !== null && g.externalLitres !== null);
    const external = complete ? stock.generators.reduce((sum,g) => sum + g.externalLitres,0) : null;
    const total = complete ? stock.generators.reduce((sum,g) => sum + g.dayLitres + g.externalLitres,0) : null;
    const rate = stock.generators.find(g => g.dg === dg)?.litresPerHour;
    const backup = total !== null && rate > 0 ? `Approximately ${(total / rate).toFixed(2)} hrs.` : 'Unavailable';
    const at = status.updatedAt?.toMillis?.();
    const observed = Number.isFinite(at) && at > 0 && at <= now + 5000
      ? new Date(at).toLocaleString('en-IN', {timeZone:'Asia/Kolkata'}) + ' IST' : 'Unavailable';
    return [[
      `Site Name:-${siteName} MSC`,
      source === 'DG' ? `Site On ${dg} Running.` : source === 'EB' ? 'Site On EB Supply.' : 'Site power source: Unavailable.',
      'Diesel stock:-',
      ...stock.generators.map(g => `${g.dg}: ${litres(g.dayLitres)} Ltrs`),
      `External metal drum stock-${litres(external)} L`,
      `Total stock-${litres(total)} liters.`,
      `Diesel Backup :- ${backup}`,
      status.mainsFailReason ? `Mains fail happened due to ${status.mainsFailReason}` : '',
      status.expectedRestoration ? `\nAs per discussion with the electricity team, power will be restored approximately ${status.expectedRestoration}` : '',
      `\nStatus updated: ${observed}`,
      `Fuel stock base: ${stock.stockDate || 'Unavailable'}; consumption deducted: ${today} (IST)`
    ].filter(Boolean).join('\n')];
  }
  if (kind === 'meters') {
    const meters = currentMeters((await db.collection(`energyMonitor/${siteId}/meters`).get()).docs, now);
    return meters.length ? meters.map(doc => {
      const report = notification(doc.data(), doc.id, siteId, siteName, now);
      return `${report.title}\n${report.message}`;
    }) : [`${siteName}: No meter readings available.`];
  }
  if (requestedSite === null && !segment(user.site)) return ['No site name is assigned to your account. Update your app profile to view DG logs.'];
  const date = istDate(now);
  const previous = new Date(`${date.slice(0,7)}-01T12:00:00Z`);
  previous.setUTCMonth(previous.getUTCMonth() - 1);
  const [configDoc, ...snapshots] = await Promise.all([
    db.doc(`siteConfigs/${siteName.toUpperCase()}`).get(),
    ...[date.slice(0,7), previous.toISOString().slice(0,7)].map(month => db.collection(`dailyDGLogs/${siteName}/${month}`).get())
  ]);
  const config = configDoc.data() || {};
  const rows = snapshots.flatMap(s => s.docs.map(d => ({...d.data(), Date:d.data().Date || d.id})))
    .filter(r => /^\d{4}-\d{2}-\d{2}$/.test(r.Date || '') && r.Date <= date).sort((a,b) => b.Date.localeCompare(a.Date));
  if (!rows.length) return [`${siteName}: No saved DG logs in the current or previous month.`];
  const row = rows[0], heading = `${siteName}\nSaved daily log: ${row.Date} (IST)\n`;
  if (kind === 'fuel') {
    const stock = fuelSnapshot(config, rows, date);
    const today = await deductDayConsumption(db, stock, siteName, now);
    return [heading + `Present fuel: ${today} (IST)\nPresent fuel = opening fuel - day consumption\n` + (stock.generators.map(dg =>
      `${dg.dg}: Opening fuel ${format(dg.openingLitres)} L | Day consumption ${format(dg.dayConsumption)} L | Present fuel ${format(dg.dayLitres)} L | External ${format(dg.externalLitres)} L`
    ).join('\n') || 'No DG stock recorded.')];
  }
  const count = (key, prefix) => Math.max(0, Math.min(4, Number(config[key]) || Math.max(0, ...Object.keys(row).map(k => Number(new RegExp(`^${prefix}-([1-4]) `).exec(k)?.[1]) || 0))));
  const delta = (prefix, i) => {
    const opening = numeric(row[`${prefix}-${i} KWH Opening`]), closing = numeric(row[`${prefix}-${i} KWH Closing`]);
    return opening !== null && closing !== null && closing >= opening ? closing - opening : null;
  };
  const dgCount = count('dgCount', 'DG');
  if (kind === 'segr') {
    let totalEnergy = 0, totalFuel = 0, complete = dgCount > 0;
    const lines = Array.from({length:dgCount}, (_, index) => {
      const i = index + 1, dg = `DG-${i}`, energy = delta('DG', i);
      const open = numeric(row[`${dg} Fuel Opening`]), close = numeric(row[`${dg} Fuel Closing`]);
      const fill = numeric(row[`${dg} Fuel Filling`]) ?? 0, off = numeric(row[`${dg} Off Load Fuel Consumption`]) ?? 0;
      const fuel = open !== null && close !== null ? open - close + fill - off : null;
      if (energy === null || fuel === null || fuel < 0 || (energy > 0 && fuel === 0)) complete = false;
      else {totalEnergy += energy; totalFuel += fuel;}
      return `${dg}: ${format(energy !== null && fuel > 0 ? energy / fuel : null)} kWh/L`;
    });
    return [heading + 'SEGR (generation / on-load fuel)\n' + lines.join('\n') + `\nOverall: ${format(complete && totalFuel > 0 ? totalEnergy / totalFuel : null)} kWh/L`];
  }
  let total = 0, complete = true, sources = 0;
  for (const [key, prefix] of [['dgCount','DG'], ['ebCount','EB'], ['solarCount','Solar']]) {
    for (let i = 1; i <= count(key, prefix); i++) {
      sources++;
      const energy = delta(prefix, i);
      if (energy === null) complete = false; else total += energy;
    }
  }
  const load = complete && sources > 0 ? total / 24 : null;
  if (kind === 'load') return [heading + `Site running load (daily average): ${format(load)} kW`];
  const amps = numeric(row['DCPS Load Amps']), ups = numeric(row['UPS Load KWH']), office = numeric(row['Office kW Consumption']);
  const it = amps !== null && ups !== null ? amps * 54.2 / 1000 + ups : null;
  const pue = load !== null && office !== null && it > 0 && total >= office ? (total - office) / 24 / it : null;
  return [heading + `PUE: ${format(pue)}\nCalculated from daily energy excluding office consumption, divided by IT load.`];
}

// Keep replies comfortably below Telegram's message limit without dropping meters.
function chunks(messages) {
  return messages.flatMap(text => {
    const parts = [];
    while (text.length > 3500) {
      let end = text.lastIndexOf('\n', 3500);
      if (end < 1) end = 3500;
      parts.push(text.slice(0, end)); text = text.slice(end).replace(/^\n/, '');
    }
    if (text) parts.push(text);
    return parts;
  });
}
module.exports = {help, reportCommand, siteReportCommand, reportMessages, chunks};
