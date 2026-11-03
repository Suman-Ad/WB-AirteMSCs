# Admin site function controls

Open Site Settings, select the energy automation site, and use **Site function controls**. Active Admin and Super Admin accounts can edit any configured site; other users can view their site's settings. Save explicitly to apply changes. Existing behavior remains enabled when new flags are absent. Cached settings cannot be saved.

The panel controls periodic meter summaries and frequency, midnight kWh reports, mains/DG changeover alerts, outage alerts, recovery alerts, CRQ open/close reminders, each Telegram report (meter, fuel, load, PUE, SEGR, power status, activity, incident), and Telegram CRQ image imports. Site flags live in `energyMonitor/{siteId}/config/notifications`. Firestore rules validate boolean types, supported intervals, admin role, author and server timestamp. Saving merges fields so unrelated configuration is preserved.

Telegram checks the target site's flag after verifying account access. A paused report replies explicitly without querying report data. Image imports skip rows belonging to sites where imports are paused. Disabling imports does not delete existing CRQs. CRQ reminders recheck the setting inside their notification transaction. Disabling recovery alerts still updates the outage state, preventing old recoveries from replaying when enabled again. Availability monitoring must remain enabled for recovery alerts.

Meter-history retention, automatic switch mapping and the simulator retain their existing controls. These feature switches do not undeploy Cloud Functions or stop scheduler invocations, and do not replace users' personal push/Telegram connection settings. Existing bell messages are not deleted. A notification already in delivery can still arrive after saving a change.

Deploy rules and the affected functions, then build and deploy the frontend:

```powershell
firebase deploy --only "firestore:rules,functions:load-book:telegramWebhook,functions:load-book:sendCRQReminders,functions:load-book:sendMeterHealthAlerts" --project wb-airtelmscs
npm run build
firebase deploy --only hosting --project wb-airtelmscs
```

Periodic/daily/changeover backends already read their existing settings and require no changes for this panel.
