import { energySupplyMeter } from "./energySupplyMeter";
const now = 100000;
const meter = (id, name, volts, kw, extra = {}) => ({ id, name, status: "OK", voltage_ll: volts, active_power: kw, powerUnits: "kilo", observedAt: { toMillis: () => now }, ...extra });
test("Main Incomer supplies site values without adding HT, DG or downstream meters", () => {
  const main = meter("main", "Main Incomer", 415, 20);
  const result = energySupplyMeter([meter("load", "UPS load", 415, 15), meter("ht", "HT Panel", 11000, 22), meter("dg", "DG-1", 0, 0), main], {}, now, false);
  expect(result.source).toBe(main); expect(result.defaultMeter).toBe(main); expect(result.sourceType).toBe("Utility");
});
test("failed Main Incomer selects the energized DG rather than an online but stopped DG", () => {
  const dg2 = meter("dg2", "DG-2", 415, 30);
  const result = energySupplyMeter([meter("main", "Main Incomer", 0, 0), meter("ht", "HT Panel", 11000, 10), meter("dg1", "DG-1", 0, 0), dg2], {}, now, false);
  expect(result.source).toBe(dg2); expect(result.defaultMeter).toBe(dg2); expect(result.sourceType).toBe("DG");
});
test("HT is the utility fallback and explicit mappings support nonstandard meter names", () => {
  const ht = meter("custom", "Service supply", 11000, 50);
  expect(energySupplyMeter([ht], { htMeterId: "custom" }, now, false).source).toBe(ht);
  expect(energySupplyMeter([meter("ht", "HT Panel", 11000, 50)], {}, now, false).sourceType).toBe("Utility");
  expect(energySupplyMeter([meter("ht", "HT Panel", 110, 50)], {}, now, false).sourceType).toBe("Utility");
});
test("cached, stale and downstream-only readings never become site totals", () => {
  expect(energySupplyMeter([meter("load", "UPS", 415, 10)], {}, now, false).source).toBeNull();
  expect(energySupplyMeter([meter("main", "Main Incomer", 415, 10)], {}, now, true).source).toBeNull();
  expect(energySupplyMeter([meter("dg", "DG-1", 415, 10, { observedAt: { toMillis: () => 1 } })], {}, now, false).source).toBeNull();
});
