# All-sites DG permissions fix

The deployed rules supplied for this task allow signed-in non-collector users to access non-energyMonitor root collections. The all-sites page previously used database-wide collectionGroup queries for dynamic YYYY-MM collections, runs and MonthlyBills. Those queries could include descendants under the intentionally restricted energyMonitor root. Firestore rules evaluate the full potential query scope, not JavaScript filters applied after results arrive. A client-side root/month filter does not authorize the query.

The page now resolves registered sites from siteConfigs and uses explicit queries:

- dailyDGLogs/{canonicalSiteName}/{YYYY-MM}
- dgLogs/{canonicalSiteName}/{Mon-YYYY}/{selectedDate}/runs
- ebBillDetails/{canonicalSiteName}/MonthlyBills/{YYYY-MM}

Site names retain canonical casing from siteIdMap. Independent subscriptions aggregate into the same UI. One site's read error is reported without discarding successful site records. Site config failures and bill/run errors are visible. Old subscriptions are removed on period/site-list changes, and late callbacks are ignored. No collection-group access rule is needed or added.

firestore.rules preserves the supplied broad legacy access outside energyMonitor and the collector's allowed site/meter writes. SLD reads are allowed for active same-site users. Only active same-site Admin / Super Admin profiles may create, update or delete energyMonitor/{siteId}/config/sld, with version, payload and server timestamp validation on writes. It does not add global energyMonitor reads or let the collector write user/config documents. The energyChangeovers root is also excluded from legacy broad access; its site-specific runs are readable/writable by active same-site users, with immutable opening/identity fields and no edits after completion. This is a compatibility fix, not a redesign of the existing broad non-energy authorization policy.

firebase.json now points to firestore.rules. To publish the reviewed rules to the configured project wb-airtelmscs:

    firebase deploy --only firestore:rules --project wb-airtelmscs

Updating the React page requires the normal app build/deployment as well. These local file changes alone do not change the currently published production rules. Use a normal Firebase-authenticated app account for all-sites reports; the collector account intentionally has no access.

## Validation

Verified locally: 4 subscription/query unit tests and 32 Firestore emulator rules checks passed. ESLint reported zero errors (existing page warnings). Production rules were not deployed.

Unit query/lifecycle tests:

    npm test -- --watch=false --runInBand --env=node --runTestsByPath src/services/allSitesDGSubscriptions.test.js

Rules integration checks (requires Java 21+ and firebase-tools):

    firebase emulators:exec --only firestore --project demo-wb-airtel-msc "node scripts/testFirestoreRules.cjs"

The integration script refuses non-local emulator hosts and non-demo project ids. It checks direct report queries, denial of the old unscoped group query, collector upload boundaries, anonymous/cross-site/inactive denials, and SLD validation. It only seeds the local emulator.
