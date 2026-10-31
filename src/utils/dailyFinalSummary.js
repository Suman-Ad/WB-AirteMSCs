import { evaluateFormulasForRows } from "./dailySheetFormulas";

const present = value => value !== "" && value !== null && value !== undefined;
const number = value => present(value) && Number.isFinite(Number(value)) ? Number(value) : null;
const done = row => String(row.PM_Status || "").trim().toLowerCase() === "done";

// Field names follow the column order used by DailyDashboard's Excel export.
// Keep its fixed report declarations (N/Y/Ok/100% and zero placeholders).
export function calculateDailyFinalSummary(siteData = {}, selectedDate) {
  const sheets = {};
  Object.values(siteData).forEach(site => {
    Object.entries(site || {}).forEach(([key, rows]) => {
      if (!Array.isArray(rows) || key === "Final_Summary") return;
      sheets[key] = [...(sheets[key] || []), ...evaluateFormulasForRows(rows, key)];
    });
  });
  const rows = key => sheets[key] || [];
  const count = (key, field, predicate) => rows(key).filter(row => {
    const value = number(row[field]);
    return value !== null && predicate(value);
  }).length;
  const sum = (key, field) => rows(key).reduce((total, row) => total + (number(row[field]) ?? 0), 0);
  const sites = rows("Diesel_Back_Up").filter(row => present(row.Circle)).length;
  const infra = rows("Infra_Update").map(row => number(row.Infra_Uptime_Percentage)).filter(value => value !== null);
  const planned = key => rows(key).filter(row => present(row.Circle)).length;
  const completed = key => rows(key).filter(done).length;
  const percent = key => planned(key) ? completed(key) / planned(key) * 100 : 0;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(selectedDate || "") ? new Date(`${selectedDate}T12:00:00Z`) : null;
  const month = date ? date.toLocaleString("en-US", { month: "short", timeZone: "UTC" }) + "'" + String(date.getUTCFullYear()).slice(-2) : "Selected";
  const result = [
    ["Total Site Count", sites],
    ["Category Checks", ""],
    ["Sites Less Than 12 Hrs Diesel Back Up", count("Diesel_Back_Up", "Fuel_back_up_Hrs", value => value < 12)],
    ["Sites More Than 12 Hrs Diesel Back Up", count("Diesel_Back_Up", "Fuel_back_up_Hrs", value => value > 12)],
    ["MSC more than 2500 Litres excluding Day Tanks", count("Diesel_Back_Up", "External_Stock_capacity_Barrel_UG_Buffer_Ltr", value => value > 2500)],
    ["MSC more than 2500 Litres Including Day Tanks", count("Diesel_Back_Up", "Tota_Stock_Capacity", value => value > 2500)],
    ["DG Running Hrs.", sum("DG_EB_Backup", "Total_DG_Run_hrs")],
    ["EB Availability Hrs.", sites * 24 - sum("DG_EB_Backup", "Total_Power_Failure_hrs")],
    ["Infra Uptime", infra.length ? infra.reduce((total, value) => total + value, 0) / infra.length : 0],
    ["Infra Uptime with Redundancy", "100%"],
    ["Minor Fault Details (If any)", "N"],
    ["Major Fault Details (If any)", "N"],
    ["Planned Activity Details", "Y"],
    [`Month ${month}`, ""],
    ["Edge Data Centres Count", "WB"],
    ["Total Site Count", sites],
    ["Category Checks", ""],
    ["O&M Manpower Availability as Per LOI", "Ok"],
    [`In House PM Planned (${month} Month)`, planned("In_House_PM")],
    [`In House PM Completed (${month} Month)`, completed("In_House_PM")],
    ["Inhouse PM Completion %", percent("In_House_PM")],
    [`OEM PM Planned (${month} Month)`, planned("OEM_PM")],
    [`OEM PM Completed (${month} Month)`, completed("OEM_PM")],
    ["OEM PM Completion %", percent("OEM_PM")],
    ["Incidents / Accidents Reported", 0],
    ["EOL Replacement Planned", 0],
    ["EOL Replacement Completed", 0],
    ["Operational Governance Call Planned", 0],
    ["Operational Governance Call Executed", 0],
  ];
  return result.map(([Edge_Data_Centres_Count, WB]) => ({ Edge_Data_Centres_Count, WB }));
}
