// src/pages/DailyDGLog.js
import React, { useEffect, useState } from "react";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  deleteDoc,
  serverTimestamp,
  sum,
  query,
  where,
  limit,
  onSnapshot
} from "firebase/firestore";
import { db } from "../firebase";
import "../assets/DailyDGLog.css";
// import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import XLSX from "xlsx-js-style";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { calculateFields } from "../utils/calculatedDGLogs";

// ✅ helper to format date as YYYY-MM-DD


const getFormattedDate = (d = new Date()) => {
  // const d = new Date();
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
};

// ✅ helper to extract from DailyDGLogs snapshot
const findLastFillingInDailyLogs = (logs = []) => {
  const fillings = [...logs]
    .map((e) => ({
      Date: e.Date,
      DG1: parseFloat(e["DG-1 Fuel Filling"] || 0),
      DG2: parseFloat(e["DG-2 Fuel Filling"] || 0),
      DG1Hrs: parseFloat(e["DG-1 Hour Closing"] || 0),
      DG2Hrs: parseFloat(e["DG-2 Hour Closing"] || 0),
    }))
    .filter((e) => e.DG1 > 0 || e.DG2 > 0)
    .sort((a, b) => new Date(b.Date) - new Date(a.Date));

  return fillings.length ? fillings[0] : null;
};

// ✅ Helper to scan dgLogs runs directly
const findLastFillingInDGLogs = async (site, monthsToCheck = 3) => {
  const today = new Date();
  let runsDG1 = [];
  let runsDG2 = [];

  for (let i = 0; i < monthsToCheck; i++) {
    const m = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const mKey =
      m.toLocaleString("en-US", { month: "short" }) + "-" + m.getFullYear();

    try {
      const datesSnap = await getDocs(collection(db, "dgLogs", site, mKey));
      for (const dateDoc of datesSnap.docs) {
        const dateKey = dateDoc.id; // 'YYYY-MM-DD'
        const runsSnap = await getDocs(
          collection(db, "dgLogs", site, mKey, dateKey, "runs")
        );

        runsSnap.docs.forEach((rd) => {
          const run = rd.data();
          const fill = Number(run.fuelFill || 0);
          if (fill > 0) {
            const hrMeter = Number(run.hrMeterEnd || run.hrMeterStart || 0);
            if (run.dgNumber === "DG-1") {
              runsDG1.push({ Date: dateKey, liters: fill, hrs: hrMeter });
            } else if (run.dgNumber === "DG-2") {
              runsDG2.push({ Date: dateKey, liters: fill, hrs: hrMeter });
            }
          }
        });
      }
    } catch (err) {
      console.error(`Error scanning dgLogs for ${mKey}:`, err);
    }
  }

  runsDG1.sort((a, b) => new Date(b.Date) - new Date(a.Date));
  runsDG2.sort((a, b) => new Date(b.Date) - new Date(a.Date));

  const lastDG1 = runsDG1[0] || null;
  const lastDG2 = runsDG2[0] || null;

  if (lastDG1 || lastDG2) {
    const mostRecentDate = [lastDG1?.Date, lastDG2?.Date]
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))[0];

    return {
      Date: mostRecentDate,
      DG1: lastDG1?.liters || 0,
      DG2: lastDG2?.liters || 0,
      DG1Hrs: lastDG1?.hrs || 0,
      DG2Hrs: lastDG2?.hrs || 0,
    };
  }

  return null;
};


const calculateMonthlySummary = (logs, calculateFields, siteConfig) => {
  if (!logs?.length) return null;

  const calculated = logs.map(e => calculateFields(e, siteConfig));

  const sum = (key) =>
    calculated.reduce((a, b) => a + (Number(b[key]) || 0), 0);

  const avg = (key) => {
    const vals = calculated.map(e => Number(e[key])).filter(v => v > 0);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  };

  return {
    totalDGKWH: sum("Total DG KWH"),
    totalEBKWH: sum("Total EB KWH"),
    totalSolarKWH: sum("Total Solar KWH"),
    totalFuel: sum("Total DG Fuel"),
    totalDGHours: sum("Total DG Hours"),
    avgSiteKW: avg("Site Running kW"),
    avgPUE: avg("PUE"),
  };
};


