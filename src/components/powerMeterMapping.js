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
export function resolvePowerMapping(config, meters) {
  const name = (meter) => String(meter.name || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const unique = (pattern) => { const matches = meters.filter((meter) => pattern.test(name(meter))); return matches.length === 1 ? matches[0].id : ""; };
  return { ...config,
    htMeterId: config.htMeterId || unique(/^ht\s*(?:panel|incomer|meter|main)(?:\s|$)|^ht$/),
    mainMeterId: config.mainMeterId || unique(/^(?:(?:eb|utility)\s+)?main\s+incomer(?:\s|$)|^(?:eb|utility)\s+incomer(?:\s|$)/),
    dg1MeterId: config.dg1MeterId || unique(/^dg\s*0?1(?:\s|$)/),
    dg2MeterId: config.dg2MeterId || unique(/^dg\s*0?2(?:\s|$)/) };
}
