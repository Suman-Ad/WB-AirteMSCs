# EnergyMonitor / EnergyBook views

The page has five tabs: Energy Dashboard, Site Overview, Electrical SLD, Analysis Report, and Alarms. It uses the app's light/dark theme tokens and the existing account site assignment.

## Live readings and units

Live subscription: `energyMonitor/{siteId}/meters`.


- `active_power`, `apparent_power`, `reactive_power`: displayed as kW, kVA, kvar. `powerUnits: "base"` means W/VA/var (divide by 1000); `powerUnits: "kilo"` means already scaled. Unknown source scales show unavailable values.
- Per phase: `R_current`, `Y_current`, `B_current` (A), `R_voltage_ln` / Y/B (V), and `R_voltage_ll` / Y/B (V). L-L columns correspond to R-Y, Y-B, B-R. Aggregate current/voltage remains available in the collector data.
- EnergyBook reader fields `fwd_Wh`, `fwd_VAh`, `fwd_VARh`, `fwd_VARh_capacitive` are base counters, displayed after division by 1000 as kWh/kVAh/kvarh. Explicit `energyUnits: "kWh"` or `"kilo"` means already scaled and prevents another division. `fwd_runsec` remains seconds.
- Failed meter readings are withheld. Cache state and upload freshness are visible. Site power totals include only live readings with known units and may include overlapping parent/submeter circuits.
- The phase table and vectors retain the current EnergyBook measured-angle and P/Q-estimate behavior. Diagnostics are shown alongside readings. The live trend is limited to the latest 60 updates received while the page is open, not historical energy storage.

## Daily opening/closing and DG report

The selected date uses Asia/Kolkata. The report subscribes to existing saved records:

- `dailyDGLogs/{siteName}/{YYYY-MM}` filtered by `Date == YYYY-MM-DD`: fields such as `EB-1 KWH Opening`, `EB-1 KWH Closing`, `DG-1 KWH Opening`, and other KWH Opening/Closing pairs. Values are already kWh. Missing values remain unavailable; counter decreases invalidate consumption.
- `dgLogs/{siteName}/{Mon-YYYY}/{YYYY-MM-DD}/runs`: `dgNumber`, `startTime`, `stopTime`, `totalRunHours`, `kwhMeterStart`, `kwhMeterEnd`, `fuelConsumption`, `remarks`. Run hours prefer saved duration, then runSeconds, then valid start/stop times with midnight handling.

CSV export keeps daily register rows and DG-run rows in separate sections so their energy is not double-counted. Summed DG hours are equipment-hours; simultaneous DG runs overlap. Cached or unreadable records are labelled. A current meter counter cannot reconstruct past midnight readings. Meter-level daily collector history is not manufactured or written by this page; maintain daily readings in the existing Daily DG Log.

## Electrical SLD JSON

Import supports up to 1 MB, 200 nodes and 500 edges. A sample JSON download is available. Graph imports and node/connection mappings autosave in device storage per site and restore after tab changes or reloads. Save site SLD writes a shared cloud copy. Graph nodes can link to live meter ids and open their dashboard readings. Lines show imported connectivity, not verified breaker/energization state.

```json
{
  "title": "Site power distribution",
  "nodes": [
    { "id": "utility", "label": "Utility supply", "type": "source", "x": 30, "y": 30 },
    { "id": "main", "label": "Main incomer", "type": "breaker", "meterId": "meter-1", "x": 280, "y": 30 }
  ],
  "edges": [{ "source": "utility", "target": "main", "label": "Incoming" }]
}
```

`position: {x,y}` / `data: {label,meterId}` node fields and `from` / `to` edge endpoints are also supported. Missing coordinates receive a grid layout. Invalid ids, dangling connections, excessive graph sizes and invalid coordinates are rejected without replacing the current graph. EnergyBook native exports are also accepted directly: `{ "format": "EnergyBook drawing", "version": 1, "site": "...", "items": [...] }`. Breaker/Ellipse/Busbar dimensions, titles, font and line sizes, and Connector source/target ports, fractions and waypoints are preserved. Bounds include complete shape dimensions and connector waypoints. UTF-8 BOMs are accepted. Fit width resets zoom.

Native `point` UUIDs are kept separately from web meter ids. Automatic linking matches an explicit meter id or a meter's `pointId`, `point_id`, `point`, or `energyBookPointId`; equipment titles are never used to guess. Select a shape and use Linked live meter to map a node. Importing a new drawing clears its previous mappings and autosaves the replacement on the device. Use Save site SLD to replace the shared site copy. Unsupported drawing versions are rejected without replacing the current graph.

## Alarms

