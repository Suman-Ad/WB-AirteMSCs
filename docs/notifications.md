# Device and WhatsApp notifications

Each newly created `notifications/{uid}/items/{id}` document is forwarded by a server function to all devices registered by that user. Read notifications are skipped. Existing history is not replayed. Foreground messages use the same device notification panel as background messages. Clicking opens the app; approve/reject actions remain inside the authenticated app.

## Activate device notifications

1. In Firebase Console → Project settings → Cloud Messaging → Web configuration, generate a Web Push certificate. Copy its public key into `REACT_APP_FIREBASE_VAPID_KEY` in `.env.local` before building. This is a public key, not a server credential.
2. Build with `npm run build`, then deploy hosting, Firestore rules, and the two notification functions in the existing `load-book` codebase. Review the other pending rule changes before deploying the rules file.
3. Sign in on each device, open the bell, and choose **Enable device notifications**. Allow the browser permission prompt. HTTPS is required outside localhost. iPhone/iPad users must install the app on their Home Screen and enable notifications there.
4. Create a new bell notification for that user and verify delivery with the app open, backgrounded, and closed. The browser/OS must permit push and notifications; force-stopping the browser or OS restrictions can prevent delivery.

### Troubleshooting device activation

If the app says **Device notifications are awaiting the Firebase web-push key configuration** (or **Setup required**), the build has no `REACT_APP_FIREBASE_VAPID_KEY`. This is separate from Telegram's bot token and webhook secret.

Open Firebase Console → project `wb-airtelmscs` → Project settings → Cloud Messaging → Web configuration → Web Push certificates. Generate a key pair if none exists, then copy its **public** key. Create `.env.local` in the repository root with:

```dotenv
REACT_APP_FIREBASE_VAPID_KEY=YOUR_FIREBASE_PUBLIC_WEB_PUSH_KEY
```

Restart `npm start` for local development. For hosting, rebuild with the key present and deploy only after the build succeeds; editing `.env.local` alone does not update a hosted app. Enable the FCM Registration API if Firebase reports token subscription errors. The app now keeps device setup errors separate from Telegram messages and reports service-worker/registration timeouts instead of leaving the enable button waiting indefinitely.

## Activate MSC Bot on Telegram

WhatsApp has been replaced by Telegram. The app forwards new bell notifications to each user's linked private chat. There are no group broadcasts or unauthenticated chat-ID entry fields. The bot supports `/start`, `/help`, `/status` and `/stop`; approvals remain in the app.

### 1. Create and verify the bot

Open the official https://t.me/BotFather, send `/newbot`, choose **MSC Bot** as the display name, and choose an available username. BotFather normally requires usernames to end in `bot`; copy its confirmation rather than guessing the name. Keep the token private.

From the repository root in PowerShell, run:

```powershell
.\scripts\registerTelegramWebhook.ps1 -ConfigureOnly
```

Enter the bot token in the hidden prompt. The script calls Telegram's `getMe` and saves only the verified public username to the ignored `functions/load-book/.env.wb-airtelmscs` file. It never stores the bot token in that file.

### 2. Save the two server secrets

```powershell
firebase login
firebase functions:secrets:set TELEGRAM_BOT_TOKEN --project wb-airtelmscs
firebase functions:secrets:set TELEGRAM_WEBHOOK_SECRET --project wb-airtelmscs
```

Paste the BotFather token at the first prompt. At the second, use a password-manager-generated random secret of 32-256 letters, digits, underscores or hyphens. Keep that secret for webhook registration. Neither secret belongs in React environment variables or chat. Firebase billing/Cloud Functions must be enabled.

### 3. Deploy the Telegram functions

```powershell
firebase deploy --only "functions:load-book:createTelegramLink,functions:load-book:disconnectTelegram,functions:load-book:telegramWebhook,functions:load-book:telegramBellNotification" --project wb-airtelmscs
```

The callables and webhook use the default `us-central1` region. Ensure the webhook endpoint permits unauthenticated HTTPS invocation: Telegram authenticates using the secret header, not Google IAM credentials.

