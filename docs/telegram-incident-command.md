# Open incident reports

Send `/incident` in your linked private Telegram bot chat to view all currently open incidents for your assigned site, newest date first. Reports include title, docket, date/time, equipment, description, type, SA/NSA, affected equipment, OEM partner, actions, ownership, RCA status and remarks where available. Reports are not limited to today's incidents. Long details are split across Telegram messages without truncation. No records are changed.

Active Admin and Super Admin accounts can also use `/Asansol: incident` or another configured site name. All commands require a currently active linked account. Named-site access is checked before querying incidents. An empty result explicitly says no open incidents.

Deploy `telegramWebhook`, then run `scripts/registerTelegramWebhook.ps1` to update the menu:

```powershell
firebase deploy --only "functions:load-book:telegramWebhook" --project wb-airtelmscs
.\scripts\registerTelegramWebhook.ps1
```

The Incident Dashboard theme changes require the usual frontend build and hosting deployment.
