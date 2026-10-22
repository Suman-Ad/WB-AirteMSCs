import { collection, doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { captureMeter, checkpointEnergyRun, commitEnergyChangeover } from "./energyChangeoverHistory";
jest.mock("firebase/firestore", () => ({ collection: jest.fn(), doc: jest.fn(), runTransaction: jest.fn(), serverTimestamp: jest.fn() }));
let records, sequence, transaction;
const now = Date.parse("2026-10-22T10:00:00Z");
const meter = (kwh, time = now) => ({ id: "dg", name: "DG meter", status: "OK", fwd_Wh: kwh * 1000, powerUnits: "base", active_power: 20000, observedAt: { toMillis: () => time } });
const data = (kwh, time = now) => ({ config: { dg1MeterId: "dg", mainMeterId: "main" }, fromCache: false, meters: [meter(kwh, time)] });
const context = (meterData) => ({ siteId: "ASL", siteName: "Asansol", uid: "human", dg: "DG-1", automatic: false, meterData });
const source = (powerSource) => ({ powerSource, dgNumber: "DG-1" });
beforeEach(() => {
  jest.useFakeTimers(); jest.setSystemTime(now); sequence = 0; records = new Map([["status", { powerSource: "EB" }]]);
  collection.mockImplementation((db, ...path) => path.join("/"));
  doc.mockImplementation((db, ...path) => path.length ? { path: path.join("/"), id: path[path.length - 1] } : { path: `${db}/run${++sequence}`, id: `run${sequence}` });
  serverTimestamp.mockReturnValue("SERVER_TIME");
  transaction = { get: jest.fn(async (ref) => ({ exists: () => records.has(ref.path || ref), data: () => records.get(ref.path || ref) })), set: jest.fn((ref, value, options) => records.set(ref.path || ref, options?.merge ? { ...records.get(ref.path || ref), ...value } : value)) };
  runTransaction.mockImplementation((db, callback) => callback(transaction));
});
afterEach(() => jest.useRealTimers());
const run = () => [...records.entries()].find(([path]) => path.startsWith("energyChangeovers/"))?.[1];
test("durable opening, checkpoint and offline restoration preserve closing kWh after reload", async () => {
  await commitEnergyChangeover({}, "status", source("DG"), context(data(1000)));
  expect(run().opening.kwh).toBe(1000); expect(run().opening.kw).toBe(20);
  jest.setSystemTime(now + 10000);
  await checkpointEnergyRun({}, "status", { siteId: "ASL", uid: "human", meterData: data(1005, now + 10000) });
  jest.setSystemTime(now + 20000);
  await commitEnergyChangeover({}, "status", source("EB"), context({ ...data(0, now + 20000), meters: [{ ...meter(0, now + 20000), status: "ERROR" }] }));
  expect(run().status).toBe("Completed"); expect(run().closing.kwh).toBe(1005); expect(run().generationKwh).toBe(5);
  expect(run().closing.quality).toBe("Last valid reading before restoration");
  expect(run().runSeconds).toBe(20); expect(records.get("status").activeEnergyRunId).toBeNull();
});
test("duplicate starts and restores do not create extra runs or reset opening", async () => {
  const start = { ...context(data(0)), automatic: true };
  expect(await commitEnergyChangeover({}, "status", source("DG"), start)).toBe(true);
  expect(await commitEnergyChangeover({}, "status", source("DG"), start)).toBe(false);
  await commitEnergyChangeover({}, "status", source("EB"), context(data(2)));
  expect(await commitEnergyChangeover({}, "status", source("EB"), context(data(3)))).toBe(false);
  expect([...records.keys()].filter((path) => path.startsWith("energyChangeovers/"))).toHaveLength(1);
  expect(run().opening.kwh).toBe(0); expect(run().generationKwh).toBe(2);
});
test("counter reset is labelled and cannot produce negative generation", async () => {
  await commitEnergyChangeover({}, "status", source("DG"), context(data(100)));
  await commitEnergyChangeover({}, "status", source("EB"), context(data(1)));
  expect(run().counterReset).toBe(true); expect(run().generationKwh).toBeNull();
});
test("restoration without an opening retains incomplete history rather than inventing energy", async () => {
  records.set("status", { powerSource: "DG", dgNumber: "DG-1", dgStartTime: { toMillis: () => now - 60000 } });
  await commitEnergyChangeover({}, "status", source("EB"), context(data(20)));
  expect(run().opening).toBeNull(); expect(run().closing.kwh).toBe(20); expect(run().generationKwh).toBeNull();
});
test("stale and cached samples are not captured as current registers; kilo counters stay scaled", () => {
  expect(captureMeter({ ...data(2), fromCache: true }, "dg", now).kwh).toBeNull();
  expect(captureMeter(data(2, now - 60000), "dg", now).kwh).toBeNull();
  expect(captureMeter({ ...data(2), meters: [{ ...meter(2), energyUnits: "kilo", fwd_Wh: 2 }] }, "dg", now).kwh).toBe(2);
});