The Alarms tab combines connection freshness, missing timestamps, meter errors, and collector `warnings` / `alarms`. It does not invent electrical thresholds or acknowledge/clear collector alarms. Each item opens the affected meter.

## Saved SLD and live power flow

Device autosave key: `energy-monitor:sld:v1:{siteId}`. Shared Firestore document: `energyMonitor/{siteId}/config/sld`. It stores a versioned JSON payload string (to preserve nested waypoint arrays), node-meter mappings, connection-meter mappings/polarity, and server update time. Active same-site users can read; only Admin / Super Admin profiles can upload, edit or delete the shared SLD. Import automatically publishes the drawing. Mapping edits publish with Save site SLD. Viewers load the cloud copy without importing a file, and shared deletion clears their view and old device copy. A failed cloud write is explicitly reported; the local copy remains. Dirty local drafts are not overwritten by incoming shared snapshots. The saved version preserves EnergyBook geometry and point IDs. Shared saves currently use last-write-wins when different editors explicitly save the same site.

Select a shape to map its meter and see kW, kVA, kvar, kWh and freshness. Mapped EnergyBook shapes also display kW or stale/offline state directly on the drawing.

Select a connector line to map the meter measuring that connection and set its installed positive-power direction (source→target or target→source). Only explicitly mapped, live, finite power readings with known units animate. Negative active power reverses motion relative to the configured polarity; zero, cached/stale/error/unknown-unit and unmapped connections are static. A node mapping does not imply branch measurements or breaker position. Reduced-motion preferences disable animation while numeric direction labels remain.

## Firestore listener stability

The ca9 assertion (negative pending target responses) followed by b815 is an SDK listen-target race, not a drawing-schema or meter-unit error. Firebase's release notes identify a related fix in 12.13.0 and listen-stream robustness changes in 12.14.0: https://firebase.google.com/support/release-notes/js . Later occurrences have also been reported upstream, so a mocked lifecycle test does not prove all SDK races are eliminated.

EnergyMonitor mounts SLD and Analysis Report subscriptions only when first opened, then keeps them mounted while switching tabs. Leaving the page or changing the site still cleans them up. Meter/report callbacks ignore events after cleanup. Firebase initialization reuses the default app during development module reloads.

After installing the updated SDK, stop and restart the development server, then fully reload the browser tab. Fast Refresh alone can retain the old, failed Firestore client. Do not clear localStorage: it contains unsaved SLD drawings and mappings. The change does not suppress browser errors, clear IndexedDB, change security rules, or patch SDK internals.

## Asansol operation simulator bridge

EnergyMonitor connects to `AsansolOperationSimulator` through an external bridge without editing the simulator file. The integration appears only for Asansol site names and remains mounted while switching EnergyMonitor tabs.

Under Asansol live-triggered operation simulator, open Meter mappings & voltage thresholds, map the Main Incomer and at least one DG meter, review thresholds, then enable automatic simulation. Defaults: failure below 100 V L-L; recovered supply and DG supply at or above 300 V L-L; two distinct paired updates. Configuration autosaves per site on this device (`energy-monitor:asansol-trigger:v1:{siteId}`). No equipment command or Firestore write is made by this bridge.

Detection requires OK, server-confirmed, fresh timestamps. All three phase L-L readings are used when available (all must be below failure / above recovery or DG thresholds); aggregate voltage_ll is used only if phase readings are absent. Partial/inconsistent phase data cannot indicate total failure. Cached, stale, missing or failed readings do not trigger. Both Main Incomer and DG timestamps must advance between confirmations. DG-1 takes priority if both DGs meet the threshold. One trigger is latched per outage until the mapped incomer recovers; ticks and duplicate uploads do not restart the simulator.

The existing simulator is mounted first with selectedDG, then receives triggeredBy="DG" on the next task so its selectedDG effect settles first. Existing internal trigger effects, timers, auto/manual sequences and controls are unchanged. The resulting animation demonstrates the existing timed logic; it is not a synchronized readout of physical breaker states. Restored incomer voltage rearms the external detector; it does not inject an unrequested EB restore command into the original simulation.

## Header automatic EB to DG status

