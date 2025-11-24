import React, { useEffect, useState } from "react";
import { collectionGroup, getDocs, getDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import "../assets/DailyDGLog.css"; // reuse your log CSS
import { useNavigate, useLocation } from "react-router-dom";
import { calculateFields } from '../utils/calculatedDGLogs';
import * as XLSX from "xlsx";


// Optional: Assume userData comes as prop/context for security
const AllSitesDGLogs = ({ userData }) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const navigate = useNavigate();
    const location = useLocation();
    const [siteConfigs, setSiteConfigs] = useState({});
    const { monthKey } = location.state; // default month
    // You need to provide correct siteConfig for each site (dgCount, ebCount, solarCount)
    const calculatedLogs = logs.map(log => calculateFields(log, siteConfigs[log.site.toUpperCase()] || {}));
    const [popupSite, setPopupSite] = useState(null);


    const groupedLogs = logs.reduce((groups, log, idx) => {
        const siteKey = (log.site || "Unknown Site").toUpperCase();
        if (!groups[siteKey]) groups[siteKey] = [];
        groups[siteKey].push({ ...log, __calc: calculatedLogs[idx] });
        return groups;
    }, {});

    function getMonthlySummary(siteLogs, siteConfig) {
        if (!siteLogs.length) return {};

        // Per-site calculated logs
        const calculated = siteLogs.map(e => calculateFields(e, siteConfig));

        // Helper functions – you can enhance formatting later
        const avg = arr => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
        const sum = arr => arr.reduce((a, b) => a + b, 0);

        // Monthly averages
        const cphValues = calculated.flatMap(cl => [
            cl["DG-1 CPH"], cl["DG-2 CPH"]
        ]).filter(v => v > 0);
        const monthlyAvgCPH = avg(cphValues);

        const monthlyAvgITLoad = avg(calculated.map(cl => cl["Total IT Load KWH"]).filter(v => v > 0));
        const monthlyAvgCoolingLoad = avg(calculated.map(cl => cl["Cooling kW Consumption"]).filter(v => v > 0));
        const monthlyAvgOfficeLoad = avg(calculated.map(cl => cl["Office kW Consumption"]).filter(v => v > 0)) / 24;

        // Totals
        const totalKwh = sum(calculated.map(cl => cl["Total DG KWH"] || 0));
        const totalFuel = sum(calculated.map(cl => cl["Total DG Fuel"] || 0));
        const totalHrs = sum(calculated.map(cl => cl["Total DG Hours"] || 0));
        const totalFilling = sum(calculated.map(cl => cl["Total Fuel Filling"] || 0));
        const totalDG1Kw = sum(calculated.map(cl => cl["DG-1 KWH Generation"] || 0));
        const totalDG2Kw = sum(calculated.map(cl => cl["DG-2 KWH Generation"] || 0));
        const totalDG1Filling = sum(calculated.map(cl => cl["DG-1 Fuel Filling"] || 0));
        const totalDG2Filling = sum(calculated.map(cl => cl["DG-2 Fuel Filling"] || 0));
        const totalOnLoadCon = sum(calculated.map(cl => (cl["DG-1 ON Load Consumption"] || 0) + (cl["DG-2 ON Load Consumption"] || 0)));
        const totalDG1OnLoadCon = sum(calculated.map(cl => cl["DG-1 ON Load Consumption"] || 0));
        const totalDG2OnLoadCon = sum(calculated.map(cl => cl["DG-2 ON Load Consumption"] || 0));
        const totalOffLoadCon = sum(calculated.map(cl => (cl["DG-1 OFF Load Consumption"] || 0) + (cl["DG-2 OFF Load Consumption"] || 0)));
        const totalDG1OffLoadCon = sum(calculated.map(cl => cl["DG-1 OFF Load Consumption"] || 0));
        const totalDG2OffLoadCon = sum(calculated.map(cl => cl["DG-2 OFF Load Consumption"] || 0));

        // For backup/fuel bars
        const tankCapacity = Number(siteConfig.dgDayTankCapacity || 0) + Number(siteConfig.dgExtrnlTankCapacity || 0);

        // Add more fields here as needed! You can add any stat from your previous advanced summary.

        return {
            totalDays: siteLogs.length,
            monthlyAvgCPH,
            monthlyAvgITLoad,
            monthlyAvgCoolingLoad,
            monthlyAvgOfficeLoad,
            totalKwh,
            totalFuel,
            totalHrs,
            totalFilling,
            totalDG1Kw,
            totalDG2Kw,
            totalDG1Filling,
            totalDG2Filling,
            totalOnLoadCon,
            totalOffLoadCon,
            totalDG1OnLoadCon,
            totalDG2OnLoadCon,
            totalDG1OffLoadCon,
            totalDG2OffLoadCon,
            tankCapacity
            // plus any other fields you want! Just add their calcs here.
        };
    }


    // Excel export function
    function exportSiteToExcel(siteKey, siteLogs, thisConfig) {
        if (!siteLogs.length || !thisConfig) return;

        // Build dynamic headers based on thisConfig
        const headers = [
            "Location Name",
            "Site ID",
            "Date",
            // DG columns
            ...[...Array(Number(thisConfig.dgCount) || 0)].flatMap((_, i) => [
                `DG-${i + 1} OPENING KWH`,
                `DG-${i + 1} CLOSING KWH`,
                `DG-${i + 1} KWH Generation`
            ]),
            // EB columns
            ...[...Array(Number(thisConfig.ebCount) || 0)].flatMap((_, i) => [
                `EB-${i + 1} OPENING KWH`,
                `EB-${i + 1} CLOSING KWH`,
                `EB-${i + 1} KWH Generation`
            ]),
            // Solar columns
            ...[...Array(Number(thisConfig.solarCount) || 0)].flatMap((_, i) => [
                `Solar-${i + 1} OPENING KWH`,
                `Solar-${i + 1} CLOSING KWH`,
                `Solar-${i + 1} KWH Generation`
            ]),
            // DG details
            ...[...Array(Number(thisConfig.dgCount) || 0)].flatMap((_, i) => [
                `DG-${i + 1} Run Min`,
                `DG-${i + 1} Fuel Opening`,
                `DG-${i + 1} Fuel Closing`,
                `DG-${i + 1} Fuel Filling`,
                `DG-${i + 1} ON Load Consumption`,
                `DG-${i + 1} OFF Load Consumption`,
                `DG-${i + 1} Fuel Consumption`,
                `DG-${i + 1} Hour Opening`,
                `DG-${i + 1} Hour Closing`,
                `DG-${i + 1} ON Load Hour`,
                `DG-${i + 1} OFF Load Hour`,
                `DG-${i + 1} Running Hrs`,
                `DG-${i + 1} CPH`,
                `DG-${i + 1} SEGR`
            ]),
            // Totals
            "Total DG KWH Generation",
            "Total EB KWH Reading",
            "Total KWH Consumption (EB+DG)",
            "Total Fuel Consumption",
            "Total DG Run Hours",
            "Site Running (kWh)",
            "Cooling Load (kWh)",
            "DCPS Load (Amps)",
            "UPS Load (kWh)",
            "Total IT Load (kWh)",
            "Office Load (kW)",
            "PUE",
            "Entered By"
        ];

        // Build rows with dynamic data
        const rows = siteLogs.map(log => {
            const calc = log.__calc;
            const rowData = {
                "Location Name": thisConfig.siteName,
                "Site ID": thisConfig.siteId,
                "Date": log.Date
            };

            // DG KWH data
            for (let i = 1; i <= (thisConfig.dgCount || 0); i++) {
                rowData[`DG-${i} OPENING KWH`] = Number(calc[`DG-${i} KWH Opening`] || 0).toFixed(2);
                rowData[`DG-${i} CLOSING KWH`] = Number(calc[`DG-${i} KWH Closing`] || 0).toFixed(2);
                rowData[`DG-${i} KWH Generation`] = Number(calc[`DG-${i} KWH Generation`] || 0).toFixed(2);
            }

            // EB KWH data
            for (let i = 1; i <= (thisConfig.ebCount || 0); i++) {
                rowData[`EB-${i} OPENING KWH`] = Number(calc[`EB-${i} KWH Opening`] || 0).toFixed(2);
                rowData[`EB-${i} CLOSING KWH`] = Number(calc[`EB-${i} KWH Closing`] || 0).toFixed(2);
                rowData[`EB-${i} KWH Generation`] = Number(calc[`EB-${i} KWH Generation`] || 0).toFixed(2);
            }

            // Solar KWH data
            for (let i = 1; i <= (thisConfig.solarCount || 0); i++) {
                rowData[`Solar-${i} OPENING KWH`] = Number(calc[`Solar-${i} KWH Opening`] || 0).toFixed(2);
                rowData[`Solar-${i} CLOSING KWH`] = Number(calc[`Solar-${i} KWH Closing`] || 0).toFixed(2);
                rowData[`Solar-${i} KWH Generation`] = Number(calc[`Solar-${i} KWH Generation`] || 0).toFixed(2);
            }

            // DG details (Fuel, Hours, etc.)
            for (let i = 1; i <= (thisConfig.dgCount || 0); i++) {
                rowData[`DG-${i} Run Min`] = Number(calc[`DG-${i} Run Min`] || 0).toFixed(2);
                rowData[`DG-${i} Fuel Opening`] = Number(calc[`DG-${i} Fuel Opening`] || 0).toFixed(2);
                rowData[`DG-${i} Fuel Closing`] = Number(calc[`DG-${i} Fuel Closing`] || 0).toFixed(2);
                rowData[`DG-${i} Fuel Filling`] = Number(calc[`DG-${i} Fuel Filling`] || 0).toFixed(2);
                rowData[`DG-${i} ON Load Consumption`] = Number(calc[`DG-${i} ON Load Consumption`] || 0).toFixed(2);
                rowData[`DG-${i} OFF Load Consumption`] = Number(calc[`DG-${i} OFF Load Consumption`] || 0).toFixed(2);
                rowData[`DG-${i} Fuel Consumption`] = Number(calc[`DG-${i} Fuel Consumption`] || 0).toFixed(2);
                rowData[`DG-${i} Hour Opening`] = Number(calc[`DG-${i} Hour Opening`] || 0).toFixed(1);
                rowData[`DG-${i} Hour Closing`] = Number(calc[`DG-${i} Hour Closing`] || 0).toFixed(1);
                rowData[`DG-${i} ON Load Hour`] = Number(calc[`DG-${i} ON Load Hour`] || 0).toFixed(1);
                rowData[`DG-${i} OFF Load Hour`] = Number(calc[`DG-${i} OFF Load Hour`] || 0).toFixed(1);
                rowData[`DG-${i} Running Hrs`] = Number(calc[`DG-${i} Running Hrs`] || 0).toFixed(1);
                rowData[`DG-${i} CPH`] = Number(calc[`DG-${i} CPH`] || 0).toFixed(2);
                rowData[`DG-${i} SEGR`] = Number(calc[`DG-${i} SEGR`] || 0).toFixed(2);
            }

            // Totals
            rowData["Total DG KWH Generation"] = Number(calc["Total DG KWH"] || 0).toFixed(2);
            rowData["Total EB KWH Reading"] = Number(calc["Total EB KWH"] || 0).toFixed(2);
            rowData["Total KWH Consumption (EB+DG)"] = Number(calc["Total Unit Consumption"] || 0).toFixed(2);
            rowData["Total Fuel Consumption"] = Number(calc["Total DG Fuel"] || 0).toFixed(2);
            rowData["Total DG Run Hours"] = Number(calc["Total DG Hours"] || 0).toFixed(1);
            rowData["Site Running (kWh)"] = Number(calc["Site Running kW"] || 0).toFixed(2);
            rowData["Cooling Load (kWh)"] = Number(calc["Cooling kW Consumption"] || 0).toFixed(2);
            rowData["DCPS Load (Amps)"] = Number(calc["DCPS Load Amps"] || 0).toFixed(2);
            rowData["UPS Load (kWh)"] = Number(calc["UPS Load KWH"] || 0).toFixed(2);
            rowData["Total IT Load (kWh)"] = Number(calc["Total IT Load KWH"] || 0).toFixed(2);
            rowData["Office Load (kW)"] = Number(calc["Office kW Consumption"] || 0).toFixed(2);
            rowData["PUE"] = calc["PUE"] || "";
            rowData["Entered By"] = log["updatedBy"] || "";

            return rowData;
        });

        // Create and export Excel file
        const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Site Logs");
        XLSX.writeFile(workbook, `${siteKey}_MonthlyLogs.xlsx`);
    }



    useEffect(() => {
        // Only let Admin/Super Admin access this page!
        if (!userData || (userData.role !== "Admin" && userData.role !== "Super Admin")) {
            navigate("/"); // redirect unauthorized users
            return;
        }

        const fetchAllLogs = async () => {
            setLoading(true);
            setError("");
            try {
                const snapshot = await getDocs(collectionGroup(db, monthKey)); // get all site logs
                console.log("Fetched logs snapshot:", snapshot);
                const logsArr = [];
                snapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    // Try to get the parent (site) ID from the document path
                    const pathParts = docSnap.ref.path.split('/');
                    const siteId = pathParts.length > 1 ? pathParts[1] : "Unknown Site";
                    logsArr.push({
                        id: docSnap.id,
                        site: data.site || siteId, // fallback logic for site name/id
                        ...data,
                    });
                });
                setLogs(logsArr);
                console.log("Fetched all site logs:", logsArr);
            } catch (err) {
                setError("Error fetching logs: " + err.message);
            }
            setLoading(false);
        };

        fetchAllLogs();
    }, [userData, navigate]);

    useEffect(() => {
        // Get all unique site keys from logs (case-sensitive; match your Firestore docs)
        const allSiteKeys = [
            ...new Set(logs.map(log => (log.site || "Unknown Site").toUpperCase()))
        ];

        // Fetch missing configs
        allSiteKeys.forEach(async (siteKey) => {
            if (!siteConfigs[siteKey]) {
                const snap = await getDoc(doc(db, "siteConfigs", siteKey));
                if (snap.exists()) {
                    setSiteConfigs(prev => ({ ...prev, [siteKey]: snap.data() }));
                }
            }
        });
    }, [logs]);


    if (loading) return <div>⏳Loading all site logs…</div>;
    if (error) return <div style={{ color: "red" }}>{error}</div>;

    const getHeaderStyle = (header) => {
        if (header.startsWith("EB")) return { backgroundColor: "#294985", color: "#fff" };
        if (header.includes("Run Min")) return { backgroundColor: "#FFD700", color: "#000" };
        if (header.includes("ON Load")) return { backgroundColor: "#2E7D32", color: "#fff" };
        if (header.includes("OFF Load")) return { backgroundColor: "#F35C48", color: "#fff" };
        if (header.startsWith("DG-1")) return { backgroundColor: "#8655ac", color: "#fff" };
        if (header.startsWith("DG-2")) return { backgroundColor: "#5e87b9", color: "#fff" };
        if (header.startsWith("DG-2")) return { backgroundColor: "#5e87b9", color: "#fff" };
        if (header.startsWith("Total") || header === "PUE" || header === "Site Running kW") return { backgroundColor: "#F57C00", color: "#fff" };
        return { backgroundColor: "#FFFFFF", color: "#000" };
    };

    const fmt = (val) => (val !== undefined && val !== null ? Number(val).toFixed(2) : "0.0");
    const fmt1 = (val) => (val !== undefined && val !== null ? Number(val).toFixed(1) : "0.0");

    return (
        <div className="daily-log-container">
            <h2>All Sites DG Logs - Monthly Summary</h2>
            {Object.entries(groupedLogs).map(([site, siteLogs]) => {
                const siteKey = site.toUpperCase();
                const thisConfig = siteConfigs[siteKey];
                if (!thisConfig) return <div key={siteKey}>⏳ Loading config for {siteKey}...</div>;

                // Get monthly summary for the card (pass siteConfig each time)
                const summary = getMonthlySummary(siteLogs, thisConfig);

                // Last log for DG fuel bars (today's last log)
                const form = siteLogs[siteLogs.length - 1] || {};

                // For DG bar
                const availableFuel = (parseFloat(form["DG-1 Fuel Closing"] || 0) + parseFloat(form["DG-2 Fuel Closing"] || 0));
                const tankCapacity = summary.tankCapacity || 0;

                // Convert totalHrs to minutes
                const totalHrsMin = ((summary.totalHrs || 0) * 60).toFixed(0);

                return (
                    <div className="chart-container" key={site} onClick={() => setPopupSite(site.toUpperCase())}>
                        {/* Fuel, load, backups */}
                        <h1>{site}</h1>
                        <h1 style={{ fontSize: "20px", color: "green", textAlign: "left" }}>
                            <strong>⛽ Present Stock – {fmt(availableFuel)} ltrs</strong>
                        </h1>
                        <div style={{ display: "flex", marginTop: "10px", fontSize: "18px" }}>
                            🛢️ <div className="fuel-bar-container">
                                <div
                                    className="fuel-bar"
                                    style={{
                                        width: `${(availableFuel / tankCapacity) * 100}%`,
                                        background: `linear-gradient(to right, red, yellow, green)`
                                    }}
                                ></div>
                                <strong style={{ color: ((availableFuel / tankCapacity) * 100) < 60 ? "red" : "blue" }}>
                                    {((availableFuel / tankCapacity) * 100).toFixed(0)}%
                                </strong>
                            </div>
                        </div>
                        <p style={{ fontSize: "10px", textAlign: "left", color: "#5c3c6ece" }}>
                            Total Stock Capacity: <strong>{tankCapacity} Ltrs</strong>
                        </p>
                        {/* D/G fuel bars */}
                        <div>
                            <div style={{ display: "flex", fontSize: "10px", height: "13px" }}>
                                🛢️DG-1 :<div className="fuel-bar-container" style={{ display: "flex" }}>
                                    <p className="fuel-bar"
                                        style={{
                                            width: `${(form["DG-1 Fuel Closing"] / (tankCapacity / 2)) * 100}%`,
                                            background: `linear-gradient(to right, blue)`,
                                            color: "white", fontSize: "7px"
                                        }}>
                                        ⛽ {form["DG-1 Fuel Closing"]} ltrs
                                    </p>
                                    <p style={{ color: "black", fontSize: "4px" }}>
                                        /{tankCapacity / 2}ltrs.
                                    </p>
                                    <strong style={{ color: (((form["DG-1 Fuel Closing"] / (tankCapacity / 2)) * 100) < 60 ? "red" : "blue") }}>
                                        {((form["DG-1 Fuel Closing"] / (tankCapacity / 2)) * 100).toFixed(0)}%
                                    </strong>
                                </div>
                            </div>
                            <div style={{ display: "flex", fontSize: "10px", height: "13px" }}>
                                🛢️DG-2 :<div className="fuel-bar-container" style={{ display: "flex" }}>
                                    <p className="fuel-bar"
                                        style={{
                                            width: `${(form["DG-2 Fuel Closing"] / (tankCapacity / 2)) * 100}%`,
                                            background: `linear-gradient(to right, blue)`,
                                            color: "white", fontSize: "7px"
                                        }}>
                                        ⛽ {form["DG-2 Fuel Closing"]} ltrs
                                    </p>
                                    <p style={{ color: "black", fontSize: "4px" }}>
                                        /{tankCapacity / 2}ltrs.
                                    </p>
                                    <strong style={{ color: (((form["DG-2 Fuel Closing"] / (tankCapacity / 2)) * 100) < 60 ? "red" : "blue") }}>
                                        {((form["DG-2 Fuel Closing"] / (tankCapacity / 2)) * 100).toFixed(0)}%
                                    </strong>
                                </div>
                            </div>
                        </div>

                        <h4 style={{ borderTop: "3px solid #eee", textAlign: "center" }}>
                            📊 Summary – {summary.totalDays} Days
                        </h4>
                        {/* STAT LINES */}
                        <p>Average DG CPH – <strong>{fmt1(summary.monthlyAvgCPH)}</strong></p>
                        <p>Avg IT Load – <strong>{fmt1(summary.monthlyAvgITLoad)} kWh</strong></p>
                        <p>Avg Cooling Load – <strong>{fmt1(summary.monthlyAvgCoolingLoad)} kWh</strong></p>
                        <p>Avg Office Load – <strong>{fmt1(summary.monthlyAvgOfficeLoad)} kWh</strong></p>
                        <p>DG-1 Total KW Generation: <strong>{fmt1(summary.totalDG1Kw)}</strong></p>
                        <p>DG-2 Total KW Generation: <strong>{fmt1(summary.totalDG2Kw)}</strong></p>
                        <p>Total DG Run Hours: <strong>{fmt1(summary.totalHrs)} hours</strong> ({totalHrsMin} min)</p>
                        <p>Total DG Fuel Consumption: <strong>{fmt1(summary.totalFuel)} Ltrs</strong></p>
                        {/* Add more breakdowns, load, filling, DG-1/2 metrics, etc. from your summary if desired */}
                    </div>
                );
            })}

            {popupSite && (() => {
                const siteKey = popupSite;
                const thisConfig = siteConfigs[siteKey];
                const siteLogs = groupedLogs[siteKey];
                if (!thisConfig || !siteLogs) return null;

                return (
                    <div className="popup-bg" onClick={() => setPopupSite(null)}>
                        <div className="popup-modal" onClick={e => e.stopPropagation()}>
                            <h3 style={{ position: "sticky", left: 0 }}>{thisConfig.siteName || siteKey} - Day-wise Month Data</h3>
                            <button className="excel-btn" onClick={() => exportSiteToExcel(siteKey, siteLogs, thisConfig)}>
                                Download Excel
                            </button>
                            <button className="close-btn" onClick={() => setPopupSite(null)}>
                                &times;
                            </button>
                            <table border="1" cellPadding="8" style={{ width: "100%" }}>
                                <thead>
                                    <tr>
                                        <th style={getHeaderStyle(`Location Name`)}>{thisConfig.siteName}</th>
                                        <th style={getHeaderStyle(`Site ID`)}>{thisConfig.siteId}</th>
                                        <th className="sticky-col"
                                            style={{
                                                ...getHeaderStyle(`Date`),
                                                left: 0,
                                                zIndex: 3,
                                            }}>Date</th>
                                        {/* DG columns */}
                                        {[...Array(Number(thisConfig.dgCount) || 0)].map((_, i) => (
                                            <React.Fragment key={`dg-head-${i + 1}`}>
                                                <th style={getHeaderStyle(`DG-${i + 1} OPENING KWH`)}>{`DG-${i + 1} OPENING KWH`}</th>
                                                <th style={getHeaderStyle(`DG-${i + 1} CLOSING KWH`)}>{`DG-${i + 1} CLOSING KWH`}</th>
                                                <th style={getHeaderStyle(`DG-${i + 1} KWH Generation`)}>{`DG-${i + 1} KWH Generation`}</th>
                                            </React.Fragment>
                                        ))}
                                        {/* EB columns */}
                                        {[...Array(Number(thisConfig.ebCount) || 0)].map((_, i) => (
                                            <React.Fragment key={`eb-head-${i + 1}`}>
                                                <th style={getHeaderStyle(`EB-${i + 1} OPENING KWH`)}>{`EB-${i + 1} OPENING KWH`}</th>
                                                <th style={getHeaderStyle(`EB-${i + 1} CLOSING KWH`)}>{`EB-${i + 1} CLOSING KWH`}</th>
                                                <th style={getHeaderStyle(`EB-${i + 1} KWH Generation`)}>{`EB-${i + 1} KWH Generation`}</th>
                                            </React.Fragment>
                                        ))}
                                        {/* Solar columns */}
                                        {[...Array(Number(thisConfig.solarCount) || 0)].map((_, i) => (
                                            <React.Fragment key={`solar-head-${i + 1}`}>
                                                <th style={getHeaderStyle(`Solar-${i + 1} OPENING KWH`)}>{`Solar-${i + 1} OPENING KWH`}</th>
                                                <th style={getHeaderStyle(`Solar-${i + 1} CLOSING KWH`)}>{`Solar-${i + 1} CLOSING KWH`}</th>
                                                <th style={getHeaderStyle(`Solar-${i + 1} KWH Generation`)}>{`Solar-${i + 1} KWH Generation`}</th>
                                            </React.Fragment>
                                        ))}
                                        {/* DG common fields and details */}
                                        {[...Array(Number(thisConfig.dgCount) || 0)].map((_, i) => (
                                            <React.Fragment key={`dg-detail-head-${i + 1}`}>
                                                <th style={getHeaderStyle(`DG-${i + 1} Run Min`)}>{`DG-${i + 1} Run Min`}</th>
                                                <th style={getHeaderStyle(`DG-${i + 1} Fuel Opening`)}>{`DG-${i + 1} Fuel Opening`}</th>
                                                <th style={getHeaderStyle(`DG-${i + 1} Fuel Closing`)}>{`DG-${i + 1} Fuel Closing`}</th>
                                                <th style={getHeaderStyle(`DG-${i + 1} Fuel Filling`)}>{`DG-${i + 1} Fuel Filling`}</th>
                                                <th style={getHeaderStyle(`DG-${i + 1} ON Load Consumption`)}>{`DG-${i + 1} ON Load Consumption`}</th>
                                                <th style={getHeaderStyle(`DG-${i + 1} OFF Load Consumption`)}>{`DG-${i + 1} OFF Load Consumption`}</th>
                                                <th style={getHeaderStyle(`DG-${i + 1} Fuel Consumption`)}>{`DG-${i + 1} Fuel Consumption`}</th>
                                                <th style={getHeaderStyle(`DG-${i + 1} Hour Opening`)}>{`DG-${i + 1} Hour Opening`}</th>
                                                <th style={getHeaderStyle(`DG-${i + 1} Hour Closing`)}>{`DG-${i + 1} Hour Closing`}</th>
                                                <th style={getHeaderStyle(`DG-${i + 1} ON Load Hour`)}>{`DG-${i + 1} ON Load Hour`}</th>
                                                <th style={getHeaderStyle(`DG-${i + 1} OFF Load Hour`)}>{`DG-${i + 1} OFF Load Hour`}</th>
                                                <th style={getHeaderStyle(`DG-${i + 1} Running Hrs`)}>{`DG-${i + 1} Running Hrs`}</th>
                                                <th style={getHeaderStyle(`DG-${i + 1} CPH`)}>{`DG-${i + 1} CPH`}</th>
                                                <th style={getHeaderStyle(`DG-${i + 1} SEGR`)}>{`DG-${i + 1} SEGR`}</th>
                                            </React.Fragment>
                                        ))}
                                        {/* Totals */}
                                        <th style={getHeaderStyle(`Total DG KWH Generation`)}>Total DG KWH Generation</th>
                                        <th style={getHeaderStyle(`Total EB KWH Reading`)}>Total EB KWH Reading</th>
                                        <th style={getHeaderStyle(`Total KWH Consumption (EB+DG)`)}>Total KWH Consumption (EB+DG)</th>
                                        <th style={getHeaderStyle(`Total Fuel Consumption`)}>Total Fuel Consumption</th>
                                        <th style={getHeaderStyle(`Total DG Run Hours`)}>Total DG Run Hours</th>
                                        <th style={getHeaderStyle(`Site Running kW`)}>Site Running (kWh)</th>
                                        <th style={getHeaderStyle(`Site Running kW`)}>Cooling Load (kWh)</th>
                                        <th style={getHeaderStyle(`DCPS Load Amps`)}>DCPS Load (Amps)</th>
                                        <th style={getHeaderStyle(`UPS Load (kWh)`)}>UPS Load (kWh)</th>
                                        <th style={getHeaderStyle(`Total IT Load (kWh)`)}>Total IT Load (kWh)</th>
                                        <th style={getHeaderStyle(`Office Load (kW)`)}>Office Load (kW)</th>
                                        <th style={getHeaderStyle(`PUE`)}>PUE</th>
                                        {(userData?.role === "Super Admin" || userData?.role === "Admin" || userData?.role === "Super User" ||
                                            userData?.designation === "Vertiv Site Infra Engineer" || userData?.designation === "Vertiv Supervisor" ||
                                            userData?.designation === "Vertiv CIH" || userData?.designation === "Vertiv ZM") && (
                                                <th>Actions</th>
                                            )}
                                        <th>ℹ️</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {siteLogs.map((log, rowIndex) => {
                                        const calculated = log.__calc;
                                        const showSiteInfo = rowIndex === 0;
                                        let rowClass = "";
                                        for (let i = 1; i <= (thisConfig.dgCount || 0); i++) {
                                            const cph = calculated[`DG-${i} CPH`];
                                            const segr = calculated[`DG-${i} SEGR`];
                                            const offLoadCon = calculated[`DG-${i} OFF Load Consumption`];
                                            const offLoadHr = calculated[`DG-${i} OFF Load Hour`];
                                            if (cph > 100 || cph < 80) rowClass = "row-inefficient";
                                            else if (segr < 3 && segr > 0) rowClass = "row-warning";
                                            else if (offLoadCon > 0 && offLoadHr > 0) rowClass = "row-offload";
                                        }

                                        return (
                                            <tr key={log.id} className={rowClass}>
                                                {showSiteInfo && (
                                                    <>
                                                        <td rowSpan={siteLogs.length} style={{ textAlign: "center", verticalAlign: "middle", fontWeight: "bold", transform: "rotate(270deg)" }}>
                                                            {thisConfig.siteName}
                                                        </td>
                                                        <td rowSpan={siteLogs.length} style={{ textAlign: "center", verticalAlign: "middle", fontWeight: "bold", transform: "rotate(270deg)", whiteSpace: "nowrap" }}>
                                                            {thisConfig.siteId}
                                                        </td>
                                                    </>
                                                )}
                                                <td className="sticky-col" style={{ left: 0, zIndex: 2, background: "linear-gradient(to right, lightgray)" }}>{log.Date}</td>
                                                {/* DG columns */}
                                                {[...Array(Number(thisConfig.dgCount) || 0)].map((_, i) => (
                                                    <React.Fragment key={`dg-kwh-${i + 1}`}>
                                                        <td>{fmt(calculated[`DG-${i + 1} KWH Opening`])}</td>
                                                        <td>{fmt(calculated[`DG-${i + 1} KWH Closing`])}</td>
                                                        <td>{fmt(calculated[`DG-${i + 1} KWH Generation`])}</td>
                                                    </React.Fragment>
                                                ))}
                                                {/* EB columns */}
                                                {[...Array(Number(thisConfig.ebCount) || 0)].map((_, i) => (
                                                    <React.Fragment key={`eb-kwh-${i + 1}`}>
                                                        <td>{fmt(calculated[`EB-${i + 1} KWH Opening`])}</td>
                                                        <td>{fmt(calculated[`EB-${i + 1} KWH Closing`])}</td>
                                                        <td>{fmt(calculated[`EB-${i + 1} KWH Generation`])}</td>
                                                    </React.Fragment>
                                                ))}
                                                {/* Solar columns */}
                                                {[...Array(Number(thisConfig.solarCount) || 0)].map((_, i) => (
                                                    <React.Fragment key={`solar-kwh-${i + 1}`}>
                                                        <td>{fmt(calculated[`Solar-${i + 1} KWH Opening`])}</td>
                                                        <td>{fmt(calculated[`Solar-${i + 1} KWH Closing`])}</td>
                                                        <td>{fmt(calculated[`Solar-${i + 1} KWH Generation`])}</td>
                                                    </React.Fragment>
                                                ))}
                                                {/* DG details */}
                                                {[...Array(Number(thisConfig.dgCount) || 0)].map((_, i) => (
                                                    <React.Fragment key={`dg-detail-${i + 1}`}>
                                                        <td>{fmt(calculated[`DG-${i + 1} Run Min`])}</td>
                                                        <td>{fmt(calculated[`DG-${i + 1} Fuel Opening`])}</td>
                                                        <td>{fmt(calculated[`DG-${i + 1} Fuel Closing`])}</td>
                                                        <td>{fmt(calculated[`DG-${i + 1} Fuel Filling`])}</td>
                                                        <td>{fmt(calculated[`DG-${i + 1} ON Load Consumption`])}</td>
                                                        <td>{fmt(calculated[`DG-${i + 1} OFF Load Consumption`])}</td>
                                                        <td>{fmt(calculated[`DG-${i + 1} Fuel Consumption`])}</td>
                                                        <td>{fmt1(calculated[`DG-${i + 1} Hour Opening`])}</td>
                                                        <td>{fmt1(calculated[`DG-${i + 1} Hour Closing`])}</td>
                                                        <td>{fmt1(calculated[`DG-${i + 1} ON Load Hour`])}</td>
                                                        <td>{fmt1(calculated[`DG-${i + 1} OFF Load Hour`])}</td>
                                                        <td>{fmt1(calculated[`DG-${i + 1} Running Hrs`])}</td>
                                                        <td>{fmt(calculated[`DG-${i + 1} CPH`])}</td>
                                                        <td>{fmt(calculated[`DG-${i + 1} SEGR`])}</td>
                                                    </React.Fragment>
                                                ))}
                                                {/* Totals */}
                                                <td>{fmt(calculated["Total DG KWH"])}</td>
                                                <td>{fmt(calculated["Total EB KWH"])}</td>
                                                <td>{fmt(calculated["Total Unit Consumption"])}</td>
                                                <td>{fmt(calculated["Total DG Fuel"])}</td>
                                                <td>{fmt1(calculated["Total DG Hours"])}</td>
                                                <td>{fmt(calculated["Site Running kW"])}</td>
                                                <td>{fmt(calculated["Cooling kW Consumption"])}</td>
                                                <td>{fmt(calculated["DCPS Load Amps"])}</td>
                                                <td>{fmt(calculated["UPS Load KWH"])}</td>
                                                <td>{fmt(calculated["Total IT Load KWH"])}</td>
                                                <td>{fmt(calculated["Office kW Consumption"])}</td>
                                                <td>{fmt(calculated["PUE"])}</td>
                                                {/* Actions */}
                                                {/* {(userData?.role === "Super Admin" || userData?.role === "Admin" || userData?.role === "Super User" ||
                                                    userData?.designation === "Vertiv Site Infra Engineer" || userData?.designation === "Vertiv Supervisor" ||
                                                    userData?.designation === "Vertiv CIH" || userData?.designation === "Vertiv ZM") && (
                                                        <td style={{ whiteSpace: "nowrap" }}>
                                                            {calculated["Total Fuel Filling"] > 0 && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleGenerateCCMS(log); }}
                                                                    style={{ background: "#3f5c4193", color: "#49e60bb9" }}
                                                                >
                                                                    CCMS
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleDelete(log.id); }}
                                                                style={{ background: "#5c3f3f93", color: "#e60b0bef" }}
                                                            >
                                                                X
                                                            </button>
                                                        </td>
                                                    )} */}
                                                <td>ℹ️</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            <p style={{ fontSize: "12px" }}><strong>ℹ️</strong> <strong>🔴</strong>Check <strong>"CPH"</strong> | <strong>⚠️</strong>Check <strong>"SEGR"</strong> | <strong style={{ background: "red" }}>"ROW"</strong> For Test Run</p>
                        </div>
                    </div>
                );
            })()}

        </div>
    );


};

export default AllSitesDGLogs;
