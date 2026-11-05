const {onDocumentWritten} = require('firebase-functions/v2/firestore');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const {serverRunHistoryEntry} = require('./server-run-history.cjs');
exports.syncServerDGRunHistory = onDocumentWritten({document:'energyMonitor/{siteId}/serverChangeovers/{runId}',retry:true}, async event => {
  if (!event.data?.after.exists || event.data.after.data().status !== 'Completed') return;
  const {siteId,runId}=event.params;
  const db=getFirestore(), source=db.doc(`energyMonitor/${siteId}/serverChangeovers/${runId}`);
  await db.runTransaction(async tx => {
    const snapshot=await tx.get(source);
    if (!snapshot.exists) return;
    const run=snapshot.data();
    if (run.historyEntryId) return;
    const entry=serverRunHistoryEntry(run,siteId,runId);
    if (!entry) throw new Error('Completed server run has invalid times, generator or site mapping');
    const id=`server-${runId}`, target=db.doc(`dgRunLogs/${entry.site}/entries/${id}`);
    const existing=await tx.get(target);
    // Never replace user edits or reset an already completed DG log.
    if (!existing.exists) tx.create(target,{...entry,createdAt:FieldValue.serverTimestamp()});
    tx.set(source,{historyEntryId:id,historyLinkedAt:FieldValue.serverTimestamp()},{merge:true});
  });
});