Layout keeps the original EB/DG slider and its updatePowerSource click handler. A headless useAutoPowerSource hook calls that same handler for automatic DG starts; no additional header control is rendered. Configure Main Incomer and DG-1 / DG-2 under Energy Monitor → Existing header EB/DG switch · automatic meter mapping. Settings are saved explicitly to `energyMonitor/{siteId}/config/powerSwitch` and shared across site sessions. Active Admin and Super Admin profiles can select and edit any site; active Super User profiles can edit only their assigned site. The section is hidden from other users. The Admin-only site selector changes the settings target without changing the header's monitored site. Firestore enforces the same edit restriction. Active site users can read their own runtime configuration, while Admins can read settings and mapping meters across sites. Other meter-write and log permissions remain unchanged. Until site settings are published, automatic switching is disabled. Existing device/simulator mappings are offered to authorized editors for migration when saving the first shared configuration. When explicit mappings are absent, unique names such as Main Incomer, DG-1 Meter and DG Panel - 01 are recognized. Retained documents from meter-ID changes resolve to the newest matching meter; ambiguous equipment remains unmapped.

Two distinct fresh, server-confirmed paired updates must show Main Incomer exactly 0 V L-L and a mapped DG strictly above 300 V L-L. All available phase values must agree; partial, stale, failed, pending-write and cached readings do not trigger. DG-1 has priority if both are live. Detection runs throughout Layout, including outside Energy Monitor, while an app session is open and the user has the existing power-change permission.

The automatic entry point uses the existing header DG-start/timer/notification flow without a manual confirmation. A Firestore transaction allows only one session to claim EB → DG and stores the detected selectedDG with the status. Already-DG sessions do not restart timing or send duplicate start notifications. One trigger is latched per outage until healthy incomer readings return. Automatic return to EB follows the load-transfer rule described below. Two distinct qualifying reading pairs confirm stable supply; repeated timestamps do not count, and an unhealthy reading resets confirmation. DG voltage may remain available during cooldown; the recorded running DG zero-load observations determine return. Any nonzero verified active-power phase (or fallback current) on the running DG blocks confirmation; partial, stale, offline or cached running-DG load readings cannot establish transfer. The wait status identifies the blocking DG. The return uses the existing DG-stop logging and form navigation. The original simulator file and manual toggle behavior are unchanged. No physical switching command is sent.

Validation: 41 component/detection/history tests and 48 local Firestore emulator access checks passed; lint reports no errors (existing Layout warnings remain). Shared configuration changes require deploying the updated app and Firestore rules, then saving the site mapping once.

## Meter changeover history and status lights

Header EB → DG → EB transitions now write separate records to `energyChangeovers/{siteId}/runs/{runId}`. Each run captures DG opening/closing kWh, converted kW/kVA/kvar, all available numeric meter readings, sample times, EB-failure/restoration meter snapshots, actor, trigger, run duration and generation. Header status and run creation/completion commit in one transaction; repeated sessions cannot start the same run twice. The status document retains `activeEnergyRunId` to reconnect a run across browser reloads and users.

During a run, fresh counter updates checkpoint `latest` to Firestore. On restoration, a fresh DG counter is preferred. If the DG meter has gone offline, its saved last valid reading is retained as closing with an explicit quality label and observation time. Missing opening readings and counter decreases never generate fabricated or negative consumption. Meter mappings come from Energy Monitor automatic-switch settings; the original run meter remains fixed through restoration even if mappings change.

Analysis Report includes Meter-recorded EB / DG changeovers, filtered by run start date in Asia/Kolkata. Opening/closing values remain after restoration; captured reading details and JSON export are available. Existing manual DG and daily logs remain separate to avoid double counting. Runs already in progress before this feature can only record available restoration information; historical opening counters cannot be reconstructed.

This records header status transitions while an authorized application session is running. It is not a background collector and cannot detect physical changes that never reach the header flow. No Cloud Function or collector change is required. Publish the updated `firestore.rules` before using this feature; the collection is created automatically by the first successful run write.

Meter lights are green for fresh OK readings, amber for cached/reconnecting/waiting readings, and red for errors/offline/unavailable readings. This applies to Site Overview, selected-meter status and linked SLD shapes. Zero supply voltage alone does not mean a meter is offline.

The existing slider shows automatic-trigger status beside its DG label and in its tooltip. Successful persisted changes move that slider immediately; a denied transaction keeps its previous source and reports the permissions blocker. Manual click/keyboard confirmation, DG-stop run logging/form navigation, notifications and simulator behavior remain in the existing updatePowerSource flow. Automatic recording still requires the published changeover rules described above.

## Default selection and Site Overview supply

Without a manual meter selection, the dashboard follows the active supply: Main Incomer, HT utility fallback, or a fresh running DG when utility fails. A confirmed zero-voltage Main Incomer selects DG rather than an upstream HT reading. Utility voltage must be positive; DG requires over 300 V L-L (or nonzero measured kW when voltage fields are absent). Standby DG meters with zero voltage are not treated as running just because their connection is online. Manual selections persist through subsequent uploads and source changes until leaving/resetting the page.

