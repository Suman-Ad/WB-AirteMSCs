import { readPowerMapping, resolvePowerMapping, savePowerMapping } from "./powerMeterMapping";
beforeEach(() => localStorage.clear());
test("a previously blank header copy uses the current simulator mapping", () => {
  localStorage.setItem("energy-monitor:header-power:v1:ASL", JSON.stringify({ enabled: true, mainMeterId: "", dg1MeterId: "" }));
  localStorage.setItem("energy-monitor:asansol-trigger:v1:ASL", JSON.stringify({ enabled: false, mainMeterId: "main", dg1MeterId: "dg" }));
  expect(readPowerMapping("ASL")).toEqual(expect.objectContaining({ enabled: true, mainMeterId: "main", dg1MeterId: "dg" }));
});
test("unique meter names resolve without a second header control; ambiguous names require mapping", () => {
  const meters = [{ id: "main", name: "Main Incomer Meter" }, { id: "dg", name: "DG-1 Meter" }, { id: "wrong", name: "DG-10" }];
  expect(resolvePowerMapping({ enabled: true }, meters)).toEqual(expect.objectContaining({ mainMeterId: "main", dg1MeterId: "dg" }));
  expect(resolvePowerMapping({}, [...meters, { id: "other", name: "Main Incomer Panel" }]).mainMeterId).toBe("");
});
test("Energy Monitor settings notify the active Layout hook immediately and retain site isolation", () => {
  const listener = jest.fn(); window.addEventListener("energy-monitor:power-mapping", listener);
  savePowerMapping("ASL", { enabled: true, mainMeterId: "main", dg1MeterId: "dg" });
  expect(listener).toHaveBeenCalledTimes(1); expect(readPowerMapping("ASL").mainMeterId).toBe("main");
  expect(readPowerMapping("OTHER").mainMeterId).toBe("");
  window.removeEventListener("energy-monitor:power-mapping", listener);
});
