const reading = value => value !== null && value !== undefined && String(value).trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : '';

// Read the same date/run paths used when saving a DG log. No collection-group
// index or parent date document is needed. Stop as soon as both counters exist.
export async function findPreviousRunReadings({date, dg, readRuns, cancelled = () => false, maxDays = 3660}) {
  const cursor = new Date(date + 'T12:00:00');
  const result = {hrMeterStart:'', kwhMeterStart:''};
  for (let day = 0; day < maxDays && !cancelled(); day++) {
    const key = cursor.getFullYear() + '-' + String(cursor.getMonth()+1).padStart(2,'0') + '-' + String(cursor.getDate()).padStart(2,'0');
    const month = cursor.toLocaleString('en-US', {month:'short'}) + '-' + cursor.getFullYear();
    const readings = openingRunReadings(await readRuns(month, key), dg);
    if (cancelled()) return result;
    for (const field of Object.keys(result)) if (result[field] === '') result[field] = readings[field];
    if (Object.values(result).every(value => value !== '')) break;
    cursor.setDate(cursor.getDate()-1);
  }
  return result;
}

export function openingRunReadings(runs, dg, date) {
  const sorted = runs.filter(run => run.dgNumber === dg && (!date || /^\d{4}-\d{2}-\d{2}$/.test(run.date || '') && run.date <= date)).sort((a, b) =>
    String(b.date || '').localeCompare(String(a.date || '')) ||
    String(b.stopTime || b.startTime || '').localeCompare(String(a.stopTime || a.startTime || '')) ||
    (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
  const latest = field => {
    for (const run of sorted) {
      const value = reading(run[field]);
      if (value !== '') return value;
    }
    return '';
  };
  return {hrMeterStart:latest('hrMeterEnd'), kwhMeterStart:latest('kwhMeterEnd')};
}

export function dailyOpeningReadings(rows, dg, date) {
  const sorted = rows.filter(row => /^\d{4}-\d{2}-\d{2}$/.test(row.Date || '') && row.Date <= date)
    .sort((a,b) => b.Date.localeCompare(a.Date));
  const latest = meter => {
    for (const row of sorted) {
      const value = reading(row[`${dg} ${meter} ${row.Date === date ? 'Opening' : 'Closing'}`]);
      if (value !== '') return value;
    }
    return '';
  };
  return {hrMeterStart:latest('Hour'), kwhMeterStart:latest('KWH')};
}
