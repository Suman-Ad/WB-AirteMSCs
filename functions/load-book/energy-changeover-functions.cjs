const {onDocumentWritten} = require('firebase-functions/v2/firestore');
const {getFirestore,FieldValue} = require('firebase-admin/firestore');
const {transition,changeoverNotification,changeoverId,eligibleChangeoverUser} = require('./energy-changeover-notifications.cjs');
const {loadFuelSnapshot,fuelSnapshot} = require('./energy-changeover-fuel.cjs');
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
  const users=await db.collection('users').where('isActive','==',true).get();
  const id=changeoverId(siteId,runId,phase);
  const fuelRef=db.doc(`notificationDeliveries/energyChangeoverFuel/snapshots/${id}`);
  let fuel=(await fuelRef.get()).data();
  if (!fuel) {
    try { fuel=await loadFuelSnapshot(db,after,phase,siteId); }
    catch (error) {
      console.warn('Changeover fuel lookup failed',{siteId,runId,phase,code:error.code || 'read-failed'});
      fuel={...fuelSnapshot({},[],after.date || '',after.dgNumber),unavailableReason:'Fuel data read failed'};
    }
    fuel=await db.runTransaction(async tx=>{
      const saved=await tx.get(fuelRef);
      if (saved.exists) return saved.data();
      tx.create(fuelRef,fuel);return fuel;
    });
  }
  const notice={...changeoverNotification({...after,fuelSnapshot:fuel},phase,siteId),runId};
  for(const user of users.docs) {
    if(!eligibleChangeoverUser(user.data(),siteId) || user.id === 'n89Dopqa4ybdE8VX6B5zUwJYMcx1') continue;
    const ref=db.doc(`notifications/${user.id}/items/${id}`);
    const claim=db.doc(`notificationDeliveries/${user.id}/energyChangeovers/${id}`);
    await db.runTransaction(async tx=>{
      const [claimed,saved,latestUser,config]=await Promise.all([tx.get(claim),tx.get(ref),tx.get(user.ref),tx.get(configRef)]);
      if(claimed.exists || !latestUser.exists || !eligibleChangeoverUser(latestUser.data(),siteId) || config.data()?.changeoverEnabled === false) return;
      // Event snapshots preserve the correct phase even if stop arrives before a start retry.
      if(!saved.exists) tx.create(ref,{...notice,createdAt:FieldValue.serverTimestamp()});
      tx.create(claim,{siteId,runId,phase,createdAt:FieldValue.serverTimestamp()});
    });
  }
});
