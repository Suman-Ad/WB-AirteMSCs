# Server mains/DG detector

## Layout and Telegram integration — 4 November 2026

The integration now uses `config/serverPowerSwitch.enabled` to choose the authority in Layout. The independent configuration activates the backend for a site; when present, the existing `config/powerSwitch` supplies its enabled flag and explicit meter mappings. The settings editor saves resolved meter IDs so name-based selections work on the server. Enabled sites subscribe to `runtime/serverPowerSource` for EB/DG, running generator, and elapsed run time. Browser automatic changes and checkpoints are suppressed while server settings load, fail to load, or remain enabled. Sites with a confirmed disabled/missing server configuration retain the browser flow. Manual source changes remain disabled in server mode. The server updates status on collector uploads regardless of app sessions; no user-presence check is needed.

Layout treats cached, disabled, or more than 30-second-old source/evaluation readings as last observed / waiting. It retains the last observed EB/DG position without claiming current live supply. Server mode does not write `sitePowerStatus`, existing browser run collections, or DG log forms.

`notifyServerEnergyChangeover` watches `energyMonitor/{siteId}/serverChangeovers/{runId}`. Running and Completed transitions create the existing rich changeover bell notifications, which `telegramBellNotification` and `pushBellNotification` deliver to linked/enabled recipients. Active site users and active admins receive them; site changeover opt-out and recipient eligibility are rechecked. Deterministic server-specific delivery claims prevent retries/checkpoints from producing repeat alerts. Existing run history is not replayed on deployment.

Deployment requires the updated frontend, `detectServerPowerSource`, and the new `notifyServerEnergyChangeover` function. Deploy the frontend before enabling the new notification trigger so updated clients stop browser detection. Older open clients should refresh. Existing Telegram and push delivery functions must already be deployed. No rules changes are required. The implementation is prepared locally; this section does not record a production deployment.

The remaining sections describe the original independent deployment before this integration.


`detectServerPowerSource` is a separate Firestore-triggered Cloud Function in the existing `load-book` codebase. It runs on collector uploads to `energyMonitor/{siteId}/meters/{meterId}` without an app session. The existing browser automatic switch, header power status, manual controls, reports, and notification delivery remain unchanged.

## Configuration and activation

The function defaults to inactive when `energyMonitor/{siteId}/config/serverPowerSwitch` does not exist or `enabled` is not exactly `true`. It does not inherit activation from the browser's `config/powerSwitch`. There is deliberately no new frontend settings screen in this stage.

Create the separate configuration through a trusted Admin SDK script or Firebase console, using actual collector document IDs:

```js
await db.doc(`energyMonitor/${siteId}/config/serverPowerSwitch`).set({
  enabled: true,
  mainMeterId: 'YOUR_MAIN_METER_ID',
  dg1MeterId: 'YOUR_DG1_METER_ID',
  dg2MeterId: '', // optional second DG
  updatedBy: 'ADMIN_USER_UID',
  updatedAt: FieldValue.serverTimestamp(),
});
```

Browser clients can configure it only as an active Admin/Super Admin; same-site users and active admins can read its settings and results. Runtime and history writes are server-only. Mapping is explicit in this first version: name-based mapping migration/resolution is not implemented. If collector IDs change, update this independent configuration. Mapping changes during an active server run pause detection until the original mapping is restored or the isolated runtime is reconciled by a trusted backend operator. Editing configuration discards pending confirmations; it never rewrites a running meter's identity.

Source preparation does not activate production. After tests, deploy only the new function and the reviewed rules:

```powershell
firebase deploy --only "functions:load-book:detectServerPowerSource" --project wb-airtelmscs --non-interactive --force
firebase deploy --only firestore:rules --project wb-airtelmscs
```

Review any other pending rules changes before deploying the shared rules file. Then create the independent config to enable it for the intended site. Disabling it stops evaluation on subsequent mapped uploads, clears pending confirmation/evidence, and retains historical runs and last observed source. Config changes alone do not trigger evaluation. Keep the collector and internet connection running; a cloud function cannot infer a physical change without uploaded readings.

## Stored results and future connection

- Current result: `energyMonitor/{siteId}/runtime/serverPowerSource`.
- Independent DG runs: `energyMonitor/{siteId}/serverChangeovers/{runId}`.
- No writes to `sitePowerStatus`, `energyChangeovers`, bell notifications, Telegram, or device delivery paths.

Runtime includes `powerSource` (`Unknown`, `EB`, `DG`), `selectedDG`, `activeRunId`, `assessment`, `message`, `enabled`, `evaluatedAtMs`, `mainObservedAtMs`, `sourceMeterId`, and `sourceObservedAtMs`. Initial source remains Unknown until healthy mains or a confirmed loaded DG establishes it. A saved source is last observed, not proof of present live supply: the later UI integration must check evaluation/readings freshness and show offline/disabled/waiting state. No heartbeat runs when uploads stop, so old runtime timestamps must never be presented as current evidence.

