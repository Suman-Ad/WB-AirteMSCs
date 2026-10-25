import { currentEnergyMeters } from "../pages/currentEnergyMeters";
export const powerMappingEvent = "energy-monitor:power-mapping";
export const powerMappingKey = (siteId) => `energy-monitor:header-power:v1:${siteId}`;
export function readPowerMapping(siteId) {
  const read = (key) => { try { const value = JSON.parse(localStorage.getItem(key) || "{}"); return value && typeof value === "object" && !Array.isArray(value) ? value : {}; } catch { return {}; } };
  const saved = read(powerMappingKey(siteId));
  const simulator = read(`energy-monitor:asansol-trigger:v1:${siteId}`);
  return { htMeterId: saved.htMeterId || "", enabled: saved.enabled !== false, mainMeterId: saved.mainMeterId || simulator.mainMeterId || "", dg1MeterId: saved.dg1MeterId || simulator.dg1MeterId || "", dg2MeterId: saved.dg2MeterId || simulator.dg2MeterId || "" };
}
export function savePowerMapping(siteId, value) {
  localStorage.setItem(powerMappingKey(siteId), JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(powerMappingEvent, { detail: { siteId } }));
}
export const canManageAllPowerMappings = userData => Boolean(userData && userData.isActive !== false &&
  ["Admin", "Super Admin"].includes(userData.role));
export const canEditPowerMapping = (userData, siteId) => Boolean(siteId && userData?.isActive !== false &&
  (canManageAllPowerMappings(userData) || userData?.role === "Super User" && userData.siteId === siteId));
export function normalizePowerMapping(value = {}) {
  return {enabled:value.enabled !== false, ...Object.fromEntries(["mainMeterId", "htMeterId", "dg1MeterId", "dg2MeterId"].map(field => [field, typeof value[field] === "string" ? value[field] : ""]))};
}
export function resolvePowerMapping(config, incoming) {
  const {meters, aliases} = currentEnergyMeters(incoming);
  const mapped = field => config[field] ? aliases[config[field]] || config[field] : "";
  const name = (meter) => String(meter.name || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const unique = (pattern) => { const matches = meters.filter((meter) => pattern.test(name(meter))); return matches.length === 1 ? matches[0].id : ""; };
  return { ...config,
    htMeterId: mapped("htMeterId") || unique(/^ht\s*(?:panel|incomer|meter|main)(?:\s|$)|^ht$/),
    mainMeterId: mapped("mainMeterId") || unique(/^(?:(?:eb|utility)\s+)?main\s+incomer(?:\s|$)|^(?:eb|utility)\s+incomer(?:\s|$)/),
    dg1MeterId: mapped("dg1MeterId") || unique(/^dg\s*(?:(?:panel|meter|incomer)\s*)?0?1(?:\s|$)/),
    dg2MeterId: mapped("dg2MeterId") || unique(/^dg\s*(?:(?:panel|meter|incomer)\s*)?0?2(?:\s|$)/) };
}
