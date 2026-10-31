import { calculateDailyFinalSummary } from "./dailyFinalSummary";

const value = (rows, name) => rows.find(row => row.Edge_Data_Centres_Count === name)?.WB;
const site = (stock, onload, total, pm = []) => ({
  Diesel_Back_Up: [{ Circle: "WB", Site_Name: "A", DG_fuel_tank_capacity: 1000,
    External_Stock_capacity_Barrel_UG_Buffer_Ltr: 2600,
    Present_Diesel_Stock_in_DG_tank_Ltr: stock, External_Stock_availiabl_at_MSC_Ltr: 0, DG_CPH: 10 }],
  DG_EB_Backup: [{ Total_Power_Failure_hrs: onload, Total_DG_Run_hrs: total }],
  In_House_PM: pm,
  // Old saved summaries must never be summed or used as input.
  Final_Summary: [{ Edge_Data_Centres_Count: "Total Site Count", WB: 999 }],
});

test("combines all sites using export columns and subtracts power failure, not total DG run", () => {
  const rows = calculateDailyFinalSummary({ A: site(100, 2, 3), B: site(140, 4, 5) }, "2026-10-31");
  expect(value(rows, "Total Site Count")).toBe(2);
  expect(value(rows, "Sites Less Than 12 Hrs Diesel Back Up")).toBe(1);
  expect(value(rows, "Sites More Than 12 Hrs Diesel Back Up")).toBe(1);
  expect(value(rows, "MSC more than 2500 Litres excluding Day Tanks")).toBe(2);
  expect(value(rows, "MSC more than 2500 Litres Including Day Tanks")).toBe(2);
  expect(value(rows, "DG Running Hrs.")).toBe(8);
  expect(value(rows, "EB Availability Hrs.")).toBe(42);
});

test("uses the selected report month and case-insensitive PM Status for percentages", () => {
  const data = { A: site(100, 0, 0, [{ Circle: "WB", PM_Status: "DONE" }, { Circle: "WB", PM_Status: "Pending" }]),
    B: site(100, 0, 0, [{ Circle: "WB", PM_Status: "Done" }]) };
  data.A.OEM_PM = [{ Circle: "WB", PM_Status: "done" }];
  const rows = calculateDailyFinalSummary(data, "2025-02-28");
  expect(value(rows, "In House PM Planned (Feb'25 Month)")).toBe(3);
  expect(value(rows, "In House PM Completed (Feb'25 Month)")).toBe(2);
  expect(value(rows, "Inhouse PM Completion %")).toBeCloseTo(200 / 3);
  expect(value(rows, "OEM PM Completion %")).toBe(100);
});

test("handles empty sheets and zero planned PM without errors", () => {
  const rows = calculateDailyFinalSummary({ A: { Diesel_Back_Up: [{}], In_House_PM: [{}] } }, "2026-11-01");
  expect(value(rows, "Total Site Count")).toBe(0);
  expect(value(rows, "Sites Less Than 12 Hrs Diesel Back Up")).toBe(0);
  expect(value(rows, "OEM PM Completion %")).toBe(0);
  expect(value(rows, "Inhouse PM Completion %")).toBe(0);
  expect(rows.every(row => typeof row.WB !== "number" || Number.isFinite(row.WB))).toBe(true);
});

test("counts every site and keeps exactly 12-hour and 2500-litre boundaries strict", () => {
  const data = Object.fromEntries(Array.from({ length: 25 }, (_, index) => [`Site ${index}`, site(120, 1, 2)]));
  Object.values(data).forEach(entry => {
    entry.Diesel_Back_Up[0].External_Stock_capacity_Barrel_UG_Buffer_Ltr = 1500;
  });
  const rows = calculateDailyFinalSummary(data, "2026-11-01");
  expect(value(rows, "Total Site Count")).toBe(25);
  expect(value(rows, "Sites Less Than 12 Hrs Diesel Back Up")).toBe(0);
  expect(value(rows, "Sites More Than 12 Hrs Diesel Back Up")).toBe(0);
  expect(value(rows, "MSC more than 2500 Litres Including Day Tanks")).toBe(0);
  expect(value(rows, "DG Running Hrs.")).toBe(50);
});

test("live editor site summary uses the same calculation for a single site", () => {
  const rows = calculateDailyFinalSummary({ A: site(130, 1.5, 2) }, "2026-11-01");
  expect(value(rows, "Total Site Count")).toBe(1);
  expect(value(rows, "EB Availability Hrs.")).toBe(22.5);
  expect(value(rows, "Sites More Than 12 Hrs Diesel Back Up")).toBe(1);
});
