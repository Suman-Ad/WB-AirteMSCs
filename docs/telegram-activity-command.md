# Telegram activity command

`/activity` displays today's saved activities for the linked user's assigned site, using the Asia/Kolkata date. Each activity includes its node, details, all CRQ/PE numbers, start/end times in IST, PM status, activity type and notes when saved. Empty days are reported explicitly. Replies are split to fit Telegram's message limit.

Admin and Super Admin accounts can also type `/Asansol: activity` (or another configured site). Other roles remain restricted to their assigned site. An active linked account is required. This command only reads `daily_activity_sheets`; string and legacy Timestamp dates are supported.

Deploy with `firebase deploy --only "functions:load-book:telegramWebhook" --project wb-airtelmscs`. Run `scripts/registerTelegramWebhook.ps1` afterward to add `/activity` to the bot command menu. Typed commands work after deployment without refreshing the menu.
