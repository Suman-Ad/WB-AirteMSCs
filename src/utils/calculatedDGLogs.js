// src/utils/calculatedDGLogs.js

export const calculateFields = (data, siteConfig) => {
  const result = { ...data };

  // DG Calculations
  for (let i = 1; i <= siteConfig.dgCount; i++) {
    const kwhOpen = parseFloat(result[`DG-${i} KWH Opening`]) || 0;
    const kwhClose = parseFloat(result[`DG-${i} KWH Closing`]) || 0;
    const fuelOpen = parseFloat(result[`DG-${i} Fuel Opening`]) || 0;
    const fuelClose = parseFloat(result[`DG-${i} Fuel Closing`]) || 0;
    const hrOpen = parseFloat(result[`DG-${i} Hour Opening`]) || 0;
    const hrClose = parseFloat(result[`DG-${i} Hour Closing`]) || 0;
    const fuelFill = parseFloat(result[`DG-${i} Fuel Filling`]) || 0;
    const offLoadFuelCon = parseFloat(result[`DG-${i} Off Load Fuel Consumption`]) || 0;
    const offLoadHrs = parseFloat(result[`DG-${i} Off Load Hour`]) || 0;
    const totalFuelCon = fuelOpen - fuelClose + fuelFill;

    result[`DG-${i} KWH Generation`] = kwhClose - kwhOpen;
    result[`DG-${i} Fuel Consumption`] = totalFuelCon;
    result[`DG-${i} Running Hrs`] = hrClose - hrOpen;
    result[`DG-${i} CPH`] =
      hrClose > hrOpen && totalFuelCon - offLoadFuelCon > 0
        ? (totalFuelCon - offLoadFuelCon) / (hrClose - hrOpen - offLoadHrs)
        : 0;
    result[`DG-${i} SEGR`] =
      totalFuelCon - offLoadFuelCon > 0
        ? (kwhClose - kwhOpen) / (totalFuelCon - offLoadFuelCon)
        : 0;
    result[`DG-${i} Run Min`] = (hrClose - hrOpen) * 60;
    result[`DG-${i} ON Load Consumption`] = Math.max(totalFuelCon - offLoadFuelCon, 0);
    result[`DG-${i} OFF Load Consumption`] = offLoadFuelCon;
    result[`DG-${i} ON Load Hour`] = (hrClose - hrOpen - offLoadHrs);
    result[`DG-${i} OFF Load Hour`] = offLoadHrs;
    result[`DG-${i} Fuel Filling`] = fuelFill;

    result[`DG-${i} Avg Fuel/Hr`] =
      result[`DG-${i} Running Hrs`] > 0
        ? Number((result[`DG-${i} Fuel Consumption`] / result[`DG-${i} Running Hrs`]).toFixed(2))
        : 0;
  }

  // EB Calculations
  for (let i = 1; i <= siteConfig.ebCount; i++) {
    const ebOpen = parseFloat(result[`EB-${i} KWH Opening`]) || 0;
    const ebClose = parseFloat(result[`EB-${i} KWH Closing`]) || 0;
    result[`EB-${i} KWH Generation`] = ebClose - ebOpen;
  }

  // Solar
  for (let i = 1; i <= siteConfig.solarCount; i++) {
    const solarOpen = parseFloat(result[`Solar-${i} KWH Opening`]) || 0;
    const solarClose = parseFloat(result[`Solar-${i} KWH Closing`]) || 0; // Fixed field name
    result[`Solar-${i} KWH Generation`] = solarClose - solarOpen;
  }

  // IT Load Calculations
  const dcpsLoadAmps = parseFloat(result["DCPS Load Amps"]) || 0;
  const upsLoadKwh = parseFloat(result["UPS Load KWH"]) || 0;
  result["DCPS Load KWH"] = (dcpsLoadAmps * 54.2) / 1000; // assuming 48V system
  result["UPS Load KWH"] = upsLoadKwh;
  result["Total IT Load KWH"] = result["DCPS Load KWH"] + result["UPS Load KWH"];

  // Office Load Consumption(kW)
  const officeLoad = parseFloat(result["Office kW Consumption"]) || 0;
  result["Office kW Consumption"] = officeLoad;

  // Totals for DG, EB, Solar
  result["Total DG KWH"] =
    (result["DG-1 KWH Generation"] || 0) +
    (result["DG-2 KWH Generation"] || 0) +
    (result["DG-3 KWH Generation"] || 0) +
    (result["DG-4 KWH Generation"] || 0);

  result["Total EB KWH"] =
    (result["EB-1 KWH Generation"] || 0) +
    (result["EB-2 KWH Generation"] || 0) +
    (result["EB-3 KWH Generation"] || 0) +
    (result["EB-4 KWH Generation"] || 0);

  result["Total Solar KWH"] =
    (result["Solar-1 KWH Generation"] || 0) +
    (result["Solar-2 KWH Generation"] || 0) +
    (result["Solar-3 KWH Generation"] || 0) +
    (result["Solar-4 KWH Generation"] || 0);

  result["Total DG Fuel"] =
    (result["DG-1 Fuel Consumption"] || 0) +
    (result["DG-2 Fuel Consumption"] || 0) +
    (result["DG-3 Fuel Consumption"] || 0) +
    (result["DG-4 Fuel Consumption"] || 0);

  result["Total DG Hours"] =
    (result["DG-1 Running Hrs"] || 0) +
    (result["DG-2 Running Hrs"] || 0) +
    (result["DG-3 Running Hrs"] || 0) +
    (result["DG-4 Running Hrs"] || 0);
  
  result["Total DG Onload Hours"] =
    (result["DG-1 ON Load Hour"] || 0) +
    (result["DG-2 ON Load Hour"] || 0) +
    (result["DG-3 ON Load Hour"] || 0) +
    (result["DG-4 ON Load Hour"] || 0);

  result["Total DG Offload Hours"] =
    (result["DG-1 OFF Load Hour"] || 0) +
    (result["DG-2 OFF Load Hour"] || 0) +
    (result["DG-3 OFF Load Hour"] || 0) +
    (result["DG-4 OFF Load Hour"] || 0);

  result["Total Unit Consumption"] =
    (result["DG-1 KWH Generation"] || 0) +
    (result["DG-2 KWH Generation"] || 0) +
    (result["DG-3 KWH Generation"] || 0) +
    (result["DG-4 KWH Generation"] || 0) +
    (result["EB-1 KWH Generation"] || 0) +
    (result["EB-2 KWH Generation"] || 0) +
    (result["EB-3 KWH Generation"] || 0) +
    (result["EB-4 KWH Generation"] || 0) +
    (result["Solar-1 KWH Generation"] || 0) +
    (result["Solar-2 KWH Generation"] || 0) +
    (result["Solar-3 KWH Generation"] || 0) +
    (result["Solar-4 KWH Generation"] || 0);

  result["Site Running kW"] = (result["Total Unit Consumption"] || 0) / 24;

  result["Total Fuel Filling"] =
    (result["DG-1 Fuel Filling"] || 0) +
    (result["DG-2 Fuel Filling"] || 0) +
    (result["DG-3 Fuel Filling"] || 0) +
    (result["DG-4 Fuel Filling"] || 0);

  // PUE Calculation
  result["PUE"] =
    result["Office kW Consumption"] > 0
      ? (((result["Total Unit Consumption"] - result["Office kW Consumption"]) / 24) /
        result["Total IT Load KWH"]
        ).toFixed(2)
      : 0;

  // Cooling Load Calculations
  const coolingLoad =
    result["Site Running kW"] - (result["Total IT Load KWH"] + (result["Office kW Consumption"] / 24)) || 0;
  result["Cooling kW Consumption"] = coolingLoad;

  return result;
};
