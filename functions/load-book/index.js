const {onDocumentWritten} = require('firebase-functions/v2/firestore');
const {initializeApp} = require('firebase-admin/app');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const {buildEntry} = require('./readings.cjs');
initializeApp();
exports.autoSaveLTLoadBook = onDocumentWritten({document:'energyMonitor/{siteId}/meters/{meterId}', retry:true}, async (event) => {
  if (!event.data?.after.exists) return;
  const meter = event.data.after.data();
  const entry = buildEntry(meter, Date.parse(event.time));
  if (!entry) return;
  const {siteId, meterId} = event.params;
  const db = getFirestore();
  await db.runTransaction(async (tx) => {
    const config = await tx.get(db.doc(`energyMonitor/${siteId}/config/loadBook`));
    const settings = config.data();
    if (!settings?.enabled) return;
    const panel = settings.lt1MeterId === meterId ? 'LT Panel-1' : settings.lt2MeterId === meterId ? 'LT Panel-2' : null;
    if (!panel || settings.lt1MeterId === settings.lt2MeterId) return;
    const entries = db.collection(`loadData/${siteId}/dailyData/${entry.date}/entries`);
    const existing = await tx.get(entries.where('equipmentType','==','LT').where('equipmentId','==',panel).where('time','==',entry.time));
    if (!existing.empty) return;
    const ref = entries.doc(`auto-LT-${panel.endsWith('1') ? '1' : '2'}-${entry.time.replace(':','')}`);
    tx.create(ref, {...entry, equipmentId:panel, siteId, siteName:settings.siteName || siteId,
      source:'meter-auto', meterId, meterObservedAt:meter.observedAt,
      timestamp:FieldValue.serverTimestamp(), timestampIST:new Date(meter.observedAt.toMillis()).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'}),
      uploadedBy:{uid:'',name:'Automatic meter reading',designation:'System',empId:''}});
  });
});

// Persistent daily kWh registers and sampled history; no browser session required.
Object.assign(exports, require('./meter-history-functions.cjs'));

const {pushBellNotification} = require("./notification-functions.cjs");
Object.assign(exports, {pushBellNotification});
Object.assign(exports, require("./telegram-functions.cjs"));

// CRQ reminders feed the same bell, device push and Telegram triggers.
Object.assign(exports, require("./crq-reminder-functions.cjs"));

// Site-scoped periodic meter updates use bell, push and personal Telegram delivery.
Object.assign(exports, require("./energy-notification-functions.cjs"));

Object.assign(exports, require("./energy-changeover-functions.cjs"));

Object.assign(exports, require("./energy-cooldown-functions.cjs"));
