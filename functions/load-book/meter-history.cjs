const DAY_MS = 86400000;
const DEFAULT_RETENTION_DAYS = 7;
const SAMPLE_MINUTES = 15;
const istDate = ms => new Date(ms + 330 * 60000).toISOString().slice(0, 10);
const shiftDate = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
function historySettings(data = {}) {
  return { enabled: data.enabled !== false, retentionDays: Number.isInteger(data.retentionDays) && data.retentionDays >= 7 && data.retentionDays <= 365 ? data.retentionDays : DEFAULT_RETENTION_DAYS };
}
function meterIdentity(meter, id) {
  const point = [meter.pointId, meter.point_id, meter.point, meter.energyBookPointId].find(v => typeof v === 'string' && v.trim());
  const name = typeof meter.name === 'string' ? meter.name.normalize('NFKC').trim().toLowerCase().replace(/[\s_-]+/g, ' ').replace(/\b0+(\d+)\b/g, '$1') : '';
  return encodeURIComponent(point ? `point:${point.trim()}` : name ? `name:${name}` : `id:${id}`);
}
function buildSample(meter, meterId, eventMs) {
  const at = meter?.observedAt?.toMillis?.();
  if (meter?.status !== 'OK' || !Number.isFinite(at) || at <= 0 || !Number.isFinite(eventMs) || at > eventMs + 5000 || eventMs - at > 120000) return null;
  if (typeof meter.fwd_Wh !== 'number' || !Number.isFinite(meter.fwd_Wh) || meter.fwd_Wh < 0) return null;
  if (meter.energyUnits != null && !['Wh', 'base', 'kWh', 'kilo'].includes(meter.energyUnits)) return null;
  const kwh = meter.fwd_Wh / (['kWh', 'kilo'].includes(meter.energyUnits) ? 1 : 1000);
  const date = istDate(at);
  const readings = Object.fromEntries(Object.entries(meter).filter(([, value]) => typeof value === 'number' && Number.isFinite(value)));
  return { meterKey: meterIdentity(meter, meterId), meterId, meterName: meter.name || meterId, date, observedAtMs: at, kwh, readings, powerUnits: meter.powerUnits || 'raw', energyUnits: meter.energyUnits || 'base', bucket: `${date}_${Math.floor((at + 330 * 60000) % DAY_MS / (SAMPLE_MINUTES * 60000))}` };
}
const numeric = value => typeof value === 'number' && Number.isFinite(value);
function planDailyCapture(sample, current, previous, next) {
  const first = !current || sample.observedAtMs < current.firstAtMs;
  const last = !current || sample.observedAtMs > current.lastAtMs;
  const previousClosing = previous?.closingKwh;
  const firstKwh = first ? sample.kwh : current.firstKwh;
  const firstAtMs = first ? sample.observedAtMs : current.firstAtMs;
  const closingKwh = last ? sample.kwh : current.closingKwh;
  const lastAtMs = last ? sample.observedAtMs : current.lastAtMs;
  const carried = numeric(previousClosing) || current?.openingSource === 'previous-day-closing';
  const openingKwh = numeric(previousClosing) ? previousClosing : carried ? current.openingKwh : firstKwh;
  const between = current && !first && !last && (sample.kwh < current.firstKwh || sample.kwh > current.closingKwh);
  const resetDuringDay = Boolean(current?.counterReset) || Boolean(between) || (current && ((last && sample.kwh < current.closingKwh) || (first && sample.kwh > current.firstKwh)));
  const daily = { meterKey: sample.meterKey, meterId: last ? sample.meterId : current.meterId, meterName: last ? sample.meterName : current.meterName, date: sample.date,
    openingKwh, closingKwh, firstKwh, firstAtMs, lastAtMs, openingSource: carried ? 'previous-day-closing' : 'first-captured-reading',
    previousDate: shiftDate(sample.date, -1), counterReset: Boolean(resetDuringDay || closingKwh < openingKwh), captureCount: (current?.captureCount || 0) + 1 };
  const nextPatch = next && (next.openingKwh !== closingKwh || next.openingSource !== 'previous-day-closing') ? { openingKwh: closingKwh, openingSource: 'previous-day-closing', previousDate: sample.date, counterReset: Boolean(next.counterReset || next.closingKwh < closingKwh) } : null;
  return { daily, nextPatch };
}
module.exports = { DAY_MS, SAMPLE_MINUTES, DEFAULT_RETENTION_DAYS, istDate, shiftDate, historySettings, meterIdentity, buildSample, planDailyCapture };