Future frontend integration can subscribe to this runtime document when a user signs in. Decide which detector is authoritative before connecting it to existing status and notification logic. This stage intentionally emits no alerts, preventing duplicate Telegram/device messages while browser detection remains active.

Runs retain main/DG reading snapshots, normalized opening/latest/closing kWh, observed sample times, start/end processing times, generation when counters are valid, duration, and confirmed load-transfer time. They do not populate the existing DG log forms or report collections. Separate cooldown completion is not connected in this stage. Starts during an already-running DG capture the first confirmed available opening counter, not the historical physical start; no backfill is invented.

## Detection and delivery behavior

The backend keeps an independent copy of the current browser assessment rules: incomer 0 V/0 A or explicitly offline/stale with a fresh loaded DG above 300 V; return requires fresh loaded mains above 300 V and idle running-DG load (including complete phase currents at or below 5 A). Partial, failed, future, and stale DG samples cannot confirm live operation. Two distinct qualifying observations are required. Starts advance both paired timestamps (or distinct DG timestamps for an offline incomer); live restoration advances the running-DG timestamp. Recent observed idle evidence can support restoration after that DG becomes unavailable, with two distinct loaded-mains timestamps. Idle evidence and confirmations survive function instances in Firestore and reset on gaps/config changes or invalid conditions.

The handler reads the current mapped meter documents and commits detector progress, source and run changes in one transaction. This deliberately prioritizes current supply over replaying old event payloads. Rapid uploads may be coalesced; transitions completely overwritten before evaluation cannot be reconstructed. Expected delay depends on collector cadence plus Cloud Function execution, with no hard real-time guarantee. Duplicate/reordered events cannot count unchanged observed timestamps twice. This follows Firebase's documented [at-least-once and unordered trigger delivery](https://firebase.google.com/docs/functions/firestore-events).

The backend copy is regression-tested against the browser detection scenarios while both implementations coexist. It does not send physical switching commands.

## Production activation — 3 November 2026

The user authorized deployment and activation of the independent detector, keeping browser detection unchanged. Deployed `load-book:detectServerPowerSource` (Node.js 22, second generation, `us-central1`) and its Firestore rules to `wb-airtelmscs`. Firebase CLI requires `--force` to accept this new function's retry policy; the deployment selector was limited to this function and rules. The rules candidate was compared with the live release before deployment: the only addition was the isolated detector's config/runtime/history access block. Previous rules release: `projects/wb-airtelmscs/rulesets/d1a6a039-6a1e-4b49-a4ae-c001a2675ad5`.

Enabled only Asansol (`N19106A`) at 00:26:26 IST with the verified existing mapping: Main Incomer `meter-2`, DG-1 `meter-26`, DG-2 `meter-27`. The independent config was created with an existence precondition and a verify-only precondition on the browser config's update time. The browser config was not modified. No hosting deployment or existing function update was performed.

Live verification at 00:26:39 IST found the function `ACTIVE` and a collector-driven runtime reporting `powerSource: EB`, `assessment: restored`, `message: Auto switch: incomer healthy`. The source observation was at 00:26:28 IST. Both DG meters reported ERROR at verification; healthy mains established the EB result. Actual future outage/restoration transitions have not been induced in production. Existing alert behavior remains unchanged; this independent detector does not emit alerts.

Validation: 103 backend tests and 95 local Firestore emulator access checks passed. A checksum-verified portable Temurin Java 21 runtime was used from the temporary directory; the installed system Java was not changed.

`scripts/serverPowerDeployment.cjs` provides narrow `inspect`, `enable`, and `verify` operations for this project/site using the signed-in Firebase CLI account. Set `FIREBASE_TOOLS_LIB` to the CLI's installed `lib` directory before running it. `enable` first requires an ACTIVE function, copies only explicit existing meter mappings, and refuses to overwrite a differing independent configuration. Tokens are never printed or saved. `inspect` saves non-secret rules/mapping snapshots under `.firebase/` for review.


Runtime detector and restoration-evidence fields must be replaced as whole maps using `mergeFields`, rather than recursively merged. Recursive merges retain a prior restoration's `evidenceMode` and can prevent the next outage from advancing beyond one confirmation.


## Live detector repair — 4 November 2026

Diagnosed conflicting enabled flags between the existing settings and independent activation, plus recursively merged detector maps retaining an obsolete restoration evidenceMode. Deployed only `load-book:detectServerPowerSource` to `wb-airtelmscs`, retaining activation while reading the existing shared switch settings and replacing runtime state maps with mergeFields. No settings were changed by the repair. The shared setting was initially off and was changed externally to on at 20:08:12 IST during diagnosis.

