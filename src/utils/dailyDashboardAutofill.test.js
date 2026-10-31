import { buildDailyAutofill, mergeDailyAutofill, previousDate } from "./dailyDashboardAutofill";

const base = { site: "DLF", date: "2026-11-01", config: { dgCount: 2 } };
const log = {
  "DG-1 Fuel Closing": "120", "DG-2 Fuel Closing": "200",
  "DG-1 External Fuel Stock": "300", "DG-2 External Fuel Stock": "0",
  "DG-1 Hour Opening": "100", "DG-1 Hour Closing": "102",
  "DG-2 Hour Opening": "50", "DG-2 Hour Closing": "51",
  "DG-1 Off Load Hour": "0.25", "DG-2 Off Load Hour": "0",
};

test("uses closing stocks and separates onload from total hours", () => {
  const patch = buildDailyAutofill({ ...base, log });
  expect(patch.Diesel_Back_Up[0]).toMatchObject({ Present_Diesel_Stock_in_DG_tank_Ltr: 320, External_Stock_availiabl_at_MSC_Ltr: 300 });
  expect(patch.DG_EB_Backup[0]).toMatchObject({ Total_Power_Failure_hrs: 2.75, Total_DG_Run_hrs: 3, Remark: "EB fail and No Load test run" });
});

test("marks equal onload and total run as EB Fail", () => {
  expect(buildDailyAutofill({ ...base, log: { ...log, "DG-1 Off Load Hour": 0 } }).DG_EB_Backup[0].Remark).toBe("EB Fail");
});

test("missing readings do not become zero or capacity", () => {
  const patch = buildDailyAutofill({ ...base, config: { dgCount: 2, External_Stock_capacity_Barrel_UG_Buffer_Ltr: 2000 }, log: { "DG-1 Fuel Closing": 10 } });
  expect(patch.Diesel_Back_Up[0].Present_Diesel_Stock_in_DG_tank_Ltr).toBeUndefined();
  expect(patch.Diesel_Back_Up[0].External_Stock_availiabl_at_MSC_Ltr).toBeUndefined();
  expect(patch.DG_EB_Backup).toBeUndefined();
});

test("sums all four DGs, including valid zero stock", () => {
  const entry = {};
  for (let id = 1; id <= 4; id++) {
    entry[`DG-${id} Fuel Closing`] = id * 10;
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
