import { canEditPowerMapping, readPowerMapping, resolvePowerMapping, savePowerMapping } from "./powerMeterMapping";
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

test('recognizes actual collector DG Panel names and follows retained replacement IDs',()=>{
 const meters=[{id:'old',name:'Main Incomer',observedAt:{toMillis:()=>100}},{id:'main',name:'Main Incomer',observedAt:{toMillis:()=>200}},{id:'dg1',name:'DG Panel - 01'},{id:'dg2',name:'DG Panel - 02'}];
 expect(resolvePowerMapping({mainMeterId:'old'},meters)).toEqual(expect.objectContaining({mainMeterId:'main',dg1MeterId:'dg1',dg2MeterId:'dg2'}));
});

test('Admins edit any site, Super Users only their assigned site, other users never edit',()=>{
 for(const role of ['Admin','Super Admin']) expect(canEditPowerMapping({role,siteId:'A'},'B')).toBe(true);
 expect(canEditPowerMapping({role:'Super User',siteId:'A'},'A')).toBe(true);
 expect(canEditPowerMapping({role:'Super User',siteId:'A'},'B')).toBe(false);
 expect(canEditPowerMapping({role:'User',siteId:'A'},'A')).toBe(false);
 expect(canEditPowerMapping({role:'Admin',isActive:false},'B')).toBe(false);
});
