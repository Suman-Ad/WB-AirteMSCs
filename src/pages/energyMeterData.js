export const isNumber = (v) => typeof v === "number" && Number.isFinite(v);
export const phases = ["R", "Y", "B"];
export const phaseColors = ["#cf3434", "#a87800", "#2864d7"];
export const wrapAngle = (a) => ((a + 180) % 360 + 360) % 360 - 180;

// Match EnergyBook's phase_vectors.py: measured angles take priority over P/Q estimates.
export function vectors(meter) {
  return phases.map((phase, i) => {
    const read = (key) => meter?.status === "OK" && isNumber(meter[`${phase}_${key}`]) ? meter[`${phase}_${key}`] : null;
    const voltage = read("voltage_ln"), current = read("current");
    const voltageAngle = read("voltage_phase_angle"), currentAngle = read("current_phase_angle");
    const measured = voltageAngle !== null && currentAngle !== null;
    const p = read("active_power"), q = read("reactive_power");
    let phi = null;
    if (voltage > 0 && current > 1e-6) {
      if (measured) phi = wrapAngle(voltageAngle - currentAngle);
      else if (p !== null && q !== null && (p !== 0 || q !== 0)) phi = Math.atan2(q, p) * 180 / Math.PI;
    }
    const reference = measured ? voltageAngle : [0, -120, 120][i];
    return { phase, voltage, current, phi, reference, measured,
      voltageAngle, currentAngle, color: phaseColors[i],
      source: measured ? "Measured" : phi !== null ? "Estimated from P/Q" : "Unavailable" };
  });
}

export function displayReading(meter, key) {
  const v = meter?.status === "OK" ? meter[key] : null;
  const base = key.replace(/^[RYB]_/, "");
  const powerUnits = { active_power: "kW", apparent_power: "kVA", reactive_power: "kvar" };
  if (powerUnits[base]) return { value: isNumber(v) ? v / (meter.powerUnits === "base" ? 1000 : 1) : null,
    unit: ["base", "kilo"].includes(meter?.powerUnits) ? powerUnits[base] : "raw (units unverified)" };
  const units = { voltage_ll: "V", voltage_ln: "V", current: "A", frequency: "Hz", power_factor: "",
    voltage_phase_angle: "°", current_phase_angle: "°", fwd_Wh: "Wh", fwd_VAh: "VAh",
    fwd_VARh: "varh", fwd_VARh_capacitive: "varh", fwd_runsec: "s" };
  return { value: isNumber(v) ? v : null, unit: units[base] || "" };
}
