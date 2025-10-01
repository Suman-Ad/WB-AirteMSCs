import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { db } from "../firebase";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";

// NEW: This function gets all live run data for the current day for one DG
const fetchLiveDGData = async (site, monthKey, dateKey, dgNumber) => {
    try {
        const runsRef = collection(db, "dgLogs", site, monthKey, dateKey, "runs");
        const q = query(runsRef, where("dgNumber", "==", dgNumber));
        const snap = await getDocs(q);

        if (snap.empty) {
            return { latestHourMeter: 0, totalFuelConsumed: 0 };
        }

        let latestHourMeter = 0;
        let totalFuelConsumed = 0;

        snap.docs.forEach(doc => {
            const run = doc.data();
            const endMeter = Number(run.hrMeterEnd || 0);
            const consumption = Number(run.fuelConsumption || 0);

            if (endMeter > latestHourMeter) {
                latestHourMeter = endMeter;
            }
            totalFuelConsumed += consumption;
        });

        return { latestHourMeter, totalFuelConsumed };

    } catch (err) {
        console.error(`Error fetching live data for ${dgNumber}:`, err);
        return { latestHourMeter: 0, totalFuelConsumed: 0 };
    }
};

const getFormattedDate = () => {
    const d = new Date();
    return d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "2-digit",
    });
};

