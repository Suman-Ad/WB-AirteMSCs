const {onDocumentWritten} = require('firebase-functions/v2/firestore');
const {getFirestore,FieldValue} = require('firebase-admin/firestore');
const {eligibleUser} = require('./energy-notifications.cjs');
const {transition,changeoverNotification,changeoverId} = require('./energy-changeover-notifications.cjs');
exports.notifyEnergyChangeover = onDocumentWritten({document:'energyChangeovers/{siteId}/runs/{runId}',retry:true},async event=>{
  const before=event.data?.before.exists ? event.data.before.data() : null;
  const after=event.data?.after.exists ? event.data.after.data() : null;
  const phase=transition(before,after);
  if(!phase) return; // Checkpoints are readings, not new changeovers.
  const {siteId,runId}=event.params;
  if(after.siteId !== siteId) return;
  const db=getFirestore();
  const configRef=db.doc(`energyMonitor/${siteId}/config/notifications`);
  if((await configRef.get()).data()?.changeoverEnabled === false) return;
  const users=await db.collection('users').where('siteId','==',siteId).get();
  const id=changeoverId(siteId,runId,phase);
  const notice={...changeoverNotification(after,phase,siteId),runId};
  for(const user of users.docs) {
    if(!eligibleUser(user.data(),siteId) || user.id === 'n89Dopqa4ybdE8VX6B5zUwJYMcx1') continue;
    const ref=db.doc(`notifications/${user.id}/items/${id}`);
    const claim=db.doc(`notificationDeliveries/${user.id}/energyChangeovers/${id}`);
    await db.runTransaction(async tx=>{
      const [claimed,saved,latestUser,config]=await Promise.all([tx.get(claim),tx.get(ref),tx.get(user.ref),tx.get(configRef)]);
      if(claimed.exists || !latestUser.exists || !eligibleUser(latestUser.data(),siteId) || config.data()?.changeoverEnabled === false) return;
      // Event snapshots preserve the correct phase even if stop arrives before a start retry.
      if(!saved.exists) tx.create(ref,{...notice,createdAt:FieldValue.serverTimestamp()});
      tx.create(claim,{siteId,runId,phase,createdAt:FieldValue.serverTimestamp()});
    });
  }
});
