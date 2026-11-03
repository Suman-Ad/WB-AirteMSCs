const {createHash} = require('node:crypto');
const {meterIdentity} = require('./meter-history.cjs');
const blockedUid = 'n89Dopqa4ybdE8VX6B5zUwJYMcx1';
function eligible(user, siteId, uid) {
  return uid !== blockedUid && user?.isActive === true && (user.siteId === siteId || ['Admin','Super Admin'].includes(user.role));
}
function health(meter, now) {
  const at = meter.observedAt?.toMillis?.();
  if (!Number.isFinite(at) || at > now + 5000) return 'timestamp unavailable';
  if (now - at > Math.max(30, (Number(meter.uploadIntervalSeconds) || 10) * 3) * 1000) return 'stale reading';
  return meter.status === 'OK' ? 'healthy' : 'meter error';
}
const keyFor = (siteId, meter, id) => createHash('sha256').update(JSON.stringify([siteId,meterIdentity(meter,id)])).digest('hex');

// Persist confirmation separately for each recipient; notification and state commit together.
// Duplicate scheduler deliveries cannot advance confirmation or replay deleted bell items.
function advance(previous, condition, now) {
  const target = condition === 'healthy' ? 'online' : 'offline';
  const old = previous || {state:'online', sequence:0};
  if (now <= (old.checkedAt || 0)) return {state:old};
  if (target === old.state) return {state:{...old, candidate:'', candidateSince:0, checkedAt:now}};
  if (old.candidate !== target) return {state:{...old, candidate:target, candidateSince:now, checkedAt:now}};
  if (now - old.candidateSince < 60000) return {state:{...old,checkedAt:now}};
  const state = {state:target, sequence:(old.sequence || 0)+1, candidate:'', candidateSince:0, checkedAt:now};
  return {state, event:target};
}
function notification(meter, id, siteId, siteName, condition, event) {
  const time = meter.observedAt?.toMillis?.();
  const last = Number.isFinite(time) ? new Date(time).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'}) + ' IST' : 'Unavailable';
  return {
    title:event === 'offline' ? 'Meter readings unavailable' : 'Meter readings restored',
    message:`${siteName}: ${meter.name || id}. ${event === 'offline' ? `Confirmed unhealthy readings (${condition}). Check meter communication, EnergyBook and cloud uploads.` : 'Fresh OK readings confirmed again.'} Last observation: ${last}.`,
    actionType:event === 'offline' ? 'energy_meter_offline' : 'energy_meter_recovered',
    url:'/energy-monitor', read:false, siteId, siteName, meterId:id
  };
}
module.exports = {eligible, health, advance, keyFor, notification};