const FuelRequisition = () => {
    const { state } = useLocation();
    const { logs, siteName, avgSiteRunningKw, fuelRate, userData, siteConfig } = state || {};

    const [rows, setRows] = useState([]);
    const Navigate = useNavigate();

    // 🔹 Auto calculations (like Excel)
    const calculateFields = (data) => {
        const result = { ...data };

        // DG Calculations
        for (let i = 1; i <= 2; i++) {
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
        for (let i = 1; i <= 2; i++) {
            const ebOpen = parseFloat(result[`EB-${i} KWH Opening`]) || 0;
            const ebClose = parseFloat(result[`EB-${i} KWH Closing`]) || 0;
            result[`EB-${i} KWH Generation`] = ebClose - ebOpen;
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
            (result["DG-2 KWH Generation"] || 0);

        result["Total EB KWH"] =
            (result["EB-1 KWH Generation"] || 0) +
            (result["EB-2 KWH Generation"] || 0);

        result["Total DG Fuel"] =
            (result["DG-1 Fuel Consumption"] || 0) +
            (result["DG-2 Fuel Consumption"] || 0);

        result["Total DG Hours"] =
            (result["DG-1 Running Hrs"] || 0) +
            (result["DG-2 Running Hrs"] || 0);

        result["Total Unit Consumption"] =
            (result["DG-1 KWH Generation"] || 0) +
            (result["DG-2 KWH Generation"] || 0) +
            (result["EB-1 KWH Generation"] || 0) +
            (result["EB-2 KWH Generation"] || 0);

        result["Site Running kW"] =
            (result["Total Unit Consumption"] || 0) / 24;

        result["Total Fuel Filling"] =
            (result["DG-1 Fuel Filling"] || 0) +
            (result["DG-2 Fuel Filling"] || 0);

        //PUE Calculation
        result["PUE"] = result["Office kW Consumption"] > 0 ? (((result["Total Unit Consumption"] - result["Office kW Consumption"]) / 24) / result["Total IT Load KWH"]).toFixed(2) : "0.00";

        return result;
    };

    const calculatedLogs = logs.map((e) => calculateFields(e));
    // ON / OFF load Consupmtion
    const totalOnLoadCon =
        calculatedLogs.reduce(
            (sum, cl) => sum + (cl["DG-1 ON Load Consumption"] || 0) + (cl["DG-2 ON Load Consumption"] || 0),
            0
        );

    const totalOnLoadHrs =
        calculatedLogs.reduce(
            (sum, cl) => sum + (cl["DG-1 ON Load Hour"] || 0) + (cl["DG-2 ON Load Hour"] || 0),
            0
        );

    const cph = totalOnLoadHrs > 0 ? (totalOnLoadCon / totalOnLoadHrs).toFixed(2) : "0.00";

    // const siteRunningKwValues = calculatedLogs
    //     .map(cl => cl["Site Running kW"])
    //     .filter(v => v > 0);
    // const avgSiteRunningKw =
    //     siteRunningKwValues.length > 0
    //         ? (siteRunningKwValues.reduce((sum, v) => sum + v, 0) / siteRunningKwValues.length).toFixed(2)
    //         : 0;

    useEffect(() => {
        if (!logs || !logs.length || !userData) return;

        const loadRequisition = async () => {
            const today = new Date();
            const todayKey = today.toISOString().split("T")[0];
            const monthKey =
                today.toLocaleString("en-US", { month: "short" }) +
                "-" +
                today.getFullYear();

            // This remains the same: it gets the last SAVED daily log
            const latestDaily = [...logs].sort((a, b) =>
                a.Date < b.Date ? 1 : -1
            )[0];

            // This also remains the same: it finds the last filling event
            const lastFilling = [...logs]
                .map((e) => ({
                    Date: e.Date,
                    DG1: parseFloat(e["DG-1 Fuel Filling"] || 0),
                    DG2: parseFloat(e["DG-2 Fuel Filling"] || 0),
                    DG1Hrs: parseFloat(e["DG-1 Hour Closing"] || 0),
                    DG2Hrs: parseFloat(e["DG-2 Hour Closing"] || 0),
                }))
                .filter((e) => e.DG1 > 0 || e.DG2 > 0)
                .sort((a, b) => (a.Date < b.Date ? 1 : -1))[0] || {}; // Add || {} to prevent errors if no filling found

            // ✅ NEW: Fetch live data for BOTH DGs for today
            const dg1LiveData = await fetchLiveDGData(userData.site, monthKey, todayKey, "DG-1");
            const dg2LiveData = await fetchLiveDGData(userData.site, monthKey, todayKey, "DG-2");

            // ✅ NEW: Calculate present stock based on live consumption
            // It starts with the last saved closing fuel and subtracts today's total consumption
            const dg1OpeningStock = Number(latestDaily?.["DG-1 Fuel Closing"] || 0);
            const dg1PresentStock = dg1OpeningStock - dg1LiveData.totalFuelConsumed;

            const dg2OpeningStock = Number(latestDaily?.["DG-2 Fuel Closing"] || 0);
            const dg2PresentStock = dg2OpeningStock - dg2LiveData.totalFuelConsumed;

            const requisitionRows = [
                {
                    Circle: "WB",
                    "Site Name": siteName,
                    "Site Infra Manager": "Suman Mondal", // Consider making this dynamic from userData
                    "DG Capacity": "1010 kVA",
                    "DG load": `${avgSiteRunningKw || 0}kW`,
                    "OEM Tested CPH": siteConfig.designCph?.["DG-1"],
                    "Last Filling Date": lastFilling?.Date || "N/A",
                    "Last Filling Liters": lastFilling.DG1 || 0,
                    "Dg Run Hour in Last Filling": lastFilling.DG1Hrs || 0,
                    "Last CPH Achieved": cph || 0,
                    "DG Run Hour Reading": dg1LiveData.latestHourMeter || latestDaily?.["DG-1 Hour Closing"],
                    "Previous DG run Hrs": lastFilling.DG1Hrs || 0,
                    "Present DG run Hrs": dg1LiveData.latestHourMeter || latestDaily?.["DG-1 Hour Closing"], // ✅ Correct: Using live data
                    "Present Diesel stock": dg1PresentStock, // ✅ Correct: Using live calculation
                    "Request Date": getFormattedDate(),
                    "Requested Liters": 1090 - dg1PresentStock,
                    "Requested Amount": ((1090 - dg1PresentStock) * fuelRate).toFixed(2), // Consider making rate dynamic
                    "Approval by CIH Date": "",
                    "Vehicle No.": "",
                },
                {
                    Circle: "WB",
                    "Site Name": siteName,
                    "Site Infra Manager": "Suman Mondal",
                    "DG Capacity": "1010 kVA",
                    "DG load": `${avgSiteRunningKw || 0}kW`,
                    "OEM Tested CPH": siteConfig.designCph?.["DG-2"],
                    "Last Filling Date": lastFilling?.Date || "N/A",
                    "Last Filling Liters": lastFilling.DG2 || 0,
                    "Dg Run Hour in Last Filling": lastFilling.DG2Hrs || 0,
                    "Last CPH Achieved": cph || 0,
                    "DG Run Hour Reading": dg2LiveData.latestHourMeter || latestDaily?.["DG-2 Hour Closing"],
                    "Previous DG run Hrs": lastFilling.DG2Hrs || 0,
                    "Present DG run Hrs": dg2LiveData.latestHourMeter || latestDaily?.["DG-2 Hour Closing"], // ✅ Correct: Using live data
                    "Present Diesel stock": dg2PresentStock, // ✅ Correct: Using live calculation
                    "Request Date": getFormattedDate(),
                    "Requested Liters": 1090 - dg2PresentStock,
                    "Requested Amount": ((1090 - dg2PresentStock) * fuelRate).toFixed(2), // Consider making rate dynamic
                    "Approval by CIH Date": "",
                    "Vehicle No.": "",
                },
            ];

            setRows(requisitionRows);
        };

        loadRequisition();
    }, [logs, siteName, userData, avgSiteRunningKw, cph]); // Dependencies remain the same


    // const handleEdit = (i, field, value) => {
    //     setRows((prev) =>
    //         prev.map((r, idx) => (i === idx ? { ...r, [field]: value } : r))
    //     );
    // };

    const handleDownloadExcel = () => {
        if (!rows.length) return;
        const cols = Object.keys(rows[0]);
        const headerText = `Diesel Request Format-${getFormattedDate()}`;
        const aoa = [
            [headerText],
            [],
            cols,
            ...rows.map((r) => cols.map((c) => r[c])),
        ];
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Diesel Request");
        XLSX.writeFile(
            wb,
            `Diesel_Request_${siteName}_${getFormattedDate()}.xlsx`
        );
    };

    return (
        <div className="daily-log-container">
            <h2>⛽ Fuel Requisition Preview</h2>
            {/* <button onClick={() => Navigate(-1)}>⬅ Back</button> */}
            <button onClick={handleDownloadExcel}>⬇️ Download Excel</button>

            {!rows.length ? (
                <p>No requisition data available</p>
            ) : (
                <div className="table-container">
                    <table border="1" cellPadding="5" style={{ marginTop: "20px" }}>
                        <thead>
                            <tr>
                                {Object.keys(rows[0]).map((k) => (
                                    <th key={k}>{k}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, i) => (
                                <tr key={i}>
                                    {Object.entries(row).map(([k, v]) => (
                                        <td key={k}> {v}
                                            {/* <input
                                                value={v}
                                                onChange={(e) => handleEdit(i, k, e.target.value)}
                                            /> */}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default FuelRequisition;
