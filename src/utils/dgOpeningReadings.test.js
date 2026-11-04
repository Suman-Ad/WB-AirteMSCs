import {openingRunReadings, dailyOpeningReadings} from './dgOpeningReadings';

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
