import { dailyEnergyRows, runHours, validateSLD, sampleSLD, dgMonth, numberValue } from "./energyReportData";
import { displayReading } from "./energyMeterData";
test("daily report preserves zero, missing counters and detects resets", () => {
  const rows = dailyEnergyRows([{ id: "d1", "EB-1 KWH Opening": 0, "EB-1 KWH Closing": "12.5", "DG-1 KWH Opening": 100, "DG-1 KWH Closing": 5, "Solar KWH Closing": 8 }]);
  expect(rows.find((r) => r.label === "EB-1")).toMatchObject({ opening: 0, closing: 12.5, usage: 12.5 });
  expect(rows.find((r) => r.label === "DG-1")).toMatchObject({ reset: true, usage: null });
  expect(rows.find((r) => r.label === "Solar")).toMatchObject({ opening: null, usage: null });
  expect(numberValue(" ")).toBeNull(); expect(numberValue(true)).toBeNull();
});
test("DG hours use recorded duration and handle midnight without inventing missing times", () => {
  expect(runHours({ totalRunHours: 2, startTime: "01:00", stopTime: "02:00" })).toBe(2);
  expect(runHours({ startTime: "23:30", stopTime: "00:30" })).toBe(1);
  expect(runHours({ runSeconds: 1800 })).toBe(.5);
  expect(runHours({ startTime: "10:00" })).toBeNull();
  expect(runHours({ startTime: "99:00", stopTime: "00:00" })).toBeNull();
  expect(dgMonth("2026-10-22")).toBe("Oct-2026");
});
test("all energy and phase power display units convert once", () => {
  const meter = { status: "OK", powerUnits: "base", active_power: 2500, apparent_power: 3000, reactive_power: -500, R_current: 12, R_voltage_ll: 415, R_voltage_ln: 240, fwd_Wh: 12345, fwd_VAh: 14000, fwd_VARh: 1000 };
  expect(displayReading(meter, "active_power")).toEqual({ value: 2.5, unit: "kW" });
  expect(displayReading(meter, "apparent_power")).toEqual({ value: 3, unit: "kVA" });
  expect(displayReading(meter, "reactive_power")).toEqual({ value: -.5, unit: "kvar" });
  expect(displayReading(meter, "fwd_Wh")).toEqual({ value: 12.345, unit: "kWh" });
  expect(displayReading(meter, "fwd_VAh")).toEqual({ value: 14, unit: "kVAh" });
  expect(displayReading(meter, "fwd_VARh")).toEqual({ value: 1, unit: "kvarh" });
  expect(displayReading({ ...meter, energyUnits: "kilo" }, "fwd_Wh").value).toBe(12345);
  expect(displayReading({ ...meter, powerUnits: "unknown" }, "active_power").value).toBeNull();
  expect(displayReading(meter, "R_current").value).toBe(12);
  expect(displayReading(meter, "R_voltage_ll").value).toBe(415);
  expect(displayReading(meter, "R_voltage_ln").value).toBe(240);
});
test("SLD validates sample and common graph aliases", () => {
  expect(validateSLD(sampleSLD).nodes).toHaveLength(4);
  const graph = validateSLD({ nodes: [{ id: "a", data: { label: "Supply" }, position: { x: 10, y: 20 } }, { id: "b" }], edges: [{ from: "a", to: "b" }] });
  expect(graph.nodes[0]).toMatchObject({ label: "Supply", x: 10, y: 20 });
  expect(graph.edges[0]).toMatchObject({ source: "a", target: "b" });
});
test("SLD rejects dangling edges, duplicate ids, bad coordinates and excessive graphs", () => {
  expect(() => validateSLD({ nodes: [{ id: "a" }], edges: [{ source: "a", target: "missing" }] })).toThrow(/existing/);
  expect(() => validateSLD({ nodes: [{ id: "a" }, { id: "a" }], edges: [] })).toThrow(/unique/);
  expect(() => validateSLD({ nodes: [{ id: "a", x: "bad" }], edges: [] })).toThrow(/coordinates/);
  expect(() => validateSLD({ nodes: Array.from({ length: 201 }, (_, i) => ({ id: String(i) })), edges: [] })).toThrow(/200/);
});
