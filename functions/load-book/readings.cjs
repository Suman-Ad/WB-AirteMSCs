const SLOTS = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'];
function buildEntry(meter, now = Date.now()) {
  const ms = meter.observedAt?.toMillis?.();
  if (meter.status !== 'OK' || !Number.isFinite(ms) || ms > now + 5000 || now - ms > 120000) return null;
  const ist = new Date(ms + 330 * 60000).toISOString();
  const time = ist.slice(11, 13) + ':00';
  // Accept the first healthy upload in the five minutes after each slot.
  if (!SLOTS.includes(time) || Number(ist.slice(14, 16)) >= 5) return null;
  const mapping = {voltageRY:'R_voltage_ll', voltageYB:'Y_voltage_ll', voltageBR:'B_voltage_ll', voltageRN:'R_voltage_ln', voltageYN:'Y_voltage_ln', voltageBN:'B_voltage_ln', currentR:'R_current', currentY:'Y_current', currentB:'B_current', powerFactor:'power_factor'};
  const result = {equipmentType:'LT', date:ist.slice(0,10), time};
  for (const [field, key] of Object.entries(mapping)) {
    if (typeof meter[key] !== 'number' || !Number.isFinite(meter[key]) || meter[key] < 0) return null;
    result[field] = String(meter[key]);
  }
  if (meter.power_factor > 1 || typeof meter.fwd_Wh !== 'number' || !Number.isFinite(meter.fwd_Wh) || meter.fwd_Wh < 0) return null;
  result.kwh = String(meter.fwd_Wh / (['kWh','kilo'].includes(meter.energyUnits) ? 1 : 1000));
  // Temperature is not measured by these meters. Leave it explicitly unavailable.
  result.tempR = ''; result.tempY = ''; result.tempB = '';
  result.loadKW = 1.732 * (meter.R_voltage_ll + meter.Y_voltage_ll + meter.B_voltage_ll) / 3 * (meter.R_current + meter.Y_current + meter.B_current) / 3 * meter.power_factor / 1000;
  return result;
}
module.exports = {buildEntry};
