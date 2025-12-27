// src/pages/MonthlyData.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import XLSX from "xlsx-js-style";
import { oemDieselCphData } from "../config/oemDieselCphData";
import { db } from "../firebase"; // your firebase config
import { collection, getDocs } from "firebase/firestore";

const fmt = (val) => (val !== undefined && val !== null ? Number(val).toFixed(2) : "0.0");
const fmt1 = (val) => (val !== undefined && val !== null ? Number(val).toFixed(1) : "0.0");
const getDaysInMonthArray = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed
    const num = new Date(year, month + 1, 0).getDate();
    const arr = [];
    for (let d = 1; d <= num; d++) arr.push(new Date(year, month, d));
    return arr;
};

// list the metrics rows in the order you want (matching uploaded template)
const METRICS = [
    "Power Failure (Hrs.)",
    "DG Run (Hrs.)",
    "Office run hrs.",
    "Office load (KW)",
    "Cooling Load (KW)",
    "IT Load (KW)",
    "Total Facility Load (KW)",
    "PUE",
    // ... add other row labels you need (Monthly Summary block later)
];

export default function MonthlyData({ userData }) {
    // siteConfig can be passed via props or read from global state/context
    const { state } = useLocation();
    const { logs, siteConfig, selectedMonth } = state || {};
    const [monthDate, setMonthDate] = useState(() => {
        // default to selectedMonth used in DailyDGLog or today
        return new Date(); // override with your selectedMonth if available
    });
    // const [logs, setLogs] = useState([]); // raw daily docs for the site/month
    const [loading, setLoading] = useState(false);
    const [previewGrid, setPreviewGrid] = useState(null);
    const [monthlyCPHvsRunHrs, setMonthlyCPHvsRunHrs] = useState([]);

    const [summary, setSummary] = useState({
        DG1_OnLoad: 0,
        DG1_NoLoad: 0,
        DG2_OnLoad: 0,
        DG2_NoLoad: 0,
    });

    const navigate = useNavigate();

    // derive days of month
    const days = useMemo(() => getDaysInMonthArray(monthDate), [monthDate]);

    const formatMonthName = (ym) => {
        const [year, month] = ym.split("-");
        const date = new Date(year, month - 1); // month is 0-based
        return date.toLocaleString("default", { month: "long" }); // , year: "numeric" 
    };

    const formatYear = (ym) => {
        return ym.split("-")[0]; // just the YYYY part
    };

    const fetchMonthlySummary = async () => {
        try {
            const dateObj = new Date(selectedMonth + "-01");
            const monthKey =
                dateObj.toLocaleString("en-US", { month: "short" }) +
                "-" +
                dateObj.getFullYear();

            // 🔹 Get all date docs under the month
            const monthRef = collection(db, "dgLogs", userData?.site, monthKey);
            const monthSnapshot = await getDocs(monthRef);

            let counts = {
                DG1_OnLoad: 0,
                DG1_NoLoad: 0,
                DG2_OnLoad: 0,
                DG2_NoLoad: 0,
            };

            // 🔹 Loop each date (2025-09-01, 2025-09-02, …)
            for (const dateDoc of monthSnapshot.docs) {
                const runsRef = collection(
                    db,
                    "dgLogs",
                    userData?.site,
                    monthKey,
                    dateDoc.id,
                    "runs"
                );
                const runsSnap = await getDocs(runsRef);

                runsSnap.forEach((r) => {
                    const data = r.data();
                    if (data.dgNumber === "DG-1" && data.remarks === "On Load") counts.DG1_OnLoad++;
                    if (data.dgNumber === "DG-1" && data.remarks === "No Load") counts.DG1_NoLoad++;
                    if (data.dgNumber === "DG-2" && data.remarks === "On Load") counts.DG2_OnLoad++;
                    if (data.dgNumber === "DG-2" && data.remarks === "No Load") counts.DG2_NoLoad++;
                });
            }

            setSummary(counts);
            localStorage.setItem("summary", JSON.stringify(counts));

        } catch (err) {
            console.error("Error fetching monthly summary:", err);
        }
    };

    useEffect(() => {
        const cached = localStorage.getItem("summary");
        if (cached) {
            setSummary(JSON.parse(cached));
        }
        fetchMonthlySummary();

    }, [userData, selectedMonth]);

    // 🔹 Auto calculations (like Excel)
    const calculateFields = (data) => {
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
            result[`DG-${i} CPH`] = hrClose > hrOpen && totalFuelCon - offLoadFuelCon > 0 ? (totalFuelCon - offLoadFuelCon) / (hrClose - hrOpen - offLoadHrs) : 0;
            result[`DG-${i} SEGR`] = totalFuelCon - offLoadFuelCon > 0 ? (kwhClose - kwhOpen) / (totalFuelCon - offLoadFuelCon) : 0;
            result[`DG-${i} Run Min`] = (hrClose - hrOpen) * 60;
            result[`DG-${i} ON Load Consumption`] = Math.max(totalFuelCon - offLoadFuelCon, 0);
            result[`DG-${i} OFF Load Consumption`] = offLoadFuelCon;
            result[`DG-${i} ON Load Hour`] = (hrClose - hrOpen - offLoadHrs);
            result[`DG-${i} OFF Load Hour`] = (offLoadHrs);
            result[`DG-${i} Fuel Filling`] = (fuelFill);


            result[`DG-${i} Avg Fuel/Hr`] =
                result[`DG-${i} Running Hrs`] > 0
                    ? Number(
                        (result[`DG-${i} Fuel Consumption`] /
                            result[`DG-${i} Running Hrs`]).toFixed(2)
                    )
                    : 0;
        }

        // EB Calculations
        for (let i = 1; i <= siteConfig.ebCount; i++) {
            const ebOpen = parseFloat(result[`EB-${i} KWH Opening`]) || 0;
            const ebClose = parseFloat(result[`EB-${i} KWH Closing`]) || 0;
            result[`EB-${i} KWH Generation`] = ebClose - ebOpen;
        }

        //Solar
        for (let i = 1; i <= siteConfig.solarCount; i++) {
            const solarOpen = parseFloat(result[`Solar-${i} KWH Opening`]) || 0;
            const solarClose = parseFloat(result[`Solar-${i} KWH Opening`]) || 0;
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

        // Totals
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

        result["Total DG ON Load Hours"] =
            (result["DG-1 ON Load Hour"] || 0) +
            (result["DG-2 ON Load Hour"] || 0) +
            (result["DG-3 ON Load Hour"] || 0) +
            (result["DG-4 ON Load Hour"] || 0);

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

        result["Site Running kW"] =
            (result["Total Unit Consumption"] || 0) / 24;

        result["Total Fuel Filling"] =
            (result["DG-1 Fuel Filling"] || 0) +
            (result["DG-2 Fuel Filling"] || 0) +
            (result["DG-3 Fuel Filling"] || 0) +
            (result["DG-4 Fuel Filling"] || 0);

        //PUE Calculation
        result["PUE"] = result["Office kW Consumption"] > 0 ? (((result["Total Unit Consumption"] - result["Office kW Consumption"]) / 24) / result["Total IT Load KWH"]).toFixed(2) : "0.00";

        return result;
    };

    const allValues = logs.flatMap((entry) => calculateFields(entry));

    const siteRunningKwValues = allValues
        .map(cl => cl["Site Running kW"])
        .filter(v => v > 0);

    const avgSiteRunningKw =
        siteRunningKwValues.length > 0
            ? (siteRunningKwValues.reduce((sum, v) => sum + v, 0) / siteRunningKwValues.length).toFixed(2)
            : 0;

    // helper to find row index in OEM CPH data
    const findRowDgCapacity = (dgRating) => {
        const capacities = oemDieselCphData["DG Capacity"];
        for (let i = 0; i < capacities.length; i++) {
            if (capacities[i] === dgRating) {
                return i;
            }
        }
        return -1;
    };

    // OEM data exists for this percent — use OEM CPH table
    const runPercent = (avgSiteRunningKw / (siteConfig.dgCapacity * 0.8)) * 100;
    const roundedPercent = Math.round(runPercent);
    const capacity = parseFloat(siteConfig?.dgCapacity) || 0;
    const rowIndex = findRowDgCapacity(capacity);
    const oDCPH = oemDieselCphData[`${roundedPercent}%`]?.[rowIndex];

    // 🔹 Build Monthly CPH vs Run Hrs Table
    const buildMonthlyCPHvsRunHrsTable = (logs, siteConfig, siteMeta) => {
        const dgMap = {};
        let sno = 1;

        logs.forEach((log) => {
            const calc = calculateFields(log); // 🔥 IMPORTANT

            for (let i = 1; i <= siteConfig.dgCount; i++) {
                const dgKey = `DG-${i}`;

                const onLoadHrs = Number(calc[`${dgKey} ON Load Hour`] || 0);
                const offLoadHrs = Number(calc[`${dgKey} OFF Load Hour`] || 0);
                const totalRunHrs = onLoadHrs + offLoadHrs;

                const onLoadFuel = Number(calc[`${dgKey} ON Load Consumption`] || 0);
                const offLoadFuel = Number(calc[`${dgKey} OFF Load Consumption`] || 0);
                const totalFuel = onLoadFuel + offLoadFuel;
                const totalFuelFilling = Number(calc[`${dgKey} Fuel Filling`] || 0);

                const kwh = Number(calc[`${dgKey} KWH Generation`] || 0);

                if (!totalRunHrs || !totalFuel) continue;

                const mapKey = `${siteMeta.month}_${dgKey}`;

                if (!dgMap[mapKey]) {
                    dgMap[mapKey] = {
                        sno: sno++,
                        hub: siteMeta.hub,
                        circle: siteMeta.circle,
                        siteCode: siteMeta.siteCode,
                        siteName: siteMeta.siteName,
                        ownership: siteMeta.ownership,
                        address: siteMeta.address,
                        factory: siteMeta.factory,
                        month: siteMeta.month,

                        dgNumber: dgKey,
                        dgCapacity: siteConfig.dgCapacity,
                        dgMfgDate: siteConfig.dgMfgDate,

                        dgUnitsConsumed: 0,

                        dgRunHrsOnLoad: 0,
                        dgRunHrsNoLoad: 0,
                        dgTotalRunHrs: 0,

                        dieselConsumedOnLoad: 0,
                        dieselConsumedNoLoad: 0,
                        totalDieselConsumed: 0,
                        dieselPurchased: 0,
                        dieselAdded: 0,

                        pf: siteMeta.pf,
                    };
                }

                dgMap[mapKey].dgUnitsConsumed += kwh;

                dgMap[mapKey].dgRunHrsOnLoad += onLoadHrs;
                dgMap[mapKey].dgRunHrsNoLoad += offLoadHrs;
                dgMap[mapKey].dgTotalRunHrs += totalRunHrs;

                dgMap[mapKey].dieselConsumedOnLoad += onLoadFuel;
                dgMap[mapKey].dieselConsumedNoLoad += offLoadFuel;
                dgMap[mapKey].totalDieselConsumed += totalFuel;
                dgMap[mapKey].dieselPurchased += totalFuelFilling;
                dgMap[mapKey].dieselAdded += totalFuelFilling;
            }
        });

        // 🔹 Final calculations
        return Object.values(dgMap).map((r) => {
            const cph = r.dieselConsumedOnLoad / r.dgRunHrsOnLoad;
            const kwhPerLtr = r.dgUnitsConsumed / r.dieselConsumedOnLoad;

            const gap = cph - siteMeta.oemCph || 0;
            const gapMargin = cph - ((siteMeta.oemCph || 0) * 1.05);
            const dgKey = r.dgNumber.replace("-", "");

            return {
                ...r,
                cph: Number(cph.toFixed(1)),
                kwhPerLtr: Number(kwhPerLtr.toFixed(2)),
                oemCph: siteMeta.oemCph || 0,
                gapXV: Number(gap.toFixed(2)),
                cphStatus: cph > siteMeta.oemCph ? "High" : "Low",
                oemCphWithMargin: siteMeta.oemCphMargin || 0,
                gapXVWithMargin: Number(gapMargin.toFixed(2)),
                rcaHighCph: cph > siteMeta.oemCph ? "RCA Required" : "",
                remarks: "",
                dgRunIncidentsOnLoad: summary?.[`${dgKey}_OnLoad`] || 0,
                dgRunIncidentsNoLoad: summary?.[`${dgKey}_NoLoad`] || 0,
            };
        });
    };


    useEffect(() => {
        if (!logs?.length || !siteConfig) return;

        const siteMeta = {
            hub: userData?.region,
            circle: userData?.circle,
            siteCode: userData?.siteId,
            siteName: siteConfig.siteName,
            ownership: siteConfig.ownership,
            address: siteConfig.address,
            factory: siteConfig.factory,
            month: selectedMonth ? `${formatMonthName(selectedMonth)}-${formatYear(selectedMonth)}` : "NA",
            oemCph: oDCPH || 0,
            oemCphMargin: oDCPH * 1.05,
            pf: siteConfig.pf,
        };

        const data = buildMonthlyCPHvsRunHrsTable(logs, siteConfig, siteMeta);
        setMonthlyCPHvsRunHrs(data);

    }, [logs, siteConfig, userData, summary, selectedMonth]);

    // build preview grid: rows = METRICS, cols = days
    useEffect(() => {
        if (!logs.length) {
            setPreviewGrid(null);
            return;
        }
        // map date string to entry for quick lookup
        const byDate = {};
        logs.forEach((entry) => {
            // normalize day key: use date string 'YYYY-MM-DD' or just day number
            const d = new Date(entry.Date);
            const dayNumber = d.getDate();
            byDate[dayNumber] = entry;
        });

        // compute grid rows
        const gridRows = METRICS.map((metricLabel) => {
            const values = days.map((d) => {
                const day = d.getDate();
                const doc = byDate[day];
                if (!doc) return ""; // no data for that day
                const calculated = calculateFields(doc); // reuse your function
                // determine metric mapping to calculated fields
                // this mapping MUST match your calculateFields output keys
                switch (metricLabel) {
                    case "Power Failure (Hrs.)":
                        return fmt1(calculated["Total DG ON Load Hours"] || calculated["Power Failure"] || "");
                    case "DG Run (Hrs.)":
                        // if you want total DG run hours across all DGs for that day:
                        return fmt1(calculated["Total DG Hours"] || "");
                    case "Office run hrs.": {
                        const isSunday = d.getDay() === 0; // Sunday = 0
                        return isSunday ? 6 : 8;
                    }
                    case "Office load (KW)":
                        return fmt((calculated["Office kW Consumption"] / 24) || "");
                    case "Cooling Load (KW)":
                        return fmt((calculated["Site Running kW"] - calculated["Total IT Load KWH"] - (calculated["Office kW Consumption"] / 24)) || "");
                    case "IT Load (KW)":
                        return fmt(calculated["Total IT Load KWH"] || "");
                    case "Total Facility Load (KW)":
                        return fmt(calculated["Site Running kW"] || "");
                    case "PUE":
                        return fmt(calculated["PUE"] || "");
                    // add other mappings for every metric in METRICS
                    default:
                        return "";
                }
            });

            setMonthDate(logs.length ? new Date(logs[0].Date) : new Date());

            return { metric: metricLabel, values };
        });

        // ✅ Monthly Summary Calculations
        const summary = {};
        const totalDays = days.length;

        summary["Total Power Failure (in Hrs.)"] = fmt1(
            gridRows.find((r) => r.metric === "Power Failure (Hrs.)")?.values.reduce((a, b) => a + Number(b || 0), 0)
        );
        summary["Total DG Run Hrs."] = fmt1(
            gridRows.find((r) => r.metric === "DG Run (Hrs.)")?.values.reduce((a, b) => a + Number(b || 0), 0)
        );
        summary["Office run hrs."] = fmt1(
            gridRows.find((r) => r.metric === "Office run hrs.")?.values.reduce((a, b) => a + Number(b || 0), 0)
        );
        summary["Office load (KW)"] = fmt1(
            average(gridRows.find((r) => r.metric === "Office load (KW)")?.values)
        );
        summary["Cooling  Load (KW)"] = fmt1(
            average(gridRows.find((r) => r.metric === "Cooling Load (KW)")?.values)
        );
        summary["IT Load (KW)"] = fmt1(
            average(gridRows.find((r) => r.metric === "IT Load (KW)")?.values)
        );
        summary["Total Facility Load (KW)"] = fmt1(
            average(gridRows.find((r) => r.metric === "Total Facility Load (KW)")?.values)
        );
        summary["Maximum Facility Load (KW)"] = fmt1(
            Math.max(
                ...gridRows.find((r) => r.metric === "Total Facility Load (KW)")?.values.map(Number) || [0]
            )
        );
        summary["PUE"] = fmt(
            average(gridRows.find((r) => r.metric === "PUE")?.values)
        );

        // helper for averages
        function average(arr = []) {
            const nums = arr.map(Number).filter((n) => !isNaN(n));
            if (!nums.length) return 0;
            return nums.reduce((a, b) => a + b, 0) / nums.length;
        }

        // Build final rows array including summary
        const summaryRows = Object.entries(summary).map(([label, val]) => ({
            metric: label,
            values: [val], // only one column — summary column
        }));

        setPreviewGrid({ days, rows: gridRows, summaryRows });
    }, [logs, days]);

    // build excel file and download
    const handleDownloadExcel = () => {
        if (!previewGrid) {
            alert("No data to export for this month");
            return;
        }

        // create 2D array: first row = title (merged), second row = header (Date col + days),
        const wb = XLSX.utils.book_new();

        // Build worksheet data as array of arrays
        const headerRow = ["", "Date"]; // first column reserved for labels & site info; second column header is "Date" label or leave blank based on template
        // But uploaded template uses site name cell then date row starting from 3rd column; we replicate similar style:
        // We'll create columns: Col A = 'Site Name' label, Col B = site name, then Col C onwards = dates (Day 1..N)
        const daysFormatted = previewGrid.days.map((d) => d.getDate());
        const header = ["Site Name", "Site ID", ...daysFormatted.map((n) => n.toString())];

        // Build rows: first row is title/merged will be set later via merges
        const data = [];
        // push header as first row
        data.push(header);

        // push metric rows: each metric label occupies col A (or C?), we create columns as per header above
        previewGrid.rows.forEach((r) => {
            const rowArr = [];
            rowArr.push(r.metric); // put metric name under "Site Name" col to mirror template position
            rowArr.push(""); // site ID column (we keep empty for metric rows)
            // values for each day
            r.values.forEach((v) => rowArr.push(v));
            data.push(rowArr);
        });

        // Now convert to sheet
        const ws = XLSX.utils.aoa_to_sheet(data);

        // Apply styles similar to your uploaded sheet:
        // 1) add merged title at A1:B1 (we will put the dynamic title in A1)
        ws["!merges"] = ws["!merges"] || [];
        // Place merged title spanning first 2 columns (A1:B1) — spreadsheet is 0-indexed in merges
        ws["!merges"].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } });

        // Put title text in A1
        const title = `Monthly Energy Outlook – ${siteConfig.siteName} – ${monthDate.toLocaleString("default", { month: "long" })} ${monthDate.getFullYear()}`;
        ws["A1"].v = title;
        ws["A1"].t = "s";
        ws["A1"].s = {
            font: { bold: true, sz: 14 },
            alignment: { horizontal: "center", vertical: "center", wrapText: true },
            fill: { fgColor: { rgb: "C9E6FF" } },
            border: {
                top: { style: "thin", color: { rgb: "000000" } },
                bottom: { style: "thin", color: { rgb: "000000" } },
                left: { style: "thin", color: { rgb: "000000" } },
                right: { style: "thin", color: { rgb: "000000" } },
            },
        };

        // Style the header (row 1 after title -> actually row index 0 is header currently; if want title above header you can insert a blank row)
        // Adjust: Our data currently has header as first row (A1...), metrics start row2; to match template put title on row1 then shift header to row2.
        // For brevity, we'll keep current and style header cells (row 1).
        const headers = Object.keys(XLSX.utils.sheet_to_json(ws, { header: 1 })[0] || []);
        headers.forEach((h, idx) => {
            const cellRef = XLSX.utils.encode_cell({ r: 0, c: idx });
            if (!ws[cellRef]) ws[cellRef] = { t: "s", v: headers[idx] || "" };
            ws[cellRef].s = {
                fill: { fgColor: { rgb: "1F4E78" } }, // dark blue
                font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
                alignment: { horizontal: "center", vertical: "center", wrapText: true },
                border: {
                    top: { style: "thin", color: { rgb: "000000" } },
                    bottom: { style: "thin", color: { rgb: "000000" } },
                    left: { style: "thin", color: { rgb: "000000" } },
                    right: { style: "thin", color: { rgb: "000000" } },
                },
            };
        });

        // Add borders to metric cells
        const range = XLSX.utils.decode_range(ws["!ref"]);
        for (let R = 1; R <= range.e.r; ++R) {
            for (let C = 0; C <= range.e.c; ++C) {
                const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
                if (!ws[cellRef]) continue;
                if (!ws[cellRef].s) ws[cellRef].s = {};
                ws[cellRef].s.border = {
                    top: { style: "thin", color: { rgb: "000000" } },
                    bottom: { style: "thin", color: { rgb: "000000" } },
                    left: { style: "thin", color: { rgb: "000000" } },
                    right: { style: "thin", color: { rgb: "000000" } },
                };
                ws[cellRef].s.alignment = { horizontal: "center", vertical: "center" };
            }
        }

        // Column widths
        ws["!cols"] = new Array(range.e.c + 1).fill({ wch: 12 });

        // Append and write workbook
        XLSX.utils.book_append_sheet(wb, ws, `${siteConfig.siteName}_${monthDate.getFullYear()}_${monthDate.getMonth() + 1}`);
        const fname = `Monthly_Energy_Outlook_Report_${siteConfig.siteName}_${monthDate.toLocaleString("default", { month: "short" })}'${monthDate.getFullYear()}.xlsx`;
        XLSX.writeFile(wb, fname);
    };

    return (
        <div className="daily-log-container">
            <h2>Monthly Data</h2>
            <div style={{ border: "1px solid #000", borderRadius: "15px" }}>
                <h2>Monthly Energy Outlook Data — {siteConfig?.siteName}</h2>

                <div style={{ marginBottom: 12 }}>

                    <button onClick={() => { /* reload triggered by state change anyway */ }}>Generate</button>
                    <button onClick={handleDownloadExcel} style={{ marginLeft: 8 }}>
                        Download Excel (Styled)
                    </button>
                    {/* <button onClick={() => navigate(-1)} style={{ marginLeft: 8 }}>← Back</button> */}
                </div>

                {loading && <div>Loading logs...</div>}

                {!loading && previewGrid && (
                    <div style={{ overflowX: "auto", whiteSpace: "nowrap", marginTop: "20px", borderRadius: "15px" }}>
                        <table className="table-container" border="1" cellPadding="6" style={{ borderRadius: "15px", overflowX: "auto", borderCollapse: "collapse", padding: "20px" }}>
                            <thead>
                                <tr>
                                    <th style={{ position: "sticky", left: 0, background: "#fff", zIndex: 3 }}>Metric</th>
                                    {previewGrid.days.map((d) => (
                                        <th key={d.toISOString()}>{d.getDate()}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {previewGrid.rows.map((r) => (
                                    <tr key={r.metric}>
                                        <td style={{ position: "sticky", left: 0, background: "#fff", zIndex: 3 }}>{r.metric}</td>
                                        {r.values.map((v, idx) => (
                                            <td key={idx} style={{ textAlign: "center" }}>{v}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {previewGrid?.summaryRows && (
                    <div style={{ borderRadius: "15px", padding: "20px" }}>
                        <h3>Monthly Summary</h3>
                        <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", minWidth: "300px", borderRadius: "10px" }}>
                            <tbody>
                                {previewGrid.summaryRows.map((r) => (
                                    <tr key={r.metric}>
                                        <td style={{ fontWeight: "600", background: "#dfefff" }}>{r.metric}</td>
                                        <td style={{ textAlign: "center" }}>{r.values[0]}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {!loading && !previewGrid && <div>No data found for this month.</div>}
            </div>

            <div style={{ border: "1px solid #000", borderRadius: "15px", marginTop: "30px", padding: "20px" }}>
                <h2 style={{ marginTop: "40px" }}>Monthly CPH vs Run Hrs Table</h2>
                <div style={{ overflowX: "auto" }}>
                    <table className="table-container" border="1" cellPadding="6">
                        <thead>
                            <tr>
                                <th>S.no</th>
                                <th>Hub</th>
                                <th>Circle</th>
                                <th>Unique site Code</th>
                                <th>Site name</th>
                                <th>Rented / Owned / Long lease</th>
                                <th>Address of Property</th>
                                <th>Factory</th>
                                <th>Month</th>
                                <th>DG Number</th>
                                <th>DG capacity (kVA)</th>
                                <th>DG Manufacturing Date</th>
                                <th>DG running load (kVA)</th>
                                <th>DG running load (kW)</th>
                                <th>% of DG load (kW)</th>
                                <th>DG units consumed (kWh)</th>

                                <th>DG Run Hrs (On Load)</th>
                                <th>DG Run Hrs (No Load)</th>
                                <th>Total DG Run Hrs</th>

                                <th>Diesel Purchased (Ltrs)</th>
                                <th>Diesel Added in DG (Ltrs)</th>

                                <th>Diesel Consumption (On Load)</th>
                                <th>Diesel Consumption (No Load)</th>
                                <th>Total Diesel Consumption (Ltrs)</th>

                                <th>CPH</th>
                                <th>KWH / Ltrs</th>
                                <th>OEM CPH</th>
                                <th>Gap (X-V)</th>
                                <th>CPH Status</th>
                                <th>OEM CPH (With Margin)</th>
                                <th>Gap (With Margin)</th>
                                <th>RCA on High CPH</th>
                                <th>Remarks</th>
                                <th>PF</th>
                                <th>DG Run Incidents (On Load)</th>
                                <th>DG Run Incidents (No Load)</th>
                            </tr>
                        </thead>

                        <tbody>
                            {monthlyCPHvsRunHrs.map((row, index) => (
                                <tr key={index}>
                                    <td>{row.sno}</td>
                                    <td>{row.hub}</td>
                                    <td>{row.circle}</td>
                                    <td>{row.siteCode}</td>
                                    <td>{row.siteName}</td>
                                    <td>{row.ownership}</td>
                                    <td>{row.address}</td>
                                    <td>{row.factory}</td>
                                    <td>{row.month}</td>
                                    <td>{row.dgNumber}</td>
                                    <td>{row.dgCapacity}</td>
                                    <td>{row.dgMfgDate}</td>
                                    <td>{(avgSiteRunningKw / (siteConfig.pf || 0.8)).toFixed(2)}</td>
                                    <td>{avgSiteRunningKw}</td>
                                    <td>{((avgSiteRunningKw / (siteConfig.dgCapacity * 0.8)) * 100).toFixed(0)}%</td>
                                    <td>{row.dgUnitsConsumed.toFixed(2)}</td>

                                    <td>{row.dgRunHrsOnLoad.toFixed(1)}</td>
                                    <td>{row.dgRunHrsNoLoad.toFixed(1)}</td>
                                    <td>{row.dgTotalRunHrs.toFixed(1)}</td>

                                    <td>{row.dieselPurchased}</td>
                                    <td>{row.dieselAdded}</td>

                                    <td>{row.dieselConsumedOnLoad}</td>
                                    <td>{row.dieselConsumedNoLoad}</td>
                                    <td>{row.totalDieselConsumed}</td>

                                    <td>{row.cph}</td>
                                    <td>{row.kwhPerLtr}</td>
                                    <td>{row.oemCph}</td>
                                    <td>{row.gapXV}</td>

                                    <td
                                        style={{
                                            color: row.cphStatus === "High" ? "red" : "green",
                                            fontWeight: "bold",
                                        }}
                                    >
                                        {row.cphStatus}
                                    </td>

                                    <td>{row.oemCphWithMargin}</td>
                                    <td>{row.gapXVWithMargin}</td>
                                    <td>{row.rcaHighCph}</td>
                                    <td>{row.remarks}</td>
                                    <td>{row.pf}</td>
                                    <td>{row.dgRunIncidentsOnLoad}</td>
                                    <td>{row.dgRunIncidentsNoLoad}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
