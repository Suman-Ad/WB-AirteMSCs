const {createHash} = require('node:crypto');
const istDate = now => new Date(now + 330 * 60000).toISOString().slice(0, 10);
function sheetDate(value) {
  return value?.toMillis ? istDate(value.toMillis()) : typeof value === 'string' ? value : '';
}
function timeAt(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time || '')) return NaN;
  const ms = Date.parse(`${date}T${time}:00+05:30`);
  return Number.isFinite(ms) && istDate(ms) === date ? ms : NaN;
}
function dueReminders(sheet, now) {
  const date = sheetDate(sheet.date);
  if (![istDate(now), istDate(now - 86400000)].includes(date)) return [];
  return (Array.isArray(sheet.rows) ? sheet.rows : []).flatMap(row => {
    if (!row || typeof row !== 'object') return [];
    if (!/CRQ/i.test(row.crqType || '') && !/^CRQ/i.test(row.crqNo || '')) return [];
    const status = (row.pmStatus || 'Pending').trim().toLowerCase();
    if (['completed', 'cancelled', 'canceled'].includes(status)) return [];
    const start = timeAt(date, row.activityStartTime);
    let end = timeAt(date, row.activityEndTime);
    if (Number.isFinite(start) && end <= start) end += 86400000;
    // Previous-day sheets are relevant only for a shift crossing midnight.
    if (date !== istDate(now) && !(end > timeAt(date, '23:59') && now <= end)) return [];
    const types = [];
    if (status === 'pending' && Number.isFinite(start) && now >= start) types.push('open');
    if (Number.isFinite(end) && now >= end - 30 * 60000) types.push('close');
    return types.map(type => ({type, row, date}));
  });
}
const normalize = value => String(value || '').trim().toLowerCase();
function eligibleUser(user, sheet) {
  if (!sheet || !user || user.isActive !== true) return false;
  if (['Admin', 'Super Admin'].includes(user.role)) return true;
  if (user.siteId && sheet.siteId) return user.siteId === sheet.siteId;
  return Boolean(normalize(sheet.siteName) && normalize(user.site || user.siteName) === normalize(sheet.siteName));
}
function reminderId(sheetId, reminder) {
  const r = reminder.row;
  const identity = r.rowId || [r.crqNo, r.nodeName, r.activityDetails, r.activityStartTime, r.activityEndTime];
  return 'crq-' + createHash('sha256').update(JSON.stringify([sheetId, reminder.date, identity, r.crqNo, reminder.type])).digest('hex');
}
function notification(sheet, reminder) {
  const {row, type, date} = reminder;
  return {title: type === 'open' ? 'CRQ Pending Open' : 'CRQ Pending Close',
    message: `${sheet.siteName || sheet.siteId || 'Site'}: ${row.crqNo || 'CRQ'} — ${type === 'open' ? 'scheduled start reached; open/implement CRQ' : 'close CRQ before activity end'}. Activity: ${row.activityDetails || 'Not specified'}. Scheduled ${row.activityStartTime || '—'}–${row.activityEndTime || '—'} IST. Call 18001039090.`,
    actionType: `crq_${type}_reminder`, url: '/daily-activity-dashboard', read: false,
    date, siteId: sheet.siteId || '', siteName: sheet.siteName || '', crqNo: row.crqNo || ''};
}
module.exports = {istDate, dueReminders, eligibleUser, reminderId, notification};