Post-deployment verification found the function ACTIVE and a collector-confirmed DG-1 run beginning at 20:11:20 IST (`DG-1-1793803272000-1793803272000`). Runtime reported DG / DG-1 and a current active run. This verifies a real start transition; restoration has not been induced. The frontend settings changes and new server Telegram notification trigger are still local and were not included in this narrow deployment. Validation: 19 targeted backend tests and 29 settings/Layout tests passed; frontend tests disabled optional native canvas for the test process due to the installed Node ABI mismatch.


## Complete server changeover alerts — 4 November 2026

Server alert delivery now resolves a missing run site name through the shared site-ID mapping before querying uppercase siteConfigs and named Daily DG Logs. A read-only preview of the saved Asansol restoration found the 3 November fuel stock: DG-1 683 L day tank and 1,152 L external; DG-2 700 L and 1,142 L external. Message generation displays the resolved site name and both configured generators.

The detector now retains valid mapped meter registers in runtime.lastGoodMeters. Future start alerts can label an offline mains register as last known, with its original observation time. It cannot reconstruct a reading that was never captured. Readings show explicit Reading time and Reading quality fields, and Telegram formatting no longer mistakes time colons for field labels. Previously delivered notifications are not replayed or edited. Validation: 49 targeted tests passed, including site-ID fuel lookup, retained offline mains readings, and timestamp formatting.

Successfully deployed only detectServerPowerSource, notifyServerEnergyChangeover and telegramBellNotification to wb-airtelmscs for this alert repair. Firebase reported successful update operations for all three. No hosting, settings, historical notifications or other functions were changed.


## Pending DG log entries after server restoration — 4 November 2026

`syncServerDGRunHistory` watches completed server runs and transactionally creates `dgRunLogs/{siteName}/entries/server-{runId}` with the existing manual-history fields, original IST times, duration, and dgLogAdded=false. The original server run is linked using historyEntryId. Retries and the linking event do not duplicate entries, reset user completion or overwrite edited history. Deleting a linked history row does not replay it. Existing bell/Telegram transition detection ignores this metadata-only source update.

`scripts/backfillServerDGRunHistory.cjs inspect|apply` narrowly recovers today's completed Asansol runs using signed-in Firebase CLI credentials, existence/update-time preconditions and a check for matching manual history. Restored the 4 November DG-1 run 20:11–20:18 (428 seconds) as a pending entry. The local DGRunHistory Add Entry action also now passes the row date rather than today's date when opening a historical run. Validation: all 137 backend tests passed, including retry/user-completion preservation and cross-midnight timestamps. No frontend deployment is needed for today's restored entry or future backend-created history entries; the historical navigation date correction remains local until hosting is deployed.

Firebase successfully created syncServerDGRunHistory in us-central1. A post-recovery read verified the 20:11–20:18 entry with dgLogAdded=false, and a repeat recovery inspection proposed no duplicate writes. No hosting deployment or other function update was performed for this change.


## Daily and all-sites live source indicators

DailyDGLog and AllSitesDGLogs now subscribe to per-site server activation, shared Auto Switch settings and runtime via useLiveSitePower. Fresh server readings drive the EB/DG badge and card colors, selected running generator, all-sites DG count/filter and running timer. A 30-second source/evaluation freshness limit (with five seconds of clock-skew tolerance) prevents cached, failed or stale runtime from displaying live EB/DG colors; these states display Unknown and a waiting/last-observed explanation. Confirmed disabled or absent server activation retains the existing manual source. Subscriptions are scoped to configured sites, cleaned up on site changes and isolated from one another. DailyDGLog's manual listener also cleans up old running timers.

These are local frontend changes and require a hosting build/deployment to reach the live website; no function or hosting deployment was performed for this UI change. Regression coverage includes server DG to EB restoration against conflicting manual status, card red-border removal, DG filtering/counts, freshness expiration, and multi-site listener cleanup.


## Hosting release — 4 November 2026

Deployed the Auto Switch frontend, including DailyDGLog and AllSitesDGLogs live source/color integration, to https://wb-airtelmscs.web.app. Built an isolated source snapshot excluding unrelated AssetsDashboard, DGLogForm and HSDPrintTemplate edits. Included the required DGLogTable.css dependency imported by the existing table. The production build completed with lint warnings; all 13 targeted frontend tests had passed. Hosting-only deployment succeeded. Verified public HTML HTTP 200 references main.92303341.js and that the bundle responds HTTP 200. The deployed build is retained in the workspace build directory; staging source/environment copies were removed. No functions or rules were deployed in this hosting release.
