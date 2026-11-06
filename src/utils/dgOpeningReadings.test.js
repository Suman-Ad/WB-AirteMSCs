import {openingRunReadings, dailyOpeningReadings, findPreviousRunReadings} from './dgOpeningReadings';

test('direct run lookup crosses missing dates and month boundaries without parent documents', async () => {
  const paths = [];
  const result = await findPreviousRunReadings({date:'2026-11-02', dg:'DG-1', readRuns:async (month,date) => {
    paths.push(`${month}/${date}/runs`);
    return date === '2026-10-31' ? [{dgNumber:'DG-1',hrMeterEnd:42,kwhMeterEnd:500}] : [];
  }});
  expect(result).toEqual({hrMeterStart:42,kwhMeterStart:500});
  expect(paths).toEqual(['Nov-2026/2026-11-02/runs','Nov-2026/2026-11-01/runs','Oct-2026/2026-10-31/runs']);
});

test('direct lookup takes latest fields independently and stops on cancellation', async () => {
  let calls = 0;
  const result = await findPreviousRunReadings({date:'2026-11-06',dg:'DG-1',readRuns:async () => {
    calls++;
    return [{dgNumber:'DG-1',hrMeterEnd:calls === 1 ? 50 : 49,kwhMeterEnd:calls === 1 ? '' : 600}];
  }});
  expect(result).toEqual({hrMeterStart:50,kwhMeterStart:600});
  expect(calls).toEqual(2);
  calls = 0;
  await findPreviousRunReadings({date:'2026-11-06',dg:'DG-1',cancelled:() => calls > 0,readRuns:async () => {calls++;return [];}});
  expect(calls).toEqual(1);
});

test('finds each closing reading independently and excludes other DGs', () => {
  expect(openingRunReadings([
    {dgNumber:'DG-1', stopTime:'09:00', hrMeterEnd:120, kwhMeterEnd:500},
    {dgNumber:'DG-1', stopTime:'10:00', hrMeterEnd:121, kwhMeterEnd:''},
    {dgNumber:'DG-2', stopTime:'11:00', hrMeterEnd:999, kwhMeterEnd:999}
  ], 'DG-1')).toEqual({hrMeterStart:121, kwhMeterStart:500});
});

test('zero is a valid reading', () => {
  expect(openingRunReadings([{dgNumber:'DG-1', hrMeterEnd:0, kwhMeterEnd:'0'}], 'DG-1'))
    .toEqual({hrMeterStart:0, kwhMeterStart:0});
});

test('empty selected day uses latest earlier date rather than latest clock time', () => {
  expect(openingRunReadings([
    {date:'2026-11-04', dgNumber:'DG-1', stopTime:'23:00', hrMeterEnd:120, kwhMeterEnd:500},
    {date:'2026-11-05', dgNumber:'DG-1', stopTime:'08:00', hrMeterEnd:121, kwhMeterEnd:510},
    {date:'2026-11-07', dgNumber:'DG-1', hrMeterEnd:999, kwhMeterEnd:999},
    {date:'2026-11-05', dgNumber:'DG-2', hrMeterEnd:999, kwhMeterEnd:999},
  ], 'DG-1', '2026-11-06')).toEqual({hrMeterStart:121, kwhMeterStart:510});
});

test('all historical months remain eligible and missing counters fall back independently', () => {
  expect(openingRunReadings([
    {date:'2025-12-31', dgNumber:'DG-1', hrMeterEnd:120, kwhMeterEnd:500},
    {date:'2026-01-02', dgNumber:'DG-1', hrMeterEnd:121, kwhMeterEnd:''},
  ], 'DG-1', '2026-11-06')).toEqual({hrMeterStart:121, kwhMeterStart:500});
});

test('daily fallback uses selected day opening and excludes future logs', () => {
  expect(dailyOpeningReadings([
    {Date:'2026-11-04', 'DG-1 Hour Opening':150, 'DG-1 KWH Opening':600, 'DG-1 KWH Closing':700},
    {Date:'2026-11-05', 'DG-1 Hour Closing':999}
  ], 'DG-1', '2026-11-04')).toEqual({hrMeterStart:150, kwhMeterStart:600});
});

test('previous month closing readings supply the next opening', () => {
  expect(dailyOpeningReadings([
    {Date:'2026-10-31', 'DG-1 Hour Closing':100, 'DG-1 KWH Closing':400}
  ], 'DG-1', '2026-11-01')).toEqual({hrMeterStart:100, kwhMeterStart:400});
});
