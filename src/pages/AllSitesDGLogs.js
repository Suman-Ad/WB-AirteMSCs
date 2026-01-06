import React, { useEffect, useState } from "react";
import { collectionGroup, getDocs, getDoc, doc, collection } from "firebase/firestore";
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
    const [fuelRates, setFuelRates] = useState({});
    const [ebRate, setEbRate] = useState({});
    const { monthKey } = location.state; // default month
    // You need to provide correct siteConfig for each site (dgCount, ebCount, solarCount)
    const calculatedLogs = logs.map(log => calculateFields(log, siteConfigs[log.site.toUpperCase()] || {}));
    const [popupSite, setPopupSite] = useState(null);
    const [sitePowerStatus, setSitePowerStatus] = useState({});
    const [loadingPower, setLoadingPower] = useState(true);
    const [showOnlyDG, setShowOnlyDG] = useState(false);
    const [dgLogs, setDgLogs] = useState([]);
    const todayKey = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const todayDGLogs = dgLogs.filter(
        log => log.date === todayKey
    );

    const normalizeSiteId = (raw) => {
        if (!raw) return "";
        const lower = raw.toLowerCase();     // "asansol"
        return lower.charAt(0).toUpperCase() + lower.slice(1); // "Asansol"
    };

    const normalizeMonthKey = (isoMonth) => {
        if (!isoMonth || !isoMonth.includes('-')) return isoMonth;

        const [year, month] = isoMonth.split('-');
        const monthNames = [
            '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ];

        return `${monthNames[parseInt(month)]}-${year}`;
    };


    const fetchDgLogs = async () => {
        try {
            const logs = [];

            const siteSnap = await getDocs(collection(db, "siteConfigs"));

            for (const siteDoc of siteSnap.docs) {
                const site = normalizeSiteId(siteDoc.id);
                const normalizedMonthKey = normalizeMonthKey(monthKey);

                const monthRef = collection(db, "dgLogs", site, normalizedMonthKey);
                const monthSnap = await getDocs(monthRef);

                for (const dateDoc of monthSnap.docs) {
                    const date = dateDoc.id;

                    const runsRef = collection(
                        db,
                        "dgLogs",
                        site,
                        normalizedMonthKey,
                        date,
                        "runs"
                    );

                    const runsSnap = await getDocs(runsRef);

                    runsSnap.forEach((runDoc) => {
                        logs.push({
                            id: runDoc.id,
                            site,
                            date,
                            ...runDoc.data(),
                        });
                    });
                }
            }

            setDgLogs(logs);
            console.log("✅ dgLogs fetched:", logs);

        } catch (err) {
            console.error("dgLogs fetch error:", err);
        }
    };

    useEffect(() => {
        if (!monthKey) return;

        fetchDgLogs();   // 👈 additional only
    }, [monthKey]);

    useEffect(() => {
        const fetchSitePowerStatus = async () => {
            try {
                const snap = await getDocs(collection(db, "sitePowerStatus"));
                const statusMap = {};

                snap.forEach((doc) => {
                    statusMap[doc.id.toUpperCase()] = doc.data();
                });

                setSitePowerStatus(statusMap);
            } catch (err) {
                console.error("Failed to fetch sitePowerStatus", err);
            } finally {
                setLoadingPower(false);
            }
        };

        fetchSitePowerStatus();
    }, []);

    const fuelConsumptionBySiteDG = todayDGLogs.reduce((acc, log) => {
        const site = log.siteName || log.site;
        const dg = log.dgNumber;
        const fuel = Number(log.fuelConsumption) || 0;

        if (!acc[site]) acc[site] = {};
        if (!acc[site][dg]) {
            acc[site][dg] = {
                fuel: 0,
                runs: [],
            };
        }

        acc[site][dg].fuel += fuel;
        acc[site][dg].runs.push({
            startTime: log.startTime,
            stopTime: log.stopTime,
            remarks: log.remarks,
            runHours: log.totalRunHours,
        });

        return acc;
    }, {});


    const groupedLogs = logs.reduce((groups, log, idx) => {
        const siteKey = (log.site || "Unknown Site").toUpperCase();
        if (!groups[siteKey]) groups[siteKey] = [];
        groups[siteKey].push({ ...log, __calc: calculatedLogs[idx] });
        return groups;
    }, {});

    const filteredSites = Object.entries(groupedLogs).filter(
        ([site]) => {
            if (!showOnlyDG) return true;
            return sitePowerStatus[site]?.powerSource === "DG";
        }
    );

    const totalSites = filteredSites.length;

    const dgSitesCount = filteredSites.filter(
        ([site]) => sitePowerStatus[site]?.powerSource === "DG"
    ).length;


    function getMonthlySummary(siteLogs, siteConfig) {
        if (!siteLogs.length) return {};

        // Calculate with correct config for each card/table row
        const calculatedLogs = siteLogs.map(e => calculateFields(e, siteConfig));

        // Averages
        const cphValues = calculatedLogs.flatMap(cl => [cl["DG-1 CPH"], cl["DG-2 CPH"]]).filter(v => v > 0);
        const monthlyAvgCPH = cphValues.length ? (cphValues.reduce((a, b) => a + b, 0) / cphValues.length).toFixed(2) : 0;

        const pueValues = calculatedLogs.flatMap(cl => Number(cl["PUE"])).filter(v => v > 0);
        const monthlyAvgPUE = pueValues.length ? (pueValues.reduce((a, b) => a + b, 0) / pueValues.length).toFixed(2) : 0;

        // SEGR Averages
        const segrValues = calculatedLogs.flatMap(cl => [Number(cl["DG-1 SEGR"]), Number(cl["DG-2 SEGR"])]).filter(v => v > 0);
        const monthlyAvgSEGR = segrValues.length ? (segrValues.reduce((a, b) => a + b, 0) / segrValues.length).toFixed(2) : 0;

        const segrValuesDG1 = calculatedLogs.flatMap(cl => Number(cl["DG-1 SEGR"])).filter(v => v > 0);
        const monthlyAvgDG1SEGR = segrValuesDG1.length ? (segrValuesDG1.reduce((a, b) => a + b, 0) / segrValuesDG1.length).toFixed(2) : 0;

        const segrValuesDG2 = calculatedLogs.flatMap(cl => Number(cl["DG-2 SEGR"])).filter(v => v > 0);
        const monthlyAvgDG2SEGR = segrValuesDG2.length ? (segrValuesDG2.reduce((a, b) => a + b, 0) / segrValuesDG2.length).toFixed(2) : 0;

        // IT Load and Cooling Load Averages
        const itLoadValues = calculatedLogs.map(cl => cl["Total IT Load KWH"]).filter(v => v > 0);
        const monthlyAvgITLoad = itLoadValues.length ? (itLoadValues.reduce((a, b) => a + b, 0) / itLoadValues.length).toFixed(2) : 0;

        const coolingLoadValues = calculatedLogs.map(cl => cl["Cooling kW Consumption"]).filter(v => v > 0);
        const monthlyAvgCoolingLoad = coolingLoadValues.length ? (coolingLoadValues.reduce((a, b) => a + b, 0) / coolingLoadValues.length).toFixed(2) : 0;

        const officeLoadValues = calculatedLogs.map(cl => cl["Office kW Consumption"]).filter(v => v > 0);
        const monthlyAvgOfficeLoad = officeLoadValues.length ? ((officeLoadValues.reduce((a, b) => a + b, 0) / officeLoadValues.length) / 24).toFixed(2) : 0;

        // Site Running Load Average
        const avgSiteRunningKw = calculatedLogs.map(cl => cl["Site Running kW"]).filter(v => v > 0);
        const totalSiteRuningLoad = avgSiteRunningKw.length ? (avgSiteRunningKw.reduce((a, b) => a + b, 0) / avgSiteRunningKw.length).toFixed(2) : 0;

        // Totals
        const totalKwh = calculatedLogs.reduce((sum, cl) => sum + (cl["Total DG KWH"] || 0), 0);
        const totalEBKWH = calculatedLogs.reduce((sum, cl) => sum + (cl["Total EB KWH"] || 0), 0);
        const totalSolarKWH = calculatedLogs.reduce((sum, cl) => sum + (cl["Total Solar KWH"] || 0), 0);
        const totalFuel = calculatedLogs.reduce((sum, cl) => sum + (cl["Total DG Fuel"] || 0), 0);
        const totalHrs = calculatedLogs.reduce((sum, cl) => sum + (cl["Total DG Hours"] || 0), 0);
        const totalFilling = calculatedLogs.reduce((sum, cl) => sum + (cl["Total Fuel Filling"] || 0), 0);

        // DG and Fuel breakdowns
        const totalDG1Kw = calculatedLogs.reduce((sum, cl) => sum + (cl["DG-1 KWH Generation"] || 0), 0);
        const totalDG2Kw = calculatedLogs.reduce((sum, cl) => sum + (cl["DG-2 KWH Generation"] || 0), 0);

        const totalDG1Filling = calculatedLogs.reduce((sum, cl) => sum + (cl["DG-1 Fuel Filling"] || 0), 0);
        const totalDG2Filling = calculatedLogs.reduce((sum, cl) => sum + (cl["DG-2 Fuel Filling"] || 0), 0);

        const totalOnLoadCon = calculatedLogs.reduce((sum, cl) =>
            sum + (cl["DG-1 ON Load Consumption"] || 0) + (cl["DG-2 ON Load Consumption"] || 0), 0);
        const totalDG1OnLoadCon = calculatedLogs.reduce((sum, cl) => sum + (cl["DG-1 ON Load Consumption"] || 0), 0);
        const totalDG2OnLoadCon = calculatedLogs.reduce((sum, cl) => sum + (cl["DG-2 ON Load Consumption"] || 0), 0);

        const totalOffLoadCon = calculatedLogs.reduce((sum, cl) =>
            sum + (cl["DG-1 OFF Load Consumption"] || 0) + (cl["DG-2 OFF Load Consumption"] || 0), 0);
        const totalDG1OffLoadCon = calculatedLogs.reduce((sum, cl) => sum + (cl["DG-1 OFF Load Consumption"] || 0), 0);
        const totalDG2OffLoadCon = calculatedLogs.reduce((sum, cl) => sum + (cl["DG-2 OFF Load Consumption"] || 0), 0);

        const totalOnLoadHrs = calculatedLogs.reduce((sum, cl) =>
            sum + (cl["DG-1 ON Load Hour"] || 0) + (cl["DG-2 ON Load Hour"] || 0), 0);
        const totalDG1OnLoadHrs = calculatedLogs.reduce((sum, cl) => sum + (cl["DG-1 ON Load Hour"] || 0), 0);
        const totalDG2OnLoadHrs = calculatedLogs.reduce((sum, cl) => sum + (cl["DG-2 ON Load Hour"] || 0), 0);

        const totalOffLoadHrs = calculatedLogs.reduce((sum, cl) =>
            sum + (cl["DG-1 OFF Load Hour"] || 0) + (cl["DG-2 OFF Load Hour"] || 0), 0);
        const totalDG1OffLoadHrs = calculatedLogs.reduce((sum, cl) => sum + (cl["DG-1 OFF Load Hour"] || 0), 0);
        const totalDG2OffLoadHrs = calculatedLogs.reduce((sum, cl) => sum + (cl["DG-2 OFF Load Hour"] || 0), 0);

        // Minutes
        const totalHrsMin = (totalHrs * 60).toFixed(0);
        const totalDG1HrsMin = ((totalDG1OnLoadHrs + totalDG1OffLoadHrs) * 60).toFixed(0);
        const totalDG2HrsMin = ((totalDG2OnLoadHrs + totalDG2OffLoadHrs) * 60).toFixed(0);
        const totalDG1OnLoadHrsMin = (totalDG1OnLoadHrs * 60).toFixed(0);
        const totalDG2OnLoadHrsMin = (totalDG2OnLoadHrs * 60).toFixed(0);
        const totalDG1OffLoadHrsMin = (totalDG1OffLoadHrs * 60).toFixed(0);
        const totalDG2OffLoadHrsMin = (totalDG2OffLoadHrs * 60).toFixed(0);

        // Extra stats (expand as needed)
        // Add PUE/SEGR/Running Load etc. if you want monthly averages for those (e.g. from calculatedLogs or another helper)

        // Compute tank capacity from config
        const tankCapacity = Number(siteConfig.dgDayTankCapacity) + Number(siteConfig.dgExtrnlTankCapacity);

        return {
            totalDays: siteLogs.length,
            monthlyAvgCPH,
            monthlyAvgITLoad,
            monthlyAvgCoolingLoad,
            monthlyAvgOfficeLoad,
            monthlyAvgPUE,
            monthlyAvgSEGR,
            monthlyAvgDG1SEGR,
            monthlyAvgDG2SEGR,
            totalKwh,
            totalEBKWH,
            totalSolarKWH,
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
            totalOnLoadHrs,
            totalDG1OnLoadHrs,
            totalDG2OnLoadHrs,
            totalOffLoadHrs,
            totalDG1OffLoadHrs,
            totalDG2OffLoadHrs,
            totalHrsMin,
            totalDG1HrsMin,
            totalDG2HrsMin,
            totalDG1OnLoadHrsMin,
            totalDG2OnLoadHrsMin,
            totalDG1OffLoadHrsMin,
            totalDG2OffLoadHrsMin,
            tankCapacity,
            totalSiteRuningLoad,
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

        const fetchFuelRate = async () => {
            const siteKeys = [...new Set(logs.map(log => (log.site || "Unknown Site")))];
            if (!siteKeys.length) return;

            siteKeys.forEach(async (siteKey) => {
                try {
                    const docRef = doc(db, "fuelRates", siteKey);
                    const docSnap = await getDoc(docRef);
                    const key = siteKey.toUpperCase();
                    if (docSnap.exists()) {
                        setFuelRates(prev => ({ ...prev, [key]: docSnap.data().rate || 90 }));
                    } else {
                        setFuelRates(prev => ({ ...prev, [key]: 90 })); // default if no rate stored
                    }
                } catch (err) {
                    console.error("Error fetching fuel rate", err);
                }
            });
        };

        const fetchEBRate = async () => {
            const siteKeys = [...new Set(logs.map(log => (log.site || "Unknown Site")))];
            if (!siteKeys.length) return;

            siteKeys.forEach(async (siteKey) => {
                try {
                    const docRef = doc(db, "EBRates", siteKey);
                    const docSnap = await getDoc(docRef);
                    const key = siteKey.toUpperCase();
                    if (docSnap.exists()) {
                        setEbRate(prev => ({ ...prev, [key]: docSnap.data().rate || 10 }));
                    } else {
                        setEbRate(prev => ({ ...prev, [key]: 10 })); // default if no rate stored
                    }
                } catch (err) {
                    console.error("Error fetching fuel rate", err);
                }
            });
        };

        fetchEBRate();
        fetchFuelRate();
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
            <h2>All Sites DG Logs Monthly Summary - <strong>{monthKey}</strong> </h2>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    marginBottom: "14px",
                    padding: "10px",
                    background: "#0f172a",
                    borderRadius: "10px",
                    color: "#fff",
                }}
            >
                <strong>⚡ Power Filter:</strong>

                <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <input
                        type="checkbox"
                        checked={showOnlyDG}
                        onChange={(e) => setShowOnlyDG(e.target.checked)}
                    />
                    Show only DG sites
                </label>

                {showOnlyDG && (
                    <span
                        style={{
                            background: "#7f1d1d",
                            padding: "2px 10px",
                            borderRadius: "6px",
                            fontSize: "12px",
                        }}
                    >
                        DG MODE
                    </span>
                )}
                <div
                    style={{
                        marginLeft: "auto",
                        background: "#020617",
                        padding: "6px 14px",
                        borderRadius: "8px",
                        fontWeight: "600",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        border: "1px solid #334155",
                    }}
                >
                    <span style={{ color: "#e5e7eb" }}>⚡ DG Sites:</span>

                    <span
                        style={{
                            color: dgSitesCount > 0 ? "#f87171" : "#22c55e",
                            fontSize: "16px",
                        }}
                    >
                        {dgSitesCount}
                    </span>

                    <span style={{ color: "#94a3b8" }}>/ {totalSites}</span>
                </div>

            </div>

            {filteredSites.map(([site, siteLogs]) => {
                const siteKey = site.toUpperCase();
                const thisConfig = siteConfigs[siteKey];
                const powerInfo = sitePowerStatus[site];
                const powerSource = powerInfo?.powerSource || "N/A";
                const dgNumber = powerInfo?.selectedDG;

                if (!thisConfig) return <div key={siteKey}>⏳ Loading config for {siteKey}...</div>;

                // Get monthly summary for the card (pass siteConfig each time)
                const summary = getMonthlySummary(siteLogs, thisConfig);

                // Last log for DG fuel bars (today's last log)
                const form = siteLogs[siteLogs.length - 1] || {};

                // Get site-specific fuel rate (default to 90 if not found)
                const currentFuelRate = fuelRates[site] || 90;
                const currentEBRate = ebRate[site] || 10;

                // Handler for this specific site's fuel rate
                const handleFuelChange = (e) => {
                    const newRate = Number(e.target.value);
                    setFuelRates(prev => ({ ...prev, [site]: newRate }));
                };

                // For DG bar
                const availableFuel = (parseFloat(form["DG-1 Fuel Closing"] || 0) + parseFloat(form["DG-2 Fuel Closing"] || 0));
                const tankCapacity = summary.tankCapacity || 0;

                // Convert totalHrs to minutes
                const totalHrsMin = ((summary.totalHrs || 0) * 60).toFixed(0);

                return (
                    <div className="chart-container" key={site}
                        style={{
                            border:
                                powerSource === "DG"
                                    ? "2px solid #dc2626"
                                    : "1px solid #e5e7eb",
                            background:
                                powerSource === "DG"
                                    ? "#fee2e2"
                                    : "",
                        }}
                    >

                        <span
                            style={{
                                marginLeft: "8px",
                                padding: "2px 10px",
                                borderRadius: "6px",
                                fontSize: "12px",
                                fontWeight: "600",
                                color: "#fff",
                                background:
                                    powerSource === "DG"
                                        ? "#dc2626"
                                        : powerSource === "EB"
                                            ? "#16a34a"
                                            : "#6b7280",
                            }}
                        >
                            Site Live On:- <strong>{powerSource === "DG" ? `${powerSource} (${dgNumber})` : powerSource || "N/A"}</strong> Source
                        </span>

                        {fuelConsumptionBySiteDG[site] &&
                            Object.entries(fuelConsumptionBySiteDG[site]).map(
                                ([dg, data]) => (
                                    <div key={dg}>
                                        <strong>{dg}</strong> — {data.fuel.toFixed(2)} L

                                        {data.runs.map((r, i) => (
                                            <div key={i} style={{ fontSize: "12px", color: "#6b7280" }}>
                                                {r.startTime}–{r.stopTime} • {r.remarks}
                                            </div>
                                        ))}
                                    </div>
                                )
                            )}
                        {/* Fuel, load, backups */}
                        <h2 style={{ color: powerSource == "DG" ? "RED" : "", fontWeight: "bold" }}>{site} MSC</h2>
                        <h1 style={{ fontSize: "20px", color: "green", textAlign: "left" }}>
                            <strong>⛽ Present Stock – {fmt(availableFuel)} ltrs</strong>
                        </h1>
                        <h1 style={(availableFuel / summary.monthlyAvgCPH) < 18 ? { fontSize: "20px", color: "red", textAlign: "left" } : { fontSize: "20px", color: "green", textAlign: "left" }}> <strong>⏱️BackUp Hours – {(availableFuel / summary.monthlyAvgCPH).toFixed(2)} Hrs.</strong></h1>

                        <div style={{ display: "flex", marginTop: "10px", fontSize: "18px" }}>
                            🛢️ <div className="fuel-bar-container">
                                <div
                                    className="fuel-bar"
                                    style={{
                                        width: `${(availableFuel / tankCapacity) * 100}%`,
                                        background: `linear-gradient(to right, red, yellow, green)`
                                    }}
                                ></div>

                            </div>
                            <strong style={{ color: ((availableFuel / tankCapacity) * 100) < 60 ? "red" : "blue" }}>
                                {((availableFuel / tankCapacity) * 100).toFixed(0)}%
                            </strong>
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
                                    <p style={{ color: "black", fontSize: "6px" }}>
                                        /{tankCapacity / 2}ltrs.
                                    </p>
                                </div>
                                <strong style={{ color: (((form["DG-1 Fuel Closing"] / (tankCapacity / 2)) * 100) < 60 ? "red" : "blue") }}>
                                    {((form["DG-1 Fuel Closing"] / (tankCapacity / 2)) * 100).toFixed(0)}%
                                </strong>
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
                                    <p style={{ color: "black", fontSize: "6px" }}>
                                        /{tankCapacity / 2}ltrs.
                                    </p>
                                </div>
                                <strong style={{ color: (((form["DG-2 Fuel Closing"] / (tankCapacity / 2)) * 100) < 60 ? "red" : "blue") }}>
                                    {((form["DG-2 Fuel Closing"] / (tankCapacity / 2)) * 100).toFixed(0)}%
                                </strong>
                            </div>
                        </div>

                        <h4 style={{ borderTop: "3px solid #eee", textAlign: "center" }}>
                            📊 Summary – of Last {summary.totalDays} Days Logs
                        </h4>
                        {/* Average PUE */}
                        <p className={summary.monthlyAvgPUE > 1.6 ? "avg-segr low" : "avg-segr high"}>
                            <strong>Average PUE – {summary.monthlyAvgPUE}</strong>
                        </p>
                        {/* Average SEGR */}
                        <p className={(summary.totalKwh / summary.totalOnLoadCon) < 3 ? "avg-segr low" : "avg-segr high"}>
                            <strong>Average SEGR – {(summary.totalKwh / summary.totalOnLoadCon).toFixed(2)}</strong>
                        </p>
                        <p className={(summary.totalDG1Kw / summary.totalDG1OnLoadCon) < 3 ? "avg-segr low" : "avg-segr high"} style={{ fontSize: "10px" }} >
                            DG-1 Average SEGR – {(summary.totalDG1Kw / summary.totalDG1OnLoadCon).toFixed(2)}
                        </p>
                        <p className={(summary.totalDG2Kw / summary.totalDG2OnLoadCon) < 3 ? "avg-segr low" : "avg-segr high"} style={{ fontSize: "10px" }} >
                            DG-2 Average SEGR – {(summary.totalDG2Kw / summary.totalDG2OnLoadCon).toFixed(2)}
                        </p>
                        {/* <p style={{ borderTop: "3px solid #eee" }}>⚡ Site Running Load – <strong>{fmt(avgSiteRunningKw)} kWh</strong></p> */}
                        <p style={{ color: "#302f74ff" }}><strong>[Total Cost (EB + DG) – ₹{fmt((summary.totalEBKWH * currentEBRate) + (summary.totalFuel * currentFuelRate))}]</strong></p>

                        <div style={{ display: "flex", borderTop: "3px solid #eee" }}>
                            <div>
                                <p><strong>⚡ Site Running Load – {summary.totalSiteRuningLoad} kWh</strong></p>
                                <p><strong>📡 Avg IT Load – {summary.monthlyAvgITLoad} kWh</strong></p>
                                <p><strong>❄️ Avg Cooling Load – {summary.monthlyAvgCoolingLoad} kWh</strong></p>
                                <p><strong>🏢 Avg Office Load – {summary.monthlyAvgOfficeLoad} kWh</strong></p>
                                <p><strong>⛽ Avg DG CPH – {fmt1(summary.totalOnLoadCon / summary.totalOnLoadHrs)} Ltrs/Hrs</strong></p>
                            </div>
                            <div style={{ fontSize: "10px" }}>
                                <p>⛽DG-1 OEM CPH – <strong>{thisConfig.designCph?.["DG-1" || ""]}Ltrs/⏱️</strong></p>

                                <p>⛽DG-2 OEM CPH – <strong>{thisConfig.designCph?.["DG-2"] || ""}Ltrs/⏱️</strong></p>
                            </div>
                        </div>
                        {summary.totalEBKWH > 0 && (
                        <p style={{ borderTop: "1px solid #eee" }}>Total EB Unit Generation - <strong>{fmt(summary.totalEBKWH)} Units </strong>
                            ₹<input
                                type="number"
                                step="0.01"
                                value={currentEBRate}
                                onChange={handleFuelChange}
                                style={{ width: "70px", marginLeft: "4px", height: "20px" }}
                            /><strong style={{ fontSize: "10px" }}>/Ltr. = <b style={{color: "#302f74ff"}}>Cost: ₹{fmt(summary.totalEBKWH * currentEBRate)}</b></strong>
                        </p>
                        )}
                        {summary.totalSolarKWH > 0 && (
                            <p style={{ borderTop: "1px solid #eee" }}><strong>Total Solar Unit Generation - {fmt(summary.totalSolarKWH)} Units</strong></p>
                        )}

                        <p style={{ borderTop: "1px solid #eee" }}><strong>⚡ Total DG KW Generation – {fmt(summary.totalKwh)} kW</strong> <b style={{ fontSize: "10px", color: "#302f74ff" }}>(Cost: ₹{fmt((summary.totalFuel * currentFuelRate) / summary.totalKwh)}/Unit.)</b></p>
                        <div style={{ display: "flex" }}>
                            <p style={{ marginLeft: "20px" }}>
                                • DG-1: <strong>{fmt1(summary.totalDG1Kw)} kW</strong>
                            </p>
                            <p style={{ marginLeft: "20px" }}>
                                • DG-2: <strong>{fmt1(summary.totalDG2Kw)} kW</strong>
                            </p>
                        </div>
                        <p style={{ borderTop: "1px solid #eee" }}>
                            <strong>⛽ Total Fuel Filling – {fmt(summary.totalFilling)}Ltrs. x </strong>
                            ₹<input
                                type="number"
                                step="0.01"
                                value={currentFuelRate}
                                onChange={handleFuelChange}
                                style={{ width: "70px", marginLeft: "4px", height: "20px" }}
                            /><strong style={{ fontSize: "10px" }}>/Ltr. = <b style={{color: "#302f74ff"}}>Cost: ₹{fmt(summary.totalFilling * currentFuelRate)}</b></strong>
                        </p>
                        <div style={{ display: "flex" }}>
                            <p style={{ marginLeft: "20px" }}>
                                • DG-1: <strong>{fmt1(summary.totalDG1Filling)} Ltrs</strong>
                            </p>
                            <p style={{ marginLeft: "20px" }}>
                                • DG-2: <strong>{fmt1(summary.totalDG2Filling)} Ltrs</strong>
                            </p>
                        </div>

                        <p style={{ borderTop: "1px solid #eee" }}><strong>⛽ Total Fuel Consumption – {fmt(summary.totalFuel)}Ltrs.</strong> <b style={{ fontSize: "10px", color: "#302f74ff" }}>(Cost: ₹{fmt(summary.totalFuel * currentFuelRate)})</b></p>
                        <div style={{ display: "flex" }}>
                            <p style={{ marginLeft: "20px" }}>
                                • DG-1: <strong>{fmt1(summary.totalDG1OnLoadCon + summary.totalDG1OffLoadCon)} Ltrs</strong>
                            </p>
                            <p style={{ marginLeft: "40px", fontSize: "11px" }}>
                                - ON Load: <strong>{fmt1(summary.totalDG1OnLoadCon)} Ltrs</strong>
                            </p>
                            <p style={{ marginLeft: "40px", fontSize: "11px" }}>
                                - OFF Load: <strong>{fmt1(summary.totalDG1OffLoadCon)} Ltrs</strong>
                            </p>
                        </div>
                        <div style={{ display: "flex" }}>
                            <p style={{ marginLeft: "20px" }}>
                                • DG-2: <strong>{fmt1(summary.totalDG2OnLoadCon + summary.totalDG2OffLoadCon)} Ltrs</strong>
                            </p>
                            <p style={{ marginLeft: "40px", fontSize: "11px" }}>
                                - ON Load: <strong>{fmt1(summary.totalDG2OnLoadCon)} Ltrs</strong>
                            </p>
                            <p style={{ marginLeft: "40px", fontSize: "11px" }}>
                                - OFF Load: <strong>{fmt1(summary.totalDG2OffLoadCon)} Ltrs</strong>
                            </p>
                        </div>
                        <p style={{ borderTop: "1px solid #eee" }}><strong>⏱️ Total DG Run Hours – {fmt1(summary.totalHrs)} Hour</strong> ({totalHrsMin} min)</p>
                        <div style={{ display: "flex" }}>
                            <p style={{ marginLeft: "20px" }}>
                                • DG-1: <strong>{fmt1(summary.totalDG1OnLoadHrs + summary.totalDG1OffLoadHrs)} hrs</strong> ({summary.totalDG1HrsMin} min)
                            </p>
                            <p style={{ marginLeft: "40px", fontSize: "11px" }}>
                                - ON Load: <strong>{fmt1(summary.totalDG1OnLoadHrs)} hrs</strong> ({summary.totalDG1OnLoadHrsMin} min)
                            </p>
                            <p style={{ marginLeft: "40px", fontSize: "11px" }}>
                                - OFF Load: <strong>{fmt1(summary.totalDG1OffLoadHrs)} hrs</strong> ({summary.totalDG1OffLoadHrsMin} min)
                            </p>
                        </div>
                        <div style={{ display: "flex" }}>
                            <p style={{ marginLeft: "20px" }}>
                                • DG-2: <strong>{fmt1(summary.totalDG2OnLoadHrs + summary.totalDG2OffLoadHrs)} hrs</strong> ({summary.totalDG2HrsMin} min)
                            </p>
                            <p style={{ marginLeft: "40px", fontSize: "11px" }}>
                                - ON Load: <strong>{fmt1(summary.totalDG2OnLoadHrs)} hrs</strong> ({summary.totalDG2OnLoadHrsMin} min)
                            </p>
                            <p style={{ marginLeft: "40px", fontSize: "11px" }}>
                                - OFF Load: <strong>{fmt1(summary.totalDG2OffLoadHrs)} hrs</strong> ({summary.totalDG2OffLoadHrsMin} min)
                            </p>
                        </div>
                        {/* Add more breakdowns, load, filling, DG-1/2 metrics, etc. from your summary if desired */}
                        <div>
                            <p style={{ textAlign: "right", color: "gray", textSizeAdjust: "10px", cursor: "pointer" }} onClick={() => setPopupSite(siteKey)}>View Day-wise Details 📄</p>
                        </div>
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
                                        <th style={getHeaderStyle(`Location Name`)}>Site Name</th>
                                        <th style={getHeaderStyle(`Site ID`)}>Site ID</th>
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
