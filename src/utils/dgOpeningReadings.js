const reading = value => value !== null && value !== undefined && String(value).trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : '';

export function openingRunReadings(runs, dg) {
  const sorted = runs.filter(run => run.dgNumber === dg).sort((a, b) =>
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
