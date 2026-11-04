const {istDate, shiftDate} = require('./meter-history.cjs');
const {numeric, fuelSnapshot} = require('./energy-changeover-fuel.cjs');
const hours = value => {
  if (!Number.isFinite(value) || value < 0) return 'Unavailable';
  const minutes = Math.round(value * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2,'0')}:${String(minutes % 60).padStart(2,'0')} (HH:MM)`;
};
const sum = values => values.every(v => v !== null) ? values.reduce((a,b) => a+b,0) : null;
const decimal = (value, digits) => value !== null && Number.isFinite(value) ? value.toFixed(digits) : 'Unavailable';

async function dhrMessages(db, siteName, siteId, now, user = {}) {
  const date = istDate(now), yesterday = shiftDate(date,-1);
  const runMonth = new Date(`${yesterday}T12:00:00+05:30`).toLocaleString('en-US',{month:'short',timeZone:'Asia/Kolkata'}) + '-' + yesterday.slice(0,4);
  const previous = shiftDate(`${date.slice(0,7)}-01`,-1).slice(0,7);
  const [configDoc, runDocs, ...snapshots] = await Promise.all([
    db.doc(`siteConfigs/${siteName.toUpperCase()}`).get(),
    db.collection(`dgLogs/${siteName}/${runMonth}/${yesterday}/runs`).get(),
    ...[date.slice(0,7),previous].map(month => db.collection(`dailyDGLogs/${siteName}/${month}`).get())
  ]);
  const config = configDoc.data() || {};
  const rows = snapshots.flatMap(s => s.docs.map(d => ({...d.data(),Date:d.data().Date || d.id})))
    .filter(r => /^\d{4}-\d{2}-\d{2}$/.test(r.Date || '') && r.Date <= date).sort((a,b) => b.Date.localeCompare(a.Date));
  // DHR preview uses yesterday's total run hours minus its No Load run hours.
  const runs = runDocs.docs.map(d => d.data());
  const total = sum(runs.map(r => numeric(r.totalRunHours) ?? (r.totalRunHours == null || r.totalRunHours === '' ? 0 : null)));
  const off = sum(runs.filter(r => r.remarks === 'No Load').map(r => numeric(r.totalRunHours) ?? (r.totalRunHours == null || r.totalRunHours === '' ? 0 : null)));
  const on = total !== null && off !== null ? total-off : null;
  // Retain the DHR preview's 24-hour guard as well as its on-load subtraction.
  const eb = on !== null ? total < 24 ? 24-on : 0 : null;
  const stock = fuelSnapshot(config,rows,date);
  const fuel = stock.generators.length ? sum(stock.generators.flatMap(g => [g.dayLitres,g.externalLitres])) : null;
  const latest = rows[0];
  const energies = [];
  for (const [field,prefix] of [['dgCount','DG'],['ebCount','EB'],['solarCount','Solar']]) {
    const count = Math.max(0,Math.min(4,Math.trunc(Number(config[field]) || 0)));
    for (let i=1;i<=count;i++) {
      const start = numeric(latest?.[`${prefix}-${i} KWH Opening`]), end = numeric(latest?.[`${prefix}-${i} KWH Closing`]);
      energies.push(start !== null && end !== null && end >= start ? end-start : null);
    }
  }
  const energy = latest && energies.length ? sum(energies) : null;
  const ownSite = user.siteId === siteId;
  return [[
    `${siteName} — Daily Health Report`,
    `📊 DHR Date: ${date.split('-').reverse().join('.')}`,
    `🏙️ Region: ${config.region || (ownSite && user.region) || 'Unavailable'}`,
    `🔄 Circle: ${config.circle || (ownSite && user.circle) || 'Unavailable'}`,
    `📍 Site Name: ${siteName}`,
    `⛽ Diesel Available: ${decimal(fuel,2)} Ltrs.`,
    `🕑 DG Run Hrs (Yesterday): ${hours(on)}`,
    `⚡ EB Run Hrs (Yesterday): ${hours(eb)}`,
    ...[['🔌 EB Status','ebStatus'],['🔋 DG Status','dgStatus'],['⚙️ SMPS Status','smpsStatus'],['🔄 UPS Status','upsStatus'],['❄️ PAC Status','pacStatus'],['❄️ CRV Status','crvStatus']].map(([label,key]) => `${label}: ${config[key] || 'N/A'}`),
    `📝 Major Activity: ${config.majorActivity || 'N'}`,
    `🛠️ Inhouse PM: ${config.inHousePm || 'N'}`,
    `🚨 Fault Details: ${config.faultDetails || 'N'}`,
    `⚡ Total kW Unit: ${decimal(energy,3)} kWh`,
    `Run date: ${yesterday} (IST); DG hours exclude No Load, as in Preview & Share DHR.`,
    `Fuel / energy saved log: ${latest?.Date || 'Unavailable'}`
  ].join('\n')];
}
module.exports = {dhrMessages};