Site Overview kW, kVA and kvar now come from that one supply meter, never a sum of main, HT and downstream meters. The source name/type is displayed. Missing/stale/cached/unmapped supply readings show unavailable values. Main Incomer / DG mappings reuse the existing Energy Monitor power-mapping settings; an optional HT panel mapping is available there. Unique HT Panel names can also be recognized automatically.

## Meter ID changes

The Energy Monitor consolidates retained collector documents before rendering its meter list, Site Overview, counts and alarms. Stable EnergyBook point IDs take precedence. For legacy records without point IDs, matching equipment names (ignoring case, spacing, hyphens and leading zeros in panel numbers) identify a replacement. The newest valid observation is displayed, including its ERROR status when applicable. Distinct explicit point IDs remain separate even when their names match. Unnamed or ambiguous meters are retained separately. Selection follows the replacement document ID. No Firestore documents or historical readings are deleted. Custom document IDs remain visible alongside `meter-N` IDs; only the original `test-meter` document is hidden when other meters exist.

## All-sites live meter viewer

`AllSitesDGLogs` includes a separate read-only live-meter section, available before monthly logs finish loading and independent of month/date filters. Site names are matched from the site configurations, but meter IDs come exclusively from `siteIdMap`; `siteConfig.siteId` is never used. Unknown names are skipped and duplicate mapped IDs are removed. The user's own site opens initially. All configured site meter subscriptions remain active while the page is open so collapsed headers keep their Live/Offline counts current. Leaving the page removes all subscriptions. Sites with no meter records are hidden. Expanded tables show all registered meters, including offline/error records, with individual Live/Offline status; offline values are labelled as last known readings. Registered offline sites retain their collapsed status header. Cached connections are labelled Reconnecting instead of counted as live.

Each site shows the latest retained meter identity, kW/kVA/kvar/kWh, R/Y/B L-L and L-N voltages, currents, power factor, frequency and observation time in IST. Values display two decimal places. Unit conversion and meter-health checks reuse Energy Monitor helpers. Non-live records remain visible with Offline or Reconnecting status and last-known-reading labels; failed/missing values are not displayed as zero. No mapping, power-switch or meter-write controls are present.

The new rule permits active Admin, Super Admin, Super User and User profiles to read meter documents across sites. Meter writes remain collector-only, and site configuration/changeover permissions are unchanged. Read-only UI and rule checks cover cross-site reads, denied writes, denied private settings access, inactive/anonymous accounts, deduplication, subscription cleanup and loading/error behavior. Publishing this access expansion requires separate production approval.

## Meter cleanup in Site Config

Energy Monitor shows all meter documents, including offline and duplicate records. In Site Config, open Energy Automation and Manage energy meters to review IDs, point IDs, health and last-reading times. Admin and Super Admin users can check extra meters, review the selected records, and confirm removal. Removal deletes only current meter documents, leaving saved history intact. Active collectors can recreate records; update collector configuration to stop unwanted uploads. Review power-switch and SLD mappings after removal. Firestore rules must be deployed to enable admin deletion.


## Load transfer and DG cooldown

The DG → EB return now follows load transfer: mains must be fresh above 300 V L-L and carrying positive current, and the recorded running DG must show zero load on two distinct fresh DG observations. Verified active power is used for load (all phase powers when supplied, otherwise total active power); current is the fallback for meters without verified power data. Partial phase data cannot be replaced by an aggregate value. Mains is reassessed on both observations but does not need a newer timestamp when its saved reading remains fresh. DG voltage may remain present during cooldown. Offline standby DG meters are irrelevant to this confirmation; fresh evidence of another DG carrying load still blocks return. With two mapped DGs and no recorded running-DG identity, the detector waits for that identity.

The first zero-load observation is retained once the second observation confirms transfer, and saved as `loadTransferAtMs` / `cooldownStartAtMs`. DG load-run closing readings are saved immediately at restoration; voltage-zero is not required to close the load run. `captureEnergyCooldown` watches subsequent collector uploads server-side and saves `cooldownEndAtMs` plus `cooldownSeconds` when the same DG first has fresh complete zero-voltage readings. Cooldown is shown separately in the meter changeover report. Missing/offline voltage readings leave cooldown pending, and a new DG power-source state interrupts the old cooldown instead of counting across another outage. This is an observed duration with collector sampling precision; exact physical breaker timing is not inferred. Cooldown updates preserve the closing register and do not replay restoration alerts.

Deploy the updated frontend, `captureEnergyCooldown` function and Firestore rules (new run fields must be allowed). Automatic load-transfer detection still requires an authorized app session; cooldown completion runs server-side once transfer is saved.
