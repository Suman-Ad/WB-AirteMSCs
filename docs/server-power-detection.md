# Independent server mains/DG detector

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
