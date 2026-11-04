// Monthly formulas mirror src/utils/calculatedDGLogs.js and AllSitesDGLogs.js.
// src/utils/calculatedDGLogs.js

const calculateFields = (data, siteConfig) => {
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
    const externalFuelFilling = parseFloat(result[`DG-${i} External Fuel Filling`]) || 0;
    const externalFuelStock = parseFloat(result[`DG-${i} External Fuel Stock`]) || 0;
    const offLoadFuelCon = parseFloat(result[`DG-${i} Off Load Fuel Consumption`]) || 0;
    const offLoadHrs = parseFloat(result[`DG-${i} Off Load Hour`]) || 0;
    // const exUSe = parseFloat(prevLog[`DG-${i} External Fuel Stock`]) || 0;

    // Adjust fuelOpen if there's external fuel stock from previous day
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
    result[`DG-${i} External Fuel Filling`] = externalFuelFilling;
    result[`DG-${i} External Fuel Stock`] = externalFuelStock;

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

  result["Total External Fuel"] =
    (result["DG-1 External Fuel Filling"] || 0) +
    (result["DG-2 External Fuel Filling"] || 0) +
    (result["DG-3 External Fuel Filling"] || 0) +
    (result["DG-4 External Fuel Filling"] || 0);

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

    function getMonthlySummary(siteLogs, siteConfig) {
        if (!siteLogs.length) return {};

        const calculatedLogs = siteLogs.map(e => calculateFields(e, siteConfig));
        const dgCount = siteConfig.dgCount || 0;

        const getVal = (v) => Number(v) || 0;

        // ------------------ AVERAGES ------------------
        const pueValues = calculatedLogs.map(cl => getVal(cl["PUE"])).filter(v => v > 0);
        const monthlyAvgPUE = pueValues.length ? (pueValues.reduce((a, b) => a + b, 0) / pueValues.length).toFixed(2) : 0;

        // Dynamic CPH & SEGR
        let cphValues = [];
        let segrValues = [];

        for (let i = 1; i <= dgCount; i++) {
            cphValues.push(...calculatedLogs.map(cl => getVal(cl[`DG-${i} CPH`])));
            segrValues.push(...calculatedLogs.map(cl => getVal(cl[`DG-${i} SEGR`])));
        }

        cphValues = cphValues.filter(v => v > 0);
        segrValues = segrValues.filter(v => v > 0);

        const monthlyAvgCPH = cphValues.length ? (cphValues.reduce((a, b) => a + b, 0) / cphValues.length).toFixed(2) : 0;
        const monthlyAvgSEGR = segrValues.length ? (segrValues.reduce((a, b) => a + b, 0) / segrValues.length).toFixed(2) : 0;

        // ------------------ LOADS ------------------
        const monthlyAvgITLoad = avg(calculatedLogs.map(cl => getVal(cl["Total IT Load KWH"])));
        const monthlyAvgCoolingLoad = avg(calculatedLogs.map(cl => getVal(cl["Cooling kW Consumption"])));
        const monthlyAvgOfficeLoad = avg(calculatedLogs.map(cl => getVal(cl["Office kW Consumption"]))) / 24;
        const totalSiteRuningLoad = avg(calculatedLogs.map(cl => getVal(cl["Site Running kW"])));

        function avg(arr) {
            const f = arr.filter(v => v > 0);
            return f.length ? (f.reduce((a, b) => a + b, 0) / f.length).toFixed(2) : 0;
        }

        // ------------------ TOTALS ------------------
        const totalKwh = sum(calculatedLogs, "Total DG KWH");
        const totalEBKWH = sum(calculatedLogs, "Total EB KWH");
        const totalSolarKWH = sum(calculatedLogs, "Total Solar KWH");
        const totalFuel = sum(calculatedLogs, "Total DG Fuel");
        const totalHrs = sum(calculatedLogs, "Total DG Hours");
        const totalFilling = sum(calculatedLogs, "Total Fuel Filling") + sum(calculatedLogs, "Total External Fuel");

        function sum(arr, key) {
            return arr.reduce((s, cl) => s + getVal(cl[key]), 0);
        }

        // ------------------ DG DYNAMIC BREAKDOWN ------------------
        let dgData = {};
        let totalOnLoadCon = 0;
        let totalOffLoadCon = 0;
        let totalOnLoadHrs = 0;
        let totalOffLoadHrs = 0;

        let dgExternalFuel = {};
        let dayTankCapacity = 0;
        let externalTankCapacity = 0;

        for (let i = 1; i <= dgCount; i++) {
            const dgKey = `DG-${i}`;

            const kwh = sum(calculatedLogs, `${dgKey} KWH Generation`);
            const filling = sum(calculatedLogs, `${dgKey} Fuel Filling`) + sum(calculatedLogs, `${dgKey} External Fuel Filling`);
            const onLoadCon = sum(calculatedLogs, `${dgKey} ON Load Consumption`);
            const offLoadCon = sum(calculatedLogs, `${dgKey} OFF Load Consumption`);
            const onLoadHrs = sum(calculatedLogs, `${dgKey} ON Load Hour`);
            const offLoadHrs = sum(calculatedLogs, `${dgKey} OFF Load Hour`);
            // const externalFuel = calculatedLogs.map(cl => (getVal(cl[`${dgKey} External Fuel Stock`])));
            // const externalFuel = sum(calculatedLogs, `${dgKey} External Fuel Filling`);
            const externalFuel = getVal(
                calculatedLogs[calculatedLogs.length - 1]?.[`${dgKey} External Fuel Stock`]
            );

            dgData[dgKey] = {
                kwh,
                filling,
                onLoadCon,
                offLoadCon,
                onLoadHrs,
                offLoadHrs,
                totalHrs: onLoadHrs + offLoadHrs,
                totalHrsMin: ((onLoadHrs + offLoadHrs) * 60).toFixed(0),
                onLoadHrsMin: (onLoadHrs * 60).toFixed(0),
                offLoadHrsMin: (offLoadHrs * 60).toFixed(0),
            };

            dgExternalFuel[dgKey] = externalFuel;

            totalOnLoadCon += onLoadCon;
            totalOffLoadCon += offLoadCon;
            totalOnLoadHrs += onLoadHrs;
            totalOffLoadHrs += offLoadHrs;

            // Tank capacity
            dayTankCapacity += getVal(siteConfig.dgConfigs?.[dgKey]?.dayTankLtrs);
            externalTankCapacity += getVal(siteConfig.dgConfigs?.[dgKey]?.externalTankLtrs);
        }

        const tankCapacity = dayTankCapacity + externalTankCapacity;

        // ------------------ FINAL RETURN ------------------
        return {
            totalDays: siteLogs.length,
            monthlyAvgCPH,
            monthlyAvgPUE,
            monthlyAvgSEGR,
            monthlyAvgITLoad,
            monthlyAvgCoolingLoad,
            monthlyAvgOfficeLoad: monthlyAvgOfficeLoad.toFixed(2),
            totalSiteRuningLoad,

            totalKwh,
            totalEBKWH,
            totalSolarKWH,
            totalFuel,
            totalHrs,
            totalFilling,

            totalOnLoadCon,
            totalOffLoadCon,
            totalOnLoadHrs,
            totalOffLoadHrs,
            totalHrsMin: (totalHrs * 60).toFixed(0),

            dgData,              // 🔥 MAIN DYNAMIC OBJECT
            dgExternalFuel,

            dayTankCapacity,
            externalTankCapacity,
            tankCapacity,
        };
    }

const {istDate} = require('./meter-history.cjs');
const {numeric} = require('./energy-changeover-fuel.cjs');
const fmt = value => Number.isFinite(value) ? value.toLocaleString('en-IN', {maximumFractionDigits:2}) : 'Unavailable';
const ratio = (value, denominator) => Number.isFinite(value) && denominator > 0 ? value / denominator : null;
async function summaryMessages(db, siteName, siteId, now) {
  const date = istDate(now), month = date.slice(0,7);
  const [configDoc, daily, fuelDoc, billDoc] = await Promise.all([
    db.doc(`siteConfigs/${siteName.toUpperCase()}`).get(),
    db.collection(`dailyDGLogs/${siteName}/${month}`).get(),
    db.doc(`fuelRates/${siteName.toUpperCase()}`).get(),
    db.doc(`ebBillDetails/${siteName}/MonthlyBills/${month}`).get()
  ]);
  const config = configDoc.data() || {};
  const rows = daily.docs.map(d => ({...d.data(),Date:d.data().Date || d.id})).filter(r => /^\d{4}-\d{2}-\d{2}$/.test(r.Date) && r.Date.startsWith(month) && r.Date <= date).sort((a,b) => a.Date.localeCompare(b.Date));
  const heading = `${siteName}\nMonthly summary: ${month} (through ${date})`;
  if (!rows.length) return [heading+'\nNo saved daily logs this month.'];
  const s = getMonthlySummary(rows,config), bill = billDoc.data() || {};
  const fuelRate = numeric(fuelDoc.data()?.rate) || 90, ebRate = numeric(bill.EBRate) || 10;
  const monthly = [heading,`${s.totalDays} saved day(s); latest log ${rows.at(-1).Date}`,
    `Average PUE: ${fmt(Number(s.monthlyAvgPUE))} | SEGR: ${fmt(ratio(s.totalKwh,s.totalOnLoadCon))} kWh/L`,
    `Site running load: ${fmt(Number(s.totalSiteRuningLoad))} kW`,
    `Average IT / Cooling / Office load: ${fmt(Number(s.monthlyAvgITLoad))} / ${fmt(Number(s.monthlyAvgCoolingLoad))} / ${fmt(Number(s.monthlyAvgOfficeLoad))} kW`,
    `Average DG CPH: ${fmt(ratio(s.totalOnLoadCon,s.totalOnLoadHrs))} L/h`,
    `EB consumption: ${fmt(s.totalEBKWH)} kWh | Solar generation: ${fmt(s.totalSolarKWH)} kWh`,
    `DG generation: ${fmt(s.totalKwh)} kWh`,
    `Fuel filling: ${fmt(s.totalFilling)} L | Fuel consumption: ${fmt(s.totalFuel)} L`,
    `Fuel on/no load: ${fmt(s.totalOnLoadCon)} / ${fmt(s.totalOffLoadCon)} L`,
    `DG hours: ${fmt(s.totalHrs)} h | On/no load: ${fmt(s.totalOnLoadHrs)} / ${fmt(s.totalOffLoadHrs)} h`,
    ...Object.entries(s.dgData).map(([dg,r]) => `${dg}: ${fmt(r.kwh)} kWh | Filling ${fmt(r.filling)} L | Fuel on/no load ${fmt(r.onLoadCon)}/${fmt(r.offLoadCon)} L | Hours on/no load ${fmt(r.onLoadHrs)}/${fmt(r.offLoadHrs)} | SEGR ${fmt(ratio(r.kwh,r.onLoadCon))} kWh/L | CPH ${fmt(ratio(r.onLoadCon,r.onLoadHrs))} L/h`),
    `Cost (EB + DG): ₹${fmt(s.totalEBKWH*ebRate+s.totalFuel*fuelRate)}`,
    `EB cost: ₹${fmt(s.totalEBKWH*ebRate)} | DG fuel cost: ₹${fmt(s.totalFuel*fuelRate)}`,
    `DG generation cost: ₹${fmt(ratio(s.totalFuel*fuelRate,s.totalKwh))}/kWh | Fuel filling cost: ₹${fmt(s.totalFilling*fuelRate)}`,
    `Rates: EB ₹${ebRate}/kWh; diesel ₹${fuelRate}/L (dashboard defaults ₹10/₹90 if unset).`,
    `EB bill: ${fmt(numeric(bill.Unit))} units | ₹${fmt(numeric(bill.Amount))} | TDS ₹${fmt(numeric(bill.TDSAmount))}`,
    `EB bill after TDS: ₹${fmt(numeric(bill.Amount) !== null && numeric(bill.TDSAmount) !== null ? Number(bill.Amount)-Number(bill.TDSAmount) : null)}`,
    'Monthly values follow All Sites DG Logs saved-log formulas.'];
  return [monthly.join('\n')];
}
module.exports = {summaryMessages,getMonthlySummary};
