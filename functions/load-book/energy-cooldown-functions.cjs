const {onDocumentWritten}=require('firebase-functions/v2/firestore');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const {cooldownPatch}=require('./energy-cooldown.cjs');
exports.captureEnergyCooldown=onDocumentWritten({document:'energyMonitor/{siteId}/meters/{meterId}',retry:true},async event=>{
 if(!event.data?.after.exists) return;
 const {siteId,meterId}=event.params,db=getFirestore(),meter=event.data.after.data(),now=Date.parse(event.time);
 if(!Number.isFinite(now)) return;
 const runs=await db.collection(`energyChangeovers/${siteId}/runs`).where('cooldownStatus','==','Cooling').get();
 for(const run of runs.docs) {
  if(run.data().meterId!==meterId||!run.data().siteName) continue;
  await db.runTransaction(async tx=>{
   const [latest,status]=await Promise.all([tx.get(run.ref),tx.get(db.doc(`sitePowerStatus/${run.data().siteName}`))]);
   if(!latest.exists) return;
   const patch=cooldownPatch(latest.data(),meter,now,status.data()?.powerSource);
   if(patch) tx.set(run.ref,{...patch,updatedAt:FieldValue.serverTimestamp()},{merge:true});
  });
 }
});
