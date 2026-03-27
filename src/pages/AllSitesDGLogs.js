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
    const [collaps, setCollaps] = useState({})

    const [isLargeScreen, setIsLargeScreen] = useState(window.innerHeight > 512)
    // Screen Resize Listener
    useEffect(() => {
        const handleResize = () => setIsLargeScreen(window.innerWidth > 512);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const toggleSite = (siteName) => {
        setCollaps((prev) => ({
            ...prev,
            [siteName]: !prev[siteName],
        }));
    };

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

                // 👇 Get DATE documents correctly
                const monthRef = collection(db, "dgLogs", site, normalizedMonthKey);
                const dateDocs = await getDocs(monthRef);

                for (const dateDoc of dateDocs.docs) {
                    const date = dateDoc.id;

                    // 👇 runs subcollection
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
                        const data = runDoc.data();

                        logs.push({
                            id: runDoc.id,
                            site: site.toUpperCase(),   // 🔥 normalize here
                            date,
                            ...data,
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
        const site = (log.siteName || log.site || "").toUpperCase(); // 🔥 FIX
        const dg = log.dgNumber || log.dg || "DG-1"; // fallback
        const fuel = Number(log.fuelConsumption) || 0;
        const runHrs = log.remarks === "On Load" ? (log.totalRunHours || 0) : 0;

        if (!acc[site]) acc[site] = {};
        if (!acc[site][dg]) {
            acc[site][dg] = {
                fuel: 0,
                totalDGRunHours: 0,
                runs: [],
            };
        }

        acc[site][dg].fuel += fuel;
        acc[site][dg].totalDGRunHours += runHrs;
        acc[site][dg].runs.push({
            startTime: log.startTime,
            stopTime: log.stopTime,
            remarks: log.remarks,
            runHours: log.totalRunHours,
        });

        return acc;
    }, {});

    const getTodayFuelUsed = (siteKey) => {
        const siteData = fuelConsumptionBySiteDG[siteKey] || {};

        return Object.values(siteData).reduce((sum, dg) => {
            return sum + (dg.fuel || 0);
        }, 0);
    };

    const getTodayDGRunHrs = (siteKey) => {
        const siteData = fuelConsumptionBySiteDG[siteKey] || {};

        return Object.values(siteData).reduce((sum, dg) => {
            return sum + (dg.totalDGRunHours || 0);
        }, 0);
    };

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

        // if (!userData || (userData.role !== "Admin" && userData.role !== "Super Admin")) {
        //     navigate("/"); // redirect unauthorized users
        //     return;
        // }

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

        // Inside useEffect for fetching rates
        const fetchEBRate = async () => {
            const siteKeys = [...new Set(logs.map(log => (log.site || "Unknown Site")))];
            if (!siteKeys.length) return;

            siteKeys.forEach(async (siteKey) => {
                try {
                    const docRef = doc(db, "ebBillDetails", siteKey, "MonthlyBills", monthKey);
                    const docSnap = await getDoc(docRef);
                    const key = siteKey.toUpperCase();

                    if (docSnap.exists()) {
                        // Store the entire data object instead of just one field
                        setEbRate(prev => ({ ...prev, [key]: docSnap.data() }));
                    } else {
                        // Provide a default object structure if no record exists
                        setEbRate(prev => ({
                            ...prev,
                            [key]: { Unit: 0, Amount: 0, EBRate: 10, TDSAmount: 0 }
                        }));
                    }
                } catch (err) {
                    console.error("Error fetching EB rate", err);
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
                const currentEBRate = ebRate[siteKey] || { Unit: 0, Amount: 0, EBRate: 10, TDSAmount: 0 };

                // Handler for this specific site's fuel rate
                const handleChangeFuelRate = (e) => {
                    const newRate = Number(e.target.value);
                    setFuelRates(prev => ({ ...prev, [site]: newRate }));
                };

                // Handler for this specific site's EB rate
                const handleChangeEBRate = (e, siteKey) => {
                    const { name, value } = e.target;
                    const numericValue = parseFloat(value) || 0;

                    setEbRate(prev => {
                        // Get the existing data for this site or provide defaults
                        const existingData = prev[siteKey] || { Unit: 0, Amount: 0, EBRate: 10, TDSAmount: 0 };

                        // Create the updated object for this site
                        const updatedSiteData = {
                            ...existingData,
                            [name]: numericValue
                        };

                        // If 'Amount' is changed, automatically recalculate TDSAmount
                        if (name === "Amount") {
                            updatedSiteData.TDSAmount = parseFloat((numericValue * (thisConfig.ebTDS * 0.1)).toFixed(2));
                        }

                        return {
                            ...prev,
                            [siteKey]: updatedSiteData
                        };
                    });
                };

                // For DG bar
                const dgCount = thisConfig.dgCount || 0;

                // 🔥 Available Fuel (Dynamic DG closing)
                const availableFuel = Array.from({ length: dgCount }, (_, i) => {
                    const dgNo = i + 1;
                    return parseFloat(form[`DG-${dgNo} Fuel Closing`] || 0);
                }).reduce((a, b) => a + b, 0).toFixed(2);

                // 🔥 External Fuel (Dynamic)
                const dgExternalFuel = summary.dgExternalFuel || {};

                const exAvailableFuel = Object.values(dgExternalFuel)
                    .reduce((a, b) => a + (parseFloat(b) || 0), 0);

                // 🔥 Total Fuel
                const todayFuelUsed = getTodayFuelUsed(siteKey);
                const todayRunHrs = getTodayDGRunHrs(siteKey);
                const ebAvailable = 24 - todayRunHrs;

                const totalFuelAvailable =
                    (parseFloat(availableFuel) + parseFloat(exAvailableFuel)) - todayFuelUsed;

                // Tank capacity
                const dayTankCapacity = summary.dayTankCapacity || 0;
                const externalTankCapacity = summary.externalTankCapacity || 0;
                const tankCapacity = summary.tankCapacity || 0;

                // Convert totalHrs to minutes
                const totalHrsMin = ((summary.totalHrs || 0) * 60).toFixed(0);

                const dgSummary = Object.entries(summary.dgData || {}).map(([dg, data]) => {
                    const segr =
                        data.kwh && data.onLoadCon
                            ? (data.kwh / data.onLoadCon).toFixed(2)
                            : 0;

                    return {
                        dg,
                        ...data,
                        segr,
                        oemCph: thisConfig.designCph?.[dg] || "-"
                    };
                });

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
                            display: "grid"
                        }}
                    >

                        <button
                            style={{
                                background: collaps[site] ? "#a75555" : powerSource === "DG" ? "#dc2626" : "",

                            }}
                            onClick={() => toggleSite(site)}
                        >
                            <strong
                                style={{
                                    background: collaps[site] ? "" : "#7ca9e49d",
                                    padding: collaps[site] ? "" : "10px 10px",
                                    borderRadius: "5px",
                                    // height: "100%",
                                    // justifyContent: "center"                             
                                }}
                            >
                                {collaps[site] ? "▶ Collaps" : `${site} MSC ▼`}
                            </strong> :
                            {collaps[site] ? (
                                ""
                            ) : (
                                <div>
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
                                    {isLargeScreen ? (
                                        <div style={{ fontSize: "13px", display: "flex" }}>
                                            <strong>⛽ Present Stock – {fmt(totalFuelAvailable)} ltrs</strong>||<br></br>
                                            <strong>⏱️BackUp Hours – {(totalFuelAvailable / summary.monthlyAvgCPH).toFixed(2)} Hrs.</strong>||<br></br>
                                            <strong>⚡ Site Running Load – {summary.totalSiteRuningLoad} kWh</strong>||<br></br>
                                            <strong>⚡ DG Run Hrs – {todayRunHrs.toFixed(1)} Hrs.</strong>||<br></br>
                                            <strong>⚡ EB Avl Hrs – {ebAvailable.toFixed(1)} Hrs.</strong>||<br></br>
                                        </div>

                                    ) : (
                                        <div style={{ fontSize: "10px" }}>
                                            <strong>⛽ Present Stock – {fmt(totalFuelAvailable)} ltrs</strong>||<br></br>
                                            <strong>⏱️BackUp Hours – {(totalFuelAvailable / summary.monthlyAvgCPH).toFixed(2)} Hrs.</strong>||<br></br>
                                            <strong>⚡ Site Running Load – {summary.totalSiteRuningLoad} kWh</strong>||<br></br>
                                            <strong>⚡ DG Run Hrs – {todayRunHrs.toFixed(1)} Hrs.</strong>||<br></br>
                                            <strong>⚡ EB Avl Hrs – {ebAvailable.toFixed(1)} Hrs.</strong>||<br></br>
                                        </div>
                                    )}
                                </div>
                            )}
                        </button>

                        {collaps[site] && (

                            <div>
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

                                <h2 style={{ color: powerSource == "DG" ? "RED" : "", fontWeight: "bold" }}>{site} MSC</h2>
                                {/* Fuel, load, backups */}
                                <div style={{ display: "flex" }}>
                                    <div>
                                        <h1 style={{ fontSize: "20px", color: "green", textAlign: "left" }}>
                                            <strong>⛽ Present Stock – {fmt(totalFuelAvailable)} ltrs</strong>
                                        </h1>
                                        <h1 style={((totalFuelAvailable) / summary.monthlyAvgCPH) < 18 ? { fontSize: "20px", color: "red", textAlign: "left" } : { fontSize: "20px", color: "green", textAlign: "left" }}> <strong>⏱️BackUp Hours – {(totalFuelAvailable / summary.monthlyAvgCPH).toFixed(2)} Hrs.</strong></h1>
                                    </div>
                                    <div style={{ background: "#e450509f", color: "#fff", padding: "5px 5px", marginLeft: "10px", borderRadius: "7px" }}>
                                        <p style={{ fontSize: "10px", fontWeight: "bold" }}>Today DG Run:</p>
                                        {fuelConsumptionBySiteDG[site] &&
                                            Object.entries(fuelConsumptionBySiteDG[site]).map(
                                                ([dg, data]) => (
                                                    <div key={dg} style={{ display: "flex", fontSize: "10px" }}>
                                                        {/* <strong>{dg}</strong> — {data.fuel.toFixed(2)} L */}
                                                        <strong>{dg}</strong> — {(data.totalDGRunHours).toFixed(1)} Hrs
                                                        {/* {data.runs.map((r, i) => (
                                                            <div key={i} style={{ fontSize: "12px", color: "#6b7280" }}>
                                                                {r.startTime}–{r.stopTime} • {r.runHours.toFixed(2)}Hrs • {r.remarks}
                                                            </div>
                                                        ))} */}
                                                    </div>
                                                )
                                            )}
                                    </div>
                                </div>

                                {/* ✅ Split Fuel Level Bar */}
                                <div style={{ display: "flex", alignItems: "center", marginTop: "6px", fontSize: "18px" }}>
                                    🛢️
                                    <div
                                        className="fuel-bar-container"
                                        style={{
                                            display: "flex",
                                            width: `${(tankCapacity) * 100}%`,
                                            height: "22px",
                                            background: "#eee",
                                            borderRadius: "4px",
                                            overflow: "hidden",
                                            marginLeft: "4px",
                                        }}
                                    >
                                        {/* 🔴 Day Tank */}
                                        <div
                                            style={{
                                                width: `${(dayTankCapacity / tankCapacity) * 100}%`,
                                                background: "#f5c6c6",
                                                position: "relative",
                                                whiteSpace: "nowrap"
                                            }}
                                        >
                                            <p
                                                // className="fuel-bar"
                                                style={{
                                                    width: `${((availableFuel - todayFuelUsed) / dayTankCapacity) * 100 || 0}%`,
                                                    height: "100%",
                                                    background: "linear-gradient(to right, red, orange, green)",
                                                    fontSize: "10px",
                                                    alignContent: "center"
                                                }}
                                            >
                                                ⛽{(availableFuel - todayFuelUsed) || 0}/{dayTankCapacity || 0}L
                                            </p>

                                        </div>

                                        {/* 🔵 External Tank */}
                                        <div
                                            style={{
                                                width: `${(externalTankCapacity / tankCapacity) * 100}%`,
                                                background: "#cce5ff",
                                                position: "relative",
                                                borderLeft: "2px solid black",
                                                whiteSpace: "nowrap",
                                                color: (dgExternalFuel?.["DG-1"] + dgExternalFuel?.["DG-2"] + dgExternalFuel?.["DG-3"]) > 0 ? "white" : "black",
                                            }}
                                        >
                                            <p
                                                style={{
                                                    width: `${(((((thisConfig?.dgCount > 0 ? dgExternalFuel?.["DG-1"] : 0) + (thisConfig?.dgCount > 1 ? dgExternalFuel?.["DG-2"] : 0) + (thisConfig?.dgCount > 2 ? dgExternalFuel?.["DG-3"] : 0) + (thisConfig?.dgCount > 3 ? dgExternalFuel?.["DG-4"] : 0)) || 0)) / externalTankCapacity) * 100 || 0}%`,
                                                    height: "100%",
                                                    background: "linear-gradient(to right, blue, green)",
                                                    fontSize: "8px",
                                                    alignContent: "center"
                                                }}
                                            >
                                                ⛽{((((thisConfig?.dgCount > 0 ? dgExternalFuel?.["DG-1"] : 0) + (thisConfig?.dgCount > 1 ? dgExternalFuel?.["DG-2"] : 0) + (thisConfig?.dgCount > 2 ? dgExternalFuel?.["DG-3"] : 0) + (thisConfig?.dgCount > 3 ? dgExternalFuel?.["DG-4"] : 0)) || 0)) || 0}/{externalTankCapacity || 0}L
                                            </p>
                                        </div>
                                    </div>
                                    <strong style={((totalFuelAvailable / tankCapacity) * 100) < 60 ? { color: "red" } : { color: "blue" }}>{((totalFuelAvailable / tankCapacity) * 100).toFixed(0)}%</strong>
                                </div>
                                <p style={{ fontSize: "10px", textAlign: "left", color: "#5c3c6ece" }}>
                                    Total Stock Capacity: <strong>{tankCapacity} Ltrs</strong>
                                </p>

                                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "10px", justifyContent: "space-between" }}>
                                    <div style={{ fontSize: "14px", background: "#e0e7ff", padding: "6px 10px", borderRadius: "6px" }}>
                                        <h4 style={{ textDecoration: "underline" }}>⛽ DG Wise Fuel Stock</h4>
                                        {Array.from({ length: thisConfig?.dgCount || 0 }).map((_, idx) => {
                                            const dgNo = idx + 1;
                                            const dgCNo = `DG-${dgNo}`

                                            const lastFuelClosing = Number(form?.[`DG-${dgNo} Fuel Closing`] || 0);

                                            const dayTank =
                                                Number(thisConfig.dgConfigs?.[`DG-${dgNo}`]?.dayTankLtrs || 0);

                                            const externalTankConfig =
                                                Number(thisConfig.dgConfigs?.[`DG-${dgNo}`]?.externalTankLtrs || 0);

                                            const dgExternalUsed =
                                                fuelConsumptionBySiteDG[siteKey]?.[`DG-${dgNo}`]?.fuel || 0;

                                            const externalAvailable =
                                                Math.max((dgExternalFuel?.[`DG-${dgNo}`] || 0));

                                            const perDgCapacity = dayTank;
                                            const dgTodayUsed =
                                                fuelConsumptionBySiteDG[siteKey]?.[`DG-${dgNo}`]?.fuel || 0;

                                            const fuelClosing = Math.max(lastFuelClosing - dgTodayUsed, 0);

                                            const percent = perDgCapacity
                                                ? Math.min((fuelClosing / perDgCapacity) * 100, 100)
                                                : 0;
                                            const exPercent = externalTankConfig
                                                ? Math.min((externalAvailable / externalTankConfig) * 100, 100)
                                                : 0;

                                            const externalStock = dgExternalFuel?.[dgCNo] || 0;   // MAX
                                            // const externalUsed = dgExternalUsed?.[dgCNo] || 0;  // CURRENT

                                            return (
                                                <div key={dgNo} style={{ marginBottom: "4px", display: "flex" }}>
                                                    <div>
                                                        {/* 🔹 Fuel Bar */}
                                                        <div
                                                            style={{
                                                                display: "flex",
                                                                alignItems: "center",
                                                                fontSize: "10px",
                                                                maxWidth: "240px",
                                                                height: "14px",
                                                            }}
                                                        >
                                                            🛢️
                                                            <p style={{ whiteSpace: "nowrap", color: "blue", margin: "0 2px" }}>
                                                                DG-{dgNo}:
                                                            </p>

                                                            <div
                                                                style={{
                                                                    display: "flex",
                                                                    width: "120px",
                                                                    background: "#eee",
                                                                    borderRadius: "3px",
                                                                    overflow: "hidden",
                                                                }}
                                                            >
                                                                <p
                                                                    style={{
                                                                        width: `${percent}%`,
                                                                        background: "linear-gradient(to right, blue)",
                                                                        color: "white",
                                                                        fontSize: "7px",
                                                                        margin: 0,
                                                                        textAlign: "center",
                                                                        whiteSpace: "nowrap",
                                                                    }}
                                                                >
                                                                    ⛽{fuelClosing}/{perDgCapacity.toFixed(1)}L
                                                                    <small style={{ color: "red" }}>
                                                                        🔻 Used Today: {dgTodayUsed.toFixed(2)}L
                                                                    </small>
                                                                </p>
                                                            </div>

                                                            <strong
                                                                style={{
                                                                    marginLeft: "4px",
                                                                    color: percent < 60 ? "red" : "blue",
                                                                }}
                                                            >
                                                                {percent.toFixed(0)}%
                                                            </strong>
                                                        </div>
                                                        {externalTankConfig > 0 && (

                                                            <div
                                                                style={{
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    fontSize: "10px",
                                                                    maxWidth: "240px",
                                                                    height: "14px",
                                                                }}
                                                            >
                                                                🛢️
                                                                <p style={{ whiteSpace: "nowrap", color: "blue", margin: "0 2px" }}>
                                                                    DG-{dgNo}Ex.:
                                                                </p>

                                                                <div
                                                                    style={{
                                                                        display: "flex",
                                                                        width: "120px",
                                                                        background: "#eee",
                                                                        borderRadius: "3px",
                                                                        overflow: "hidden",
                                                                    }}
                                                                >
                                                                    <p
                                                                        style={{
                                                                            width: `${exPercent}%`,
                                                                            background: "linear-gradient(to right, blue)",
                                                                            color: "white",
                                                                            fontSize: "7px",
                                                                            margin: 0,
                                                                            textAlign: "center",
                                                                            whiteSpace: "nowrap",
                                                                        }}
                                                                    >
                                                                        ⛽{externalAvailable}/{externalTankConfig.toFixed(1)}L
                                                                    </p>
                                                                </div>

                                                                <strong
                                                                    style={{
                                                                        marginLeft: "4px",
                                                                        color: exPercent < 60 ? "red" : "blue",
                                                                    }}
                                                                >
                                                                    {exPercent.toFixed(0)}%
                                                                </strong>
                                                            </div>
                                                        )}

                                                    </div>
                                                </div>
                                            );

                                        })}
                                    </div>
                                    <div style={{ fontSize: "14px", background: "#e0e7ff", padding: "6px 10px", borderRadius: "6px" }}>
                                        {/* Average PUE */}
                                        <p className={summary.monthlyAvgPUE > 1.6 ? "avg-segr low" : "avg-segr high"}>
                                            <strong>Average PUE – {summary.monthlyAvgPUE}</strong>
                                        </p>
                                        {/* Average SEGR */}
                                        <p className={(summary.totalKwh / summary.totalOnLoadCon) < 3 ? "avg-segr low" : "avg-segr high"}>
                                            <strong>Average SEGR – {(summary.totalKwh / summary.totalOnLoadCon).toFixed(2)}</strong>
                                        </p>

                                        {/* Per DG SEGR */}
                                        {dgSummary.map(dg => (
                                            <p
                                                key={dg.dg}
                                                className={dg.segr < 3 ? "avg-segr low" : "avg-segr high"}
                                                style={{ fontSize: "10px" }}
                                            >
                                                {dg.dg} Average SEGR – {dg.segr}
                                            </p>
                                        ))}
                                    </div>
                                </div>

                                <h4 style={{ borderTop: "3px solid #eee", textAlign: "center" }}>
                                    📊 Summary – of Last {summary.totalDays} Days Logs
                                </h4>

                                {/* <p style={{ borderTop: "3px solid #eee" }}>⚡ Site Running Load – <strong>{fmt(avgSiteRunningKw)} kWh</strong></p> */}
                                <p style={{ color: "#302f74ff" }}><strong>[Total Cost (EB + DG) – ₹{fmt((summary.totalEBKWH * currentEBRate.EBRate) + (summary.totalFuel * currentFuelRate))}]</strong></p>

                                {/* Summary Cards */}
                                <div style={{ display: "flex", borderTop: "3px solid #eee" }}>
                                    <div>
                                        <p><strong>⚡ Site Running Load – {summary.totalSiteRuningLoad} kWh</strong></p>
                                        <p><strong>📡 Avg IT Load – {summary.monthlyAvgITLoad} kWh</strong></p>
                                        <p><strong>❄️ Avg Cooling Load – {summary.monthlyAvgCoolingLoad} kWh</strong></p>
                                        <p><strong>🏢 Avg Office Load – {summary.monthlyAvgOfficeLoad} kWh</strong></p>
                                        <p><strong>⛽ Avg DG CPH – {fmt1(summary.totalOnLoadCon / summary.totalOnLoadHrs)} Ltrs/Hrs</strong></p>
                                    </div>

                                    {/* Per DG CPH */}
                                    <div style={{ fontSize: "10px" }}>
                                        {dgSummary.map(dg => (
                                            <p key={dg.dg}>
                                                ⛽{dg.dg} OEM CPH – <strong>{dg.oemCph} Ltrs/⏱️</strong>
                                            </p>
                                        ))}
                                    </div>
                                </div>

                                {/* Conditional rendering based on available data */}
                                {summary.totalEBKWH > 0 && (
                                    <p style={{ borderTop: "1px solid #eee" }}>Total EB Unit Generation - <strong>{fmt(summary.totalEBKWH)} Units </strong>
                                        ₹<input
                                            type="number"
                                            step="0.01"
                                            value={currentEBRate.EBRate || ""}
                                            onChange={(e) => handleChangeEBRate(e, siteKey)}
                                            style={{ width: "70px", marginLeft: "4px", height: "20px" }}
                                        /><strong style={{ fontSize: "10px" }}>/Ltr. = <b style={{ color: "#302f74ff" }}>Cost: ₹{fmt(summary.totalEBKWH * currentEBRate.EBRate)}</b></strong>
                                    </p>
                                )}

                                <div style={{ fontSize: "12px", display: "grid" }}>
                                    <strong style={{ whiteSpace: "nowrap" }}>
                                        💡 EDCOM: <input
                                            type="number"
                                            name="Unit" // Matches the key in setEBBill
                                            step="0.01"
                                            value={currentEBRate.Unit || ""}
                                            onChange={(e) => handleChangeEBRate(e, siteKey)}
                                            // readOnly
                                            style={{ width: "inherit", marginLeft: "4px", height: "20px" }}
                                        />Units
                                    </strong>

                                    <strong style={{ whiteSpace: "nowrap" }}>
                                        🏦 Through NEFT/RTGS(RS): ₹<input
                                            type="number"
                                            name="Amount" // Matches the key in setEBBill
                                            step="0.01"
                                            value={currentEBRate.Amount || ""}
                                            onChange={(e) => handleChangeEBRate(e, siteKey)}
                                            // readOnly
                                            style={{ width: "inherit", marginLeft: "4px", height: "20px" }}
                                        />
                                    </strong>

                                    {/* TDS is calculated automatically from the state */}
                                    <b>💰 TDS Amount: <strong>₹{currentEBRate.TDSAmount || "0.00"}</strong> <span style={{ color: "#5c3c6ce8" }}>as per {thisConfig.ebTDS}% of Bill Amount</span></b>
                                </div>

                                {/* If solar data exists, show solar generation summary */}
                                {summary.totalSolarKWH > 0 && (
                                    <p style={{ borderTop: "1px solid #eee" }}><strong>Total Solar Unit Generation - {fmt(summary.totalSolarKWH)} Units</strong></p>
                                )}

                                {/* Per DG KW */}
                                <p style={{ borderTop: "1px solid #eee" }}><strong>⚡ Total DG KW Generation – {fmt(summary.totalKwh)} kW</strong> <b style={{ fontSize: "10px", color: "#302f74ff" }}>(Cost: ₹{fmt((summary.totalFuel * currentFuelRate) / summary.totalKwh)}/Unit.)</b></p>
                                <div style={{ display: "flex", flexWrap: "wrap" }}>
                                    {dgSummary.map(dg => (
                                        <p key={dg.dg} style={{ marginLeft: "20px" }}>
                                            • {dg.dg}: <strong>{fmt1(dg.kwh)} kW</strong>
                                        </p>
                                    ))}
                                </div>

                                {/* Total Fuel Filling & Consumption */}
                                <p style={{ borderTop: "1px solid #eee" }}>
                                    <strong>⛽ Total Fuel Filling – {fmt(summary.totalFilling)}Ltrs. x </strong>
                                    ₹<input
                                        type="number"
                                        step="0.01"
                                        value={currentFuelRate}
                                        onChange={handleChangeFuelRate}
                                        style={{ width: "70px", marginLeft: "4px", height: "20px" }}
                                    /><strong style={{ fontSize: "10px" }}>/Ltr. = <b style={{ color: "#302f74ff" }}>Cost: ₹{fmt(summary.totalFilling * currentFuelRate)}</b></strong>
                                </p>

                                <div style={{ display: "flex", flexWrap: "wrap" }}>
                                    {dgSummary.map(dg => (
                                        <p key={dg.dg} style={{ marginLeft: "20px" }}>
                                            • {dg.dg}: <strong>{fmt1(dg.filling)} Ltrs</strong>
                                        </p>
                                    ))}
                                </div>

                                {/* Total Fuel Consumption */}
                                <p style={{ borderTop: "1px solid #eee" }}><strong>⛽ Total Fuel Consumption – {fmt(summary.totalFuel)}Ltrs.</strong> <b style={{ fontSize: "10px", color: "#302f74ff" }}>(Cost: ₹{fmt(summary.totalFuel * currentFuelRate)})</b></p>

                                {dgSummary.map(dg => (
                                    <div key={dg.dg} style={{ display: "flex" }}>
                                        <p style={{ marginLeft: "20px" }}>
                                            • {dg.dg}: <strong>{fmt1(dg.onLoadCon + dg.offLoadCon)} Ltrs</strong>
                                        </p>
                                        <p style={{ marginLeft: "40px", fontSize: "11px" }}>
                                            - ON Load: <strong>{fmt1(dg.onLoadCon)} Ltrs</strong>
                                        </p>
                                        <p style={{ marginLeft: "40px", fontSize: "11px" }}>
                                            - OFF Load: <strong>{fmt1(dg.offLoadCon)} Ltrs</strong>
                                        </p>
                                    </div>
                                ))}

                                {/* Total DG Run Hours */}
                                <p style={{ borderTop: "1px solid #eee" }}><strong>⏱️ Total DG Run Hours – {fmt1(summary.totalHrs)} Hour</strong> ({totalHrsMin} min)</p>

                                {dgSummary.map(dg => (
                                    <div key={dg.dg} style={{ display: "flex" }}>
                                        <p style={{ marginLeft: "20px" }}>
                                            • {dg.dg}: <strong>{fmt1(dg.onLoadHrs + dg.offLoadHrs)} hrs</strong>
                                        </p>
                                        <p style={{ marginLeft: "40px", fontSize: "11px" }}>
                                            - ON Load: <strong>{fmt1(dg.onLoadHrs)} hrs</strong>
                                        </p>
                                        <p style={{ marginLeft: "40px", fontSize: "11px" }}>
                                            - OFF Load: <strong>{fmt1(dg.offLoadHrs)} hrs</strong>
                                        </p>
                                    </div>
                                ))}
                                {/* Add more breakdowns, load, filling, DG-1/2 metrics, etc. from your summary if desired */}
                                <div>
                                    <p style={{ textAlign: "right", color: "gray", textSizeAdjust: "10px", cursor: "pointer" }} onClick={() => setPopupSite(siteKey)}>View Day-wise Details 📄</p>
                                </div>
                            </div>
                        )}

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
