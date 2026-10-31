import { consumption, numberValue } from "./energyReportData";

export const validHistoryDate = date => /^\d{4}-\d{2}-\d{2}$/.test(date || "") && Number.isFinite(Date.parse(`${date}T12:00:00Z`)) && new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date;
export const shiftHistoryDate = (date, days) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
export const historyDates = date => Array.from({ length: 7 }, (_, i) => shiftHistoryDate(date, i - 6));
export function historyMeterKey(meter) {
  const point = [meter.pointId, meter.point_id, meter.point, meter.energyBookPointId].find(v => typeof v === "string" && v.trim());
  const name = typeof meter.name === "string" ? meter.name.normalize("NFKC").trim().toLowerCase().replace(/[\s_-]+/g, " ").replace(/\b0+(\d+)\b/g, "$1") : "";
  return encodeURIComponent(point ? `point:${point.trim()}` : name ? `name:${name}` : `id:${meter.id}`);
}
export function meterDailyRows(meterKey, records, date) {
  const byDate = new Map(records.filter(r => r.meterKey === meterKey).map(r => [r.date, r]));
  return historyDates(date).map(day => {
    const record = byDate.get(day), previous = byDate.get(shiftHistoryDate(day, -1));
    const priorClosing = numberValue(previous?.closingKwh);
    const opening = priorClosing ?? numberValue(record?.openingKwh);
    const closing = numberValue(record?.closingKwh);
    const reset = Boolean(record?.counterReset) || (opening !== null && closing !== null && closing < opening);
    const carried = priorClosing !== null || record?.openingSource === "previous-day-closing";
    return { date: day, opening, closing, usage: reset ? null : consumption(opening, closing), reset, carried, record,
      quality: reset ? "Counter decreased / reset" : !record ? "No saved readings" : !carried ? "First captured reading; previous day unavailable" : "Previous closing carried forward" };
  });
}
export function reportMeters(meters, records, date) {
  const result = new Map();
  meters.forEach(meter => result.set(historyMeterKey(meter), { key: historyMeterKey(meter), name: meter.name || meter.id, meterId: meter.id, meter }));
  records.filter(record => validHistoryDate(record.date)).sort((a, b) => b.date.localeCompare(a.date)).forEach(record => {
    if (!record.meterKey || result.has(record.meterKey) || record.date < shiftHistoryDate(date, -6)) return;
    result.set(record.meterKey, { key: record.meterKey, name: record.meterName || record.meterId, meterId: record.meterId });
  });
  return [...result.values()];
}
