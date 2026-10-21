import { POWER_READINGS, powerReading, energyCounter, updateRegisters, registerUsage, flattenReadings, phaseVectors, rmsReadings, forwardReadings, phaseDisplacements } from "./energyReadings";
const meter = (counter, time, extra = {}) => ({ id: "meter-1", status: "OK", fwd_Wh: counter, energyUnits: "Wh", observedAt: { toMillis: () => time }, ...extra });
test("energy units are independent of power units and zero is valid", () => {
  expect(energyCounter(meter(1000, 1))).toEqual({ value: 1, unit: "kWh" });
  expect(energyCounter(meter(0, 1))).toEqual({ value: 0, unit: "kWh" });
  expect(energyCounter(meter(1000, 1, { energyUnits: undefined, powerUnits: "base" }))).toEqual({ value: 1000, unit: "raw" });
  expect(energyCounter({ import_kwh: 5 })).toEqual({ value: 5, unit: "kWh" });
});
test("tracks opening and closing independently, ignores duplicates and older/error readings", () => {
  let registers = updateRegisters({}, [meter(1000, 100)]);
  expect(registerUsage(registers["meter-1"])).toBeNull();
  registers = updateRegisters(registers, [meter(2500, 200), meter(9000, 250, { id: "meter-2" })]);
  registers = updateRegisters(registers, [meter(500, 50), meter(99000, 300, { status: "ERROR" })]);
  expect(registers["meter-1"].opening).toBe(1);
  expect(registers["meter-1"].closing).toBe(2.5);
  expect(registerUsage(registers["meter-1"])).toBe(1.5);
  expect(registers["meter-2"].opening).toBe(9);
  expect(updateRegisters(registers, [meter(8000, 200)])["meter-1"].closing).toBe(2.5);
});
test("counter decreases invalidate usage and unverified-to-verified units restart the window", () => {
  let registers = updateRegisters({}, [meter(5000, 100)]);
  registers = updateRegisters(registers, [meter(100, 200)]);
  expect(registers["meter-1"].reset).toBe(true);
  expect(registerUsage(registers["meter-1"])).toBeNull();
  registers = updateRegisters({}, [meter(8000, 300, { energyUnits: undefined })]);
  registers = updateRegisters(registers, [meter(9000, 400)]);
  expect(registers["meter-1"].opening).toBe(9);
  expect(registers["meter-1"].unit).toBe("kWh");
  expect(registerUsage(registers["meter-1"])).toBeNull();
});
test("vectors require measured magnitude and angle; nested raw fields remain visible", () => {
  expect(phaseVectors({ voltage_ll: 415, power_factor: 0.9 })).toEqual([]);
  const data = { phases: { r: { voltage: 230, voltage_angle: 0, current: 4 } } };
  expect(phaseVectors(data)).toEqual([{ phase: "r", kind: "voltage", magnitude: 230, angle: 0 }]);
  expect(flattenReadings(data)).toContainEqual(["phases.r.current", "4"]);
});

test("power readings convert W / VA / var to kW / kVA / kvar", () => {
  const base = { powerUnits: "base", active_power: 2500, apparent_power: 3000, reactive_power: -1500 };
  expect(POWER_READINGS.map(({ key }) => powerReading(base, key))).toEqual([2.5, 3, -1.5]);
  const kilo = { powerUnits: "kilo", active_power: 2.5, apparent_power: 3, reactive_power: -1.5 };
  expect(POWER_READINGS.map(({ key }) => powerReading(kilo, key))).toEqual([2.5, 3, -1.5]);
  expect(POWER_READINGS.map(({ unit }) => unit)).toEqual(["kW", "kVA", "kvar"]);
});
test("unknown scale, missing and invalid power remain unavailable; zero stays zero", () => {
  expect(powerReading({ active_power: 1500, powerUnits: "unknown" })).toBeNull();
  expect(powerReading({ active_power: 1500 })).toBeNull();
  expect(powerReading({ powerUnits: "base", active_power: 0 })).toBe(0);
  expect(powerReading({ powerUnits: "base", active_power: Infinity })).toBeNull();
  expect(powerReading({ powerUnits: "base" }, "apparent_power")).toBeNull();
});

test("collector RMS aliases and numeric strings resolve to measured vectors", () => {
  const data = { RMS_Voltage_L1: "230.5", voltage_L1_angle: "0", RMS_Current_L1: 10, current_angle_L1: -25, phase_angle_L1: 25 };
  expect(phaseVectors(data)).toEqual([
    { phase: "r", kind: "voltage", magnitude: 230.5, angle: 0 },
    { phase: "r", kind: "current", magnitude: 10, angle: -25 },
  ]);
  expect(phaseDisplacements(data)[0].reading.value).toBe(25);
  expect(phaseVectors({ RMS_Voltage_R: 230, phase_angle_R: 25 })).toEqual([]);
});
test("RMS and forward groups retain extra registers and keep explicit counter units", () => {
  const data = { voltage_RN: 231, current_b: 4, voltage_ll: 400, custom_rms_peak: 244, fwd_Wh: 4500, energyUnits: "Wh", fwd_kVAh: 8, fwd_varh: 900, fwd_tariff_1: 200 };
  const rms = rmsReadings(data), forward = forwardReadings(data);
  expect(rms.find((r) => r.label === "Voltage R-N RMS").value).toBe(231);
  expect(rms.find((r) => r.label === "Current B RMS").value).toBe(4);
  expect(rms.find((r) => r.label === "Current Y RMS").value).toBeNull();
  expect(rms.find((r) => r.key === "custom_rms_peak").value).toBe("244");
  expect(forward[0].value).toBe(4.5);
  expect(forward[0].unit).toBe("kWh");
  expect(forward[1].value).toBe(8);
  expect(forward[1].unit).toBe("kVAh");
  expect(forward[2].unit).toBe("raw · units unverified");
  expect(forward.find((r) => r.key === "fwd_tariff_1").value).toBe("200");
});
