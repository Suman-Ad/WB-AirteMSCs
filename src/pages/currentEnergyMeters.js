// Collector document IDs can change when a Modbus address is reassigned.
const pointId = meter => [meter.pointId, meter.point_id, meter.point, meter.energyBookPointId]
  .find(value => typeof value === 'string' && value.trim())?.trim() || '';
const equipmentName = meter => typeof meter.name === 'string' ? meter.name.normalize('NFKC').trim().toLowerCase()
  .replace(/[\s_-]+/g, ' ').replace(/\b0+(\d+)\b/g, '$1') : '';
const observed = (meter, now) => {
  const value = meter.observedAt?.toMillis?.();
  return Number.isFinite(value) && value > 0 && value <= now + 5000 ? value : -Infinity;
};

export function currentEnergyMeters(incoming, now = Date.now()) {
  // Only the legacy test document is retired; custom collector IDs remain valid.
  const records = incoming.some(m => m.id !== 'test-meter') ? incoming.filter(m => m.id !== 'test-meter') : incoming;
  const pointsByName = new Map();
  records.forEach(meter => {
    const name = equipmentName(meter), point = pointId(meter);
    if (name && point) {
      if (!pointsByName.has(name)) pointsByName.set(name, new Set());
      pointsByName.get(name).add(point);
    }
  });
  const groups = new Map();
  records.forEach(meter => {
    const point = pointId(meter), name = equipmentName(meter);
    const candidates = pointsByName.get(name);
    // Different explicit point IDs are distinct equipment, even with matching names.
    const inferredPoint = !point && candidates?.size === 1 ? [...candidates][0] : '';
    const key = point || inferredPoint ? `point:${point || inferredPoint}`
      : name && (!candidates || candidates.size === 0) ? `name:${name}` : `id:${meter.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(meter);
  });
  const aliases = {};
  const meters = [...groups.values()].map(group => {
    group.sort((a,b) => {
      const aTime = observed(a, now), bTime = observed(b, now);
      return aTime === bTime ? String(a.id).localeCompare(String(b.id), undefined, {numeric:true}) : aTime > bTime ? -1 : 1;
    });
    const newest = group[0];
    group.forEach(meter => {aliases[meter.id] = newest.id;});
    return newest;
  }).sort((a,b) => (Number(a.slaveId) || 0) - (Number(b.slaveId) || 0) || String(a.id).localeCompare(String(b.id), undefined, {numeric:true}));
  return {meters, aliases};
}
