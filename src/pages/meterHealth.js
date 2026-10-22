export function meterHealth(meter, now, fromCache, unavailable = false) {
  if (unavailable) return "Unavailable";
  if (fromCache) return "Cached / reconnecting";
  const time = meter?.observedAt?.toMillis?.();
  if (typeof time !== "number" || !Number.isFinite(time) || time > now + 5000) return "Waiting for data";
  const stale = Math.max(30, (Number(meter?.uploadIntervalSeconds) || 10) * 3) * 1000;
  if (now - time > stale) return "Stale / offline";
  return meter?.status === "OK" ? "Live" : "Meter error";
}
export const meterLight = (status) => status === "Live" ? "online" : /Cached|Waiting/.test(status) ? "waiting" : "offline";
