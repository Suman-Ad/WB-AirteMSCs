// src/pages/MonthlyData.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import XLSX from "xlsx-js-style";

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
    const { logs, siteConfig } = state || {};
    const [monthDate, setMonthDate] = useState(() => {
        // default to selectedMonth used in DailyDGLog or today
        return new Date(); // override with your selectedMonth if available
    });
    // const [logs, setLogs] = useState([]); // raw daily docs for the site/month
    const [loading, setLoading] = useState(false);
    const [previewGrid, setPreviewGrid] = useState(null);
    const navigate = useNavigate();

    // derive days of month
    const days = useMemo(() => getDaysInMonthArray(monthDate), [monthDate]);

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

    // useEffect(() => {
    //     // fetch logs for selected site/month on mount or month change
    //     const fetchLogs = async () => {
    //         setLoading(true);
    //         try {
    //             // You probably store dailyDGLogs under collection(db, 'dailyDGLogs', siteKey, monthKey)
    //             const siteKey = (userData?.site);
    //             const monthKey = monthKeyFromDate(monthDate); // e.g. "sep-2025"
    //             // adjust path/query as per your data organization
    //             const q = query(collection(db, "dailyDGLogs", siteKey, monthKey));
    //             const snap = await getDocs(q);
    //             const docs = [];
    //             snap.forEach((d) => {
    //                 docs.push({ id: d.id, ...d.data() });
    //             });
    //             // sort by Date (if you store Date as string or timestamp adapt accordingly)
    //             docs.sort((a, b) => {
    //                 const da = new Date(a.Date), dbt = new Date(b.Date);
    //                 return da - dbt;
    //             });
    //             setLogs(docs);
    //         } catch (err) {
    //             console.error("fetch monthly logs error", err);
    //         } finally {
    //             setLoading(false);
    //         }
    //     };

    //     fetchLogs();
    // }, [monthDate, userData]);

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
        summary["PUE"] = fmt1(
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
            <h2>Monthly Energy Outlook Data — {siteConfig?.siteName}</h2>

            <div style={{ marginBottom: 12 }}>

                <button onClick={() => { /* reload triggered by state change anyway */ }}>Generate</button>
                <button onClick={handleDownloadExcel} style={{ marginLeft: 8 }}>
                    Download Excel (Styled)
                </button>
                {/* <button onClick={() => navigate(-1)} style={{ marginLeft: 8 }}>← Back</button> */}
            </div>

            {previewGrid?.summaryRows && (
                <div style={{ marginTop: "20px" }}>
                    <h3>Monthly Summary</h3>
                    <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", minWidth: "300px" }}>
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

            {loading && <div>Loading logs...</div>}

            {!loading && previewGrid && (
                <div style={{ overflowX: "auto", whiteSpace: "nowrap" }}>
                    <table border="1" cellPadding="6" style={{ borderCollapse: "collapse" }}>
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

            {!loading && !previewGrid && <div>No data found for this month.</div>}

        </div>
    );
}
