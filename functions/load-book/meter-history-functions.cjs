const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { buildSample, historySettings, planDailyCapture, shiftDate, istDate } = require('./meter-history.cjs');

exports.captureMeterHistory = onDocumentWritten({ document: 'energyMonitor/{siteId}/meters/{meterId}', retry: true }, async event => {
  if (!event.data?.after.exists) return;
  const { siteId, meterId } = event.params;
  const sample = buildSample(event.data.after.data(), meterId, Date.parse(event.time));
  if (!sample) return;
  const db = getFirestore();
  const root = db.doc(`energyMonitor/${siteId}`);
  const dailyCollection = root.collection('dailyReadings');
  const dayRef = dailyCollection.doc(`${sample.date}__${sample.meterKey}`);
  const historyMeter = root.collection('historyMeters').doc(sample.meterKey);
  await db.runTransaction(async tx => {
    const configSnapshot = await tx.get(root.collection('config').doc('meterHistory'));
    const settings = historySettings(configSnapshot.data());
    if (!settings.enabled || sample.date < shiftDate(istDate(Date.now()), 1 - settings.retentionDays)) return;
    const currentSnapshot = await tx.get(dayRef), current = currentSnapshot.data();
    // A one-minute daily checkpoint bounds writes while keeping observation provenance.
    // Earlier observations can still correct the first reading; retries are idempotent.
    const historicalReset = current && !current.counterReset && sample.observedAtMs > current.firstAtMs && sample.observedAtMs < current.lastAtMs && (sample.kwh < current.firstKwh || sample.kwh > current.closingKwh);
    if (current && !historicalReset && sample.observedAtMs >= current.firstAtMs && (sample.observedAtMs <= current.lastAtMs || (sample.observedAtMs <= current.lastAtMs + 59999 && sample.kwh >= current.closingKwh))) return;
    const previousRef = dailyCollection.doc(`${shiftDate(sample.date, -1)}__${sample.meterKey}`);
    const nextRef = dailyCollection.doc(`${shiftDate(sample.date, 1)}__${sample.meterKey}`);
    const sampleRef = historyMeter.collection('samples').doc(sample.bucket);
    const [previous, next, savedSample] = await Promise.all([tx.get(previousRef), tx.get(nextRef), tx.get(sampleRef)]);
    const plan = planDailyCapture(sample, current, previous.data(), next.data());
    tx.set(dayRef, { ...plan.daily, updatedAt: FieldValue.serverTimestamp() });
    if (plan.nextPatch) tx.update(nextRef, { ...plan.nextPatch, updatedAt: FieldValue.serverTimestamp() });
    if (!savedSample.exists) tx.create(sampleRef, { ...sample, savedAt: FieldValue.serverTimestamp() });
    tx.set(historyMeter, { meterKey: sample.meterKey, meterName: plan.daily.meterName, meterId: plan.daily.meterId }, { merge: true });
    tx.set(root, { meterHistoryVersion: 1 }, { merge: true });
  });
});

async function deleteOldDocuments(db, collection, cutoff) {
  // Bound each invocation; any large remaining backlog is picked up next run.
  for (let round = 0; round < 25; round++) {
    const snapshot = await collection.where('date', '<', cutoff).limit(400).get();
    if (snapshot.empty) return;
    const batch = db.batch(); snapshot.docs.forEach(document => batch.delete(document.ref));
    await batch.commit();
    if (snapshot.size < 400) return;
  }
}
exports.pruneMeterHistory = onSchedule({ schedule: '15 2 * * *', timeZone: 'Asia/Kolkata', timeoutSeconds: 540 }, async () => {
  const db = getFirestore();
  const sites = await db.collection('energyMonitor').get();
  for (const site of sites.docs) {
    const config = await site.ref.collection('config').doc('meterHistory').get();
    const { retentionDays } = historySettings(config.data());
    const cutoff = shiftDate(istDate(Date.now()), 1 - retentionDays);
    await deleteOldDocuments(db, site.ref.collection('dailyReadings'), cutoff);
    const meters = await site.ref.collection('historyMeters').get();
    for (const meter of meters.docs) await deleteOldDocuments(db, meter.ref.collection('samples'), cutoff);
  }
});
