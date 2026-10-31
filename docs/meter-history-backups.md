# Live meter daily registers and history backups

Energy Monitor > Analysis Report now shows a daily opening/closing table for each current meter, seven daily records per meter, and a meter selector for sampled live readings. Select a report date to end the seven-day window on that date. Today follows the IST day boundary while the report remains on today's date. CSV downloads distinguish meter registers/samples from the existing Daily DG Log export.

## Capture and continuity

The `load-book:captureMeterHistory` Firestore trigger runs on healthy uploads to `energyMonitor/{siteId}/meters/{meterId}`. It operates without a browser. It rejects missing/negative/nonfinite counters, unsupported energy units, failed readings, samples more than two minutes older than their upload event, and timestamps more than five seconds in the future. Wh values are converted once to kWh; `kWh`/`kilo` values are already scaled.

Daily documents live at `energyMonitor/{siteId}/dailyReadings/{date}__{meterKey}`. The opening is the immediately preceding IST calendar day's saved closing, including when that closing is zero. If that day's document is missing, the first observed reading becomes a clearly labelled partial-day baseline. Gaps are never filled from a later live counter. Existing carried openings remain valid if retention later removes their source document.

Daily checkpoints update at most once per minute. A detected counter decrease is captured immediately and leaves usage unavailable even if the counter later recovers. First and last observation times are retained. Today's saved closing is provisional; past closing is the last captured value before the day ended, not a reconstructed midnight reading. Offline periods remain visible through timestamps and missing days. The report does not sum branch meters or combine meter daily usage with DG-run/register totals.

Transactions read the previous/current/following day before writing. Retries preserve one sample per bucket. A late previous-day update synchronizes the following day's stored opening. Counter identity uses an explicit point ID when available, otherwise a normalized equipment name, otherwise the collector document ID. A stable name/point preserves continuity when a meter's Modbus address changes; distinct explicit points remain separate. A genuine equipment replacement that resets its counter is flagged for review.

`energyMonitor/{siteId}/historyMeters/{meterKey}/samples/{IST-date}_{15-minute-bucket}` stores the first accepted capture in each available 15-minute interval, including every finite numeric meter field, the normalized kWh counter, original units, meter ID/name and observation time. This is sampled history, not a complete copy of every collector upload. Unknown power units remain unavailable in scaled kW displays. The daily register is checkpointed independently of sample intervals. The seven-day sample query is bounded to 1,000 records; a complete seven-day window has at most 672 buckets.

## Backup controls

The report reads shared settings from `energyMonitor/{siteId}/config/meterHistory`. Admin and Super Admin users can save:

- `enabled`: pause/resume new captures (default true after deployment).
- `retentionDays`: integer 7–365 (default 7), including today in Asia/Kolkata.
- `updatedBy` and server `updatedAt` for provenance.

The `load-book:pruneMeterHistory` scheduler runs at 02:15 IST and deletes daily meter documents and samples older than the selected retention. It continues while capture is paused. Reducing retention removes older meter history at the next cleanup; increasing retention cannot recover previously deleted or never captured days. Daily DG Log, LT Load Book, EB/DG changeovers and live meter documents are unaffected. Cleanup is bounded to 25 batches of 400 records per collection per invocation; a larger backlog carries over. Meter metadata remains available after sample deletion.

Firestore rules allow active site users and active Admins to read these records. Browser/collector writes to saved daily/sample history are denied; only backend Admin SDK functions create, update or prune it. Administrator settings writes validate permitted fields, the day range, authenticated author and server timestamp.

## Deployment

No production deployment is performed by this change. Existing past live counters cannot produce seven days of history retroactively.

1. Install the existing backend lockfile with `npm ci` in `functions/load-book` when dependencies are absent.
2. Deploy the two new functions and updated rules to the intended project: `firebase deploy --only functions:load-book:captureMeterHistory,functions:load-book:pruneMeterHistory,firestore:rules`.
3. Build/deploy hosting for the updated report.
4. Verify fresh meter uploads create daily/sample records, then check rollover and scheduled cleanup. Defaults begin collecting after function deployment; administrators can adjust backup days in the report.

No extra composite indexes are needed: daily and cleanup queries use `date`, and per-meter sample queries filter/order only `observedAtMs`.

Tests: `node --test functions/load-book/readings.test.cjs functions/load-book/meter-history.test.cjs functions/load-book/meter-history-functions.test.cjs`; React/Jest history tests cover date scoping, stale listeners, missing/reset readings, per-meter rendering, administrator controls and cached/error states.
