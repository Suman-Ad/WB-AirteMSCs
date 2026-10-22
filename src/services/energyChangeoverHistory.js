import { collection, doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { displayReading } from "../pages/energyMeterData";
import { meterHealth } from "../pages/meterHealth";

export function captureMeter(data, meterId, now) {
  const meter = data?.meters?.find((item) => item.id === meterId);
  const state = meterHealth(meter, now, data?.fromCache !== false);
  const live = state === "Live";
  const read = (key) => live ? displayReading(meter, key).value : null;
  const readings = live ? Object.fromEntries(Object.entries(meter).filter(([, value]) => typeof value === "number" && Number.isFinite(value))) : {};
  const last = data?.lastGood?.[meterId];
  return { meterId: meterId || "", meterName: meter?.name || meterId || "Unmapped", observedAtMs: live ? meter.observedAt.toMillis() : null,
    kwh: read("fwd_Wh"), kw: read("active_power"), kva: read("apparent_power"), kvar: read("reactive_power"),
    readings, powerUnits: meter?.powerUnits || "unknown", energyUnits: meter?.energyUnits || "Wh", quality: live ? "Captured" : state,
    lastKnownKwh: last?.kwh ?? null, lastKnownAtMs: last?.observedAtMs ?? null };
}
const mappedMeter = (config, dg) => dg === "DG-2" ? config?.dg2MeterId : dg === "DG-1" ? config?.dg1MeterId : "";

// Commit status and meter history together. A second client cannot claim the same transition.
export async function commitEnergyChangeover(db, powerRef, updateData, context) {
  const { siteId, siteName, dg, automatic, meterData, uid } = context;
  const now = Date.now();
  const newRunRef = doc(collection(db, "energyChangeovers", siteId, "runs"));
  return runTransaction(db, async (transaction) => {
    const status = await transaction.get(powerRef);
    const prev = status.exists() ? status.data() : {};
    const previousSource = prev.powerSource || "EB";
    if (previousSource === updateData.powerSource || (automatic && previousSource !== "EB")) return false;
    const starting = updateData.powerSource === "DG";
    const runRef = !starting && prev.activeEnergyRunId ? doc(db, "energyChangeovers", siteId, "runs", prev.activeEnergyRunId) : newRunRef;
    const oldRun = !starting && prev.activeEnergyRunId ? await transaction.get(runRef) : null;
    const existing = oldRun?.exists() ? oldRun.data() : null;
    const dgNumber = starting ? dg : existing?.dgNumber || prev.dgNumber || dg;
    const meterId = existing?.meterId || mappedMeter(meterData?.config, dgNumber) || "";
    let sample = captureMeter(meterData, meterId, now);
    if (!starting && sample.kwh === null) {
      const last = [existing?.latest, meterData?.lastGood?.[meterId]].filter((value) => value?.kwh != null).sort((a, b) => b.observedAtMs - a.observedAtMs)[0];
      if (last?.kwh != null) sample = { ...last, quality: "Last valid reading before restoration", connectionAtRestoration: sample.quality };
    }
    const mainMeterId = existing?.mainMeterId || meterData?.config?.mainMeterId || "";
    const main = captureMeter(meterData, mainMeterId, now);
    const timestamp = serverTimestamp();
    if (starting) {
      transaction.set(runRef, { siteId, siteName, dgNumber, meterId, mainMeterId, status: "Running", startAtMs: now,
        endAtMs: null, date: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(now)),
        opening: sample, latest: sample, closing: null, ebFailure: main, ebRestoration: null, generationKwh: null,
        trigger: automatic ? "Automatic" : "Manual", createdBy: uid, updatedBy: uid, createdAt: timestamp, updatedAt: timestamp });
    } else {
      const startAtMs = existing?.startAtMs ?? prev.dgStartTime?.toMillis?.() ?? null;
      const opening = existing?.opening || null;
      const generation = opening?.kwh != null && sample.kwh != null && sample.kwh >= opening.kwh ? sample.kwh - opening.kwh : null;
      const record = { siteId, siteName, dgNumber, meterId, mainMeterId, status: "Completed", startAtMs, endAtMs: now,
        date: existing?.date || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(startAtMs || now)),
        opening, closing: sample, ebRestoration: main, generationKwh: generation,
        runSeconds: startAtMs === null ? null : Math.max(0, Math.floor((now - startAtMs) / 1000)),
        counterReset: opening?.kwh != null && sample.kwh != null && sample.kwh < opening.kwh, updatedBy: uid, updatedAt: timestamp };
      if (!existing) Object.assign(record, { createdBy: uid, createdAt: timestamp, trigger: "Restoration only", ebFailure: null });
      transaction.set(runRef, record, { merge: true });
    }
    transaction.set(powerRef, { ...updateData, ...(starting ? { selectedDG: dgNumber } : {}), activeEnergyRunId: starting ? runRef.id : null }, { merge: true });
    return true;
  });
}

export async function checkpointEnergyRun(db, powerRef, { siteId, uid, meterData }) {
  return runTransaction(db, async (transaction) => {
    const status = await transaction.get(powerRef);
    const current = status.exists() ? status.data() : {};
    if (current.powerSource !== "DG" || !current.activeEnergyRunId) return;
    const runRef = doc(db, "energyChangeovers", siteId, "runs", current.activeEnergyRunId);
    const snapshot = await transaction.get(runRef);
    if (!snapshot.exists() || snapshot.data().status !== "Running") return;
    const run = snapshot.data(), sample = captureMeter(meterData, run.meterId, Date.now());
    if (sample.kwh === null || sample.observedAtMs <= (run.latest?.observedAtMs || 0)) return;
    transaction.set(runRef, { latest: sample, updatedBy: uid, updatedAt: serverTimestamp() }, { merge: true });
  });
}
