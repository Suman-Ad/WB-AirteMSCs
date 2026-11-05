const {onSchedule} = require('firebase-functions/v2/scheduler');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const {slotAt, eligibleUser, currentMeters, notification, notificationId} = require('./energy-notifications.cjs');

exports.sendEnergyMeterUpdates = onSchedule({schedule: 'every 5 minutes', timeZone: 'Asia/Kolkata', timeoutSeconds: 540, maxInstances: 1, retryCount: 3}, async () => {
  const db = getFirestore(), now = Date.now();
  const users = await db.collection('users').where('isActive', '==', true).get();
  const sites = new Map();
  for (const user of users.docs) {
    const id = user.data().siteId;
    if (typeof id !== 'string' || !id || id.includes('/') || user.id === 'n89Dopqa4ybdE8VX6B5zUwJYMcx1') continue;
    if (!sites.has(id)) sites.set(id, []);
    sites.get(id).push(user);
  }
  for (const [siteId, recipients] of sites) {
    const configRef = db.doc(`energyMonitor/${siteId}/config/notifications`);
    const config = (await configRef.get()).data();
    const slot = slotAt(now, config);
    if (!slot) continue;
    const meters = currentMeters((await db.collection(`energyMonitor/${siteId}/meters`).get()).docs, now);
    for (const meter of meters) {
      const id = notificationId(siteId, meter.data(), meter.id, slot);
      for (const user of recipients) {
        const ref = db.doc(`notifications/${user.id}/items/${id}`);
        const claim = db.doc(`notificationDeliveries/${user.id}/energyMeterUpdates/${id}`);
        await db.runTransaction(async tx => {
          const [savedClaim, saved, latestUser, latestConfig, latestMeter] = await Promise.all([
            tx.get(claim), tx.get(ref), tx.get(user.ref), tx.get(configRef), tx.get(meter.ref)
          ]);
          if (savedClaim.exists || !latestUser.exists || !eligibleUser(latestUser.data(), siteId) || !latestMeter.exists || slotAt(now, latestConfig.data()) !== slot) return;
          const data = latestMeter.data();
          if (notificationId(siteId, data, meter.id, slot) !== id) return;
          if (!saved.exists) tx.create(ref, {...notification(data, meter.id, siteId, latestUser.data().site || siteId, now), createdAt: FieldValue.serverTimestamp()});
          // A permanent claim prevents retries from recreating a deleted bell item.
          tx.create(claim, {siteId, meterId: meter.id, slot, createdAt: FieldValue.serverTimestamp()});
        });
      }
    }
  }
});

const {meterIdentity, shiftDate} = require('./meter-history.cjs');
const {reportDate, dailyNotification, dailyId} = require('./energy-daily-notifications.cjs');
exports.sendDailyEnergyReadings = onSchedule({schedule:'0 0 * * *',timeZone:'Asia/Kolkata',timeoutSeconds:540,maxInstances:1,retryCount:3}, async event => {
  const db = getFirestore(), now = Date.now();
  // Use scheduled time so a retry after midnight still reports the same day.
  const date = reportDate(event?.scheduleTime, now);
  const users = await db.collection('users').where('isActive','==',true).get();
  const sites = new Map();
  for (const user of users.docs) {
    const id = user.data().siteId;
    if (typeof id !== 'string' || !id || id.includes('/') || user.id === 'n89Dopqa4ybdE8VX6B5zUwJYMcx1') continue;
    if (!sites.has(id)) sites.set(id, []);
    sites.get(id).push(user);
  }
  for (const [siteId, recipients] of sites) {
    const configRef = db.doc(`energyMonitor/${siteId}/config/notifications`);
    if ((await configRef.get()).data()?.dailyEnabled === false) continue;
    const [daily, meters] = await Promise.all([
      db.collection(`energyMonitor/${siteId}/dailyReadings`).where('date','==',date).get(),
      db.collection(`energyMonitor/${siteId}/meters`).get()
    ]);
    const equipment = new Map(currentMeters(meters.docs,now).map(m => [meterIdentity(m.data(),m.id),{...m.data(),id:m.id}]));
    // Include meters recorded during the day even if their collector document was removed.
    for (const record of daily.docs) {
      const data = record.data();
      if (typeof data.meterKey === 'string' && data.meterKey && !data.meterKey.includes('/')) equipment.set(data.meterKey,{...equipment.get(data.meterKey),id:equipment.get(data.meterKey)?.id || data.meterId || '',name:data.meterName || equipment.get(data.meterKey)?.name || ''});
    }
    for (const [key, meter] of equipment) {
      const dayRef = db.doc(`energyMonitor/${siteId}/dailyReadings/${date}__${key}`);
      const previousRef = db.doc(`energyMonitor/${siteId}/dailyReadings/${shiftDate(date,-1)}__${key}`);
      const meterRef = meter.id && !meter.id.includes('/') ? db.doc(`energyMonitor/${siteId}/meters/${meter.id}`) : null;
      const id = dailyId(siteId,key,date);
      for (const user of recipients) {
        const ref = db.doc(`notifications/${user.id}/items/${id}`);
        const claim = db.doc(`notificationDeliveries/${user.id}/energyDailyReadings/${id}`);
        await db.runTransaction(async tx => {
          const [claimed,saved,latestUser,config,register,previous,currentMeter] = await Promise.all([
            tx.get(claim),tx.get(ref),tx.get(user.ref),tx.get(configRef),tx.get(dayRef),tx.get(previousRef),meterRef ? tx.get(meterRef) : null
          ]);
          if (claimed.exists || !latestUser.exists || !eligibleUser(latestUser.data(),siteId) || config.data()?.dailyEnabled === false) return;
          if (!saved.exists) tx.create(ref,{...dailyNotification(register.data(),previous.data(),currentMeter?.exists ? {...currentMeter.data(),id:meter.id} : {...meter,status:'OFFLINE',communicationState:'OFFLINE'},siteId,latestUser.data().site || siteId,date,now),createdAt:FieldValue.serverTimestamp()});
          tx.create(claim,{siteId,meterKey:key,date,createdAt:FieldValue.serverTimestamp()});
        });
      }
    }
  }
});
