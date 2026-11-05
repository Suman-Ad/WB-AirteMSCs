const {meterNotificationStatus,meterStatusIcon} = require('./meter-notification-status.cjs');
const {createHash} = require('node:crypto');
const {meterIdentity, istDate} = require('./meter-history.cjs');
const INTERVALS = [30, 60, 120, 240, 360, 720, 1440];
function settings(data = {}) {
  return {enabled: data.enabled !== false, intervalMinutes: INTERVALS.includes(data.intervalMinutes) ? data.intervalMinutes : 120};
}
function slotAt(now, config) {
  const {enabled, intervalMinutes} = settings(config);
  const local = now + 330 * 60000;
  const minutes = Math.floor((local % 86400000) / 60000);
  if (!enabled || minutes % intervalMinutes >= 5) return null;
  return `${istDate(now)}-${String(Math.floor(minutes / intervalMinutes) * intervalMinutes).padStart(4, '0')}`;
}
const eligibleUser = (user, siteId) => user?.isActive === true && user.siteId === siteId;
const numeric = v => typeof v === 'number' && Number.isFinite(v);
const format = v => numeric(v) ? v.toLocaleString('en-IN', {maximumFractionDigits: 2}) : 'Unavailable';
function currentMeters(documents, now) {
  const groups = new Map();
  const records = documents.some(d => d.id !== 'test-meter') ? documents.filter(d => d.id !== 'test-meter') : documents;
  for (const doc of records) {
    const meter = doc.data(), key = meterIdentity(meter, doc.id);
    const old = groups.get(key);
    const at = m => { const t = m.observedAt?.toMillis?.(); return numeric(t) && t <= now + 5000 ? t : -Infinity; };
    if (!old || at(meter) > at(old.data())) groups.set(key, doc);
  }
  return [...groups.values()];
}
function notification(meter, meterId, siteId, siteName, now) {
  const at = meter.observedAt?.toMillis?.();
  const validTime = numeric(at) && at > 0 && at <= now + 5000;
  const status = meterNotificationStatus(meter,now);
  const health = status.readingState;
  const read = key => meter.status === 'OK' && numeric(meter[key]) ? meter[key] : null;
  const power = ['base', 'kilo'].includes(meter.powerUnits) && read('active_power') !== null ? read('active_power') / (meter.powerUnits === 'base' ? 1000 : 1) : null;
  const kwh = [undefined, null, 'Wh', 'base', 'kWh', 'kilo'].includes(meter.energyUnits) && read('fwd_Wh') !== null && read('fwd_Wh') >= 0 ? read('fwd_Wh') / (['kWh', 'kilo'].includes(meter.energyUnits) ? 1 : 1000) : null;
  return {title: `Meter update · ${String(meter.name || meterId).slice(0, 100)}`, message: [
    `${String(siteName || siteId).slice(0, 100)} · ${meterStatusIcon(status.meterState)} ${health}`,
    `Energy: ${format(kwh)} kWh | Power: ${format(power)} kW`,
    `Voltage R/Y/B: ${['R','Y','B'].map(p => format(read(`${p}_voltage_ln`))).join(' / ')} V L-N`,
    `Current R/Y/B: ${['R','Y','B'].map(p => format(read(`${p}_current`))).join(' / ')} A`,
    `PF: ${format(read('power_factor'))} | Frequency: ${format(read('frequency'))} Hz`,
    `Observed: ${validTime ? new Date(at).toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'}) + ' IST' : 'Unavailable'}`
  ].join('\n'), actionType: 'energy_meter_update', url: '/energy-monitor', read: false, date: istDate(now), siteId, meterId, ...status};
}
const notificationId = (siteId, meter, meterId, slot) => 'energy-' + createHash('sha256').update(JSON.stringify([siteId, meterIdentity(meter, meterId), slot])).digest('hex');
module.exports = {INTERVALS, settings, slotAt, eligibleUser, currentMeters, notification, notificationId};
