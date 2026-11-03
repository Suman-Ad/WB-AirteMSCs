export const siteFunctionControls = [
  ['healthAlertsEnabled', 'Meter readings unavailable alerts'],
  ['recoveryAlertsEnabled', 'Meter readings restored alerts'],
  ['crqRemindersEnabled', 'CRQ open / close reminders'],
  ['telegramMetersEnabled', 'Telegram meter readings'],
  ['telegramFuelEnabled', 'Telegram fuel report'],
  ['telegramLoadEnabled', 'Telegram running load report'],
  ['telegramPueEnabled', 'Telegram PUE report'],
  ['telegramSegrEnabled', 'Telegram SEGR report'],
  ['telegramSiteStatusEnabled', 'Telegram site power status'],
  ['telegramActivityEnabled', 'Telegram /activity'],
  ['telegramIncidentEnabled', 'Telegram /incident'],
  ['telegramCrqImportEnabled', 'Telegram CRQ image imports'],
];
export const notificationDefaults = {enabled:true,dailyEnabled:true,changeoverEnabled:true,intervalMinutes:120,
  ...Object.fromEntries(siteFunctionControls.map(([field])=>[field,true]))};
export function normalizeNotifications(value = {}) {
  return {...Object.fromEntries(Object.keys(notificationDefaults).filter(field=>field !== 'intervalMinutes').map(field=>[field,value[field] !== false])),
    intervalMinutes:[30,60,120,240,360,720,1440].includes(value.intervalMinutes) ? value.intervalMinutes : 120};
}
