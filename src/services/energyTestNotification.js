import { collection, doc, getDocFromServer, getDocsFromServer, serverTimestamp, writeBatch } from "firebase/firestore";
import { auth, db } from "../firebase";
import { currentEnergyMeters } from "../pages/currentEnergyMeters";
import { displayReading } from "../pages/energyMeterData";
import { meterHealth } from "../pages/meterHealth";

export async function sendEnergyTestNotification(siteId) {
  const uid = auth.currentUser?.uid;
  if (!uid || !siteId) throw new Error("Sign in with a site-assigned account first.");
  const user = (await getDocFromServer(doc(db, "users", uid))).data();
  if (!user || user.isActive !== true || user.siteId !== siteId) throw new Error("Test notifications require an active account assigned to this site.");
  if (!["Admin", "Super Admin"].includes(user.role)) throw new Error("Only Admin and Super Admin accounts can send test notifications.");
  const snapshot = await getDocsFromServer(collection(db, "energyMonitor", siteId, "meters"));
  const now = Date.now();
  const meters = currentEnergyMeters(snapshot.docs.map(item => ({...item.data(), id: item.id})), now).meters;
  if (!meters.length) throw new Error("No meter readings are available for this site.");
  if (auth.currentUser?.uid !== uid) throw new Error("Your session changed. Please retry.");
  const batch = writeBatch(db);
  // Keep a single atomic test batch within Firestore's write limit.
  if (meters.length > 450) throw new Error("Too many meters for a single test notification batch.");
  const format = value => typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("en-IN", {maximumFractionDigits: 2}) : "Unavailable";
  for (const meter of meters) {
    const reading = key => format(displayReading(meter, key).value);
    const at = meter.observedAt?.toMillis?.();
    const health = meterHealth(meter, now, false);
    const ref = doc(collection(db, "notifications", uid, "items"));
    batch.set(ref, {
      title: `TEST · ${String(meter.name || meter.id).slice(0, 100)}`,
      message: [
        `${user.site || siteId} · ${health}`,
        `Energy: ${reading("fwd_Wh")} kWh | Power: ${reading("active_power")} kW`,
        `Voltage R/Y/B: ${["R","Y","B"].map(p => reading(`${p}_voltage_ln`)).join(" / ")} V L-N`,
        `Current R/Y/B: ${["R","Y","B"].map(p => reading(`${p}_current`)).join(" / ")} A`,
        `PF: ${reading("power_factor")} | Frequency: ${reading("frequency")} Hz`,
        `Observed: ${Number.isFinite(at) && at > 0 && at <= now + 5000 ? new Date(at).toLocaleString("en-IN", {timeZone: "Asia/Kolkata"}) + " IST" : "Unavailable"}`
      ].join("\n"),
      actionType: "energy_meter_update", url: "/energy-monitor", read: false, isTest: true,
      date: new Date(now + 330 * 60000).toISOString().slice(0, 10), siteId, meterId: meter.id,
      readingState: health, createdAt: serverTimestamp()
    });
  }
  await batch.commit();
  return meters.length;
}
