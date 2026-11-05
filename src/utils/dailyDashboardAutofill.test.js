import { evaluateFormulasForRows } from "./dailySheetFormulas";
import { buildDailyAutofill, fillDieselIdentity, getDailyTankCapacities, mergeDailyAutofill, previousDate } from "./dailyDashboardAutofill";

const base = { site: "DLF", date: "2026-11-01", config: { dgCount: 2 } };
const log = {
  "DG-1 Fuel Opening": "120", "DG-2 Fuel Opening": "200",
  "DG-1 External Fuel Stock": "300", "DG-2 External Fuel Stock": "0",
  "DG-1 Hour Opening": "100", "DG-1 Hour Closing": "102",
  "DG-2 Hour Opening": "50", "DG-2 Hour Closing": "51",
  "DG-1 Off Load Hour": "0.25", "DG-2 Off Load Hour": "0",
};

test("uses opening stocks and separates onload from total hours", () => {
  const patch = buildDailyAutofill({ ...base, log });
  expect(patch.Diesel_Back_Up[0]).toMatchObject({ Present_Diesel_Stock_in_DG_tank_Ltr: 320, External_Stock_availiabl_at_MSC_Ltr: 300 });
  expect(patch.DG_EB_Backup[0]).toMatchObject({ Total_Power_Failure_hrs: 2.75, Total_DG_Run_hrs: 3, Remark: "EB fail  and No load DG run" });
});

test("marks equal onload and total run as EB Fail", () => {
  expect(buildDailyAutofill({ ...base, log: { ...log, "DG-1 Off Load Hour": 0 } }).DG_EB_Backup[0].Remark).toBe("EB Fail DG Run");
});

test("missing readings do not become zero or capacity", () => {
  const patch = buildDailyAutofill({ ...base, config: { dgCount: 2, External_Stock_capacity_Barrel_UG_Buffer_Ltr: 2000 }, log: { "DG-1 Fuel Closing": 10 } });
  expect(patch.Diesel_Back_Up[0].Present_Diesel_Stock_in_DG_tank_Ltr).toBeUndefined();
  expect(patch.Diesel_Back_Up[0].External_Stock_availiabl_at_MSC_Ltr).toBeUndefined();
  expect(patch.DG_EB_Backup[0].Total_DG_Run_hrs).toBeUndefined();
});

test("sums all four DGs, including valid zero stock", () => {
  const entry = {};
  for (let id = 1; id <= 4; id++) {
    entry[`DG-${id} Fuel Opening`] = id * 10;
    entry[`DG-${id} External Fuel Stock`] = 0;
  }
  expect(buildDailyAutofill({ ...base, config: { dgCount: 4 }, log: entry }).Diesel_Back_Up[0]).toMatchObject({ Present_Diesel_Stock_in_DG_tank_Ltr: 100, External_Stock_availiabl_at_MSC_Ltr: 0 });
});

test("activities obey cutoff across month boundary and match site", () => {
  const sheets = [
    { siteName: "DLF", date: "2026-10-31", rows: [{ activityStartTime: "15:59", activityDetails: "excluded" }, { activityStartTime: "16:00", activityDetails: "night" }] },
    { siteName: "dlf", date: "2026-11-01", rows: [{ activityStartTime: "15:59", activityDetails: "day" }, { activityStartTime: "16:00", activityDetails: "next" }, { activityDetails: "planned" }] },
    { siteName: "Other", date: "2026-11-01", rows: [{ activityDetails: "wrong site" }] },
  ];
  expect(buildDailyAutofill({ ...base, activitySheets: sheets }).Planned_Activity_Details.map(row => row.Activity_Description)).toEqual(["night", "day", "planned"]);
  expect(previousDate("2026-01-01")).toBe("2025-12-31");
});

test("repeated imports replace sourced activities and preserve manual rows and other sheets", () => {
  const data = { Planned_Activity_Details: [{ Activity_Description: "manual" }], Fault_Details: [{ notes: "keep" }] };
  const patch = buildDailyAutofill({ ...base, activitySheets: [{ siteName: "DLF", date: base.date, rows: [{ activityDetails: "imported" }] }] });
  const once = mergeDailyAutofill(data, patch);
  expect(mergeDailyAutofill(once, patch)).toEqual(once);
  expect(mergeDailyAutofill(once, { Planned_Activity_Details: [] }).Planned_Activity_Details).toEqual(data.Planned_Activity_Details);
  expect(once.Fault_Details).toEqual(data.Fault_Details);
});


