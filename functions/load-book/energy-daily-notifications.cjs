const {createHash} = require('node:crypto');
const {istDate, shiftDate} = require('./meter-history.cjs');
const numeric = v => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const format = v => numeric(v) ? v.toLocaleString('en-IN', {maximumFractionDigits: 2}) : 'Unavailable';
const time = v => numeric(v) && v > 0 ? new Date(v).toLocaleString('en-IN', {timeZone:'Asia/Kolkata'}) + ' IST' : 'Unavailable';
function reportDate(scheduledTime, now) {
  const scheduled = typeof scheduledTime === 'string' ? Date.parse(scheduledTime) : NaN;
  return shiftDate(istDate(Number.isFinite(scheduled) ? scheduled : now), -1);
}
function dailyNotification(daily, previous, meter, siteId, siteName, date) {
  const valid = daily?.date === date;
  const opening = valid ? daily.openingKwh : null, closing = valid ? daily.closingKwh : null;
  const reset = valid && (daily.counterReset === true || (numeric(opening) && numeric(closing) && closing < opening));
  const consumption = numeric(opening) && numeric(closing) && !reset ? closing - opening : null;
  const carried = valid && daily.openingSource === 'previous-day-closing';
  const openingAt = carried ? previous?.date === shiftDate(date, -1) ? previous.lastAtMs : null : valid ? daily.firstAtMs : null;
  const closingAt = valid ? daily.lastAtMs : null;
  const incomplete = !valid || !numeric(opening) || !numeric(closing) || !numeric(openingAt) || !numeric(closingAt) ||
    openingAt < Date.parse(`${date}T00:00:00+05:30`) - 300000 ||
    openingAt > Date.parse(`${date}T00:05:00+05:30`) || closingAt < Date.parse(`${date}T23:55:00+05:30`);
  return {title:`Daily kWh · ${String(daily?.meterName || meter?.name || meter?.id || 'Meter').slice(0, 100)}`,
    message:[`${String(siteName || siteId).slice(0, 100)} · ${date} (IST)`,
      `Opening: ${format(opening)} kWh`, `Closing: ${format(closing)} kWh`,
      `Recorded consumption: ${format(consumption)} kWh`,
      `Opening source: ${carried ? 'previous-day closing' : valid ? 'first captured reading' : 'no daily register'}. Observed: ${time(openingAt)}`,
      `Closing observed: ${time(closingAt)}`,
      reset ? 'Counter reset detected; consumption unavailable.' : incomplete ? 'Incomplete coverage / missing readings; values are saved observations, not exact midnight readings.' : 'Values are saved observations; see observation times.'
    ].join('\n'),actionType:'energy_daily_kwh',url:'/energy-monitor',read:false,date,siteId,
    meterId:daily?.meterId || meter?.id || '', counterReset:!!reset, incompleteCoverage:incomplete};
}
const dailyId = (siteId, meterKey, date) => 'energy-daily-' + createHash('sha256').update(JSON.stringify([siteId,meterKey,date])).digest('hex');
module.exports = {reportDate,dailyNotification,dailyId};
