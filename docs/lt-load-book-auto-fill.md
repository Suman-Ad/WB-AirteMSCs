# Automatic LT Load Book

The Load Dashboard includes automatic LT settings for site Admin / Super Admin accounts. Select the actual meter for LT Panel-1 and LT Panel-2, then enable and save. Configuration is shared in `energyMonitor/{siteId}/config/loadBook`.

The server function responds to meter uploads, so no browser needs to stay open. It captures each panel independently using the first complete, healthy reading in the five minutes starting at 00:00, 04:00, 08:00, 12:00, 16:00 and 20:00 Asia/Kolkata. No upload in that window means no automatic entry. It does not use current readings to backfill past slots. Readings older than two minutes at the upload event are rejected.

Entries use the existing `loadData/{siteId}/dailyData/{date}/entries` collection. A transaction checks existing manual and automatic entries for the same equipment and slot before creating a deterministic document. Trigger retries do not replace an existing entry. Each record retains the meter ID and observation timestamp. Temperatures remain blank because no temperature channels are supplied by the meter; add them by editing the entry. Zero readings are retained.

## Deployment

This repository previously had no deployed-functions source configuration or functions package manifest. The new function uses a separate `load-book` codebase in `functions/load-book`; the existing `functions/index.js` user-deletion source is untouched and is not part of this codebase.

1. Run `npm ci` in `functions/load-book` once its lockfile is available (otherwise `npm install`).
2. Deploy `firebase deploy --only functions:load-book,firestore:rules` to the intended Firebase project. Cloud Functions billing and required APIs must be enabled.
3. Build and deploy hosting to expose the Load Dashboard settings.
4. Map the two meters and enable automatic saving. Check the next slot and Cloud Functions logs.

Nothing runs automatically in production until the function and rules are deployed and the site's mapping is enabled. The fixed five-minute capture window and two-minute freshness limit are defined in `readings.cjs`.

Validation: `node --test functions/load-book/readings.test.cjs`.

## Asansol production diagnosis (23 October 2026 IST)

Read-only production checks confirmed that `autoSaveLTLoadBook` was not deployed and the Asansol settings document did not exist. Live meter names identify `meter-24` as LT Panel - 01 and `meter-25` as LT Panel - 02. Existing Load Book entries are present: 50 on 22 October, 48 on 21 October and 48 on 20 October. There were no entries for 23 October at the time of inspection. No historical records were changed.

The date view now uses an explicit loading/error/cache state with previous/next-day navigation. Stale callbacks from a previous date cannot overwrite the current selection. The entry form preserves the HTML date key without converting it through Date/locale parsing. Trend charts use their range's data rather than requiring entries for the selected single day. A matching-meter button suggests unique LT panel names but requires saving settings to activate them.

Production deployment requires explicit approval. The automatic approval review blocked deploying the Cloud Function and complete Firestore ruleset without that approval.

The selected historical date is preserved in the dashboard URL (`?date=YYYY-MM-DD`); saving an edited entry returns to its own date instead of resetting to today.

Checks passed: five backend tests (`node --test functions/load-book/readings.test.cjs`) and six history tests (`npm test -- --watch=false --runInBand --cacheDirectory=node_modules/.cache/jest-load-book --runTestsByPath src/hooks/useLoadBookDay.test.js src/pages/LoadDashboard.history.test.js`). The history tests use the Node environment to avoid the existing canvas native-module ABI mismatch.

## Activation completed (23 October 2026 IST)

The user explicitly approved production deployment and activation. Hosting and Firestore rules were deployed to `wb-airtelmscs`. The `load-book:autoSaveLTLoadBook` function was created successfully in `us-central1` after retrying the first-time Eventarc service-agent propagation delay. Asansol's shared configuration is enabled with LT Panel-1 mapped to `meter-24` and LT Panel-2 mapped to `meter-25`.

Read-back checks confirmed the enabled mapping, HTTP 200 from the published historical-date URL with the current app bundle, and 50 unchanged entries for 22 October. The next eligible slot after activation is 04:00 IST on 23 October; no historical automatic entries were fabricated.