test("tank capacities come from all configured DG tanks without a daily log", () => {
  const config = { dgCount: 2, DG_fuel_tank_capacity: 9999, dgConfigs: {
    "DG-1": { dayTankLtrs: "990", externalTankLtrs: 0 },
    "DG-2": { dayTankLtrs: 500, externalTankLtrs: "2000" },
    "DG-3": { dayTankLtrs: 100, externalTankLtrs: 100 },
  } };
  expect(getDailyTankCapacities(config)).toEqual({ DG_fuel_tank_capacity: 1490, External_Stock_capacity_Barrel_UG_Buffer_Ltr: 2000 });
  expect(buildDailyAutofill({ ...base, config }).Diesel_Back_Up[0]).toMatchObject(getDailyTankCapacities(config));
  expect(buildDailyAutofill({ ...base, config, log }).Diesel_Back_Up[0]).toMatchObject(getDailyTankCapacities(config));
});

test("missing or invalid tank capacity never becomes an incomplete total", () => {
  expect(getDailyTankCapacities({})).toEqual({});
  expect(getDailyTankCapacities({ dgCount: 2, dgConfigs: {
    "DG-1": { dayTankLtrs: 100, externalTankLtrs: 0 },
    "DG-2": { dayTankLtrs: "", externalTankLtrs: 0 },
  } })).toEqual({ External_Stock_capacity_Barrel_UG_Buffer_Ltr: 0 });
  expect(getDailyTankCapacities({ dgCount: 1, dgConfigs: {
    "DG-1": { dayTankLtrs: -1, externalTankLtrs: "invalid" },
  } })).toEqual({});
});


test("diesel autofill preserves the sheet's existing circle and site name", () => {
  const data = { Diesel_Back_Up: [{ Circle: "Existing circle", Site_Name: "Existing site" }] };
  const config = { dgCount: 1, circle: "Other circle", dgConfigs: {
    "DG-1": { dayTankLtrs: 990, externalTankLtrs: 200 },
  } };
  for (const entry of [undefined, log]) {
    const patch = buildDailyAutofill({ ...base, config, log: entry });
    expect(patch.Diesel_Back_Up[0]).not.toHaveProperty("Circle");
    expect(patch.Diesel_Back_Up[0]).not.toHaveProperty("Site_Name");
    expect(mergeDailyAutofill(data, patch).Diesel_Back_Up[0]).toMatchObject({
      Circle: "Existing circle", Site_Name: "Existing site", DG_fuel_tank_capacity: 990,
    });
  }
});


test("fills blank diesel identity even when capacities or formulas already exist", () => {
  const row = { Circle: "", Site_Name: " ", DG_fuel_tank_capacity: 990, Tota_Stock_Capacity: "=A+B" };
  expect(fillDieselIdentity(row, { circle: "WB", site: "DLF" })).toEqual({ ...row, Circle: "WB", Site_Name: "DLF" });
  expect(fillDieselIdentity({ Circle: "Existing", Site_Name: "Custom" }, { circle: "WB", site: "DLF" }))
    .toEqual({ Circle: "Existing", Site_Name: "Custom" });
  expect(fillDieselIdentity({}, { site: "DLF" })).toEqual({ Circle: "WB", Site_Name: "DLF" });
});


test("latest saved stock can load independently of the reporting date log", () => {
  const patch = buildDailyAutofill({ ...base, stockLog: { ...log, Date: base.date } });
  expect(patch.Diesel_Back_Up[0]).toMatchObject({
    Present_Diesel_Stock_in_DG_tank_Ltr: 320, External_Stock_availiabl_at_MSC_Ltr: 300,
  });
  expect(patch.DG_EB_Backup[0].Total_DG_Run_hrs).toBeUndefined();
  const updated = buildDailyAutofill({ ...base, stockLog: { ...log, Date: base.date, "DG-1 Fuel Opening": 0, "DG-2 Fuel Opening": 0,
    "DG-1 External Fuel Stock": 0, "DG-2 External Fuel Stock": 0 } });
  expect(updated.Diesel_Back_Up[0]).toMatchObject({
    Present_Diesel_Stock_in_DG_tank_Ltr: 0, External_Stock_availiabl_at_MSC_Ltr: 0,
  });
});

test("new stock readings do not replace the reporting date's DG hours", () => {
  const patch = buildDailyAutofill({ ...base, log, stockLog: { ...log, "DG-1 Fuel Closing": 90, "DG-1 Hour Closing": 999 } });
  expect(patch.Diesel_Back_Up[0].Present_Diesel_Stock_in_DG_tank_Ltr).toBe(320);
  expect(patch.DG_EB_Backup[0].Total_DG_Run_hrs).toBe(3);
});


