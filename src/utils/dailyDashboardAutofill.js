import { buildIncidentFaultRows } from "./dailyIncidentFaults";
import { formulasConfig } from "../config/formulasConfig";

export const getISTDate = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());

export const previousDate = date => new Date(Date.parse(`${date}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);
const numeric = value => value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
const round = value => Number(value.toFixed(4));

// Fill identity independently of other populated fields; retain entered values.
export function fillDieselIdentity(row, userData = {}) {
  const missing = value => value === undefined || value === null || String(value).trim() === "";
  return { ...row,
    Circle: missing(row.Circle) ? (userData.circle || "WB") : row.Circle,
    Site_Name: missing(row.Site_Name) ? (userData.site || "") : row.Site_Name,
  };
}

// Tank capacities are site configuration, independent of daily closing readings.
export function getDailyTankCapacities(config = {}) {
  const count = Number(config.dgCount);
  const tanks = Number.isInteger(count) && count >= 0
    ? Array.from({ length: count }, (_, index) => config.dgConfigs?.[`DG-${index + 1}`] || {})
    : Object.values(config.dgConfigs || {});
  const result = {};
  [["dayTankLtrs", "DG_fuel_tank_capacity"],
    ["externalTankLtrs", "External_Stock_capacity_Barrel_UG_Buffer_Ltr"]].forEach(([source, target]) => {
    if (tanks.length && tanks.every(tank => numeric(tank[source]) && Number(tank[source]) >= 0)) {
      result[target] = round(tanks.reduce((sum, tank) => sum + Number(tank[source]), 0));
    }
  });
  return result;
}

// A daily DG entry is the closing date's previous-4-PM to current-4-PM report.
// Stock readings can come from the latest saved stock log; hours use the reporting date only.
export function buildDailyAutofill({ site, date, log, stockLog = log, runs = [], runHoursFromRuns = false, config = {}, activitySheets = [], incidents = null }) {
  const patch = {};
  const identity = { Circle: config.circle || "WB", Site_Name: site };
  const capacities = getDailyTankCapacities(config);
  if (Object.keys(capacities).length) patch.Diesel_Back_Up = [{ ...capacities, ...formulasConfig.Diesel_Back_Up }];
  const dgRemark = (run, power) => run > 0 && power === 0 ? "No Load DG Run"
    : run === power ? "EB Fail DG Run"
    : run > power && power > 0 ? "EB fail  and No load DG run" : "";
  patch.DG_EB_Backup = [{ SlNo: 1, ...identity }];
  if (log && !runHoursFromRuns) {
    const count = Number(config.dgCount) || Math.max(0, ...Object.keys(log).map(key => Number(key.match(/^DG-(\d+) /)?.[1]) || 0));
    const ids = Array.from({ length: count }, (_, index) => index + 1);
    const sumReading = suffix => {
      const readings = ids.map(id => log[`DG-${id} ${suffix}`]);
      return readings.length && readings.every(numeric) ? round(readings.reduce((sum, value) => sum + Number(value), 0)) : undefined;
    };
    const total = sumReading("Hour Closing");
    const opening = sumReading("Hour Opening");
    const offload = sumReading("Off Load Hour");
    const runHours = total !== undefined && opening !== undefined ? round(total - opening) : undefined;
    if (runHours !== undefined && offload !== undefined && runHours >= offload && offload >= 0) {
      patch.DG_EB_Backup = [{ SlNo: 1, ...identity,
        Total_Power_Failure_hrs: round(runHours - offload), Total_DG_Run_hrs: runHours,
        Remark: dgRemark(runHours, round(runHours - offload)),
      }];
    }
  }

  if (runHoursFromRuns && Array.isArray(runs)) {
    // Same current-day run rows as DGLogTable; exclude fuel-filling entries.
    const dailyRuns = runs.filter(run => ["On Load", "No Load"].includes(run.remarks));
    if (dailyRuns.every(run => numeric(run.totalRunHours) && Number(run.totalRunHours) >= 0)) {
      const runHours = round(dailyRuns.reduce((sum, run) => sum + Number(run.totalRunHours), 0));
      const powerHours = round(dailyRuns.filter(run => run.remarks === "On Load").reduce((sum, run) => sum + Number(run.totalRunHours), 0));
      patch.DG_EB_Backup = [{ SlNo: 1, ...identity, Total_DG_Run_hrs: runHours,
        Total_Power_Failure_hrs: powerHours, Remark: dgRemark(runHours, powerHours) }];
    }
  }

  if (stockLog) {
    const count = Number(config.dgCount) || Math.max(0, ...Object.keys(stockLog).map(key => Number(key.match(/^DG-(\d+) /)?.[1]) || 0));
    const ids = Array.from({ length: count }, (_, index) => index + 1);
    const sumStock = suffix => {
      const values = ids.map(id => stockLog[`DG-${id} ${suffix}`]);
      return values.length && values.every(value => numeric(value) && Number(value) >= 0)
        ? round(values.reduce((sum, value) => sum + Number(value), 0)) : undefined;
    };
    const diesel = { ...capacities };
    if (numeric(config.DG_CPH)) diesel.DG_CPH = Number(config.DG_CPH);
    // Today's opening comes from today's opening fields, or the last saved
    // day's closing fields. Reusing yesterday's opening adds consumed fuel back.
    const hasSelectedDayLog = Boolean(log) || stockLog.Date === date;
    const openingLog = log || stockLog;
    const openingField = hasSelectedDayLog ? "Fuel Opening" : "Fuel Closing";
    const openings = ids.map(id => openingLog?.[`DG-${id} ${openingField}`]);
    // These rows are already scoped to DGLogTable's site/date collection.
    // The table displays empty fuelConsumption as zero, including filling-only rows.
    const fuelRuns = runs;
    const consumption = fuelRuns?.reduce((sum, run) => sum + (Number(run.fuelConsumption) || 0), 0);
    const tank = ids.length && openings.every(value => numeric(value) && Number(value) >= 0) && fuelRuns
      ? round(openings.reduce((sum, value) => sum + Number(value), 0) - consumption)
      : undefined;
    const external = numeric(stockLog.External_Stock_availiabl_at_MSC_Ltr)
      ? Number(stockLog.External_Stock_availiabl_at_MSC_Ltr) : sumStock("External Fuel Stock");
    if (tank !== undefined) {
      diesel.Present_Diesel_Stock_in_DG_tank_Ltr = tank;
      diesel.__fuelCalculation = { opening: round(openings.reduce((sum, value) => sum + Number(value), 0)),
        consumption: round(consumption), runs: fuelRuns.length, stock: tank };
    }
    if (external !== undefined) diesel.External_Stock_availiabl_at_MSC_Ltr = external;
    patch.Diesel_Back_Up = [{ ...diesel, ...formulasConfig.Diesel_Back_Up }];
  }

  const start = `${previousDate(date)}T16:00`;
  const end = `${date}T16:00`;
  const activityRows = [];
  activitySheets.forEach(sheet => {
    if (String(sheet.siteName || "").trim().toLowerCase() !== site.trim().toLowerCase()) return;
    const sheetDate = sheet.date?.toDate ? sheet.date.toDate().toISOString().slice(0, 10) : sheet.date;
    (sheet.rows || []).forEach(row => {
      const activityDate = sheetDate || row.doneDate;
      const time = row.activityStartTime;
      const stamp = `${activityDate}T${time}`;
      // Date-only planned activities belong to their scheduled reporting date.
      const included = time ? stamp >= start && stamp < end : activityDate === date;
      if (!included) return;
      activityRows.push({ Date: activityDate || date, Circle: sheet.circle || identity.Circle,
        Site_Name: site, Site_ID: sheet.siteId || "", Activity_Planned_Y_N: "Y",
        Activity_Description: [row.activityDetails, row.notes].filter(Boolean).join(" — "),
        Activity_Execution_Status: row.pmStatus || "Pending", Category: row.activityCategory || row.activityType || "",
      });
    });
  });
  if (incidents !== null) patch.Fault_Details = buildIncidentFaultRows({ incidents, site, siteId: config.siteId, date });
  patch.Planned_Activity_Details = activityRows;
  return patch;
}

export function mergeDailyAutofill(data, patch) {
  const next = { ...data };
  Object.entries(patch).forEach(([key, rows]) => {
    if (key === "Fault_Details") {
      const manual = (data[key] || []).filter(row => !row.__dailyIncidentSource &&
        ["Complaint_ID", "Issue_Details", "Equipment_Name", "Equipment_Type"].some(field => row[field]));
      next[key] = [...manual, ...rows].map((row, index) => ({ ...row, SlNo: index + 1 }));
    } else if (key === "Planned_Activity_Details") {
      // Replace only previously imported rows; preserve manually entered activities.
      const manual = (data[key] || []).filter(row => !row.__dailyActivitySource && row.Activity_Description);
      next[key] = [...manual, ...rows.map(row => ({ ...row, __dailyActivitySource: true }))];
    } else {
      next[key] = [{ ...(data[key]?.[0] || {}), ...rows[0] }];
    }
  });
  return next;
}
