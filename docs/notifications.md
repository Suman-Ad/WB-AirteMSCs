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
