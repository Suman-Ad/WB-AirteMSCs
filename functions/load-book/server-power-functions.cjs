const {onDocumentWritten} = require('firebase-functions/v2/firestore');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const {assessHeaderPower, advanceChangeover, initialChangeoverState, fresh} = require('./server-power-detector.cjs');

// Runtime drives Layout; server run transitions feed the dedicated notification trigger.
exports.detectServerPowerSource = onDocumentWritten({
  document: 'energyMonitor/{siteId}/meters/{meterId}', retry: true,
}, async event => {
  if (!event.data?.after.exists) return;
  const {siteId, meterId} = event.params;
  const db = getFirestore(), base = `energyMonitor/${siteId}`;
  await db.runTransaction(async tx => {
    const activation = (await tx.get(db.doc(`${base}/config/serverPowerSwitch`))).data();
    if (!activation) return;
    const shared = (await tx.get(db.doc(`${base}/config/powerSwitch`))).data();
    // Independent config activates the backend; the existing settings control its operation.
    const config = shared ? {...shared, enabled: activation.enabled === true && shared.enabled === true} : activation;
    const ids = [config.mainMeterId, config.dg1MeterId, config.dg2MeterId].filter(Boolean);
    if (!config.mainMeterId || ids.length < 2 || new Set(ids).size !== ids.length ||
        ids.some(id => typeof id !== 'string' || id.includes('/'))) return;
    if (!ids.includes(meterId)) return;
    const ref = db.doc(`${base}/runtime/serverPowerSource`);
    const previous = (await tx.get(ref)).data() || {};
    if (config.enabled !== true) {
      if (previous.mappingKey) tx.set(ref, {enabled: false, detector: initialChangeoverState(),
        restorationEvidence: null, assessment: 'disabled', message: 'Server automatic detection disabled',
        updatedAt: FieldValue.serverTimestamp()}, {mergeFields: ['enabled', 'detector', 'restorationEvidence', 'assessment', 'message', 'updatedAt']});
      return;
    }
    const meters = [];
    for (const id of ids) {
      const snapshot = await tx.get(db.doc(`${base}/meters/${id}`));
      if (snapshot.exists) meters.push({...snapshot.data(), id});
    }
    // Assess current documents, never an old event payload. Duplicate/reordered events
    // cannot turn the same observed timestamps into a second confirmation.
    const now = Date.now();
    const key = JSON.stringify(ids);
    const revision = config.updatedAt?.toMillis?.() ?? null;
    const maxGap = Math.max(30000, ...meters.map(m => (Number(m.uploadIntervalSeconds) || 10) * 3000));
    const reset = previous.mappingKey !== key || previous.configRevision !== revision || previous.enabled === false || now - (previous.evaluatedAtMs || 0) > maxGap;
    const powerSource = previous.powerSource || 'Unknown';
    const assessment = previous.activeRunId && previous.mappingKey !== key
      ? {kind: 'waiting', message: 'Server mapping changed during an active run; restore the mapping or reconcile the isolated runtime before continuing.'}
      : assessHeaderPower(config, meters, now, false, powerSource,
      previous.selectedDG, reset ? null : previous.restorationEvidence);
    const detector = advanceChangeover(reset ? initialChangeoverState() : previous.detector || initialChangeoverState(), assessment, 2);
    let evidence = null;
    if (assessment.kind === 'candidate' && assessment.dg === 'EB') {
      if (assessment.evidenceMode === 'retained') evidence = previous.restorationEvidence;
      else {
        const id = previous.selectedDG === 'DG-2' ? config.dg2MeterId : config.dg1MeterId || config.dg2MeterId;
        const meter = meters.find(m => m.id === id);
        const old = !reset && previous.restorationEvidence;
        evidence = {...meter, loadTransferAtMs: old?.id === id ? Math.min(old.loadTransferAtMs, assessment.transferAtMs) : assessment.transferAtMs};
      }
    }
    const activeRef = previous.activeRunId ? db.doc(`${base}/serverChangeovers/${previous.activeRunId}`) : null;
    const run = activeRef ? (await tx.get(activeRef)).data() : null;
    const patch = {
      schemaVersion: 1, enabled: true, configRevision: revision,
      mappingKey: previous.activeRunId && previous.mappingKey !== key ? previous.mappingKey : key,
      powerSource: assessment.kind === 'restored' ? 'EB' : powerSource, selectedDG: previous.selectedDG || null,
      activeRunId: previous.activeRunId || null, startAtMs: previous.startAtMs || run?.startAtMs || null, detector, restorationEvidence: evidence,
      assessment: assessment.kind, message: assessment.message, evaluatedAtMs: now,
      // Consumers must check age: a saved source is last observed, not proof of live supply.
      mainObservedAtMs: meters.find(m => m.id === config.mainMeterId)?.observedAt?.toMillis?.() ?? null,
      updatedAt: FieldValue.serverTimestamp(),
    };
    const lastGoodMeters = {};
    for (const id of ids) {
      const current = capture(meters.find(m => m.id === id), now);
      const prior = previous.lastGoodMeters?.[id];
      if (current.kwh !== null && (!prior || current.observedAtMs >= prior.observedAtMs)) lastGoodMeters[id] = current;
      else if (prior?.kwh != null && prior.observedAtMs <= now + 5000) lastGoodMeters[id] = prior;
    }
    patch.lastGoodMeters = lastGoodMeters;
    const sample = id => {
      const current = capture(meters.find(m => m.id === id), now);
      const last = lastGoodMeters[id];
      return {...current, lastKnownKwh: last?.kwh ?? null, lastKnownAtMs: last?.observedAtMs ?? null};
    };
    if (detector.fired) {
      patch.detector = initialChangeoverState();
      patch.restorationEvidence = null;
      patch.lastTransitionAtMs = now;
      patch.assessment = 'confirmed';
      patch.message = detector.dg === 'EB' ? 'Server confirmed return to mains' : `Server confirmed supply from ${detector.dg}`;
      if (detector.dg !== 'EB') {
        const dgId = detector.dg === 'DG-2' ? config.dg2MeterId : config.dg1MeterId;
        // Deterministic identity is also useful when reviewing retries operationally.
        const runId = `${detector.dg}-${detector.mainTime}-${detector.dgTime}`;
        const liveOpening = sample(dgId);
        const previousClosing = previous.dgClosingReadings?.[dgId];
        // Preserve register continuity across runs, including startup/cooldown energy.
        // A decreased live counter indicates a reset or replacement: start afresh.
        const opening = previousClosing?.meterId === dgId &&
          typeof previousClosing.kwh === 'number' && Number.isFinite(previousClosing.kwh) && previousClosing.kwh >= 0 &&
          previousClosing.observedAtMs <= now &&
          (liveOpening.kwh === null || liveOpening.kwh >= previousClosing.kwh)
          ? {...previousClosing, quality: 'Previous DG closing reading'} : liveOpening;
        tx.set(db.doc(`${base}/serverChangeovers/${runId}`), {
          siteId, status: 'Running', dgNumber: detector.dg, meterId: dgId,
          mainMeterId: config.mainMeterId, startAtMs: now, endAtMs: null,
          opening, latest: liveOpening, closing: null, ebFailure: sample(config.mainMeterId),
          trigger: 'Server automatic', createdAt: FieldValue.serverTimestamp(),
        });
        Object.assign(patch, {powerSource: 'DG', selectedDG: detector.dg, activeRunId: runId, startAtMs: now});
      } else {
        if (run) {
          let closing = sample(run.meterId);
          if (closing.kwh === null && run.latest?.kwh != null) closing = {...run.latest, quality: 'Last valid reading before restoration'};
          if (closing.kwh !== null) patch.dgClosingReadings = {...previous.dgClosingReadings, [run.meterId]: closing};
          const generationKwh = run.opening?.kwh != null && closing.kwh != null && closing.kwh >= run.opening.kwh ? closing.kwh - run.opening.kwh : null;
          tx.set(activeRef, {status: 'Completed', endAtMs: now, closing, generationKwh,
            loadTransferAtMs: detector.transferAtMs ?? null, ebRestoration: sample(config.mainMeterId),
            runSeconds: Math.max(0, Math.floor((now - run.startAtMs) / 1000)),
            updatedAt: FieldValue.serverTimestamp()}, {merge: true});
        }
        Object.assign(patch, {powerSource: 'EB', selectedDG: null, activeRunId: null, startAtMs: null});
      }
    } else if (run?.status === 'Running') {
      const latest = sample(run.meterId);
      if (latest.kwh !== null && latest.observedAtMs > (run.latest?.observedAtMs || 0)) {
        tx.set(activeRef, {latest, updatedAt: FieldValue.serverTimestamp()}, {merge: true});
      }
    }
    const sourceMeterId = patch.powerSource === 'DG'
      ? (patch.selectedDG === 'DG-2' ? config.dg2MeterId : config.dg1MeterId)
      : patch.powerSource === 'EB' ? config.mainMeterId : null;
    patch.sourceMeterId = sourceMeterId || null;
    patch.sourceObservedAtMs = meters.find(m => m.id === sourceMeterId)?.observedAt?.toMillis?.() ?? null;
    // Replace detector/evidence maps as whole fields: recursive merge retains old phase keys.
    tx.set(ref, patch, {mergeFields: Object.keys(patch)});
  });
});

function capture(meter, now) {
  const live = fresh(meter, now);
  const counter = meter?.fwd_Wh;
  const units = meter?.energyUnits;
  const knownUnits = units == null || ['Wh', 'base', 'kWh', 'kilo'].includes(units);
  return {meterId: meter?.id || '', observedAtMs: meter?.observedAt?.toMillis?.() ?? null,
    kwh: live && knownUnits && typeof counter === 'number' && Number.isFinite(counter) && counter >= 0 ? counter / (['kWh', 'kilo'].includes(units) ? 1 : 1000) : null,
    quality: live ? 'Captured' : 'Unavailable',
    readings: live ? Object.fromEntries(Object.entries(meter).filter(([, value]) => typeof value === 'number' && Number.isFinite(value))) : {},
  };
}