const DailyDGLog = ({ userData }) => {
  const siteName = userData?.site || "UnknownSite";
  const fmt = (val) => (val !== undefined && val !== null ? Number(val).toFixed(2) : "0.0");
  const fmt1 = (val) => (val !== undefined && val !== null ? Number(val).toFixed(1) : "0.0");
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7) // YYYY-MM
  );
  const [logs, setLogs] = useState([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [totalkW, setTotalkW] = useState([]);
  const [fuelAlert, setFuelAlert] = useState(false);
  const [dayFuelCon, setDayFuelCon] = useState(0);
  const [dayFuelFill, setDayFuelFill] = useState(0);
  const [dayRunningHrs, setDayRunningHrs] = useState(0);
  const [dayonLoadRunHrs, setDayOnLoadRunHrs] = useState(0);
  const [form, setForm] = useState({ Date: "" });
  const navigate = useNavigate();
  const [EBRate, setEBRate] = useState(0.00); // default value
  const [fuelRate, setFuelRate] = useState(0.00); // default value
  const [siteConfig, setSiteConfig] = useState({});
  const siteKey = userData?.site?.toUpperCase();
  const [lastFilling, setLastFilling] = useState(null);
  const [loadingFilling, setLoadingFilling] = useState(true);
  const [fuelAvalable, setFuelAvalable] = useState();
  // For yesterday's log auto-fill
  const [yesterdayLog, setYesterdayLog] = useState(null);
  //for Bulk excel Upload
  const [previewRows, setPreviewRows] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [uploadErrors, setUploadErrors] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadCalculate, setIsUploadCalculate] = useState(false);
  // Summaries for current and previous month by year
  const [currentSummary, setCurrentSummary] = useState(null);
  const [previousSummary, setPreviousSummary] = useState(null);
  const [multiYearData, setMultiYearData] = useState([]);
  const [loadingTrend, setLoadingTrend] = useState(false);
  // Fetch Power Source Status
  const [powerSource, setPowerSource] = useState("EB");
  const [updatedByName, setUpdatedByName] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loadingPower, setLoadingPower] = useState(true);
  const [dgSeconds, setDgSeconds] = useState(0);


  /** permissions */
  const isAdmin =
    userData?.role === "Super Admin" ||
    userData?.role === "Admin" ||
    userData.isAdminAssigned ||
    // isAdminAssignmentValid(userData) ||
    userData?.designation === "Vertiv Site Infra Engineer" ||
    userData?.designation === "Vertiv CIH" ||
    userData?.designation === "Vertiv ZM";


  // compute individual DG averages
  const allValues = logs.flatMap((entry) => calculateFields(entry, siteConfig));

  const totalDG1Kwh = allValues.reduce((sum, cl) => sum + (cl["DG-1 KWH Generation"] || 0), 0);
  const totalDG1OnLoadCon =
    allValues.reduce(
      (sum, cl) => sum + (cl["DG-1 ON Load Consumption"] || 0),
      0
    );

  const monthlyAvgDG1SEGR = (totalDG1Kwh / totalDG1OnLoadCon).toFixed(2);

  // DG-2 ***************************
  const totalDG2Kwh = allValues.reduce((sum, cl) => sum + (cl["DG-2 KWH Generation"] || 0), 0);
  const totalDG2OnLoadCon =
    allValues.reduce(
      (sum, cl) => sum + (cl["DG-2 ON Load Consumption"] || 0),
      0
    );
  const monthlyAvgDG2SEGR = (totalDG2Kwh / totalDG2OnLoadCon).toFixed(2);

  const totalKwh = allValues.reduce((sum, cl) => sum + (cl["Total DG KWH"] || 0), 0);
  const totalOnLoadCon =
    allValues.reduce(
      (sum, cl) => sum + (cl["DG-1 ON Load Consumption"] || 0) + (cl["DG-2 ON Load Consumption"] || 0),
      0
    );


  const monthlyAvgSEGR = (totalKwh / totalOnLoadCon).toFixed(2);
  const pueValues = logs
    .map((entry) => calculateFields(entry, siteConfig)["PUE"])
    .filter((val) => val > 0);
  const monthlyAvgPUE = pueValues.length > 0
    ? (
      pueValues.reduce((sum, val) => sum + parseFloat(val), 0) / pueValues.length
    ).toFixed(2)
    : 0;


  const siteRunningKwValues = allValues
    .map(cl => cl["Site Running kW"])
    .filter(v => v > 0);

  const avgSiteRunningKw =
    siteRunningKwValues.length > 0
      ? (siteRunningKwValues.reduce((sum, v) => sum + v, 0) / siteRunningKwValues.length).toFixed(2)
      : 0;

  const formatMonthName = (ym) => {
    const [year, month] = ym.split("-");
    const date = new Date(year, month - 1); // month is 0-based
    return date.toLocaleString("default", { month: "long" }); // , year: "numeric" 
  };

  const formatYear = (ym) => {
    return ym.split("-")[0]; // just the YYYY part
  };

  // Debounce helper (optional) For EB Rate Fetch
  let timeoutEB;
  const saveEBRate = (rate) => {
    clearTimeout(timeoutEB);
    timeoutEB = setTimeout(async () => {
      try {
        // Save fuel rate site-wise
        await setDoc(doc(db, "EBRates", userData?.site), { rate }, { merge: true });
        console.log("EB rate saved:", rate);
      } catch (err) {
        console.error("Error saving EB rate:", err);
      }
    }, 500); // wait 500ms after typing stops
  };

  // Debounce helper (optional) Fuel Rate Fetch
  let timeout;
  const saveFuelRate = (rate) => {
    clearTimeout(timeout);
    timeout = setTimeout(async () => {
      try {
        // Save fuel rate site-wise
        await setDoc(doc(db, "fuelRates", userData?.site), { rate }, { merge: true });
        console.log("Fuel rate saved:", rate);
      } catch (err) {
        console.error("Error saving fuel rate:", err);
      }
    }, 500); // wait 500ms after typing stops
  };



  // Change Function For Fuel Rate
  const handleFuelChange = (e) => {
    const rate = parseFloat(e.target.value) || 0;
    setFuelRate(rate);
    saveFuelRate(rate);
  };

  // Change Function For EB Rate
  const handleEBChange = (e) => {
    const rate = parseFloat(e.target.value) || 0;
    setEBRate(rate);
    saveEBRate(rate);
  };


  // 🔹 Fetch logs
  const fetchLogs = async () => {
    if (!siteName) return;
    const monthKey = selectedMonth;
    const logsCol = collection(db, "dailyDGLogs", siteName, monthKey);
    const snapshot = await getDocs(logsCol);


    const data = [];
    snapshot.forEach((docSnap) => {
      data.push({ id: docSnap.id, ...docSnap.data() });
    });
    setLogs(data);
    localStorage.setItem("dailyLogs", JSON.stringify(data));
  };

  // 🔹 Refetch logs on month/site change
  useEffect(() => {
    fetchLogs();
  }, [selectedMonth, siteName]);

  useEffect(() => {
    const cached = localStorage.getItem("dailyLogs");
    if (cached) {
      setLogs(JSON.parse(cached));
    }

    const cached1 = localStorage.getItem("lastFilling");
    if (cached1) {
      setLastFilling(JSON.parse(cached1));
    }

  }, []);

  // Fetch logs from dgLogs DB and set calculating data in log form 
  const fetchAndAggregateRuns = async (selectedDate) => {
    if (!userData.site || !selectedDate) return;

    try {
      const dateObj = new Date(selectedDate);
      const monthKey =
        dateObj.toLocaleString("en-US", { month: "short" }) +
        "-" +
        dateObj.getFullYear();

      const runsCollectionRef = collection(
        db,
        "dgLogs",
        userData.site,
        monthKey,
        selectedDate,
        "runs"
      );

      const snapshot = await getDocs(runsCollectionRef);
      if (snapshot.empty) {
        console.log("No DG runs found for this date.");
        return setForm((prevForm) => ({
          ...prevForm,
          // Only update if runs were found for that DG
          "DG-1 Fuel Closing": prevForm["DG-1 Fuel Opening"],
          "DG-2 Fuel Closing": prevForm["DG-2 Fuel Opening"],
          "DG-1 KWH Closing": prevForm["DG-1 KWH Opening"],
          "DG-2 KWH Closing": prevForm["DG-2 KWH Opening"],

          "DG-1 Hour Closing": prevForm["DG-1 Hour Opening"],

          "DG-2 Hour Closing": prevForm["DG-2 Hour Opening"],


          // Note: The form calculates total consumption from opening/closing fuel.
          // This aggregated value is useful for verification or other logic.
          // For now, we'll focus on populating meter readings.
        }));; // No runs to process
      }

      const runs = snapshot.docs.map((doc) => doc.data());

      // --- Aggregation Logic ---
      let dg1TotalConsumption = 0;
      let dg1TotalRunHours = 0;
      let dg1MinStartMeter = Infinity;
      let dg1MaxEndMeter = 0;
      let dg1MaxEndkWH = 0;
      let offLoadDG1Con = 0;
      let offLoadDG1Run = 0;
      let dg1FuelFill = 0;

      let dg2TotalConsumption = 0;
      let dg2TotalRunHours = 0;
      let dg2MinStartMeter = Infinity;
      let dg2MaxEndMeter = 0;
      let dg2MaxEndkWH = 0;
      let offLoadDG2Con = 0;
      let offLoadDG2Run = 0;
      let dg2FuelFill = 0;


      runs.forEach((run) => {
        const startMeter = parseFloat(run.hrMeterStart || 0);
        const endMeter = parseFloat(run.hrMeterEnd || 0);

        if (run.dgNumber === "DG-1") {
          dg1TotalConsumption += parseFloat(run.fuelConsumption || 0);
          dg1MaxEndkWH += parseFloat(run.kWHReading || 0);
          dg1TotalRunHours += parseFloat(run.totalRunHours || 0);
          if (startMeter < dg1MinStartMeter) dg1MinStartMeter = startMeter;
          if (endMeter > dg1MaxEndMeter) dg1MaxEndMeter = endMeter;
          if (run.remarks === "No Load") offLoadDG1Con += parseFloat(run.fuelConsumption || 0);
          if (run.remarks === "No Load") offLoadDG1Run += parseFloat(run.totalRunHours || 0);
          dg1FuelFill += parseFloat(run.fuelFill || 0);
        } else if (run.dgNumber === "DG-2") {
          dg2TotalConsumption += parseFloat(run.fuelConsumption || 0);
          dg2MaxEndkWH += parseFloat(run.kWHReading || 0);
          dg2TotalRunHours += parseFloat(run.totalRunHours || 0);
          if (startMeter < dg2MinStartMeter) dg2MinStartMeter = startMeter;
          if (endMeter > dg2MaxEndMeter) dg2MaxEndMeter = endMeter;
          if (run.remarks === "No Load") offLoadDG2Con += parseFloat(run.fuelConsumption || 0);
          if (run.remarks === "No Load") offLoadDG2Run += parseFloat(run.totalRunHours || 0);
          dg2FuelFill += parseFloat(run.fuelFill || 0);
        }
      });

      // --- Update the form state with aggregated data ---
      setForm((prevForm) => ({
        ...prevForm,
        // Only update if runs were found for that DG
        "DG-1 Fuel Closing": dg1TotalConsumption >= 0 ? (prevForm["DG-1 Fuel Opening"] - dg1TotalConsumption + dg1FuelFill).toFixed(2) : (Number(prevForm["DG-1 Fuel Closing"]) + Number(prevForm["DG-1 Fuel Filling"])).toFixed(2),
        "DG-2 Fuel Closing": dg2TotalConsumption >= 0 ? (prevForm["DG-2 Fuel Opening"] - dg2TotalConsumption + dg2FuelFill).toFixed(2) : (Number(prevForm["DG-2 Fuel Closing"]) + Number(prevForm["DG-2 Fuel Filling"])).toFixed(2),
        "DG-1 KWH Closing": dg1MaxEndkWH >= 0 ? (Number(prevForm["DG-1 KWH Opening"]) + dg1MaxEndkWH).toFixed(2) : (prevForm["DG-1 KWH Opening"]).toFixed(2),
        "DG-2 KWH Closing": dg2MaxEndkWH >= 0 ? (Number(prevForm["DG-2 KWH Opening"]) + dg2MaxEndkWH).toFixed(2) : (prevForm["DG-2 KWH Opening"]).toFixed(2),
        "DG-1 Off Load Fuel Consumption": offLoadDG1Con > 0 ? offLoadDG1Con : 0,
        "DG-2 Off Load Fuel Consumption": offLoadDG2Con > 0 ? offLoadDG2Con : 0,
        "DG-1 Off Load Hour": offLoadDG1Run > 0 ? offLoadDG1Run.toFixed(1) : 0,
        "DG-2 Off Load Hour": offLoadDG2Run > 0 ? offLoadDG2Run.toFixed(1) : 0,
        "DG-1 Hour Closing": dg1MaxEndMeter > 0 ? dg1MaxEndMeter : prevForm["DG-1 Hour Opening"],

        "DG-2 Hour Closing": dg2MaxEndMeter > 0 ? dg2MaxEndMeter : prevForm["DG-2 Hour Opening"],
        "DG-1 Fuel Filling": dg1FuelFill > 0 ? dg1FuelFill : (Number(prevForm["DG-1 Fuel Filling"]) || 0),
        "DG-2 Fuel Filling": dg2FuelFill > 0 ? dg2FuelFill : (Number(prevForm["DG-2 Fuel Filling"]) || 0),

        // Note: The form calculates total consumption from opening/closing fuel.
        // This aggregated value is useful for verification or other logic.
        // For now, we'll focus on populating meter readings.
      }));

      setDayFuelCon(() => (dg1TotalConsumption + dg2TotalConsumption));
      setDayFuelFill(() => (dg1FuelFill + dg2FuelFill));
      setDayRunningHrs(() => (dg1TotalRunHours + dg2TotalRunHours));
      setDayOnLoadRunHrs(() => (dg1TotalRunHours + dg2TotalRunHours - offLoadDG1Run - offLoadDG2Run));
      if (dayFuelFill > 0) alert("View CCMS");
      // setDayLogs(runs);

    } catch (err) {
      console.error("Error fetching and aggregating run logs:", err);
    }
  };

  // Current month logs - previous year same month
  const fetchPreviousYearLogs = async () => {
    if (!siteName || !selectedMonth) return [];

    const [year, month] = selectedMonth.split("-");
    const prevYearMonth = `${Number(year) - 1}-${month}`;

    try {
      const snap = await getDocs(
        collection(db, "dailyDGLogs", siteName, prevYearMonth)
      );

      return snap.docs.map(d => d.data());
    } catch (err) {
      console.error("Previous year fetch failed", err);
      return [];
    }
  };

  // YOY Data
  const yoy = (current, previous) => {
    if (!previous || previous === 0) return "N/A";
    return (((current - previous) / previous) * 100).toFixed(1) + "%";
  };

  // YOY Chart
  const buildYoYChartData = (current, previous) => [
    {
      name: "DG KWH",
      Current: current.totalDGKWH,
      Previous: previous.totalDGKWH,
    },
    {
      name: "EB KWH",
      Current: current.totalEBKWH,
      Previous: previous.totalEBKWH,
    },
    {
      name: "Solar KWH",
      Current: current.totalSolarKWH,
      Previous: previous.totalSolarKWH,
    },
  ];

  // Fetch Multy Year Data
  const fetchMultiYearData = async (years = 5) => {
    if (!siteName || !selectedMonth) return [];

    const [year, month] = selectedMonth.split("-");
    const result = [];

    for (let i = 0; i < years; i++) {
      const targetYear = Number(year) - i;
      const ym = `${targetYear}-${month}`;

      try {
        const snap = await getDocs(
          collection(db, "dailyDGLogs", siteName, ym)
        );

        const logs = snap.docs.map(d => d.data());
        const summary = calculateMonthlySummary(logs, calculateFields, siteConfig);

        if (summary) {
          result.push({
            year: targetYear,
            DG_KWH: summary.totalDGKWH,
            Fuel: summary.totalFuel,
            PUE: Number(summary.avgPUE.toFixed(2)),
          });
        }
      } catch (err) {
        console.error("Trend fetch failed:", ym, err);
      }
    }

    return result.reverse(); // Old → New
  };

  // Detect Next Unfilled Date Logs
  const getNextUnfilledDate = async () => {
    if (!siteName) return getFormattedDate();

    try {
      const todayStr = getFormattedDate();
      const today = new Date(todayStr);

      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const yesterdayStr = y.toISOString().split("T")[0];
      const monthKey = y.toISOString().slice(0, 7);

      // 🔍 Check if yesterday log exists
      const q = query(
        collection(db, "dailyDGLogs", siteName, monthKey),
        where("Date", "==", yesterdayStr),
        limit(1)
      );

      const snap = await getDocs(q);

      // ❌ Yesterday NOT filled → return yesterday
      if (snap.empty) {
        return yesterdayStr;
      }

      // ✅ Yesterday already filled → return today
      return todayStr;

    } catch (err) {
      console.error("getNextUnfilledDate error:", err);
      return getFormattedDate();
    }
  };

  const getYesterdayLog = async (currentDate) => {
    if (!currentDate || !siteName) return null;

    // Always compute yesterday safely
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 1);

    const ymd = d.toISOString().split("T")[0];   // YYYY-MM-DD
    const monthKey = d.toISOString().slice(0, 7); // YYYY-MM

    try {
      const q = query(
        collection(db, "dailyDGLogs", siteName, monthKey),
        where("Date", "==", ymd),
        limit(1)
      );

      const snap = await getDocs(q);
      return snap.empty ? null : snap.docs[0].data();

    } catch (err) {
      console.error("getYesterdayLog failed:", err);
      return null;
    }
  };

  useEffect(() => {
    const initDate = async () => {
      const nextDate = await getNextUnfilledDate();

      setForm(prev => ({
        ...prev,
        Date: nextDate
      }));

      // 🔁 Keep month in sync
      setSelectedMonth(nextDate.slice(0, 7));
    };

    fetchLogs();
    fetchAndAggregateRuns(form.Date)
    initDate();
  }, [siteName]);

  // Fetch EB rate from Firestore / Fetch fuel rate from Firestore / Fetch Site Configs from Firestore / Fetch Last Fuel Filling from dailyDGLogs db from Firestore 
  useEffect(() => {
    // Fetch EB rate from Firestore
    const fetchEBRate = async () => {
      try {
        const docRef = doc(db, "EBRates", userData?.site);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setEBRate(docSnap.data().rate || 0);
        } else {
          setEBRate(0); // default if no rate stored
        }
      } catch (err) {
        console.error("Error fetching EB rate:", err);
      }
    };

    // Fetch fuel rate from Firestore
    const fetchFuelRate = async () => {
      try {
        const docRef = doc(db, "fuelRates", userData?.site);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setFuelRate(docSnap.data().rate || 0);
        } else {
          setFuelRate(0); // default if no rate stored
        }
      } catch (err) {
        console.error("Error fetching fuel rate:", err);
      }
    };

    // Fetch Site Configs from Firestore
    const fetchConfig = async () => {
      if (!siteKey) return;
      const snap = await getDoc(doc(db, "siteConfigs", siteKey));
      if (snap.exists()) {
        setSiteConfig(snap.data());
      }
    };

    // Fetch Last Fuel Filling from dailyDGLogs db from Firestore
    const fetchLastFilling = async () => {
      setLoadingFilling(true);
      let lf = findLastFillingInDailyLogs(logs);

      if (!lf) {
        try {
          const today = new Date();
          const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          const prevMonthKey =
            prev.toLocaleString("en-US", { month: "short" }).toLowerCase() +
            "-" +
            prev.getFullYear();

          const prevSnap = await getDocs(
            collection(db, "dailyDGLogs", userData.site, prevMonthKey)
          );

          if (!prevSnap.empty) {
            const prevLogs = prevSnap.docs.map((d) => d.data());
            lf = findLastFillingInDailyLogs(prevLogs);
          }
        } catch (err) {
          console.error("Error fetching previous month dailyDGLogs:", err);
        }
      }

      if (!lf) {
        lf = await findLastFillingInDGLogs(userData.site, 3);
      }

      setLastFilling(lf);
      setLoadingFilling(false);
      localStorage.setItem("lastFilling", JSON.stringify(lf))
    };

    fetchLastFilling();

    fetchConfig();
    fetchEBRate();
    fetchFuelRate();

  }, [logs, userData?.site, siteKey]);


  // Get Yesterday Log
  useEffect(() => {

    if (!form?.Date) return;

    const loadYesterday = async () => {
      const data = await getYesterdayLog(form.Date);
      setYesterdayLog(data);
    };

    loadYesterday();
  }, [form?.Date]);



  useEffect(() => {
    if (logs.length > 0 && form.Date) {
      // if (!yesterdayLog) return;
      const yesterday = yesterdayLog;
      // ✅ CALL THE NEW FUNCTION HERE
      fetchAndAggregateRuns(form.Date);
      if (yesterday) {
        setForm((prev) => ({
          ...prev,
          Date: form.Date,   // keep current selected date
          "DG-1 KWH Opening": yesterday["DG-1 KWH Closing"] || "",
          "DG-2 KWH Opening": yesterday["DG-2 KWH Closing"] || "",
          "DG-1 Fuel Opening": yesterday["DG-1 Fuel Closing"] || "",
          "DG-2 Fuel Opening": yesterday["DG-2 Fuel Closing"] || "",
          "DG-1 Hour Opening": yesterday["DG-1 Hour Closing"] || "",
          "DG-2 Hour Opening": yesterday["DG-2 Hour Closing"] || "",
          "EB-1 KWH Opening": yesterday["EB-1 KWH Closing"] || "",
          "EB-2 KWH Opening": yesterday["EB-2 KWH Closing"] || "",
        }));
      }

      const totalOnLoadHrs =
        allValues.reduce(
          (sum, cl) => sum + (cl["DG-1 ON Load Hour"] || 0) + (cl["DG-2 ON Load Hour"] || 0),
          0
        );
      const totalOnLoadCon =
        allValues.reduce(
          (sum, cl) => sum + (cl["DG-1 ON Load Consumption"] || 0) + (cl["DG-2 ON Load Consumption"] || 0),
          0
        );
      const availableFuel =
        (parseFloat(form["DG-1 Fuel Opening"]) || 0) +
        (parseFloat(form["DG-2 Fuel Opening"]) || 0);
      const currentFuel = availableFuel - dayFuelCon + dayFuelFill;
      const currentHrs = currentFuel / (totalOnLoadCon / totalOnLoadHrs)
      setFuelAlert(currentHrs < 20 && currentFuel > 0);
      if (currentHrs < 20 && currentFuel > 0) alert("Give Fuel Requisition");

    }

  }, [logs, form.Date, dayFuelCon, dayFuelFill]);   // ✅ run also when Date changes


  // 🔹 Year-over-Year comparison
  useEffect(() => {

    if (!logs.length) return;

    const loadComparison = async () => {
      const prevLogs = await fetchPreviousYearLogs();

      setCurrentSummary(
        calculateMonthlySummary(logs, calculateFields, siteConfig)
      );

      setPreviousSummary(
        calculateMonthlySummary(prevLogs, calculateFields, siteConfig)
      );
    };

    if (!selectedMonth || !siteName) return;

    const loadTrend = async () => {
      setLoadingTrend(true);
      const data = await fetchMultiYearData(5);
      setMultiYearData(data);
      setLoadingTrend(false);
    };

    loadTrend();

    loadComparison();
    // fetchLogs();

  }, [selectedMonth, siteName, logs]);

  // Refresh Current Fuel and Total Unit Consumption
  useEffect(() => {
    {
      logs.map((entry) => {
        const calculated = calculateFields(entry, siteConfig);
        const totalkW = calculated["Total Unit Consumption"];
        const currentFuel =
          allValues.reduce(
            (sum, cl) => (Number(cl["DG-1 Fuel Closing"]) || 0) + (Number(cl["DG-2 Fuel Closing"]) || 0),
            0
          );
        setTotalkW(() => totalkW)
        setFuelAvalable(() => currentFuel)
      })
    }
  }, [logs, allValues])

  // 🔹 Handle input
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const getMonthFromDate = (dateStr) => dateStr?.slice(0, 7);

  const clampDateToMonth = (yearMonth, currentDate) => {
    if (!currentDate) return `${yearMonth}-01`;

    const [y, m] = yearMonth.split("-").map(Number);
    const day = Number(currentDate.split("-")[2] || 1);

    const lastDay = new Date(y, m, 0).getDate(); // last day of month
    const safeDay = Math.min(day, lastDay);

    return `${yearMonth}-${String(safeDay).padStart(2, "0")}`;
  };

  const handleDateChange = async (newDate) => {
    if (!newDate) return;
    if (newDate > getFormattedDate()) {
      alert("Future date entry not allowed");
      return;
    }
    const newMonth = getMonthFromDate(newDate);

    // 🔁 Sync Month when Date changes
    if (newMonth !== selectedMonth) {
      setSelectedMonth(newMonth);
    }
    // 1️⃣ Check if current date already exists
    const existing = logs.find((entry) => entry.Date === newDate);
    if (existing) {
      setForm({ ...existing, Date: newDate });
      fetchAndAggregateRuns(newDate);
      return;
    }

    // 2️⃣ Get yesterday (cross-month safe)
    const yesterday = await getYesterdayLog(newDate);

    if (yesterday) {
      setForm({
        Date: newDate,
        "DG-1 KWH Opening": yesterday["DG-1 KWH Closing"] || "",
        "DG-2 KWH Opening": yesterday["DG-2 KWH Closing"] || "",
        "DG-1 Fuel Opening": yesterday["DG-1 Fuel Closing"] || "",
        "DG-2 Fuel Opening": yesterday["DG-2 Fuel Closing"] || "",
        "DG-1 Hour Opening": yesterday["DG-1 Hour Closing"] || "",
        "DG-2 Hour Opening": yesterday["DG-2 Hour Closing"] || "",
        "EB-1 KWH Opening": yesterday["EB-1 KWH Closing"] || "",
        "EB-2 KWH Opening": yesterday["EB-2 KWH Closing"] || "",
      });
    } else {
      // 3️⃣ Absolute fallback
      setForm({ Date: newDate });
    }

    // 4️⃣ Aggregate runs AFTER opening values exist
    fetchAndAggregateRuns(newDate);
  };

  // 🔹 Save entry
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.Date) return alert("Date is required");
    // if (form.Date !== await getNextUnfilledDate()) {
    //   return alert("Please fill logs sequentially. Skipped date detected.");
    // }

    const nextDate = await getNextUnfilledDate();

    // check all required input fields
    for (const field of inputFields) {
      if (form[field] === undefined) {
        return alert(`Please fill all fields before saving. Missing: ${field}`);
      }
    }

    // ✅ validation
    for (let i = 1; i <= dg; i++) {
      const kwhOpen = parseFloat(form[`DG-${i} KWH Opening`] || 0);
      const kwhClose = parseFloat(form[`DG-${i} KWH Closing`] || 0);
      const hrOpen = parseFloat(form[`DG-${i} Hour Opening`] || 0);
      const hrClose = parseFloat(form[`DG-${i} Hour Closing`] || 0);
      const fuelOpen = parseFloat(form[`DG-${i} Fuel Opening`] || 0);
      const fuelClose = parseFloat(form[`DG-${i} Fuel Closing`] || 0);
      const fuelFill = parseFloat(form[`DG-${i} Fuel Filling`] || 0);
      const offLoadFuelCon = parseFloat(form[`DG-${i} Off Load Fuel Consumption`] || 0);
      const offLoadHour = parseFloat(form[`DG-${i} Off Load Hour`] || 0);

      if (kwhClose < kwhOpen) {
        return alert(`DG-${i} KWH Closing cannot be less than Opening`);
      }
      if (hrClose < hrOpen) {
        return alert(`DG-${i} Hour Closing cannot be less than Opening`);
      }

      if (offLoadFuelCon < 0) {
        return alert(`DG-${i} Off Load Fuel Consumption cannot be negative`);
      }

      if (offLoadHour < 0) {
        return alert(`DG-${i} Off Load Hour cannot be negative`);
      }

      if (fuelFill > 0) {
        // in filling case → Closing must be greater than Opening
        if (fuelClose <= fuelOpen) {
          return alert(`DG-${i} Fuel Closing must be greater than Opening when filling fuel`);
        }
      } else {
        // in normal case → Closing must be less than or equal Opening
        if (fuelClose > fuelOpen) {
          return alert(`DG-${i} Fuel Closing cannot be greater than Opening (no fuel filling)`);
        }
      }
      // if (form.Date !== await getNextUnfilledDate()) {
      //   alert("Please fill previous pending date first");
      //   return;
      // }
    }

    // EB validation
    for (let i = 1; i <= eb; i++) {
      const ebOpen = parseFloat(form[`EB-${i} KWH Opening`] || 0);
      const ebClose = parseFloat(form[`EB-${i} KWH Closing`] || 0);
      if (ebClose < ebOpen) {
        return alert(`EB-${i} KWH Closing cannot be less than Opening`);
      }
    }

    // IT Load validation
    const smpsLoad = parseFloat(form["DCPS Load Amps"] || 0);
    if (smpsLoad < 0) {
      return alert("DCPS Load Amps cannot be negative");
    }
    const upsLoad = parseFloat(form["UPS Load KWH"] || 0);
    if (upsLoad < 0) {
      return alert("UPS Load KWH cannot be negative");
    }

    //Office kW Consumption
    const officeLoad = parseFloat(form["Office kW Consumption"] || 0);
    if (officeLoad < 0) {
      return alert("Office kW Consumption cannot be negative");
    }

    const monthKey = selectedMonth;
    const docRef = doc(db, "dailyDGLogs", siteName, monthKey, form.Date);

    await setDoc(docRef, { ...form, updatedBy: userData?.name, updatedAt: serverTimestamp() }, { merge: true });

    setForm({ Date: nextDate });
    setSelectedMonth(nextDate.slice(0, 7));
    fetchLogs();
    setShowEditModal(false);
  };

  // 🔹 Delete log
  const handleDelete = async (id) => {
    // Show a confirmation dialog and wait for user's choice
    const isConfirmed = window.confirm("Are you sure you want to delete this log? This action cannot be undone.");

    // Proceed only if the user clicks "OK" (confirm)
    if (isConfirmed) {
      try {
        const monthKey = selectedMonth;
        await deleteDoc(doc(db, "dailyDGLogs", siteName, monthKey, id));
        fetchLogs(); // Refresh the logs list after successful deletion
        console.log("Log successfully deleted!"); // Optional: for feedback
      } catch (error) {
        console.error("Error deleting log:", error); // Optional: for error handling
      }
    } else {
      // Optional: Log cancellation to the console if the user clicks "Cancel"
      console.log("Deletion cancelled by user.");
    }
  };

  // 🔹 Input fields
  const inputFields = [];

  const eb = siteConfig.siteName === userData?.site?.toUpperCase() ? siteConfig.ebCount : 0;
  const dg = siteConfig.siteName === userData?.site?.toUpperCase() ? siteConfig.dgCount : 0;
  const solar = siteConfig.siteName === userData?.site?.toUpperCase() ? siteConfig.solarCount : 0;

  // EBs
  for (let i = 1; i <= eb; i++) {
    inputFields.push(`EB-${i} KWH Opening`, `EB-${i} KWH Closing`);
  }

  // Solars
  for (let i = 1; i <= solar; i++) {
    inputFields.push(`Solar-${i} KWH Opening`, `Solar-${i} KWH Closing`);
  }


  // DGs
  for (let i = 1; i <= dg; i++) {
    inputFields.push(
      `DG-${i} KWH Opening`,
      `DG-${i} KWH Closing`,
      `DG-${i} Fuel Opening`,
      `DG-${i} Fuel Closing`,
      `DG-${i} Off Load Fuel Consumption`,
      `DG-${i} Fuel Filling`,
      `DG-${i} Hour Opening`,
      `DG-${i} Hour Closing`,
      `DG-${i} Off Load Hour`,
    );
  }

  // IT Load
  inputFields.push("DCPS Load Amps");
  inputFields.push("UPS Load KWH");
  inputFields.push("Office kW Consumption");


  // Down Tamplate For excel bluk upload
  const downloadDGLogTemplate = () => {
    const headers = ["Date"];

    // 🔹 EB (Dynamic)
    for (let i = 1; i <= eb; i++) {
      headers.push(
        `EB-${i} KWH Opening`,
        `EB-${i} KWH Closing`
      );
    }

    // 🔹 Solar (Dynamic)
    for (let i = 1; i <= solar; i++) {
      headers.push(
        `Solar-${i} KWH Opening`,
        `Solar-${i} KWH Closing`
      );
    }

    // 🔹 DG (Dynamic)
    for (let i = 1; i <= dg; i++) {
      headers.push(
        `DG-${i} KWH Opening`,
        `DG-${i} KWH Closing`,
        `DG-${i} Fuel Opening`,
        `DG-${i} Fuel Closing`,
        `DG-${i} Fuel Filling`,
        `DG-${i} Hour Opening`,
        `DG-${i} Hour Closing`,
        `DG-${i} Off Load Hour`,
        `DG-${i} Off Load Fuel Consumption`
      );
    }

    // 🔹 IT & Office Load
    headers.push(
      "UPS Load KWH",
      "DCPS Load Amps",
      "Office kW Consumption",
      "Remarks"
    );

    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DG_LOG");

    XLSX.writeFile(wb, "DG_Log_Template.xlsx");

  };


  const checkDuplicateDates = async (rows) => {
    const duplicates = [];

    for (const row of rows) {
      const monthKey = row.Date?.slice(0, 7);
      if (!monthKey) continue;

      const ref = doc(db, "dailyDGLogs", siteName, monthKey, row.Date);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        duplicates.push(row.Date);
      }
    }

    return duplicates;
  };

  const uploadDGLogs = async (rows) => {
    setIsUploadCalculate(true);
    setIsUploading(true);
    setUploadErrors([]);
    setUploadProgress(0);

    const errors = [];

    const duplicates = await checkDuplicateDates(rows);
    if (duplicates.length) {
      if (!window.confirm(
        `Data already exists for dates:\n${duplicates.join(", ")}\n\nOverwrite?`
      )) {
        setIsUploading(false);
        return;
      }
    }

    let completed = 0;

    for (const row of rows) {
      try {
        if (!row.Date || !/^\d{4}-\d{2}-\d{2}$/.test(row.Date)) {
          errors.push({ row, error: "Invalid Date format" });
          continue;
        }

        const monthKey = row.Date.slice(0, 7);
        const payload = {};
        const isNumericField = (key) => {
          return (
            key.includes("Fuel Filling") ||
            key.includes("Hour Closing") ||
            key.includes("Hour Opening") ||
            key.includes("Off Load")
          );
        };

        Object.keys(row).forEach((k) => {
          // if (isNumericField(k) && Number(value) < 0) {
          //   errors.push({ row, error: `${k} cannot be negative` });
          // }
          const value = row[k];

          if (value === "" || value === null || value === undefined) {
            payload[k] = null;
            return;
          }

          if (isNumericField(k)) {
            const num = Number(value);
            payload[k] = isNaN(num) ? null : num;
          } else {
            payload[k] = String(value).trim();
          }
        });

        payload.siteName = siteName;
        payload.updatedBy = userData?.email || "";
        payload.updatedAt = new Date();
        setIsUploadCalculate(false);
        await setDoc(
          doc(db, "dailyDGLogs", siteName, monthKey, row.Date),
          payload,
          { merge: true }
        );

        completed++;
        setUploadProgress(Math.round((completed / rows.length) * 100));

      } catch (err) {
        errors.push({ row, error: err.message });
      }
    }

    setUploadErrors(errors);
    setIsUploading(false);
    setShowPreview(false);
    fetchLogs();
    window.location.reload();
  };

  // Preview New data for uploading
  const handlePreviewDGExcel = async (file) => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets["DG_LOG"];

    if (!sheet) {
      alert("DG_LOG sheet not found");
      return;
    }

    const rows = XLSX.utils.sheet_to_json(sheet, {
      defval: "",
      raw: false,
    });

    setPreviewRows(rows);
    setShowPreview(true);
  };

  // 🔹 Download logs as Excel (Dynamic as per site config)
  const handleDownloadExcel = () => {
    if (!logs.length) {
      alert("No data available to download");
      return;
    }

    // 🔹 Dynamically map logs based on site configuration
    const exportData = logs.map((entry) => {
      const calculated = calculateFields(entry, siteConfig);
      const row = { "Location Name": siteConfig.siteName, "Site ID": siteConfig.siteId };

      row[`Date.......${formatMonthName(selectedMonth)}'${formatYear(selectedMonth)}`] = calculated.Date;

      // 🔸 DG Columns (Dynamic) 
      for (let i = 1; i <= (siteConfig.dgCount || 0); i++) {
        row[`DG-${i} KWH Opening`] = fmt(calculated[`DG-${i} KWH Opening`]);
        row[`DG-${i} KWH Closing`] = fmt(calculated[`DG-${i} KWH Closing`]);
        row[`DG-${i} KWH Generation`] = fmt(calculated[`DG-${i} KWH Generation`]);
      }

      // 🔸 EB Columns (Dynamic)  
      for (let i = 1; i <= (siteConfig.ebCount || 0); i++) {
        row[`EB-${i} KWH Opening`] = fmt(calculated[`EB-${i} KWH Opening`]);
        row[`EB-${i} KWH Closing`] = fmt(calculated[`EB-${i} KWH Closing`]);
        row[`EB-${i} KWH Generation`] = fmt(calculated[`EB-${i} KWH Generation`]);
      }

      // 🔸 Solar Columns (Dynamic)  
      for (let i = 1; i <= (siteConfig.solarCount || 0); i++) {
        row[`Solar-${i} KWH Opening`] = fmt(calculated[`Solar-${i} KWH Opening`]);
        row[`Solar-${i} KWH Closing`] = fmt(calculated[`Solar-${i} KWH Closing`]);
        row[`Solar-${i} KWH Generation`] = fmt(calculated[`Solar-${i} KWH Generation`]);
      }

      // 🔸 Both DG Run In Munites
      for (let i = 1; i <= (siteConfig.dgCount || 0); i++) {
        row[`DG-${i} Run Min`] = fmt(calculated[`DG-${i} Run Min`]);
      }

      // 🔸 DG Columns (Dynamic)
      for (let i = 1; i <= (siteConfig.dgCount || 0); i++) {
        row[`DG-${i} Fuel Opening`] = fmt(calculated[`DG-${i} Fuel Opening`]);
        row[`DG-${i} Fuel Closing`] = fmt(calculated[`DG-${i} Fuel Closing`]);
        row[`DG-${i} Fuel Filling`] = fmt(calculated[`DG-${i} Fuel Filling`]);
        row[`DG-${i} ON Load Consumption`] = fmt(calculated[`DG-${i} ON Load Consumption`]);
        row[`DG-${i} OFF Load Consumption`] = fmt(calculated[`DG-${i} OFF Load Consumption`]);
        row[`DG-${i} Fuel Consumption`] = fmt(calculated[`DG-${i} Fuel Consumption`]);
        row[`DG-${i} Hour Opening`] = fmt1(calculated[`DG-${i} Hour Opening`]);
        row[`DG-${i} Hour Closing`] = fmt1(calculated[`DG-${i} Hour Closing`]);
        row[`DG-${i} ON Load Hour`] = fmt1(calculated[`DG-${i} ON Load Hour`]);
        row[`DG-${i} OFF Load Hour`] = fmt1(calculated[`DG-${i} OFF Load Hour`]);
        row[`DG-${i} Running Hrs`] = fmt1(calculated[`DG-${i} Running Hrs`]);
        row[`DG-${i} CPH`] = fmt(calculated[`DG-${i} CPH`]);
        row[`DG-${i} SEGR`] = fmt(calculated[`DG-${i} SEGR`]);
      }

      // 🔸 Totals and Common Site Metrics
      row["Total DG KWH Generation"] = fmt(calculated["Total DG KWH"]);
      row["Total EB KWH Reading"] = fmt(calculated["Total EB KWH"]);
      row["Total Unit Consumption (EB+DG)"] = fmt(calculated["Total Unit Consumption"]);
      row["Total Fuel Consumption"] = fmt(calculated["Total DG Fuel"]);
      row["Total DG Run Hours"] = fmt1(calculated["Total DG Hours"]);
      row["Site Running kW"] = fmt(calculated["Site Running kW"] || (calculated["Total Unit Consumption"] / 24));
      row["DCPS Load Amps"] = fmt(calculated["DCPS Load Amps"]);
      row["UPS Load (kWh)"] = fmt(calculated["UPS Load KWH"]);
      row["Total IT Load (kWh)"] = fmt(calculated["Total IT Load KWH"]);
      row["Office Load (kW)"] = fmt(calculated["Office kW Consumption"]);
      row["PUE"] = fmt(calculated["PUE"]);

      return row;
    });

    // 🔹 Create worksheet and workbook
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DailyDGLogs");

    // 🔹 Get all headers
    const headers = Object.keys(exportData[0]);

    // 🔹 Style headers (different colors per section)
    headers.forEach((header, i) => {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
      ws[cellRef] = { t: "s", v: header };

      // Choose color group
      let color = "FFFFFF"; // DG Blue
      if (header.startsWith("EB")) color = "2E7D32"; // EB Green
      if (header.startsWith("DG-1")) color = "9D82B2";
      if (header.startsWith("DG-2")) color = "8298b2";
      if (header.startsWith("DG-1 Run Min")) color = "FFD700"; //DG-1 Run Min
      if (header.startsWith("DG-2 Run Min")) color = "FFD700"; //DG-1 Run Min
      if (header.startsWith("DG-1 ON Load Consumption")) color = "F35C48"; //DG-1 Run Min
      if (header.startsWith("DG-2 ON Load Consumption")) color = "F35C48"; //DG-1 Run Min
      if (header.startsWith("DG-1 OFF Load Consumption")) color = "F35C48"; //DG-1 Run Min
      if (header.startsWith("DG-2 OFF Load Consumption")) color = "F35C48"; //DG-1 Run Min
      if (header.startsWith("DG-1 ON Load Hour")) color = "F35C48"; //DG-1 Run Min
      if (header.startsWith("DG-2 ON Load Hour")) color = "F35C48"; //DG-1 Run Min
      if (header.startsWith("DG-1 OFF Load Hour")) color = "F35C48"; //DG-1 Run Min
      if (header.startsWith("DG-2 OFF Load Hour")) color = "F35C48"; //DG-1 Run Min
      if (header.startsWith("Total") || header === "PUE" || header === "Site Running kW") color = "F57C00"; // Orange

      // Apply header style
      ws[cellRef].s = {
        fill: { fgColor: { rgb: color } },
        font: { bold: true, color: { rgb: "000000" }, sz: 11 },
        alignment: { horizontal: "center", vertical: "center", wrapText: false, textRotation: 90 },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } },
        },
      };
    });

    // 🔹 Merge “Location Name” + “Site ID” columns (first two cells)
    const totalRows = exportData.length;
    // merge column A (Location Name)
    ws["!merges"] = [
      {
        s: { r: 1, c: 0 }, // start row 1 (2nd row in Excel, below header)
        e: { r: totalRows, c: 0 }, // end row (last data row), same column
      },
      {
        s: { r: 1, c: 1 }, // start Site ID column
        e: { r: totalRows, c: 1 },
      },
    ];

    // optional: center merged text
    ["A2", "B2"].forEach((ref) => {
      if (ws[ref]) {
        ws[ref].s = {
          ...ws[ref].s,
          alignment: {
            horizontal: "center",
            vertical: "center",
            textRotation: 90,   // ✅ rotate text upwards
            wrapText: true
          },
          font: { bold: true, color: { rgb: "000000" }, sz: 11 },
        };
      }
    });

    // 🔹 Add borders to all data cells
    const range = XLSX.utils.decode_range(ws["!ref"]);
    for (let R = 1; R <= range.e.r; ++R) {
      for (let C = 0; C <= range.e.c; ++C) {
        const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[cellRef]) continue; // skip empty
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

    // 🔹 Adjust column widths
    ws["!cols"] = headers.map(() => ({ wch: 12 }));

    // 🔹 Export Excel file
    XLSX.writeFile(
      wb,
      `DailyDGLogs_${siteName}_${formatMonthName(selectedMonth)}${formatYear(selectedMonth)}.xlsx`
    );
  };

  // 🔹 Download logs as Excel
  const handleDownloadExcelOnlyDGLogs = () => {
    if (!logs.length) {
      alert("No data available to download");
      return;
    }

    // Map logs with calculations
    const exportData = logs.map((entry) => {
      const calculated = calculateFields(entry, siteConfig);
      return {
        "Location Name": siteConfig.siteName,
        "Site ID": siteConfig.siteId,
        Date: calculated.Date,
        "DG-1 KWH Opening": fmt(calculated["DG-1 KWH Opening"]),
        "DG-1 KWH Closing": fmt(calculated["DG-1 KWH Closing"]),
        "DG-1 Generation": fmt(calculated["DG-1 KWH Generation"]),
        "DG-2 KWH Opening": fmt(calculated["DG-2 KWH Opening"]),
        "DG-2 KWH Closing": fmt(calculated["DG-2 KWH Closing"]),
        "DG-2 Generation": fmt(calculated["DG-2 KWH Generation"]),
      };
    });

    // Create worksheet + workbook
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DGLogs");

    // 🔹 Get all headers
    const headers = Object.keys(exportData[0]);

    headers.forEach((header, i) => {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
      ws[cellRef] = { t: "s", v: header };

      // Choose color group
      let color = "FFFFFF"; // DG Blue

      if (header.startsWith("DG-1")) color = "9D82B2";
      if (header.startsWith("DG-2")) color = "8298b2";

      // Apply header style
      ws[cellRef].s = {
        fill: { fgColor: { rgb: color } },
        font: { bold: true, color: { rgb: "000000" }, sz: 11 },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } },
        },
      };
    });

    // 🔹 Merge “Location Name” + “Site ID” columns (first two cells)
    const totalRows = exportData.length;
    // merge column A (Location Name)
    ws["!merges"] = [
      {
        s: { r: 1, c: 0 }, // start row 1 (2nd row in Excel, below header)
        e: { r: totalRows, c: 0 }, // end row (last data row), same column
      },
      {
        s: { r: 1, c: 1 }, // start Site ID column
        e: { r: totalRows, c: 1 },
      },
    ];

    // optional: center merged text
    ["A2", "B2"].forEach((ref) => {
      if (ws[ref]) {
        ws[ref].s = {
          ...ws[ref].s,
          alignment: {
            horizontal: "center",
            vertical: "center",
            textRotation: 90,   // ✅ rotate text upwards
            wrapText: true
          },
          font: { bold: true, color: { rgb: "000000" }, sz: 11 },
        };
      }
    });

    // 🔹 Add borders to all data cells
    const range = XLSX.utils.decode_range(ws["!ref"]);
    for (let R = 1; R <= range.e.r; ++R) {
      for (let C = 0; C <= range.e.c; ++C) {
        const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[cellRef]) continue; // skip empty
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

    // 🔹 Adjust column widths
    ws["!cols"] = headers.map(() => ({ wch: 12 }));

    // Export Excel file
    XLSX.writeFile(wb, `${siteName}_DGLogs_${formatMonthName(selectedMonth)}${formatYear(selectedMonth)}.xlsx`);
  };

  // 🔹 Field validation color
  const getFieldClass = (name) => {
    const [prefix, type] = name.split(" "); // ["DG-1", "KWH", "Opening"]

    const openingField = `${prefix} ${type} Opening`;
    const closingValue = parseFloat(form[name]);
    const openingValue = parseFloat(form[openingField]);

    if (type === "KWH") {
      const open = parseFloat(form[`${prefix} KWH Opening`]);
      const close = parseFloat(form[`${prefix} KWH Closing`]);
      if (form[`${prefix} KWH Closing`] === "") return "field-red";
      if (!isNaN(open) && !isNaN(close)) {
        return close >= open ? "field-green" : "field-red";
      }
    }

    if (type === "Hour") {
      const open = parseFloat(form[`${prefix} Hour Opening`]);
      const close = parseFloat(form[`${prefix} Hour Closing`]);
      if (form[`${prefix} Hour Closing`] === "") return "field-red";
      if (!isNaN(open) && !isNaN(close)) {
        return close >= open ? "field-green" : "field-red";
      }
    }

    if (type === "Fuel") {
      const open = parseFloat(form[`${prefix} Fuel Opening`]);
      const close = parseFloat(form[`${prefix} Fuel Closing`]);
      const fill = parseFloat(form[`${prefix} Fuel Filling`] || 0);
      if (form[`${prefix} Fuel Closing`] === "") return "field-red";
      if (!isNaN(open) && !isNaN(close)) {
        if (fill > 0) return close > open ? "field-green" : "field-red";
        return close <= open ? "field-green" : "field-red";
      }
    }
    // Default rule: closing must be >= opening
    if (form[name] === "" || isNaN(closingValue)) return "field-red";

    if (!isNaN(openingValue) && !isNaN(closingValue)) {
      return closingValue >= openingValue ? "field-green" : "field-red";
    }

    return "";
  };

  // 👇 Add this handler function inside the component
  const handleGenerateCCMS = (entry) => {
    // We pass the specific log entry, the site config, and the current fuel rate
    navigate("/ccms-copy", {
      state: {
        logData: calculateFields(entry, siteConfig), // Send the fully calculated data
        siteConfig: siteConfig,
        fuelRate: fuelRate,
      },
    });
  };

  // 👇 Add this handler function inside the component
  const handleGenerateDayCCMS = (entry) => {
    // We pass the specific log entry, the site config, and the current fuel rate
    navigate("/ccms-copy", {
      state: {
        logData: calculateFields(entry, siteConfig), // Send the fully calculated data
        siteConfig: siteConfig,
        fuelRate: fuelRate,
      },
    });
  };

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

  // Power Source Listener
  useEffect(() => {
    if (!userData?.site) return;

    const powerRef = doc(db, "sitePowerStatus", userData.site);

    const unsub = onSnapshot(powerRef, (snap) => {
      if (!snap.exists()) return;

      const data = snap.data();
      setPowerSource(data.powerSource);
      setUpdatedByName(data.updatedByName || "");
      setUpdatedAt(data.updatedAt ? data.updatedAt.toDate() : null);

      if (data.powerSource === "DG" && data.dgStartTime) {
        const start = data.dgStartTime.toDate();

        const tick = () => {
          const now = new Date();
          const liveSeconds =
            Math.floor((now - start) / 1000) + (data.dgTotalSeconds || 0);
          setDgSeconds(liveSeconds);
        };

        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);

      } else {
        // default EB if doc not exists
        setPowerSource("EB");
        setDgSeconds(data.dgTotalSeconds || 0);
      }
      setLoadingPower(false);
    });

    return () => unsub();
  }, [userData?.site]);

  return (
    <div className="daily-log-container" style={{ overflowX: "hidden" }}>
      <h1 style={{ color: "white", textAlign: "center", paddingBottom: "20px" }}> {/* dashboard-header */}
        <strong>
          ☣️ Daily DG Log Book
        </strong>

      </h1>

      <h1 style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: "20px" }}>
        <label style={{ fontSize: "12px"}}>
          Select Month:
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => {
              const newMonth = e.target.value;
              setSelectedMonth(newMonth);

              // 🔁 Sync Date with Month
              setForm((prev) => ({
                ...prev,
                Date: clampDateToMonth(newMonth, prev.Date),
              }));
            }}
            style={{fontSize:"12px"}}
            required
          />
        </label>

        <b className={`month ${formatMonthName(selectedMonth)}`}>
          <strong style={{ fontSize:"12px" }}>
            {formatMonthName(selectedMonth)}-{formatYear(selectedMonth)}
          </strong>
        </b>

        <label style={{fontSize:"12px"}}>
          Date:
          <input
            type="date"
            name="Date"
            value={form.Date || ""}
            onChange={(e) => handleDateChange(e.target.value)}
            style={{fontSize:"12px", borderRadius:"10px"}}
            required
          />
        </label>
      </h1>

      {/* <div className="chart-container" > */}
      {/* 🔹 New Monthly Stats */}
      {(() => {
        if (!logs.length) return null;

        // calculate all fields
        const calculatedLogs = logs.map((e) => calculateFields(e, siteConfig));

        // Average DG CPH (combined DG1+DG2)
        const cphValues = calculatedLogs.flatMap((cl) => [
          cl["DG-1 CPH"], cl["DG-2 CPH"],
        ]).filter((v) => v > 0);
        const monthlyAvgCPH =
          cphValues.length > 0
            ? (cphValues.reduce((a, b) => a + b, 0) / cphValues.length).toFixed(2)
            : 0;

        // Average IT Load
        const itLoad = calculatedLogs.flatMap((cl) => [
          cl["Total IT Load KWH"],
        ]).filter((v) => v > 0);
        const monthlyAvgITLoad =
          itLoad.length > 0
            ? (itLoad.reduce((a, b) => a + b, 0) / itLoad.length).toFixed(2)
            : 0;

        // Average Cooling Load
        const coolingLoad = calculatedLogs.flatMap((cl) => [
          cl["Cooling kW Consumption"],
        ]).filter((v) => v > 0);
        const monthlyAvgCoolingLoad =
          coolingLoad.length > 0
            ? (coolingLoad.reduce((a, b) => a + b, 0) / coolingLoad.length).toFixed(2)
            : 0;

        // Average Office Load
        const officeLoad = calculatedLogs.flatMap((cl) => [
          cl["Office kW Consumption"],
        ]).filter((v) => v > 0);
        const monthlyAvgOfficeLoad =
          officeLoad.length > 0
            ? ((officeLoad.reduce((a, b) => a + b, 0) / officeLoad.length) / 24).toFixed(2)
            : 0;


        // Totals
        const totalKwh = calculatedLogs.reduce((sum, cl) => sum + (cl["Total DG KWH"] || 0), 0);
        const totalEBKwh = calculatedLogs.reduce((sum, cl) => sum + (cl["Total EB KWH"] || 0), 0);
        const totalSolarKwh = calculatedLogs.reduce((sum, cl) => sum + (cl["Total Solar KWH"] || 0), 0);
        const totalFuel = calculatedLogs.reduce((sum, cl) => sum + (cl["Total DG Fuel"] || 0), 0);
        const totalHrs = calculatedLogs.reduce((sum, cl) => sum + (cl["Total DG Hours"] || 0), 0);
        const totalFilling = calculatedLogs.reduce((sum, cl) => sum + (cl["Total Fuel Filling"] || 0), 0);
        const yesterday = yesterdayLog;
        const availableFuel = (() => {
          if (!yesterday) return 0;
          return (
            (parseFloat(yesterday["DG-1 Fuel Closing"]) || 0) +
            (parseFloat(yesterday["DG-2 Fuel Closing"]) || 0)
          );
        })();

        // Indivisual DG Fuel Fill in Ltrs
        const totalDG1Kw =
          calculatedLogs.reduce(
            (sum, cl) => sum + (cl["DG-1 KWH Generation"] || 0),
            0
          );
        const totalDG2Kw =
          calculatedLogs.reduce(
            (sum, cl) => sum + (cl["DG-2 KWH Generation"] || 0),
            0
          );

        // Indivisual DG Fuel Fill in Ltrs
        const totalDG1Filling =
          calculatedLogs.reduce(
            (sum, cl) => sum + (cl["DG-1 Fuel Filling"] || 0),
            0
          );
        const totalDG2Filling =
          calculatedLogs.reduce(
            (sum, cl) => sum + (cl["DG-2 Fuel Filling"] || 0),
            0
          );

        // ON / OFF load Consupmtion
        const totalOnLoadCon =
          calculatedLogs.reduce(
            (sum, cl) => sum + (cl["DG-1 ON Load Consumption"] || 0) + (cl["DG-2 ON Load Consumption"] || 0),
            0
          );

        const totalDG1OnLoadCon =
          calculatedLogs.reduce(
            (sum, cl) => sum + (cl["DG-1 ON Load Consumption"] || 0),
            0
          );
        const totalDG2OnLoadCon =
          calculatedLogs.reduce(
            (sum, cl) => sum + (cl["DG-2 ON Load Consumption"] || 0),
            0
          );
        const totalOffLoadCon =
          calculatedLogs.reduce(
            (sum, cl) => sum + (cl["DG-1 OFF Load Consumption"] || 0) + (cl["DG-2 OFF Load Consumption"] || 0),
            0
          );
        const totalDG1OffLoadCon =
          calculatedLogs.reduce(
            (sum, cl) => sum + (cl["DG-1 OFF Load Consumption"] || 0),
            0
          );
        const totalDG2OffLoadCon =
          calculatedLogs.reduce(
            (sum, cl) => sum + (cl["DG-2 OFF Load Consumption"] || 0),
            0
          );

        // ON / OFF load hours + minutes
        const totalOnLoadHrs =
          calculatedLogs.reduce(
            (sum, cl) => sum + (cl["DG-1 ON Load Hour"] || 0) + (cl["DG-2 ON Load Hour"] || 0),
            0
          );
        const totalDG1OnLoadHrs =
          calculatedLogs.reduce(
            (sum, cl) => sum + (cl["DG-1 ON Load Hour"] || 0),
            0
          );
        const totalDG2OnLoadHrs =
          calculatedLogs.reduce(
            (sum, cl) => sum + (cl["DG-2 ON Load Hour"] || 0),
            0
          );
        const totalOffLoadHrs =
          calculatedLogs.reduce(
            (sum, cl) => sum + (cl["DG-1 OFF Load Hour"] || 0) + (cl["DG-2 OFF Load Hour"] || 0),
            0
          );
        const totalDG1OffLoadHrs =
          calculatedLogs.reduce(
            (sum, cl) => sum + (cl["DG-1 OFF Load Hour"] || 0),
            0
          );

        const totalDG2OffLoadHrs =
          calculatedLogs.reduce(
            (sum, cl) => sum + (cl["DG-2 OFF Load Hour"] || 0),
            0
          );

        // Convert total hours to hours and minutes
        const totalHrsMin = (totalHrs * 60).toFixed(0);
        const totalDG1OnLoadHrsMin = (totalDG1OnLoadHrs * 60).toFixed(0);
        const totalDG2OnLoadHrsMin = (totalDG2OnLoadHrs * 60).toFixed(0);
        const totalDG1OffLoadHrsMin = (totalDG1OffLoadHrs * 60).toFixed(0);
        const totalDG2OffLoadHrsMin = (totalDG2OffLoadHrs * 60).toFixed(0);
        const totalDG1HrsMin = ((totalDG1OnLoadHrs + totalDG1OffLoadHrs) * 60).toFixed(0);
        const totalDG2HrsMin = ((totalDG2OnLoadHrs + totalDG2OffLoadHrs) * 60).toFixed(0);
        const currentFuel = fmt(availableFuel - dayFuelCon + dayFuelFill);
        const fuelHours = fmt1(currentFuel / fmt1(totalOnLoadCon / totalOnLoadHrs));
        const tankCapacity = Number(siteConfig.dgDayTankCapacity) + Number(siteConfig.dgExtrnlTankCapacity);

        return (
          <div className="chart-container" >
            <div className="status-header">
              {(userData.role === 'Admin' || userData.role === 'Super Admin') && (
                <h2
                  className={`month ${formatMonthName(selectedMonth)}`}
                  style={{ cursor: "pointer", textAlign: "center" }}
                  onClick={() => navigate("/all-sites-dg-logs",
                    { state: { monthKey: selectedMonth } })}
                >
                  <b style={{ textDecoration: 'underline dotted blue' }}>
                    🖥️ All Sites DG Logs ⭆
                  </b>
                </h2>
              )}
              <h1 style={{ background: powerSource === "DG" ? "#d17272ff" : "#6ce9e35d", borderBottom: "3px solid #fff", borderTop: "3px solid #fff", borderRadius: "10px", color: "#746212ff" }}>
                <span onClick={() => window.location.reload()} style={{ cursor: "pointer" }} title="Refresh">🔄</span>
                Current Site Status
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
                  Site Live On:- <strong>{powerSource || "N/A"}</strong> Source
                </span>
              </h1>
              <h1 style={fuelHours < 18 ? { fontSize: "20px", color: "red", textAlign: "left" } : { fontSize: "20px", color: "green", textAlign: "left" }}><strong>⛽Present Stock – {currentFuel} ltrs. </strong></h1>
              <h1 style={fuelHours < 18 ? { fontSize: "20px", color: "red", textAlign: "left" } : { fontSize: "20px", color: "green", textAlign: "left" }}> <strong>⏱️BackUp Hours – {fuelHours} Hrs.</strong></h1>
              {/* ✅ Fuel Level Bar */}
              <div style={{ display: "flex", marginTop: "10px", fontSize: "18px" }}>
                🛢️<div className="fuel-bar-container" >
                  <div
                    className="fuel-bar"
                    style={{
                      width: `${(currentFuel / tankCapacity) * 100}%`,
                      background: `linear-gradient(to right, red, yellow, green)`,
                      color: "black",
                    }}
                  ></div>
                </div>
                <strong style={((currentFuel / tankCapacity) * 100) < 60 ? { color: "red" } : { color: "blue" }}>{((currentFuel / tankCapacity) * 100).toFixed(0)}%</strong>
              </div>
              <p style={{ fontSize: "10px", textAlign: "left", color: "#5c3c6ece" }}>Total Stock Capacity (Day Tank + External Tank) : <strong>{tankCapacity}Ltrs.</strong></p>
              <div style={{ display: "flex", marginTop: "0px", fontSize: "10px", maxWidth: "200px", height: "13px" }}>
                🛢️<p style={{ whiteSpace: "nowrap", color: "blue" }}>DG-1:</p><div className="fuel-bar-container" style={{ display: "flex" }}>
                  <p className="fuel-bar"
                    style={{
                      width: `${(form?.["DG-1 Fuel Closing"] / (tankCapacity / siteConfig?.dgCount)) * 100}%`,
                      background: `linear-gradient(to right, blue)`,
                      color: "white",
                      fontSize: "7px"

                    }}>⛽{form?.["DG-1 Fuel Closing"]}/{(tankCapacity / siteConfig?.dgCount).toFixed(2)} ltrs.
                  </p>
                </div>
                <strong style={((form?.["DG-1 Fuel Closing"] / (tankCapacity / siteConfig?.dgCount)) * 100) < 60 ? { color: "red" } : { color: "blue" }}>{((form?.["DG-1 Fuel Closing"] / (tankCapacity / 2)) * 100).toFixed(0)}%</strong>
              </div>

              <div style={{ display: "flex", marginTop: "0px", fontSize: "10px", maxWidth: "200px", height: "13px" }}>

                🛢️<p style={{ whiteSpace: "nowrap", color: "blue" }}>DG-2:</p><div className="fuel-bar-container" style={{ display: "flex" }}>
                  <p className="fuel-bar"
                    style={{
                      width: `${(form?.["DG-2 Fuel Closing"] / (tankCapacity / siteConfig?.dgCount)) * 100}%`,
                      background: `linear-gradient(to right, blue)`,
                      color: "white",
                      fontSize: "7px"


                    }}>⛽{form?.["DG-2 Fuel Closing"]}/{(tankCapacity / siteConfig?.dgCount).toFixed(2)} ltrs.</p>
                </div>
                <strong style={((form?.["DG-2 Fuel Closing"] / (tankCapacity / siteConfig?.dgCount)) * 100) < 60 ? { color: "red" } : { color: "blue" }}>{((form?.["DG-2 Fuel Closing"] / (tankCapacity / 2)) * 100).toFixed(0)}%</strong>
              </div>
              <div style={{ display: "flex", gap: "5px", marginTop: "10px" }}>
                <p style={{ textAlign: "Center", color: "black", fontSize: "12px", fontWeight: "bold", border: "1px solid #fff", borderRadius: "10px", background: "#6ce9e35d" }} ><p>Today Consumption </p> <span> <strong>{dayFuelCon} ltrs.</strong></span></p>
                <p style={{ textAlign: "Center", color: "black", fontSize: "12px", fontWeight: "bold", border: "1px solid #fff", borderRadius: "10px", background: "#6ce9e35d" }} ><p>Today DG Run</p> <span> <strong>{(dayRunningHrs).toFixed(1)} Hrs.</strong> <p style={{ fontSize: "8px" }}>({(dayRunningHrs * 60).toFixed(2)} Min.)</p></span></p>
                <p style={{ textAlign: "Center", color: "black", fontSize: "12px", fontWeight: "bold", border: "1px solid #fff", borderRadius: "10px", background: "#6ce9e35d" }} ><p>Total Power</p> <span> <strong>{(dayonLoadRunHrs).toFixed(1)} Hrs.</strong> <p style={{ fontSize: "8px" }}>({(dayonLoadRunHrs * 60).toFixed(2)} Min.)</p></span></p>
                <p style={{ textAlign: "Center", color: "black", fontSize: "12px", fontWeight: "bold", border: "1px solid #fff", borderRadius: "10px", background: "#6ce9e35d" }} ><p>Total Fuel Filled</p> <span><strong>{dayFuelFill} ltrs.</strong></span></p>
              </div>
            </div>

            <h1 style={{ borderTop: "3px solid #eee", color: "#fefeffff", textAlign: "center" }} className="noticeboard-header"><strong>📊Summery - {allValues.length} Days</strong>
            </h1>

            {/* Average PUE */}
            <p className={monthlyAvgPUE > 1.6 ? "avg-segr low" : "avg-segr high"}>
              Average PUE – <strong>{monthlyAvgPUE}</strong>
            </p>
            {/* Average SEGR */}
            <p className={monthlyAvgSEGR < 3 ? "avg-segr low" : "avg-segr high"}>
              Average SEGR – <strong>{monthlyAvgSEGR}</strong>
            </p>
            <p className={monthlyAvgDG1SEGR < 3 ? "avg-segr low" : "avg-segr high"} style={{ fontSize: "10px" }} >
              DG-1 Average SEGR – {monthlyAvgDG1SEGR}
            </p>
            <p className={monthlyAvgDG2SEGR < 3 ? "avg-segr low" : "avg-segr high"} style={{ fontSize: "10px" }} >
              DG-2 Average SEGR – {monthlyAvgDG2SEGR}
            </p>
            <p style={{ color: "#302f74ff" }}><strong>[Total Cost (EB + DG) – ₹{fmt((totalEBKwh * EBRate) + (totalFuel * fuelRate))}]</strong></p>
            <p style={{ borderTop: "3px solid #eee" }}>⚡ Site Running Load – <strong>{fmt(avgSiteRunningKw)} kWh</strong></p>
            <div style={{ display: "flex" }}>
              <div>
                <p><strong>📡 Avg IT Load – {monthlyAvgITLoad} kWh</strong></p>
                <p><strong>❄️ Avg Cooling Load – {monthlyAvgCoolingLoad} kWh</strong></p>
                <p><strong>🏢 Avg Office Load – {monthlyAvgOfficeLoad} kWh</strong></p>
                <p><strong>⛽ Avg DG CPH – {fmt1(totalOnLoadCon / totalOnLoadHrs)} Ltrs/Hrs</strong></p>
              </div>
              <div style={{ fontSize: "10px" }}>
                <p>⛽DG-1 OEM CPH – <strong>{siteConfig.designCph?.["DG-1" || ""]}Ltrs/⏱️</strong></p>

                <p>⛽DG-2 OEM CPH – <strong>{siteConfig.designCph?.["DG-2"] || ""}Ltrs/⏱️</strong></p>
              </div>
            </div>
            <p style={{ borderTop: "1px solid #eee", borderRadius: "10px" }}><strong>⚡ Total EB KW Consumption – {fmt(totalEBKwh)} units x </strong>
              ₹<input
                type="number"
                step="0.01"
                value={EBRate}
                onChange={handleEBChange}
                style={{ width: "60px", marginLeft: "4px", height: "20px" }}
              /><strong style={{ fontSize: "10px" }}>/Unit. = ₹{fmt(totalEBKwh * EBRate)}</strong>
            </p>
            {siteConfig.solarCount > 0 && (
              <p style={{ borderTop: "1px solid #eee" }}><strong>☀️ Total Solar KW Generation – {fmt(totalSolarKwh)} kW</strong></p>
            )}
            <p style={{ borderTop: "1px solid #eee" }}><strong>⚡ Total DG KW Generation – {fmt(totalKwh)} kW </strong><b style={{ fontSize: "10px" }}>(Cost: ₹{fmt((totalFuel * fuelRate) / totalKwh)}/kW)</b></p>
            <div style={{ display: "flex" }}>
              <p style={{ marginLeft: "20px" }}>
                • DG-1: <strong>{fmt1(totalDG1Kw)} kW</strong>
              </p>
              <p style={{ marginLeft: "20px" }}>
                • DG-2: <strong>{fmt1(totalDG2Kw)} kW</strong>
              </p>
            </div>
            <p style={{ borderTop: "1px solid #eee" }}>
              <strong>⛽ Total Fuel Filling – {fmt(totalFilling)}Ltrs. x </strong>
              ₹<input
                type="number"
                step="0.01"
                value={fuelRate}
                onChange={handleFuelChange}
                style={{ width: "70px", marginLeft: "4px", height: "20px" }}
              /><strong style={{ fontSize: "10px" }}>/Ltr. = ₹{fmt(totalFilling * fuelRate)}</strong>
            </p>
            <div style={{ display: "flex" }}>
              <p style={{ marginLeft: "20px" }}>
                • DG-1: <strong>{fmt1(totalDG1Filling)} Ltrs</strong>
              </p>
              <p style={{ marginLeft: "20px" }}>
                • DG-2: <strong>{fmt1(totalDG2Filling)} Ltrs</strong>
              </p>
            </div>

            <p style={{ borderTop: "1px solid #eee" }}><strong>⛽ Total Fuel Consumption – {fmt(totalFuel)}</strong><b style={{ fontSize: "10px" }}>Ltrs. = ₹{fmt(totalFuel * fuelRate)}</b></p>
            <div style={{ display: "flex" }}>
              <p style={{ marginLeft: "20px" }}>
                • DG-1: <strong>{fmt1(totalDG1OnLoadCon + totalDG1OffLoadCon)}</strong><b style={{ fontSize: "10px" }}>Ltrs. = ₹{fmt((totalDG1OnLoadCon + totalDG1OffLoadCon) * fuelRate)}</b>
              </p>
              <p style={{ marginLeft: "40px", fontSize: "11px" }}>
                - ON Load: <strong>{fmt1(totalDG1OnLoadCon)} Ltrs</strong>
              </p>
              <p style={{ marginLeft: "40px", fontSize: "11px" }}>
                - OFF Load: <strong>{fmt1(totalDG1OffLoadCon)} Ltrs</strong>
              </p>
            </div>
            <div style={{ display: "flex" }}>
              <p style={{ marginLeft: "20px" }}>
                • DG-2: <strong>{fmt1(totalDG2OnLoadCon + totalDG2OffLoadCon)}</strong><b style={{ fontSize: "10px" }}>Ltrs. = ₹{fmt((totalDG2OnLoadCon + totalDG2OffLoadCon) * fuelRate)}</b>
              </p>
              <p style={{ marginLeft: "40px", fontSize: "11px" }}>
                - ON Load: <strong>{fmt1(totalDG2OnLoadCon)} Ltrs</strong>
              </p>
              <p style={{ marginLeft: "40px", fontSize: "11px" }}>
                - OFF Load: <strong>{fmt1(totalDG2OffLoadCon)} Ltrs</strong>
              </p>
            </div>
            <p style={{ borderTop: "1px solid #eee" }}><strong>⏱️ Total DG Run Hours – {fmt1(totalHrs)} Hour</strong> ({totalHrsMin} min)</p>
            <div style={{ display: "flex" }}>
              <p style={{ marginLeft: "20px" }}>
                • DG-1: <strong>{fmt1(totalDG1OnLoadHrs + totalDG1OffLoadHrs)} hrs</strong> ({totalDG1HrsMin} min)
              </p>
              <p style={{ marginLeft: "40px", fontSize: "11px" }}>
                - ON Load: <strong>{fmt1(totalDG1OnLoadHrs)} hrs</strong> ({totalDG1OnLoadHrsMin} min)
              </p>
              <p style={{ marginLeft: "40px", fontSize: "11px" }}>
                - OFF Load: <strong>{fmt1(totalDG1OffLoadHrs)} hrs</strong> ({totalDG1OffLoadHrsMin} min)
              </p>
            </div>
            <div style={{ display: "flex" }}>
              <p style={{ marginLeft: "20px" }}>
                • DG-2: <strong>{fmt1(totalDG2OnLoadHrs + totalDG2OffLoadHrs)} hrs</strong> ({totalDG2HrsMin} min)
              </p>
              <p style={{ marginLeft: "40px", fontSize: "11px" }}>
                - ON Load: <strong>{fmt1(totalDG2OnLoadHrs)} hrs</strong> ({totalDG2OnLoadHrsMin} min)
              </p>
              <p style={{ marginLeft: "40px", fontSize: "11px" }}>
                - OFF Load: <strong>{fmt1(totalDG2OffLoadHrs)} hrs</strong> ({totalDG2OffLoadHrsMin} min)
              </p>
            </div>
            {/* Last update info */}
            {(userData?.role === "Super Admin" ||
              userData?.role === "Admin" ||
              userData?.role === "Super User") &&
              (() => {
                const entry = logs.find((e) => e.Date === form.Date);
                return entry ? (
                  <p style={{ fontSize: 12, color: "#666" }}>
                    Last Update By: <strong>{entry.updatedBy}</strong>{" "}
                    {entry.updatedAt && (typeof entry.updatedAt.toDate === 'function'
                      ? entry.updatedAt.toDate().toLocaleString()
                      : new Date(entry.updatedAt).toLocaleString())}
                  </p>
                ) : null;
              })()
            }
          </div>
        );
      })()}

      {/* Manage Data */}
      <div className="noticeboard-header">
        <h1 className={`month ${formatMonthName(selectedMonth)}`}>
          <strong>
            {formatMonthName(selectedMonth)}
          </strong>
        </h1>


        {/* 🔹 Last Fuel Filling */}
        {loadingFilling ? (
          <p style={{ fontSize: "10px", color: "gray" }}>⏳ Loading last fuel filling...</p>
        ) : lastFilling ? (
          <p style={{ color: "#34c0cacb", fontSize: "10px" }}>
            📅 Last Fuel Filling – <strong>{lastFilling.Date}</strong> :{" "}
            <strong>
              DG–1 {fmt1(lastFilling.DG1)} Ltrs - {lastFilling.DG1Hrs},{" "}
              DG–2 {fmt1(lastFilling.DG2)} Ltrs - {lastFilling.DG2Hrs}
            </strong>
          </p>
        ) : (
          <p style={{ fontSize: "10px", color: "red" }}>⚠️ No fuel filling records found.</p>
        )}

        <button
          className="segr-manage-btn warning"
          onClick={() => navigate('/dg-log-table', { state: { totalkW, fuelAvalable, siteConfig, dayFuelCon } })}
        >
          🔰 DG Run Logs
        </button>
        {fuelAlert === true && (userData?.role === "Super Admin" ||
          userData?.role === "Admin" ||
          userData?.role === "Super User") && (
            <button
              className="pm-manage-btn danger"
              onClick={() =>
                navigate("/fuel-requisition", {
                  state: { logs, siteName, avgSiteRunningKw, fuelRate, userData, siteConfig },
                })
              }
            >
              ⛽ Generate Fuel Request
            </button>
          )}

        {dayFuelFill > 0 && (userData?.role === "Super Admin" ||
          userData?.role === "Admin" ||
          userData?.role === "Super User") && (
            <button
              className="pm-manage-btn"
              onClick={() => handleGenerateDayCCMS(form)}
            >
              🧾 Generate {form.Date} CCMS
            </button>
          )}

        {/* <div className="controls"> */}

        <button
          className="segr-manage-btn info"
          onClick={() => setShowEditModal(!showEditModal)}
        >
          {showEditModal ? "✖ Close" : "✎ Add / Edit Daily DG Log Entry"}
        </button>
        {/* </div> */}

        {showEditModal && (
          <div className="modal-overlay" style={{ overflowY: "auto", width: "inherit" }}>
            <div className="modal-content">
              <h1 onClick={(() => setShowEditModal(false))} className="pm-manage-btn" style={{ position: "sticky", top: "0", zIndex: "2" }}>X</h1>
              <p>View & Edit</p>
              <div>
                Selected Date: <strong style={{ color: "blue" }}>
                  {form.Date}
                </strong>
              </div>

              <form className="daily-log-form" onSubmit={handleSubmit}>
                <label>
                  Date:
                  <input
                    type="date"
                    name="Date"
                    value={form.Date || ""}
                    onChange={(e) => handleDateChange(e.target.value)}
                    required
                  />
                </label>

                {inputFields.map((field) => {
                  // list of always disabled fields
                  const alwaysDisabled = [
                    "DG-1 Fuel Opening",
                    "DG-2 Fuel Opening",
                    "DG-1 KWH Opening",
                    "DG-2 KWH Opening",
                    "EB-1 KWH Opening",
                    "EB-2 KWH Opening",
                    "DG-1 Hour Opening",
                    "DG-2 Hour Opening",
                    "DG-1 Off Load Hour",
                    "DG-2 Off Load Hour",
                    "DG-1 Off Load Fuel Consumption",
                    "DG-2 Off Load Fuel Consumption",
                    "DG-1 Fuel Filling",
                    "DG-2 Fuel Filling",
                  ];

                  // list of closing fields (special condition)
                  const closingFields = [
                    "DG-1 KWH Closing",
                    "DG-2 KWH Closing",
                    "DG-1 Hour Closing",
                    "DG-2 Hour Closing",
                    "DG-1 Fuel Closing",
                    "DG-2 Fuel Closing",
                  ];

                  let disabled = false;

                  if (alwaysDisabled.includes(field)) {
                    disabled = !!form[field];
                  } else if (closingFields.includes(field)) {
                    // disable if it already has a value
                    disabled = !!form[field];
                  } else if (alwaysDisabled.includes(field) && closingFields.includes(field)) {
                    disabled = !!logs.length
                  }

                  return (
                    <label key={field}>
                      {field}:
                      <input
                        type="number"
                        step="any"
                        name={field}
                        value={form[field] > 0 ? form[field] : 0}
                        onChange={handleChange}
                        className={`${form[field] === "" || form[field] === undefined ? "input-missing" : ""} ${getFieldClass(field)}`}
                        disabled={disabled}
                      />
                    </label>
                  );
                })}

                <button className="submit-btn" type="submit">Save Entry</button>
              </form>
            </div>
          </div>
        )}

        {(userData?.name === "Crash Algo" || userData?.designation === "Vertiv Site Infra Engineer") && (
          <div className="child-container" style={{ border: "1px solid #000", borderRadius: "15px" }}>
            <h2>⚡ DG Log Bulk Upload</h2>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label>📥 Bulk DG Log Upload:</label>
              <b onClick={downloadDGLogTemplate}
                style={{ fontSize: "12px", height: "fit-content", cursor: "pointer", color: "blue", textDecoration: "underline" }}>
                📥Download DG Log Excel Template
              </b>
            </div>
            <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "10px" }}>
              <label>Upload DG Log Excel File:</label>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={(e) => handlePreviewDGExcel(e.target.files[0])}
              />
            </div>

            {showPreview && (
              <div className="child-container" >
                <h1>DG Log Upload Preview</h1>

                <div className="table-container">

                  <table>
                    <thead>
                      <tr>
                        {Object.keys(previewRows[0] || {}).map(h => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.slice(0, 100).map((row, i) => (
                        <tr key={i}>
                          {Object.values(row).map((v, j) => (
                            <td key={j}>{v}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                </div>

                {previewRows.length > 31 && <p>Showing first 31 rows of {previewRows.length} total rows.</p>}
                <div style={{ marginTop: "10px" }}>
                  <button onClick={() => uploadDGLogs(previewRows)} style={{ width: "120px", marginRight: "10px" }}>
                    Confirm Upload
                  </button>
                  <button onClick={() => {
                    setShowPreview(false);
                    setPreviewRows([]);
                    window.location.reload();
                  }} style={{ width: "120px" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {isUploading && (
              <div>
                <h4>{isUploadCalculate ? "Calculating" : "Uploading"}... Please wait.</h4>
                <progress value={uploadProgress} max="100" />
                <span>{uploadProgress}%</span>
              </div>
            )}
            {uploadErrors.length > 0 && (
              <div>
                <h4>Upload Errors</h4>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadErrors.map((e, i) => (
                      <tr key={i}>
                        <td>{e.row?.Date}</td>
                        <td>{e.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        )}
        <button onClick={() => navigate("/monthly-data", {
          state: { logs, siteConfig, selectedMonth },
        })} className="sidepanel-manage-btn" style={{ background: "blue" }}>
          📊 Preview Monthly Data
        </button>
      </div>

      {/* Summery Charts */}
      {isAdmin || userData?.designation === "Vertiv Site Infra Engineer" ? (
        <div style={{
          background: "#1e293b",
          padding: "15px",
          borderRadius: "10px",
          marginBottom: "25px",
          color: "white",
        }}
        >
          {!loadingTrend && multiYearData.length === 0 && (
            <p style={{ color: "#888" }}>
              No historical data available for previous years
            </p>
          )}
          {loadingTrend && <p>Loading multi-year trend...</p>}

          {multiYearData.length > 0 && (
            <div className="chart-box">

              <h3>📈 Multi-Year Trend (Same Month)</h3>

              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={multiYearData}>
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line dataKey="DG_KWH" />
                  <Line dataKey="Fuel" />
                  <Line dataKey="PUE" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {currentSummary && previousSummary && (
            <div className="chart-box">
              <h3>📊 YoY Energy Comparison</h3>

              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={buildYoYChartData(currentSummary, previousSummary)}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Current" />
                  <Bar dataKey="Previous" />
                </BarChart>
              </ResponsiveContainer>

              <ResponsiveContainer width="100%" height={250}>
                <LineChart
                  data={[
                    {
                      name: "Fuel",
                      Current: currentSummary.totalFuel,
                      Previous: previousSummary.totalFuel,
                    },
                    {
                      name: "PUE",
                      Current: currentSummary.avgPUE,
                      Previous: previousSummary.avgPUE,
                    },
                  ]}
                >
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line dataKey="Current" />
                  <Line dataKey="Previous" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {currentSummary && previousSummary && (
            <div className="table-container" style={{ scrollbarWidth: "thin" }}>
              <h2>📊 YoY Compare Analysis ({formatMonthName(selectedMonth)})</h2>

              <table >
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Current Year</th>
                    <th>Previous Year</th>
                    <th>YoY Change</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Total DG KWH</td>
                    <td>{fmt(currentSummary.totalDGKWH)}</td>
                    <td>{fmt(previousSummary.totalDGKWH)}</td>
                    <td>{yoy(currentSummary.totalDGKWH, previousSummary.totalDGKWH)}</td>
                  </tr>

                  <tr>
                    <td>Total EB KWH</td>
                    <td>{fmt(currentSummary.totalEBKWH)}</td>
                    <td>{fmt(previousSummary.totalEBKWH)}</td>
                    <td>{yoy(currentSummary.totalEBKWH, previousSummary.totalEBKWH)}</td>
                  </tr>

                  <tr>
                    <td>Total Solar KWH</td>
                    <td>{fmt(currentSummary.totalSolarKWH)}</td>
                    <td>{fmt(previousSummary.totalSolarKWH)}</td>
                    <td>{yoy(currentSummary.totalSolarKWH, previousSummary.totalSolarKWH)}</td>
                  </tr>

                  <tr>
                    <td>Total Fuel Consumption</td>
                    <td>{fmt(currentSummary.totalFuel)}</td>
                    <td>{fmt(previousSummary.totalFuel)}</td>
                    <td>{yoy(currentSummary.totalFuel, previousSummary.totalFuel)}</td>
                  </tr>

                  <tr>
                    <td>Avg Site Running kW</td>
                    <td>{fmt(currentSummary.avgSiteKW)}</td>
                    <td>{fmt(previousSummary.avgSiteKW)}</td>
                    <td>{yoy(currentSummary.avgSiteKW, previousSummary.avgSiteKW)}</td>
                  </tr>

                  <tr>
                    <td>Avg PUE</td>
                    <td>{fmt(currentSummary.avgPUE)}</td>
                    <td>{fmt(previousSummary.avgPUE)}</td>
                    <td>{yoy(currentSummary.avgPUE, previousSummary.avgPUE)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {/* 🔹 Monthly Diesel Reconciliation */}
      {(() => {
        if (!logs.length) return null;

        const startDate = new Date(selectedMonth + "-01");
        const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
        const daysInMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate();
        const totalHours = daysInMonth * 24;

        const calculatedLogs = logs.map((e) => calculateFields(e, siteConfig));

        const dgReco = [1, 2].map((dg) => {
          const runHrs = calculatedLogs.reduce(
            (sum, cl) => sum + (cl[`DG-${dg} Running Hrs`] || 0),
            0
          );
          const fuelCon = calculatedLogs.reduce(
            (sum, cl) => sum + (cl[`DG-${dg} Fuel Consumption`] || 0),
            0
          );

          const onLoadRunHrs = calculatedLogs.reduce(
            (sum, cl) => sum + (cl[`DG-${dg} ON Load Hour`] || 0),
            0
          );

          const ebAvailHrs = totalHours - onLoadRunHrs;
          const designCph = siteConfig.designCph?.[`DG-${dg}`] || 100; // fallback
          const idealCon = runHrs * designCph;
          const unrecoDiesel = fuelCon - idealCon;
          const percentVar =
            idealCon > 0 ? ((unrecoDiesel / fuelCon) * 100).toFixed(1) + "%" : "0%";
          const expectedRunHrs = totalHours - ebAvailHrs;
          const excessRunHr = runHrs > expectedRunHrs
            ? (runHrs - expectedRunHrs).toFixed(2)
            : "0.00";

          return {
            dg: `#${dg}`,
            type: dg === 1 ? "1010 KVA" : "1010 KVA", // static for now
            totalHrs: totalHours.toFixed(1),
            ebAvailHrs: ebAvailHrs.toFixed(1),
            runHrs: runHrs.toFixed(2),
            excessRunHr,
            aCheckHr: "0",
            unrecoRunHr: (excessRunHr - 0).toFixed(2), // placeholder
            testingHr: (excessRunHr - 0).toFixed(2),   // placeholder
            designCph,
            idealCon: idealCon.toFixed(2),
            actualCon: fuelCon.toFixed(2),
            unrecoDiesel: unrecoDiesel.toFixed(2),
            percentVar,
          };
        });

        return (
          <div style={{ marginTop: "30px" }}>
            <h2>🛢️ Diesel Reconciliation Report</h2>
            <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%", fontSize: "12px", overflowX: "auto", display: "block", maxWidth: "100%", whiteSpace: "nowrap", borderRadius: "10px", scrollbarWidth: "thin" }}>
              <thead>
                <tr style={{ background: "#f0f0f0" }}>
                  <th>Period</th>
                  <th>DG#</th>
                  <th>DG Type</th>
                  <th>Total Hr</th>
                  <th>EB Availability Hrs</th>
                  <th>DG Run Hrs</th>
                  <th>Excess DG Run Hr</th>
                  <th>Max DG Run A-Check Hr</th>
                  <th>Unreconciled DG Run Hr</th>
                  <th>DG Run for Testing Hr</th>
                  <th>Design CPH</th>
                  <th>Ideal Diesel Consumption (Ltr)</th>
                  <th>Actual Diesel Consumption (Ltr)</th>
                  <th>Unreconciled Diesel (Ltr)</th>
                  <th>% Variation Diesel</th>
                </tr>
              </thead>
              <tbody>
                {dgReco.map((row, idx) => (
                  <tr key={idx}>
                    <td>{`1-${startDate.toLocaleString("default", { month: "short" })}-${startDate.getFullYear()} to ${endDate.getDate()}-${endDate.toLocaleString("default", { month: "short" })}-${endDate.getFullYear()}`}</td>
                    <td>{row.dg}</td>
                    <td>{siteConfig.dgCapacity}kVA</td>
                    <td>{row.totalHrs}</td>
                    <td>{row.ebAvailHrs}</td>
                    <td>{row.runHrs}</td>
                    <td>{row.excessRunHr}</td>
                    <td>{row.aCheckHr}</td>
                    <td>{row.unrecoRunHr}</td>
                    <td>{row.testingHr}</td>
                    <td>{row.designCph}</td>
                    <td>{row.idealCon}</td>
                    <td>{row.actualCon}</td>
                    <td>{row.unrecoDiesel}</td>
                    <td>{row.percentVar}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* </div> */}

      <div className="download-section" style={{ marginTop: "20px" }}>
        <h2>📝 DG Logs UpTo – {allValues.length}th {formatMonthName(selectedMonth)}:</h2>
        <button className="download-btn" style={{ padding: "5px", margin: "5px" }} onClick={handleDownloadExcel}>⬇️ Full Excel</button>
        <button className="download-btn" style={{ padding: "5px", margin: "5px" }} onClick={handleDownloadExcelOnlyDGLogs}>⬇️ DG Log Excel</button>
      </div>
      <div className="table-container" style={{ border: "1px solid #ccc", borderRadius: "15px", scrollbarWidth: "thin" }}>
        <table border="1" cellPadding="8" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th style={getHeaderStyle(`Location Name`)}>Location Name</th>
              <th style={getHeaderStyle(`Site ID`)}>Site ID</th>
              <th className="sticky-col"
                style={{
                  ...getHeaderStyle(`Date`),
                  left: 0,
                  zIndex: 3,
                }}>Date {formatMonthName(selectedMonth)}-{formatYear(selectedMonth)}</th>

              {/* 🔹 DG Columns (Dynamic based on siteConfig.dgCount) */}
              {[...Array(Number(siteConfig.dgCount) || 0)].map((_, i) => (
                <React.Fragment key={`dg-head-${i + 1}`}>
                  <th style={getHeaderStyle(`DG-${i + 1} OPENING KWH`)}>{`DG-${i + 1} OPENING KWH`}</th>
                  <th style={getHeaderStyle(`DG-${i + 1} CLOSING KWH`)}>{`DG-${i + 1} CLOSING KWH`}</th>
                  <th style={getHeaderStyle(`DG-${i + 1} KWH Generation`)}>{`DG-${i + 1} KWH Generation`}</th>
                </React.Fragment>
              ))}

              {/* 🔹 EB Columns (Dynamic based on siteConfig.ebCount) */}
              {[...Array(Number(siteConfig.ebCount) || 0)].map((_, i) => (
                <React.Fragment key={`eb-head-${i + 1}`}>
                  <th style={getHeaderStyle(`EB-${i + 1} OPENING KWH`)}>{`EB-${i + 1} OPENING KWH`}</th>
                  <th style={getHeaderStyle(`EB-${i + 1} CLOSING KWH`)}>{`EB-${i + 1} CLOSING KWH`}</th>
                  <th style={getHeaderStyle(`EB-${i + 1} KWH Generation`)}>{`EB-${i + 1} KWH Generation`}</th>
                </React.Fragment>
              ))}

              {/* 🔹 Solar Columns (Dynamic based on siteConfig.ebCount) */}
              {[...Array(Number(siteConfig.solarCount) || 0)].map((_, i) => (
                <React.Fragment key={`solar-head-${i + 1}`}>
                  <th style={getHeaderStyle(`Solar-${i + 1} OPENING KWH`)}>{`Solar-${i + 1} OPENING KWH`}</th>
                  <th style={getHeaderStyle(`Solar-${i + 1} CLOSING KWH`)}>{`Solar-${i + 1} CLOSING KWH`}</th>
                  <th style={getHeaderStyle(`Solar-${i + 1} KWH Generation`)}>{`Solar-${i + 1} KWH Generation`}</th>
                </React.Fragment>
              ))}

              {/* 🔹 Common fields (DG fuel, hours, etc.) */}
              {[...Array(Number(siteConfig.dgCount) || 0)].map((_, i) => (
                <React.Fragment key={`dg-fuel-${i + 1}`}>
                  <th style={getHeaderStyle(`DG-${i + 1} Run Min`)}>{`DG-${i + 1} Run Min`}</th>
                </React.Fragment>
              ))}

              {/* 🔹 Common fields (DG fuel, hours, etc.) */}
              {[...Array(Number(siteConfig.dgCount) || 0)].map((_, i) => (
                <React.Fragment key={`dg-fuel-${i + 1}`}>
                  {/* <th style={getHeaderStyle(`DG-${i + 1} Run Min`)}>{`DG-${i + 1} Run Min`}</th> */}
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

              {/* 🔹 Totals */}
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
              {(userData?.role === "Super Admin" || userData?.role === "Admin" || userData?.role === "Super User" || userData?.designation === "Vertiv Site Infra Engineer" || userData?.designation === "Vertiv Supervisor" || userData?.designation === "Vertiv CIH" || userData?.designation === "Vertiv ZM") && (
                <th>Actions</th>
              )}
              <th>ℹ️</th>
            </tr>
          </thead>

          <tbody>
            {logs.map((entry, rowIndex) => {
              const calculated = calculateFields(entry, siteConfig);
              // Only show site name and ID for the first row
              const showSiteInfo = rowIndex === 0;

              // Row color conditions
              let rowClass = "";
              for (let i = 1; i <= (siteConfig.dgCount || 0); i++) {
                const cph = calculated[`DG-${i} CPH`];
                const segr = calculated[`DG-${i} SEGR`];
                const offLoadCon = calculated[`DG-${i} OFF Load Consumption`];
                const offLoadHr = calculated[`DG-${i} OFF Load Hour`];

                if (cph > 100 || cph < 80) rowClass = "row-inefficient";
                else if (segr < 3 && segr > 0) rowClass = "row-warning";
                else if (offLoadCon > 0 && offLoadHr > 0) rowClass = "row-offload";
              }

              return (
                <tr key={entry.id} className={rowClass} onClick={() => { setForm(entry); setShowEditModal(true); }}>

                  {/* Merge Site Name and ID for all rows */}
                  {showSiteInfo && (
                    <>
                      <td rowSpan={logs.length} style={{ textAlign: "center", verticalAlign: "middle", fontWeight: "bold", transform: "rotate(270deg)" }}>
                        {siteConfig.siteName}
                      </td>
                      <td rowSpan={logs.length} style={{ textAlign: "center", verticalAlign: "middle", fontWeight: "bold", transform: "rotate(270deg)", whiteSpace: "nowrap" }}>
                        {siteConfig.siteId}
                      </td>
                    </>
                  )}

                  <td className="sticky-col" style={{ left: 0, zIndex: 2, background: "linear-gradient(to right, lightgray)" }}>{entry.Date}</td>

                  {/* 🔹 DG KWH Data */}
                  {[...Array(Number(siteConfig.dgCount) || 0)].map((_, i) => (
                    <React.Fragment key={`dg-kwh-${i + 1}`}>
                      <td>{fmt(calculated[`DG-${i + 1} KWH Opening`])}</td>
                      <td>{fmt(calculated[`DG-${i + 1} KWH Closing`])}</td>
                      <td>{fmt(calculated[`DG-${i + 1} KWH Generation`])}</td>
                    </React.Fragment>
                  ))}

                  {/* 🔹 EB Data */}
                  {[...Array(Number(siteConfig.ebCount) || 0)].map((_, i) => (
                    <React.Fragment key={`eb-kwh-${i + 1}`}>
                      <td>{fmt(calculated[`EB-${i + 1} KWH Opening`])}</td>
                      <td>{fmt(calculated[`EB-${i + 1} KWH Closing`])}</td>
                      <td>{fmt(calculated[`EB-${i + 1} KWH Generation`])}</td>
                    </React.Fragment>
                  ))}

                  {/* 🔹 Solar Data */}
                  {[...Array(Number(siteConfig.solarCount) || 0)].map((_, i) => (
                    <React.Fragment key={`solar-kwh-${i + 1}`}>
                      <td>{fmt(calculated[`Solar-${i + 1} KWH Opening`])}</td>
                      <td>{fmt(calculated[`Solar-${i + 1} KWH Closing`])}</td>
                      <td>{fmt(calculated[`Solar-${i + 1} KWH Generation`])}</td>
                    </React.Fragment>
                  ))}

                  {/* 🔹 DG Details (Fuel / Hours) */}
                  {[...Array(Number(siteConfig.dgCount) || 0)].map((_, i) => (
                    <React.Fragment key={`dg-detail-${i + 1}`}>
                      <td>{fmt(calculated[`DG-${i + 1} Run Min`])}</td>
                    </React.Fragment>
                  ))}

                  {/* 🔹 DG Details (Fuel / Hours) */}
                  {[...Array(Number(siteConfig.dgCount) || 0)].map((_, i) => (
                    <React.Fragment key={`dg-detail-${i + 1}`}>
                      {/* <td>{fmt(calculated[`DG-${i + 1} Run Min`])}</td> */}
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

                  {/* 🔹 Totals */}
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

                  {/* 🔹 Actions */}
                  {(userData?.role === "Super Admin" || userData?.role === "Admin" || userData?.designation === "Vertiv Site Infra Engineer" || userData?.designation === "Vertiv Supervisor" || userData?.designation === "Vertiv CIH" || userData?.designation === "Vertiv ZM") && (
                    <td style={{ whiteSpace: "nowrap" }}>
                      {calculated["Total Fuel Filling"] > 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleGenerateCCMS(entry); }}
                          style={{ background: "#3f5c4193", color: "#49e60bb9" }}
                        >
                          CCMS
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
                        style={{ background: "#5c3f3f93", color: "#e60b0bef" }}
                      >
                        X
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: "12px" }}><strong>ℹ️</strong> <strong>🔴</strong>Check <strong>"CPH"</strong> | <strong>⚠️</strong>Check <strong>"SEGR"</strong> | <strong style={{ background: "red" }}>"ROW"</strong> For Test Run</p>
    </div>
  );
};

export default DailyDGLog;
