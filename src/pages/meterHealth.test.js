import { meterHealth, meterLight } from "./meterHealth";
const now = 100000;
const sample = { status: "OK", observedAt: { toMillis: () => now } };
test("indicator follows freshness, errors, cache and unavailable readings instead of supply voltage", () => {
  expect(meterLight(meterHealth({ ...sample, voltage_ll: 0 }, now, false))).toBe("online");
  expect(meterLight(meterHealth(sample, now + 31000, false))).toBe("offline");
  expect(meterLight(meterHealth({ ...sample, status: "ERROR" }, now, false))).toBe("offline");
  expect(meterLight(meterHealth(sample, now, true))).toBe("waiting");
  expect(meterLight(meterHealth(sample, now, false, true))).toBe("offline");
  expect(meterHealth({ ...sample, observedAt: { toMillis: () => now + 10000 } }, now, false)).toBe("Waiting for data");
});
