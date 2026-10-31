import { formulasConfig } from "../config/formulasConfig";

export const getISTDate = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());

export const previousDate = date => new Date(Date.parse(`${date}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);
const numeric = value => value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
const round = value => Number(value.toFixed(4));

// A daily DG entry is the closing date's previous-4-PM to current-4-PM report.
// Never substitute yesterday's stock or tank capacity for a missing closing reading.
export function buildDailyAutofill({ site, date, log, config = {}, activitySheets = [] }) {
  const patch = {};
  const identity = { Circle: config.circle || "WB", Site_Name: site };
  if (log) {
    const count = Number(config.dgCount) || Math.max(0, ...Object.keys(log).map(key => Number(key.match(/^DG-(\d+) /)?.[1]) || 0));
    const ids = Array.from({ length: count }, (_, index) => index + 1);
    const sumReading = suffix => {
      const readings = ids.map(id => log[`DG-${id} ${suffix}`]);
      return readings.length && readings.every(numeric) ? round(readings.reduce((sum, value) => sum + Number(value), 0)) : undefined;
    };
    const tank = sumReading("Fuel Closing");
    const external = numeric(log.External_Stock_availiabl_at_MSC_Ltr)
      ? Number(log.External_Stock_availiabl_at_MSC_Ltr) : sumReading("External Fuel Stock");
    const diesel = { ...identity };
    ["DG_fuel_tank_capacity", "External_Stock_capacity_Barrel_UG_Buffer_Ltr", "DG_CPH"].forEach(key => {
      if (numeric(config[key])) diesel[key] = Number(config[key]);
    });
    if (tank !== undefined) diesel.Present_Diesel_Stock_in_DG_tank_Ltr = tank;
    if (external !== undefined) diesel.External_Stock_availiabl_at_MSC_Ltr = external;
    patch.Diesel_Back_Up = [{ ...diesel, ...formulasConfig.Diesel_Back_Up }];

    const total = sumReading("Hour Closing");
    const opening = sumReading("Hour Opening");
    const offload = sumReading("Off Load Hour");
    const runHours = total !== undefined && opening !== undefined ? round(total - opening) : undefined;
    if (runHours !== undefined && offload !== undefined && runHours >= offload && offload >= 0) {
      patch.DG_EB_Backup = [{ SlNo: 1, ...identity,
        Total_Power_Failure_hrs: round(runHours - offload), Total_DG_Run_hrs: runHours,
        Remark: offload > 0 ? "EB fail and No Load test run" : "EB Fail",
      }];
    }
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
  patch.Planned_Activity_Details = activityRows;
  return patch;
}

export function mergeDailyAutofill(data, patch) {
  const next = { ...data };
  Object.entries(patch).forEach(([key, rows]) => {
    if (key === "Planned_Activity_Details") {
      // Replace only previously imported rows; preserve manually entered activities.
      const manual = (data[key] || []).filter(row => !row.__dailyActivitySource && row.Activity_Description);
      next[key] = [...manual, ...rows.map(row => ({ ...row, __dailyActivitySource: true }))];
    } else {
      next[key] = [{ ...(data[key]?.[0] || {}), ...rows[0] }];
    }
  });
  return next;
}
