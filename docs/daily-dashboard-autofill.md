# Daily dashboard autofill

The reporting date names the end of the previous-day 16:00 to selected-day
16:00 reporting period in Asia/Kolkata. Daily DG Log Book entries are already
maintained for that period; do not add two daily entries together.

- Diesel tank stock sums each configured DG's `Fuel Closing` reading.
- External stock uses the log's explicit external-stock total when available,
  otherwise the sum of each configured DG's `External Fuel Stock` reading.
- DG run hours sum closing minus opening hour meters. Power-failure hours
  subtract the sum of `Off Load Hour`. Equal totals produce `EB Fail`; an
  offload component produces `EB fail and No Load test run`.
- Missing readings remain unchanged. Capacity is never a stock fallback.
- Diesel and DG-hour autofill start after the selected date's 16:00 cutoff.
- Activity rows come from `daily_activity_sheets`, matched by site. Start
  times use the interval [previous date 16:00, selected date 16:00). Rows
  without a start time use their scheduled sheet date. Imported rows are
  refreshed without duplicating them; manually entered activities remain.

The dashboard displays live source-derived values, including in its Excel
download. The site editor saves those values to the daily site document.
Listeners operate while these pages are open; this is not a scheduled backend
job. Other sheets continue to use their existing entry process.

Calculation tests can run without the optional native canvas dependency:

```
npm test -- --watch=false --runInBand --env=node --cacheDirectory=node_modules/.cache/daily-autofill-jest src/utils/dailyDashboardAutofill.test.js
```