test("present DG stock is opening fuel minus selected day's onload and offload consumption", () => {
  const runs = [{ fuelConsumption: "25", remarks: "On Load" }, { fuelConsumption: 5, remarks: "No Load" },
    { fuelConsumption: "", remarks: "Fuel Filling Only" }];
  const patch = buildDailyAutofill({ ...base, log: { ...log, "DG-1 Fuel Closing": 90, "DG-2 Fuel Closing": 150 }, runs });
  expect(patch.Diesel_Back_Up[0].Present_Diesel_Stock_in_DG_tank_Ltr).toBe(290);
  expect(patch.Diesel_Back_Up[0].External_Stock_availiabl_at_MSC_Ltr).toBe(300);
  expect(buildDailyAutofill({ ...base, log, runs: null }).Diesel_Back_Up[0].Present_Diesel_Stock_in_DG_tank_Ltr).toBeUndefined();
});


test("consumption matches DGLogTable rows even with legacy metadata or blank fuel", () => {
  const runs = [{ date: "legacy", siteName: "legacy", fuelConsumption: "40.5" },
    { remarks: "Fuel Filling Only", fuelConsumption: "" }, { fuelConsumption: 9.5 }];
  expect(buildDailyAutofill({ ...base, log, runs }).Diesel_Back_Up[0].Present_Diesel_Stock_in_DG_tank_Ltr).toBe(270);
});


test("Asansol subtracts today's table consumption before today's daily log exists", () => {
  const patch = buildDailyAutofill({ site: "Asansol", date: "2026-11-05", config: { dgCount: 2 },
    stockLog: { Date: "2026-11-04", "DG-1 Fuel Opening": 850, "DG-2 Fuel Opening": 700, "DG-1 Fuel Closing": 800, "DG-2 Fuel Closing": 700 },
    runs: [{ fuelConsumption: 50 }, { fuelConsumption: "25.5" }],
  });
  expect(patch.Diesel_Back_Up[0].Present_Diesel_Stock_in_DG_tank_Ltr).toBe(1424.5);
  expect(patch.Diesel_Back_Up[0].__fuelCalculation).toEqual({ opening: 1500, consumption: 75.5, runs: 2, stock: 1424.5 });
});


test("Asansol current fuel is 1333 opening minus 6 consumption, not yesterday's opening", () => {
  const previousLog = { Date: "2026-11-04", "DG-1 Fuel Opening": 700, "DG-2 Fuel Opening": 683,
    "DG-1 Fuel Closing": 650, "DG-2 Fuel Closing": 683 };
  const patch = buildDailyAutofill({ site: "Asansol", date: "2026-11-05", config: { dgCount: 2 },
    stockLog: previousLog, runs: [{ fuelConsumption: 6 }],
  });
  expect(patch.Diesel_Back_Up[0].Present_Diesel_Stock_in_DG_tank_Ltr).toBe(1327);
  expect(patch.Diesel_Back_Up[0].__fuelCalculation).toMatchObject({ opening: 1333, consumption: 6, stock: 1327 });
});

test("selected-day opening takes priority over prior closing stock", () => {
  const patch = buildDailyAutofill({ ...base,
    log: { "DG-1 Fuel Opening": 650, "DG-2 Fuel Opening": 683 },
    stockLog: { Date: "2026-10-31", "DG-1 Fuel Closing": 700, "DG-2 Fuel Closing": 683 },
    runs: [{ fuelConsumption: 6 }],
  });
  expect(patch.Diesel_Back_Up[0].Present_Diesel_Stock_in_DG_tank_Ltr).toBe(1327);
});


test.each([[13, "Ok"], [12, "Not Ok, Fuel topup required"], [6, "Not Ok, Fuel topup required"]])(
  "diesel remark follows backup hours at %s hours", (hours, expected) => {
    const [row] = evaluateFormulasForRows([{ Present_Diesel_Stock_in_DG_tank_Ltr: hours * 10,
      External_Stock_availiabl_at_MSC_Ltr: 0, DG_CPH: 10 }], "Diesel_Back_Up");
    expect(row.Fuel_back_up_Hrs).toBe(hours);
    expect(row.Remark).toBe(expected);
  }
);


test.each([
  [[{ remarks: "No Load", totalRunHours: 0.25 }], 0.25, 0, "No Load DG Run"],
  [[{ remarks: "On Load", totalRunHours: 2 }], 2, 2, "EB Fail DG Run"],
  [[{ remarks: "On Load", totalRunHours: 2 }, { remarks: "No Load", totalRunHours: 0.5 }], 2.5, 2, "EB fail  and No load DG run"],
  [[], 0, 0, "EB Fail DG Run"],
])("current DG-EB hours and remarks follow saved runs", (runs, total, power, remark) => {
  const patch = buildDailyAutofill({ ...base, log, runs, runHoursFromRuns: true });
  expect(patch.DG_EB_Backup[0]).toMatchObject({ SlNo: 1, Total_DG_Run_hrs: total,
    Total_Power_Failure_hrs: power, Remark: remark });
  const [evaluated] = evaluateFormulasForRows(patch.DG_EB_Backup, "DG_EB_Backup");
  expect(evaluated.Remark).toBe(remark);
});
