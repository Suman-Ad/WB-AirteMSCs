const {onSchedule} = require('firebase-functions/v2/scheduler');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const {istDate, dueReminders, eligibleUser, reminderId, notification} = require('./crq-reminders.cjs');

exports.sendCRQReminders = onSchedule({schedule: 'every 1 minutes', timeZone: 'Asia/Kolkata', timeoutSeconds: 540, maxInstances: 1, retryCount: 3}, async () => {
  const db = getFirestore(), now = Date.now();
  const yesterday = istDate(now - 86400000), today = istDate(now);
  // Current sheets use date strings; also support legacy Firestore timestamps.
  const [strings, timestamps, users] = await Promise.all([
    db.collection('daily_activity_sheets').where('date', '>=', yesterday).where('date', '<=', today).get(),
    db.collection('daily_activity_sheets').where('date', '>=', new Date(`${yesterday}T00:00:00+05:30`)).where('date', '<', new Date(`${istDate(now + 86400000)}T00:00:00+05:30`)).get(),
    db.collection('users').where('isActive', '==', true).get(),
  ]);
  const sheets = new Map([...strings.docs, ...timestamps.docs].map(sheet => [sheet.id, sheet]));
  for (const sheet of sheets.values()) {
    for (const reminder of dueReminders(sheet.data(), now)) {
      const id = reminderId(sheet.id, reminder);
      for (const user of users.docs.filter(user => eligibleUser(user.data(), sheet.data()))) {
        const ref = db.doc(`notifications/${user.id}/items/${id}`);
        const claim = db.doc(`notificationDeliveries/${user.id}/crqReminders/${id}`);
        await db.runTransaction(async tx => {
          const [claimed, saved, latestSheet, latestUser] = await Promise.all([tx.get(claim), tx.get(ref), tx.get(sheet.ref), tx.get(user.ref)]);
          if (claimed.exists || !latestSheet.exists || !latestUser.exists || !eligibleUser(latestUser.data(), latestSheet.data())) return;
          const siteId = latestSheet.data().siteId;
          if (typeof siteId !== 'string' || !siteId || siteId.includes('/')) return;
          const config = await tx.get(db.doc(`energyMonitor/${siteId}/config/notifications`));
          if (config.data()?.crqRemindersEnabled === false) return;
          const due = dueReminders(latestSheet.data(), now).find(item => reminderId(sheet.id, item) === id);
          if (due) {
            if (!saved.exists) tx.create(ref, {...notification(latestSheet.data(), due), createdAt: FieldValue.serverTimestamp()});
            // Keep the claim after a user deletes a bell item; it must not be recreated.
            tx.create(claim, {createdAt: FieldValue.serverTimestamp(), sheetId: sheet.id, date: due.date, type: due.type});
          }
        });
      }
    }
  }
});