### 4. Register the webhook

```powershell
.\scripts\registerTelegramWebhook.ps1
```

Enter the same bot token and webhook secret in the hidden prompts. The script verifies the identity and registers the default URL `https://us-central1-wb-airtelmscs.cloudfunctions.net/telegramWebhook` with Telegram's `secret_token`. Use `-WebhookUrl` if deployment returns a different endpoint. Registration replaces this bot's existing webhook, so use a dedicated MSC bot. The script does not delete pending updates.

### 5. Publish the app and rules

Review existing unrelated pending edits before publishing this repository's full website and rules. The Telegram functions need the updated rules: client users may read their own preferences, but only server functions can write chat bindings and connection state.

```powershell
npm run build
firebase deploy --only hosting,firestore:rules --project wb-airtelmscs
```

Deploy hosting only after the build succeeds. The previous production build was stopped without completing; no successful release build or live delivery has been verified yet.

### 6. Link each account and test

For every signed-in user, the notification setup opens automatically once per browser session if device permission/registration or Telegram linking is incomplete. Already granted device permissions are registered automatically. Users still must approve the browser prompt and press Start through their private Telegram linking URL; accounts cannot be silently subscribed. The setup can be dismissed and reopened with the bell.

1. Sign in, open the notification bell, and choose **Connect Telegram**.
2. Choose **Open Telegram and press Start**. Keep this private, one-time link to yourself; it expires in 10 minutes. Creating another link invalidates the previous pending one.
3. Press **Start** in Telegram. The bot confirms connection and the app shows **Connected**.
4. Trigger a new notification for the account; check that only its linked user receives it.
5. Send `/status` to check connection, `/help` for commands, and `/stop` to disconnect. The app also has a **Disconnect Telegram** button that cancels pending connection links.
6. Test inactive accounts, expired links, and reconnecting to a different Telegram account before rollout. A Telegram chat can belong to only one app account at a time; disconnect first to change accounts.

Both the bot and device notification path process newly created bell documents; existing history is not replayed. User/OS mute settings still control whether Telegram displays a device alert.

### Delivery and operations

An established Telegram connection has no ten-minute expiry. Only unused connection links expire. The app shows **Checking connection…** until preferences load, rather than displaying a temporary false disconnection.

`notificationDeliveries/{uid}/telegramItems/{notificationId}` stores `sending`, `sent` or `failed`. `sent` means Telegram's API accepted the message, not that the user read it. Claims prevent duplicate trigger deliveries; failed/ambiguous sends are not retried automatically because a timeout can happen after Telegram accepted a message. Review failures operationally, particularly Telegram rate-limit errors during bursts. Only a Telegram 403 response explicitly identifying a blocked bot or deactivated account disconnects the matching chat; generic API failures preserve the saved connection. Preferences record `telegramDisconnectReason` for app disconnect, `/stop`, or Telegram revocation. Telegram and push are separate triggers, so one does not block the other.

Link records contain only hashed tokens and server timestamps. Superseded, consumed and disconnected pending links are deleted; abandoned expired link records can be removed using a Firestore TTL policy on `telegramLinks.expiresAt`. Expiration is enforced in the handler even without TTL. Preferences and bindings are not exposed to other app users.

## References

