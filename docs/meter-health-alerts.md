# Meter reading availability alerts

`sendMeterHealthAlerts` checks registered meters every minute, without requiring an open browser or an EnergyBook heartbeat. It uses Energy Monitor's freshness rule: a reading is stale after the greater of 30 seconds or three times `uploadIntervalSeconds` (10 seconds if unspecified). Fresh statuses other than `OK`, and missing/invalid/future observation timestamps, are also unhealthy. Zero supply voltage alone is not a fault.

Two unhealthy scheduler observations at least 60 seconds apart confirm an outage. Two healthy observations at least 60 seconds apart confirm recovery. An opposite observation resets confirmation. With normal scheduler timing, notification follows approximately 1–2 minutes after the freshness threshold is crossed. This samples availability and cannot prove continuous failure between checks. The backend cannot distinguish a meter problem from an EnergyBook or cloud-upload problem.

Recipients are active users assigned to the site and all active Admin/Super Admin accounts. Each recipient gets one bell notification per confirmed outage, and one recovery notification. Existing push and personal Telegram triggers deliver these when configured. Notifications link to Energy Monitor. Persistent state is stored in server-only `notificationDeliveries/{uid}/meterHealth/{equipmentHash}` and committed atomically with the notification. Retries and deleting a bell item do not replay an outage. Newly eligible recipients begin their own confirmation period. Stable point IDs (or normalized names for legacy meters) retain state across collector document replacements.

Checks cover configured sites and additional sites assigned to active users. Empty sites generate no alerts. A disappeared/deleted meter document is not monitored; a retained stale document is. Existing retained duplicate meter records use the newest valid observation per equipment identity. On first deployment, already-unhealthy retained meters will alert after confirmation; clean up obsolete meter registrations first if needed.

Alerts are enabled by default and independent of periodic reading-report settings. Set `healthAlertsEnabled: false` in `energyMonitor/{siteId}/config/notifications` to pause a site's checks. Existing state is retained while paused; confirmation resumes from subsequent observations.

Deploy:

```powershell
firebase deploy --only "functions:load-book:sendMeterHealthAlerts" --project wb-airtelmscs
```

Existing `pushBellNotification` and `telegramBellNotification` must already be deployed. Cloud Scheduler and billing must be available. No EnergyBook change is required. Deploy the frontend through the usual build/hosting process to enable the new notification types' bell-click navigation to Energy Monitor; backend alert generation does not depend on that frontend deployment.

Validation:

```powershell
node --test functions/load-book/meter-health-alerts.test.cjs
```
