// Calendar arithmetic uses UTC so the browser's timezone cannot shift the day.
export const addDays = (date, amount) => {
  if (!date) return '';
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
};

export const addMonths = (month, amount) => {
  if (!month) return '';
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number - 1 + amount, 1)).toISOString().slice(0, 7);
};

export const clampDateToMonth = (month, date, today) => {
  if (!month) return '';
  const [year, number] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const day = Math.min(Number(date?.slice(8, 10)) || 1, lastDay);
  const result = `${month}-${String(day).padStart(2, '0')}`;
  return today && result > today ? today : result;
};
