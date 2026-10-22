import { collection, doc, onSnapshot } from "firebase/firestore";
import { configuredDGSitePaths, siteDataPaths, subscribeSiteData } from "./allSitesDGSubscriptions";
jest.mock("firebase/firestore", () => ({ collection: jest.fn(), doc: jest.fn(), onSnapshot: jest.fn() }));
beforeEach(() => { collection.mockImplementation((db, ...path) => path); doc.mockImplementation((db, ...path) => path); });
test("configured sites preserve Firestore's canonical site casing", () => {
  expect(configuredDGSitePaths({ ASANSOL: { siteName: "ASANSOL" }, DLF: { siteName: "DLF" }, "INFINITY-I": {} })).toEqual(["Asansol", "DLF", "Infinity-I"]);
});
test("all reports target known roots and selected periods, never collection groups", () => {
  expect(siteDataPaths("daily", ["Asansol"], "2026-10")[0].path).toEqual(["dailyDGLogs", "Asansol", "2026-10"]);
  expect(siteDataPaths("runs", ["Asansol"], "2026-10", "2026-10-22")[0].path).toEqual(["dgLogs", "Asansol", "Oct-2026", "2026-10-22", "runs"]);
  expect(siteDataPaths("bills", ["Asansol"], "2026-10")[0].path).toEqual(["ebBillDetails", "Asansol", "MonthlyBills", "2026-10"]);
  expect(siteDataPaths("runs", ["Asansol"], "2026-10", "2026-09-01")).toEqual([]);
});
test("site results aggregate, permission failures remain scoped, cleanup prevents late updates", () => {
  const callbacks = [], stops = [];
  onSnapshot.mockImplementation((ref, next, error) => { callbacks.push({ ref, next, error }); const stop = jest.fn(); stops.push(stop); return stop; });
  const rows = jest.fn(), errors = jest.fn(), ready = jest.fn();
  const stop = subscribeSiteData({}, siteDataPaths("daily", ["Asansol", "DLF"], "2026-10"), rows, errors, ready);
  callbacks[0].next({ docs: [{ id: "day1", data: () => ({ site: "UNTRUSTED", Date: "2026-10-22" }) }] });
  expect(ready).not.toHaveBeenCalled();
  callbacks[1].error({ code: "permission-denied", message: "Missing permissions" });
  expect(rows).toHaveBeenLastCalledWith([expect.objectContaining({ site: "ASANSOL", id: "Asansol/day1" })]);
  expect(errors).toHaveBeenLastCalledWith("DLF: Missing permissions"); expect(ready).toHaveBeenCalled();
  stop(); const before = rows.mock.calls.length; callbacks[0].next({ docs: [] });
  expect(rows).toHaveBeenCalledTimes(before); stops.forEach((unsubscribe) => expect(unsubscribe).toHaveBeenCalledTimes(1));
});
test("empty site lists settle without hanging the loading indicator", () => {
  const ready = jest.fn(); subscribeSiteData({}, [], jest.fn(), jest.fn(), ready); expect(ready).toHaveBeenCalledTimes(1);
});
