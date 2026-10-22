import { advanceChangeover, assessChangeover, defaultChangeoverConfig, initialChangeoverState } from "./energyChangeoverTrigger";
const config = { ...defaultChangeoverConfig, enabled: true, mainMeterId: "main", dg1MeterId: "dg1", dg2MeterId: "dg2" };
const meter = (id, voltage, time = 100000) => ({ id, voltage_ll: voltage, status: "OK", observedAt: { toMillis: () => time } });
test("incomer failure and DG voltage must both be confirmed; normal grid DG tests do not trigger", () => {
  expect(assessChangeover(config, [meter("main", 0), meter("dg1", 415)], 100000, false)).toMatchObject({ kind: "candidate", dg: "DG-1" });
  expect(assessChangeover(config, [meter("main", 415), meter("dg1", 415)], 100000, false).kind).toBe("restored");
  expect(assessChangeover(config, [meter("main", 0), meter("dg1", 0)], 100000, false).kind).toBe("waiting-dg");
  expect(assessChangeover(config, [meter("main", 0), meter("dg2", 415)], 100000, false)).toMatchObject({ kind: "candidate", dg: "DG-2" });
});
test("cached, stale, failed and missing data cannot indicate a grid failure", () => {
  const meters = [meter("main", 0), meter("dg1", 415)];
  expect(assessChangeover(config, meters, 100000, true).kind).toBe("waiting");
  expect(assessChangeover(config, meters, 200000, false).kind).toBe("waiting");
  expect(assessChangeover(config, [{ ...meters[0], status: "ERROR" }, meters[1]], 100000, false).kind).toBe("waiting");
  expect(assessChangeover(config, [{ ...meters[0], voltage_ll: null }, meters[1]], 100000, false).kind).toBe("waiting");
});
test("individual phases must agree; incomplete phase data cannot be hidden by an aggregate", () => {
  const main = { ...meter("main", 0), R_voltage_ll: 0, Y_voltage_ll: 415, B_voltage_ll: 0 };
  expect(assessChangeover(config, [main, meter("dg1", 415)], 100000, false).kind).toBe("uncertain");
  expect(assessChangeover(config, [{ ...meter("main", 0), R_voltage_ll: 0 }, meter("dg1", 415)], 100000, false).kind).toBe("waiting");
});
test("only distinct updated pairs advance confirmation and each outage triggers once", () => {
  const pair = (t) => assessChangeover(config, [meter("main", 0, t), meter("dg1", 415, t)], t, false);
  let state = advanceChangeover(initialChangeoverState(), pair(100000), 2);
  expect(state.fired).toBe(false);
  state = advanceChangeover(state, pair(100000), 2);
  expect(state.count).toBe(1);
  state = advanceChangeover(state, pair(110000), 2);
  expect(state.fired).toBe(true);
  state = advanceChangeover(state, pair(120000), 2);
  expect(state.fired).toBe(false); expect(state.latched).toBe(true);
  state = advanceChangeover(state, { kind: "waiting" }, 2);
  expect(state.latched).toBe(true);
  state = advanceChangeover(state, { kind: "restored" }, 2);
  expect(state.latched).toBe(false);
});
test("invalid mappings and thresholds keep detection unconfigured", () => {
  expect(assessChangeover({ ...config, dg1MeterId: "main" }, [], 100000, false).kind).toBe("unconfigured");
  expect(assessChangeover({ ...config, recoveryVoltage: 50 }, [], 100000, false).kind).toBe("unconfigured");
  expect(assessChangeover({ ...config, confirmations: 1 }, [], 100000, false).kind).toBe("unconfigured");
});
