import { assessHeaderPower } from "./headerPowerTrigger";
import { advanceChangeover, initialChangeoverState } from "../pages/energyChangeoverTrigger";
const config = { enabled: true, mainMeterId: "main", dg1MeterId: "dg" };
const meter = (id, volts, time = 100000) => ({ id, status: "OK", voltage_ll: volts, observedAt: { toMillis: () => time } });
const assess = (main, dg, cache = false) => assessHeaderPower(config, [main, dg], 100000, cache);
test("requires exactly zero incomer and strictly more than 300 V DG", () => {
  expect(assess(meter("main", 0), meter("dg", 301)).kind).toBe("candidate");
  expect(assess(meter("main", 1), meter("dg", 415)).kind).toBe("waiting");
  expect(assess(meter("main", 0), meter("dg", 300)).kind).toBe("waiting");
});
test("missing, stale, cached, failed and partial phase values cannot trigger", () => {
  for (const main of [undefined, meter("main", null), meter("main", 0, 1), { ...meter("main", 0), status: "ERROR" }, { ...meter("main", 0), R_voltage_ll: 0 }]) expect(assess(main, meter("dg", 415)).kind).not.toBe("candidate");
  expect(assess(meter("main", 0), meter("dg", 415), true).kind).toBe("waiting");
  expect(assess({ ...meter("main", 0), R_voltage_ll: 0, Y_voltage_ll: 1, B_voltage_ll: 0 }, meter("dg", 415)).kind).toBe("waiting");
});
test("uses mapped DG-2 and rejects duplicate mappings", () => {
  expect(assessHeaderPower({ ...config, dg1MeterId: "", dg2MeterId: "dg" }, [meter("main", 0), meter("dg", 415)], 100000, false).dg).toBe("DG-2");
  expect(assessHeaderPower({ ...config, dg1MeterId: "main" }, [], 100000, false).kind).toBe("unconfigured");
});
test("two distinct paired readings trigger once per outage, healthy incomer rearms", () => {
  const first = assess(meter("main", 0), meter("dg", 415));
  let state = advanceChangeover(initialChangeoverState(), first, 2);
  expect(state.fired).toBe(false);
  state = advanceChangeover(state, first, 2); expect(state.count).toBe(1);
  state = advanceChangeover(state, { ...first, mainTime: 110000, dgTime: 110000 }, 2); expect(state.fired).toBe(true);
  state = advanceChangeover(state, { ...first, mainTime: 120000, dgTime: 120000 }, 2); expect(state.fired).toBe(false);
  expect(advanceChangeover(state, assess(meter("main", 415), meter("dg", 0)), 2).latched).toBe(false);
});
