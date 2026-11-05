/** @jest-environment node */
import { addDays, addMonths, clampDateToMonth } from './dgLogDateNavigation';

test('month arrows move exactly one month including year boundaries', () => {
  expect(addMonths('2026-11', -1)).toBe('2026-10');
  expect(addMonths('2026-11', 1)).toBe('2026-12');
  expect(addMonths('2026-01', -1)).toBe('2025-12');
  expect(addMonths('2026-12', 1)).toBe('2027-01');
});

test('day arrows cross month, leap day and year boundaries', () => {
  expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
  expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
  expect(addDays('', 1)).toBe('');
});

test('month selection keeps a valid day and caps at today', () => {
  expect(clampDateToMonth('2026-02', '2026-01-31', '2026-11-05')).toBe('2026-02-28');
  expect(clampDateToMonth('2024-02', '2024-01-31')).toBe('2024-02-29');
  expect(clampDateToMonth('2026-11', '2026-10-31', '2026-11-05')).toBe('2026-11-05');
  expect(clampDateToMonth('2026-10', '', '2026-11-05')).toBe('2026-10-01');
});