- [Firebase foreground and background message handling](https://firebase.google.com/docs/cloud-messaging/js/receive)
- [Telegram bot creation and account linking](https://core.telegram.org/bots/features)
- [Telegram Bot API and webhook secret header](https://core.telegram.org/bots/api)


## CRQ Open/Close reminders

`sendCRQReminders` runs every minute in Asia/Kolkata, independently of an open dashboard. It reads today's and yesterday's daily activity sheets (string and legacy Timestamp dates). Pending CRQs produce an Open reminder at the scheduled start; unfinished CRQs produce a Close reminder 30 minutes before the end, including overnight end times. Completed/cancelled rows are skipped. Previous-day overnight rows remain eligible through their scheduled end.

Recipients are active users assigned to the sheet's site and active Admin/Super Admin accounts. Explicit differing site IDs never match by name. Each recipient gets one deterministic notification document per row and reminder type, created transactionally after rechecking the sheet and user. A server-only `notificationDeliveries/{uid}/crqReminders/{id}` claim is committed with each notification, so repeated runs and deleting a bell item do not replay it. Legacy rows without row IDs use a fingerprint of the CRQ, activity, node and times; edits to those fields constitute a new reminder identity. Stable row IDs are preserved by dashboard edits.

The shared bell document triggers existing device push and Telegram delivery. Device registration/permission and Telegram account linking remain required. Dashboard toasts remain local and no longer generate duplicate OS alerts. Bell titles and device notification clicks open `/daily-activity-dashboard`. This is a reminder based on PM status; it does not verify the CRQ state in an external CRQ system.

After building successfully, deploy the scheduler, updated push handler and hosting:

```powershell
firebase deploy --only "functions:load-book:sendCRQReminders,functions:load-book:pushBellNotification,hosting" --project wb-airtelmscs
```

Existing `telegramBellNotification` must also be deployed and configured as described above. Cloud Scheduler/API access and billing must be enabled. On first deployment, currently due reminders are created for eligible current activities. No live alerts are sent by the local test suite.


### Periodic Energy Monitor updates (step 1)

`sendEnergyMeterUpdates` runs every five minutes on the server. Each active user with a matching `users/{uid}.siteId` receives one bell item per current physical meter at the site's configured interval. Admin roles do not bypass site matching. No browser session is required. Users missing a site ID must be assigned one before they receive these updates.

Site Config → Energy Automation → Meter notification updates saves `energyMonitor/{siteId}/config/notifications`: `enabled`, `intervalMinutes`, `updatedBy`, `updatedAt`. Active admins can manage any site; a Super User can manage their own site. The default is enabled every 120 minutes; available intervals are 30, 60, 120, 240, 360, 720 and 1440 minutes. Slots start at midnight IST, with delivery during the first five minutes of each slot. Disabling periodic updates does not change personal channel preferences.

Each summary includes kWh, kW, phase voltages/currents, power factor, frequency, observation time and freshness status. Unverified power units and failed readings are marked unavailable; stale readings remain labeled stale. The legacy test-meter is omitted when other meter documents exist. Meter identities follow the history service, taking the latest observed record for the same point/name.

Bell items use `energy_meter_update` and open `/energy-monitor`. Existing device and personal Telegram triggers deliver them to connected channels; Telegram groups are not part of this step. Transactional claims in `notificationDeliveries/{uid}/energyMeterUpdates/{id}` prevent duplicate creation across retries and after a user deletes a bell item. Site membership, active status, config and meter existence are rechecked before creation.

Deployment requires the updated Firestore rules and `sendEnergyMeterUpdates` Cloud Function, in addition to the frontend. No production deployment is performed by making these source changes. Daily opening/closing kWh summaries are implemented below; mains/DG changeover alerts are implemented in step 3 below.


### Daily opening / closing kWh (step 2)

`sendDailyEnergyReadings` runs at `0 0 * * *` in `Asia/Kolkata`. At 12:00 AM it reports the previous IST calendar day using saved `dailyReadings` registers, with one bell item per meter per active site user. The same push and personal Telegram triggers deliver these messages. The scheduler's original `scheduleTime` fixes the report date across late retries.

Site Config → Energy Automation has an independent daily-report checkbox (`dailyEnabled`, default true) in the notification settings document. Periodic updates may be disabled while daily reports stay enabled. The existing meter-history capture must be enabled to populate opening/closing readings. Missing registers still produce a clearly marked unavailable report for current meters; meters with registers are also included if their collector documents were removed.

Messages include opening kWh, closing kWh, recorded consumption, opening source and observation times. They do not claim exact midnight readings: the daily capture carries the previous day's closing counter as opening where available, otherwise uses the first captured reading. Coverage is flagged incomplete if opening is outside five minutes of the start boundary, closing is earlier than 23:55, or values/timestamps are missing. Counter resets or a decreasing counter suppress consumption. Readings are a snapshot of the saved registers at send time; late-arriving history corrections do not resend the report.

Messages use `energy_daily_kwh` and open Energy Monitor. Per-user claims in `notificationDeliveries/{uid}/energyDailyReadings/{id}` prevent duplicate sends after retries or bell deletion. Transactions recheck user activity, site membership and the daily opt-out setting. Deploy `sendDailyEnergyReadings`, updated rules and frontend to activate this feature.


### Mains / DG changeover alerts (step 3)

`notifyEnergyChangeover` listens to saved `energyChangeovers/{siteId}/runs/{runId}` documents. Creating a Running run produces `energy_dg_start`; changing Running to Completed (or creating a restoration-only Completed run) produces `energy_mains_restored`. Checkpoint updates, deletions and edits of a completed run do not alert. Event snapshots preserve the opening/restoration readings even if events arrive out of order.

Start messages include the last mains register at failure and DG opening kWh. Restoration messages include mains restored kWh, DG opening and closing kWh, generation and duration. Readings include observation timestamps and capture quality. Missing values remain unavailable; mains last-known fallback and DG last-valid-before-restoration readings are explicitly labeled. Decreased counters suppress generation. Manual header changes remain labeled Manual and are not represented as meter-confirmed outages.

Active users assigned to the event's site plus every active Admin and Super Admin receive messages via their existing bell, enabled device alerts and linked personal Telegram chat. Ordinary users (including Super Users) remain limited to their own site. An admin assigned to the event's site still receives only one notification per phase. `changeoverEnabled` is an independent site notification setting, defaulting to true; periodic and daily updates may be disabled separately. Config and active site membership are rechecked transactionally. Persistent per-user/run/phase claims under `notificationDeliveries/{uid}/energyChangeovers/{id}` prevent retry duplicates and replay after bell deletion.

This step attaches notification delivery to the existing saved header changeover workflow; it does not introduce a separate server-side detector. Automatic detection still needs configured Main Incomer/DG mappings, automatic switching enabled and an authorized app session running. With no session recording a changeover, no new run/event exists to notify. Last-known mains samples are retained by the existing running session; if unavailable after a reload, notifications show unavailable rather than inventing historical registers. Once a run is saved, notification delivery runs on the server.

Deploy `notifyEnergyChangeover`, updated Firestore rules and frontend to activate the feature. Existing historical runs are not replayed on deployment.


DG → EB alerts now follow two fresh zero-load observations while mains carries load, allowing energized cooldown. Load transfer closes the DG load run immediately. The separate `captureEnergyCooldown` server function later saves voltage-zero time and cooldown duration without resending a restoration notification. See `docs/energy-monitor-readings.md` for the detection and sampling rules.


### Bot does not reply to /start

A plain `/start` in the bot's private chat must return setup instructions, even before linking an app account. Groups are intentionally ignored. If there is no private-chat response, inspect webhook delivery before reconnecting accounts:

```powershell
.\scripts\registerTelegramWebhook.ps1 -CheckOnly
```

Enter the bot token only in the script's hidden local prompt; never paste it into chat. This read-only check reports verified bot username, registered URL, pending updates and Telegram's last delivery error. It does not change the webhook, command menu or environment files. Empty URL means registration is missing; 404 indicates a wrong/missing endpoint, 401/403 requires checking invocation access and the matching webhook secret, and 5xx requires function logs.

Read server logs after refreshing Firebase authentication if needed:

```powershell
firebase login --reauth
firebase functions:log --only telegramWebhook --lines 25 --project wb-airtelmscs
```

The handler now returns HTTP 503 if its command reply fails (except known blocked/deactivated recipients), allowing Telegram to retry instead of silently acknowledging a command that received no reply. Logs include only safe error codes, never tokens or request URLs. Deploy the updated `telegramWebhook` function to enable this behavior.


If deployed webhook logs say `The request failed because billing is disabled for this project`, Google Cloud is rejecting the function before the command handler runs. Restore an active billing account for `wb-airtelmscs` in Google Cloud Billing and then test `/start` again; rebuilding hosting or registering the webhook cannot resolve disabled billing. This also affects other billing-dependent Cloud Functions, including scheduled meter notifications and cooldown capture.


### Editing changeover notification recipients and text

- `functions/load-book/energy-changeover-notifications.cjs`: `eligibleChangeoverUser` controls the site-user plus all-admin audience. `changeoverNotification` controls titles (`EB-DG: DG Start`, `DG-EB: Mains Restore`), captured reading labels and message text.
- `functions/load-book/energy-changeover-functions.cjs`: `notifyEnergyChangeover` selects recipients, rechecks membership/role and writes the shared bell items. Deploy this function after changing either backend file: `firebase deploy --only "functions:load-book:notifyEnergyChangeover" --project wb-airtelmscs`.
- Site Config → Energy Automation → notification settings: **Send mains / DG changeover alerts** enables or disables captured-reading alerts for that site (`energyMonitor/{siteId}/config/notifications.changeoverEnabled`).
- `src/components/Layout.js`: the separate legacy **MSC Site Status** message and recipient queries remain here. The captured-reading recipient change does not change periodic/daily meter notification recipients. The bell items continue through the existing push and Telegram handlers.


### Telegram site report commands

Linked, active users can request data for their assigned site in a private bot chat:

| Typed command | Menu command | Reply |
| --- | --- | --- |
| `/meter data` | `/meter_data` | Every current meter: kWh, kW, phase voltage/current, PF, frequency, health and IST observation time |
| `/dhr` (also `/DHR`) | `/dhr` | Daily Health Report matching Preview & Share DHR: yesterday’s run hours, diesel stock, equipment statuses, activities, faults and saved energy |
| `/summary` | `/summary` | Current-month All Sites DG Logs monthly summary only |
| `/present fuel` | `/present_fuel` | Each DG's present fuel (opening fuel minus today's run consumption), opening fuel, day consumption and external stock in litres |
| `/site running load` | `/site_running_load` | Latest saved daily energy / 24, in kW |
| `/pue` | `/pue` | Latest daily energy excluding office consumption / 24 / IT load |
| `/segr` | `/segr` | Latest DG generation / on-load fuel, DG-wise and overall, in kWh/L |

`/help` lists commands. `/meters`, `/fuel`, and `/load` also work. Bot mentions and case-insensitive commands are supported. Long replies split across messages. Requests recheck the chat binding, preference and active user before reading site data.

**Admin and Super Admin only:** prefix a request with a site name to access any site, for example `/Asansol: Site Status`, `/Globsyn: meter data`, `/Kharagpur: present fuel`, `/Mira Tower: site running load`, `/Asansol: pue`, or `/Asansol: segr`. Site names are case-insensitive and resolved against `functions/load-book/telegram-sites.cjs` (keep this in sync with `src/config/siteConfigs.js`). Site Status reads the last saved `sitePowerStatus/{siteName}` source, running DG and IST update time. Missing status is explicitly unavailable. The stored role is checked on each request; User and Super User accounts cannot use site-prefixed reports. Regular commands still use the linked user's assigned site. These phrases are typed in chat; the Telegram menu continues to show the regular commands.

Fuel, load, PUE and SEGR use the newest saved Daily DG Log in the current or previous IST month, excluding future dates, and show its date. These are saved daily figures; they do not estimate unsaved tank consumption or instantaneous site load. Missing required readings and counter resets return Unavailable. Meter commands reuse the existing unit normalization, equipment deduplication and stale/error labels.

Deploy the handler with `firebase deploy --only "functions:load-book:telegramWebhook" --project wb-airtelmscs`. Run `scripts/registerTelegramWebhook.ps1` afterward to refresh the Telegram command menu. Typed commands work after deployment even before the menu refresh.

### Fuel and backup hours in changeover alerts

Both DG Start and Mains Restore include every configured DG's day-tank litres, external-tank litres, estimated backup hours and consumption rate. The message labels stock as the latest **saved Daily DG Log**, with its date, rather than a live tank measurement. Data is loaded from `dailyDGLogs/{siteName}/{YYYY-MM}/{date}` for the event month and previous month, excluding dates after the event's IST date. Stock fields are `DG-n Fuel Closing` and `DG-n External Fuel Stock`. Unsaved consumption, filling and current runs are not inferred or deducted from these saved balances.

Per-DG backup hours = (day-tank litres + external-tank litres) / litres per hour. The rate is weighted recorded on-load consumption divided by on-load hours across the fetched daily logs, using the same opening/closing, filling and off-load adjustments as the Daily DG Log calculation. If unavailable, `siteConfigs/{UPPERCASE_SITE_NAME}.designCph.DG-n` is used and labeled **Design**. Missing/invalid balances or rates produce **Unavailable**; a missing external stock is treated as zero only when that DG is explicitly configured with zero external-tank capacity. This estimate assumes that DG can use both its recorded tanks; it is not a prediction of simultaneous multi-DG operation.

Fuel is frozen once per run/phase in server-only `notificationDeliveries/energyChangeoverFuel/snapshots/{changeoverId}`, keeping recipients and retries consistent. Mains restoration captures a separate latest-saved snapshot. Failure to load fuel is labeled without suppressing the original meter-reading alert. The shared device/Telegram formatter allows up to 2,500 UTF-8 bytes for captured changeover messages so the per-DG section is retained within the device data payload budget.

Edit `energy-changeover-fuel.cjs` for stock sources and backup calculations; edit `energy-changeover-notifications.cjs` for the displayed fuel lines. Fuel entries are maintained through **Daily DG Log**; design CPH is maintained in **Site Config**. Deploy both affected functions after this update:

```powershell
firebase deploy --only "functions:load-book:notifyEnergyChangeover,functions:load-book:pushBellNotification,functions:load-book:telegramBellNotification" --project wb-airtelmscs
```

Telegram summary access: `/summary` contains only the current-month summary from All Sites DG Logs, excluding future saved logs. `/summary all` and named-site requests such as `/Asansol: summary` are limited to active Admin and Super Admin accounts; regular users get their assigned site. Each site respects `telegramSummaryEnabled`.

Telegram DHR: `/dhr` and `/DHR` show today's DHR date in IST, yesterday’s on-load DG hours (all run hours minus No Load hours), and yesterday’s EB hours using the Preview & Share DHR formula and 24-hour guard. Data comes from `dgLogs/{site}/{Mon-YYYY}/{yesterday}/runs`; date selection handles month/year boundaries. Other fields are region/circle, latest saved Daily DG Log diesel stock (day plus external tanks), site equipment statuses, major activity, inhouse PM, fault details, and total saved DG+EB+Solar energy. The source dates are displayed. Region/circle prefer Site Settings and fall back to the linked user's profile only for their own site. Admin/Super Admin can request `/Asansol: dhr`; other users are restricted to their assigned site. DHR respects the `telegramDhrEnabled` site setting.

Telegram presentation: command replies and automatic notifications use escaped HTML with report headers, bold field labels, vertical DG metrics, IST generation timestamps and numbered continuation pages. Long notification bodies are preserved across pages. Link previews are disabled. Formatting is applied only when sending to Telegram.


## Colored DG/EB alert headers

Changeover Telegram deliveries use packaged 1280x380 PNG headers: a red background/glow for energy_dg_start and a green background/glow for energy_mains_restored. These images provide actual colored backgrounds because standard Telegram HTML text bubbles do not accept CSS styling. Headers are uploaded directly using multipart sendPhoto with a plain-text site/time caption; no public image host or extra native dependency is required. The image is sent silently, followed by the full existing text notification after rate-limit pacing. Normal chat/OS notification preferences continue to apply to the text message.

The accompanying text uses matching red/green markers, a bold status title and highlighted meter registers, generation and duration. It retains HTML escaping, full multi-page details and the IST footer. Optional header upload failures fall back to text delivery; explicit blocked/deactivated responses still revoke the link. Delivery claims cover the image and text together, with photoMessageId retained for diagnostics. Existing delivered messages are not replayed. Non-changeover notifications keep their existing presentation.

Assets are reproducible with scripts/generateTelegramAlertHeaders.ps1 using Windows System.Drawing. The generator does not run in Cloud Functions. Validation: 141 backend tests passed, followed by 21 focused delivery/formatting checks after adding silent image headers and site captions. No live test message was sent during implementation.


## Meter Update and Daily kWh status colors

Meter Update and Daily kWh alerts also use glowing PNG headers and matching text markers: red for offline/error/stale, amber for retry/reconnecting/waiting for valid data, and green only for successful fresh readings. Freshness respects the collector interval (minimum 30 seconds, otherwise three upload intervals) and a five-second future timestamp tolerance. An old retry signal becomes offline when its observation is stale. Missing timestamps are amber rather than green.

Notifications record meterState, readingState and status assessment/observation times. Daily kWh reports separately label current meter status and historical daily coverage/counter resets; a current green meter never removes missing-reading warnings. The daily scheduler preserves the current collector ID while merging historical registers and transactionally rechecks the current meter. Removed meters with saved daily registers remain reportable as offline. Meter identity appears in both the photo caption and text heading; all original details remain selectable text. Existing delivered reports are not replayed, and schedule/toggles/recipient scope remain unchanged. Validation: all 152 backend tests passed, including all six report/status delivery combinations and status/coverage separation.

Deployment completed successfully for telegramBellNotification, sendEnergyMeterUpdates and sendDailyEnergyReadings on 5 November 2026. No live test message was sent and no previous notifications were replayed.


## /meter data command status cards

The Telegram webhook requests structured per-meter report metadata after existing link, account, site-access and report-toggle checks. The /meter data aliases and administrator site-prefixed meter requests now use the same offline/red, retry-waiting/amber and live/green assets as scheduled meter alerts. Short readings fit entirely in an HTML photo caption, producing one readable card per meter. Longer escaped readings keep the silent header followed by complete paginated text. Optional photo failures fall back to full text, and replies are paced across meters and continuation pages. Non-meter command report pagination remains unchanged. Validation: 51 focused command/report/formatting tests passed across the final runs, covering mixed meter states, long escaped readings, image failure and disabled-report behavior. No live command or test message was sent during implementation.

Successfully deployed telegramWebhook for the /meter data card update on 5 November 2026. No bot webhook registration change or historical-message replay was needed.


## /summary all matches /summary

All-site summary results retain independent site boundaries and use the exact same monthly summary renderer as assigned-site and named-site /summary. The webhook requests structured summary replies so each site gets the current Monthly site summary heading and independent pagination rather than joining all sites into one legacy response. No Today/Monthly two-section layout is generated. Monthly formulas, date filtering, administrator access, per-site report pause settings, and no-data messages remain shared with /summary. Validation: 53 focused command/report/formatting tests passed, including exact content comparisons for every configured site, monthly-only data queries and live webhook response formatting. No live command was sent during implementation.

Successfully deployed telegramWebhook for the /summary all monthly-format update on 5 November 2026. Existing sent summaries are unchanged; a new command requests the updated layout.


## Emergency command replay protection

The webhook now transactionally claims each Telegram update_id in notificationDeliveries/telegramWebhook/updates before report generation or sending. A duplicate, including one whose first handler is still running, is acknowledged HTTP 200 without sending again. message_id plus chat ID provides a fallback identity. Claimed delivery failures remain recorded and acknowledged rather than restarting a partially sent report; users can issue a new command with a new update ID. /summary all requests older than two minutes are acknowledged without processing to drain retries created by the previous revision. Existing handlers on the retiring revision may finish briefly during rollout. Claims are server-only under the existing notificationDeliveries rules. Validation: 56 focused tests passed, including duplicate completed/in-progress updates, delivery failures, new commands, and stale summary retries. No pending Telegram updates were deleted and no live test message was sent.

The emergency replay-protection webhook deployment completed successfully on 5 November 2026. Firebase reported a successful telegramWebhook update.
