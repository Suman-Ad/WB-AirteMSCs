import { collection, doc, onSnapshot } from "firebase/firestore";
import { siteIdMap } from "../config/siteConfigs";
export function configuredDGSitePaths(configs) {
  const names = Object.keys(siteIdMap);
  return [...new Set(Object.entries(configs).map(([id, config]) => {
    const candidates = [id, config.siteName, config.site].filter((s) => typeof s === "string").map((s) => s.trim().toLowerCase());
    return names.find((name) => candidates.includes(name.toLowerCase())) || names.find((name) => siteIdMap[name] === config.siteId) || String(config.site || config.siteName || id).trim();
  }).filter(Boolean))].sort();
}
export function siteDataPaths(kind, sites, month, date) {
  if (kind === "daily") return sites.map((site) => ({ site, path: ["dailyDGLogs", site, month] }));
  if (kind === "bills") return sites.map((site) => ({ site, document: true, path: ["ebBillDetails", site, "MonthlyBills", month] }));
  if (kind === "runs") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "") || date.slice(0, 7) !== month) return [];
    const runMonth = new Date(`${date}T12:00:00+05:30`).toLocaleString("en-US", { month: "short", timeZone: "Asia/Kolkata" }) + "-" + date.slice(0, 4);
    return sites.map((site) => ({ site, date, path: ["dgLogs", site, runMonth, date, "runs"] }));
  }
  throw new Error("Unknown DG data source");
}
// Subscribe only below known roots, never a database-wide collection group.
export function subscribeSiteData(db, paths, onRows, onErrors, onReady = () => {}) {
  let active = true;
  const rows = new Map(), errors = new Map(), pending = new Set(paths.map((p) => p.site));
  const publish = () => {
    if (!active) return;
    onRows([...rows.values()].flat()); onErrors([...errors.entries()].map(([site, message]) => `${site}: ${message}`).join("; "));
    if (!pending.size) onReady();
  };
  if (!paths.length) publish();
  const stops = paths.map((entry) => onSnapshot((entry.document ? doc : collection)(db, ...entry.path), (snapshot) => {
    if (!active) return;
    const records = entry.document ? (snapshot.exists() ? [snapshot] : []) : snapshot.docs;
    rows.set(entry.site, records.map((record) => ({ ...record.data(), id: `${entry.site}/${record.id}`, site: entry.site.toUpperCase(), ...(entry.date ? { date: entry.date } : {}) })));
    errors.delete(entry.site); pending.delete(entry.site); publish();
  }, (error) => {
    if (!active) return;
    rows.set(entry.site, []); pending.delete(entry.site); errors.set(entry.site, error.message || error.code || "Read failed"); publish();
  }));
  return () => { active = false; stops.forEach((stop) => stop()); };
}
