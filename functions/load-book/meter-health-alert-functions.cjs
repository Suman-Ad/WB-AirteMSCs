const {onSchedule} = require('firebase-functions/v2/scheduler');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const sites = require('./telegram-sites.cjs');
const {currentMeters} = require('./energy-notifications.cjs');
const {eligible, health, advance, keyFor, notification} = require('./meter-health-alerts.cjs');

exports.sendMeterHealthAlerts = onSchedule({schedule:'every 1 minutes',timeZone:'Asia/Kolkata',timeoutSeconds:540,maxInstances:1,retryCount:3}, async () => {
  const db = getFirestore(), now = Date.now();
  const users = (await db.collection('users').where('isActive','==',true).get()).docs;
  // Include configured sites with no assigned users so global Admins still receive alerts.
  const siteNames = new Map(Object.entries(sites).map(([name,id])=>[id,name]));
  for (const user of users) {
    const data=user.data();
    if (typeof data.siteId === 'string' && data.siteId && !data.siteId.includes('/') && !siteNames.has(data.siteId)) siteNames.set(data.siteId,data.site || data.siteId);
  }
  for (const [siteId,siteName] of siteNames) {
    const recipients=users.filter(user=>eligible(user.data(),siteId,user.id));
    if (!recipients.length) continue;
    const configRef=db.doc(`energyMonitor/${siteId}/config/notifications`);
    if ((await configRef.get()).data()?.healthAlertsEnabled === false) continue;
    const collection=db.collection(`energyMonitor/${siteId}/meters`);
    const meters=currentMeters((await collection.get()).docs,now);
    for (const meter of meters) {
      const key=keyFor(siteId,meter.data(),meter.id);
      for (const user of recipients) {
        const stateRef=db.doc(`notificationDeliveries/${user.id}/meterHealth/${key}`);
        await db.runTransaction(async tx=>{
          const [saved,latestUser,config,latestMeter]=await Promise.all([tx.get(stateRef),tx.get(user.ref),tx.get(configRef),tx.get(meter.ref)]);
          if (!latestUser.exists || !eligible(latestUser.data(),siteId,user.id) || config.data()?.healthAlertsEnabled === false || !latestMeter.exists) return;
          const data=latestMeter.data();
          if (keyFor(siteId,data,meter.id) !== key) return;
          const condition=health(data,now);
          const change=advance(saved.data(),condition,now);
          const id=`meter-health-${key}-${change.state.sequence}`;
          const ref=db.doc(`notifications/${user.id}/items/${id}`);
          // Read before writing to satisfy Firestore transaction ordering.
          const sendEvent=change.event && (change.event !== 'online' || config.data()?.recoveryAlertsEnabled !== false);
          const existing=sendEvent ? await tx.get(ref) : null;
          tx.set(stateRef,{...change.state,siteId,meterId:meter.id});
          if (sendEvent && !existing.exists) tx.create(ref,{...notification(data,meter.id,siteId,siteName,condition,change.event),createdAt:FieldValue.serverTimestamp()});
        });
      }
    }
  }
});
