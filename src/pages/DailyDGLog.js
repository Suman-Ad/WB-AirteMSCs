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
} from "firebase/firestore";
import { db } from "../firebase";
import "../assets/DailyDGLog.css";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";


const getFormattedDate = (d = new Date()) => {
  // const d = new Date();
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
};

const DailyDGLog = ({ userData }) => {
  const [logs, setLogs] = useState([]);
  const [dayLogs, setDayLogs] = useState([]);
  const [fuelAlert, setFuelAlert] = useState(false);
  const [dayFuelCon, setDayFuelCon] = useState(0);
  const [dayFuelFill, setDayFuelFill] = useState(0);
  const [form, setForm] = useState({ Date: "" });
  const Navigate = useNavigate();
  const [fuelRate, setFuelRate] = useState(0.00); // default value
  const [siteConfig, setSiteConfig] = useState({});
  const siteKey = userData?.site?.toUpperCase();

  // Debounce helper (optional)
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

  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7) // YYYY-MM
  );

  const handleFuelChange = (e) => {
    const rate = parseFloat(e.target.value) || 0;
    setFuelRate(rate);
    saveFuelRate(rate);
  };


  const siteName = userData?.site || "UnknownSite";

  const [showEditModal, setShowEditModal] = useState(false);


  const fmt = (val) => (val !== undefined && val !== null ? Number(val).toFixed(2) : "0.0");
  const fmt1 = (val) => (val !== undefined && val !== null ? Number(val).toFixed(1) : "0.0");


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


  // compute individual DG averages
  const allValues = logs.flatMap((entry) => calculateFields(entry));

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
    .map((entry) => calculateFields(entry)["PUE"])
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

  useEffect(() => {
    const cached = localStorage.getItem("dailyLogs");
    if (cached) {
      setLogs(JSON.parse(cached));
    }
  }, []);

  // After logs are fetched, set last submitted date
  useEffect(() => {
    if (logs.length > 0) {
      // Find the latest available date in logs
      const latest = logs.reduce((max, entry) => {
        return entry.Date > max ? entry.Date : max;
      }, logs[0].Date);

      // Add 1 day to latest
      const nextDate = new Date(latest);
      nextDate.setDate(nextDate.getDate() + 1);

      // Format back to your expected string
      const formattedNext = getFormattedDate(nextDate);

      setForm((prev) => ({ ...prev, Date: formattedNext }));
    } else {
      // fallback → today if no logs
      setForm({ Date: getFormattedDate() });
    }

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

    const fetchConfig = async () => {
      if (!siteKey) return;
      const snap = await getDoc(doc(db, "siteConfigs", siteKey));
      if (snap.exists()) {
        setSiteConfig(snap.data());
      }
    };

    fetchConfig();

    fetchFuelRate();

  }, [logs, userData?.site, siteKey]);


  const getYesterdayData = () => {
    if (!logs.length || !form.Date) return null;

    const selected = new Date(form.Date);     // use selected date
    const yesterdayDate = new Date(selected);
    yesterdayDate.setDate(selected.getDate() - 1);

    const ymd = yesterdayDate.toISOString().split("T")[0];
    return logs.find((entry) => entry.Date === ymd) || null;
  };

  useEffect(() => {
    if (logs.length > 0 && form.Date) {
      const yesterday = getYesterdayData();
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
        (parseFloat(form["DG-1 Fuel Closing"]) || 0) +
        (parseFloat(form["DG-2 Fuel Closing"]) || 0);
      const currentFuel = availableFuel - dayFuelCon + dayFuelFill;
      const currentHrs = currentFuel / (totalOnLoadCon/totalOnLoadHrs)
      setFuelAlert(currentHrs < 18);
      // console.log(currentFuel)
      // if (currentHrs < 10) alert("Give Fuel Request");

    }
  }, [logs, form.Date, dayFuelCon, dayFuelFill]);   // ✅ run also when Date changes

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
        return; // No runs to process
      }

      const runs = snapshot.docs.map((doc) => doc.data());

      // --- Aggregation Logic ---
      let dg1TotalConsumption = 0;
      let dg1TotalRunHours = 0;
      let dg1MinStartMeter = Infinity;
      let dg1MaxEndMeter = 0;
      let dg1MaxEndkWH = 0;
      let offLoadDG1Con = 0;
      let dg1FuelFill = 0;

      let dg2TotalConsumption = 0;
      let dg2TotalRunHours = 0;
      let dg2MinStartMeter = Infinity;
      let dg2MaxEndMeter = 0;
      let dg2MaxEndkWH = 0;
      let offLoadDG2Con = 0;
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
          dg1FuelFill += parseFloat(run.fuelFill || 0);
        } else if (run.dgNumber === "DG-2") {
          dg2TotalConsumption += parseFloat(run.fuelConsumption || 0);
          dg2MaxEndkWH += parseFloat(run.kWHReading || 0);
          dg2TotalRunHours += parseFloat(run.totalRunHours || 0);
          if (startMeter < dg2MinStartMeter) dg2MinStartMeter = startMeter;
          if (endMeter > dg2MaxEndMeter) dg2MaxEndMeter = endMeter;
          if (run.remarks === "No Load") offLoadDG2Con += parseFloat(run.fuelConsumption || 0);
          dg2FuelFill += parseFloat(run.fuelFill || 0);
        }
      });

      // --- Update the form state with aggregated data ---
      setForm((prevForm) => ({
        ...prevForm,
        // Only update if runs were found for that DG
        "DG-1 Fuel Closing": dg1TotalConsumption >= 0 ? prevForm["DG-1 Fuel Opening"] - dg1TotalConsumption + dg1FuelFill : Number(prevForm["DG-1 Fuel Closing"]) + Number(prevForm["DG-1 Fuel Filling"]),
        "DG-2 Fuel Closing": dg2TotalConsumption >= 0 ? prevForm["DG-2 Fuel Opening"] - dg2TotalConsumption + dg2FuelFill : Number(prevForm["DG-2 Fuel Closing"]) + Number(prevForm["DG-2 Fuel Filling"]),
        "DG-1 KWH Closing": dg1MaxEndkWH >= 0 ? Number(prevForm["DG-1 KWH Opening"]) + dg1MaxEndkWH : prevForm["DG-1 KWH Opening"],
        "DG-2 KWH Closing": dg2MaxEndkWH >= 0 ? Number(prevForm["DG-2 KWH Opening"]) + dg2MaxEndkWH : prevForm["DG-2 KWH Opening"],
        "DG-1 Off Load Fuel Consumption": offLoadDG1Con > 0 ? offLoadDG1Con : 0,
        "DG-2 Off Load Fuel Consumption": offLoadDG2Con > 0 ? offLoadDG2Con : 0,
        "DG-1 Off Load Hour": dg1MaxEndkWH < 1 && dg1TotalConsumption > 0 ? dg1TotalRunHours.toFixed(1) : 0,
        "DG-2 Off Load Hour": dg2MaxEndkWH < 1 && dg2TotalConsumption > 0 ? dg2TotalRunHours.toFixed(1) : 0,
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
      if (dayFuelFill > 0) alert("View CCMS");
      setDayLogs(runs);

    } catch (err) {
      console.error("Error fetching and aggregating run logs:", err);
    }
  };


  useEffect(() => {
    fetchLogs();
  }, [selectedMonth, siteName]);

  // 🔹 Handle input
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (newDate) => {
    setForm((prev) => ({ ...prev, Date: newDate }));

    // ✅ CALL THE NEW FUNCTION HERE
    fetchAndAggregateRuns(newDate);

    // Check if entry already exists for this date
    const existing = logs.find((entry) => entry.Date === newDate);

    if (existing) {
      // ✅ Populate with saved values
      setForm({ ...existing, Date: newDate });
    } else {
      // ✅ If not found, fall back to yesterday’s data
      const selected = new Date(newDate);
      const yesterdayDate = new Date(selected);
      yesterdayDate.setDate(selected.getDate() - 1);
      const ymd = yesterdayDate.toISOString().split("T")[0];

      const yesterday = logs.find((entry) => entry.Date === ymd);

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
        // ✅ Empty form if neither current nor yesterday’s exists
        setForm({ Date: newDate });
      }
    }
  };


  // 🔹 Save entry
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.Date) return alert("Date is required");

    // check all required input fields
    for (const field of inputFields) {
      if (form[field] === undefined) {
        return alert(`Please fill all fields before saving. Missing: ${field}`);
      }
    }

    // ✅ validation
    for (let i = 1; i <= 2; i++) {
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
    }

    // EB validation
    for (let i = 1; i <= 2; i++) {
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

    setForm({ Date: getFormattedDate() });
    fetchLogs();
    setShowEditModal(false);
  };

  // 🔹 Delete log
  const handleDelete = async (id) => {
    const monthKey = selectedMonth;
    await deleteDoc(doc(db, "dailyDGLogs", siteName, monthKey, id));
    fetchLogs();
  };

  // 🔹 Input fields
  const inputFields = [];

  const eb = siteConfig.siteName === userData?.site?.toUpperCase() ? siteConfig.ebCount : 0;
  const dg = siteConfig.siteName === userData?.site?.toUpperCase() ? siteConfig.dgCount : 0;

  // EBs
  for (let i = 1; i <= eb; i++) {
    inputFields.push(`EB-${i} KWH Opening`, `EB-${i} KWH Closing`);
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

  // 🔹 Download logs as Excel
  const handleDownloadExcel = () => {
    if (!logs.length) {
      alert("No data available to download");
      return;
    }

    // Map logs with calculations
    const exportData = logs.map((entry) => {
      const calculated = calculateFields(entry);
      return {
        Date: calculated.Date,
        "DG-1 KWH Opening": fmt(calculated["DG-1 KWH Opening"]),
        "DG-1 KWH Closing": fmt(calculated["DG-1 KWH Closing"]),
        "DG-1 Generation": fmt(calculated["DG-1 KWH Generation"]),
        "DG-2 KWH Opening": fmt(calculated["DG-2 KWH Opening"]),
        "DG-2 KWH Closing": fmt(calculated["DG-2 KWH Closing"]),
        "DG-2 Generation": fmt(calculated["DG-2 KWH Generation"]),
        "Total DG KWH Generation": fmt(calculated["Total DG KWH"]),
        "EB-1 KWH Opening": fmt(calculated["EB-1 KWH Opening"]),
        "EB-1 KWH Closing": fmt(calculated["EB-1 KWH Closing"]),
        "EB-1 Generation": fmt(calculated["EB-1 KWH Generation"]),
        "EB-2 KWH Opening": fmt(calculated["EB-2 KWH Opening"]),
        "EB-2 KWH Closing": fmt(calculated["EB-2 KWH Closing"]),
        "EB-2 Generation": fmt(calculated["EB-2 KWH Generation"]),
        "Total EB KWH Generation": fmt(calculated["Total EB KWH"]),
        "DG-1 Run Min": fmt(calculated["DG-1 Run Min"]),
        "DG-2 Run Min": fmt(calculated["DG-2 Run Min"]),
        "DG-1 Fuel Opening": fmt(calculated["DG-1 Fuel Opening"]),
        "DG-1 Fuel Closing": fmt(calculated["DG-1 Fuel Closing"]),
        "DG-1 Fuel Filling": fmt(calculated["DG-1 Fuel Filling"]),
        "DG-1 ON Load Consumption": fmt(calculated["DG-1 ON Load Consumption"]),
        "DG-1 OFF Load Consumption": fmt(calculated["DG-1 OFF Load Consumption"]),
        "DG-1 Fuel Consumption": fmt(calculated["DG-1 Fuel Consumption"]),
        "DG-1 Hour Opening": fmt1(calculated["DG-1 Hour Opening"]),
        "DG-1 Hour Closing": fmt1(calculated["DG-1 Hour Closing"]),
        "DG-1 ON Load Hour": fmt1(calculated["DG-1 ON Load Hour"]),
        "DG-1 OFF Load Hour": fmt1(calculated["DG-1 OFF Load Hour"]),
        "DG-1 Running Hrs": fmt1(calculated["DG-1 Running Hrs"]),
        "DG-1 CPH": fmt(calculated["DG-1 CPH"]),
        "DG-1 SEGR": fmt(calculated["DG-1 SEGR"]),
        "DG-2 Fuel Opening": fmt(calculated["DG-2 Fuel Opening"]),
        "DG-2 Fuel Closing": fmt(calculated["DG-2 Fuel Closing"]),
        "DG-2 Fuel Filling": fmt(calculated["DG-2 Fuel Filling"]),
        "DG-1 Fuel Filling": fmt(calculated["DG-1 Fuel Filling"]),
        "DG-2 ON Load Consumption": fmt(calculated["DG-2 ON Load Consumption"]),
        "DG-2 OFF Load Consumption": fmt(calculated["DG-2 OFF Load Consumption"]),
        "DG-2 Fuel Consumption": fmt(calculated["DG-2 Fuel Consumption"]),
        "DG-2 Hour Opening": fmt1(calculated["DG-2 Hour Opening"]),
        "DG-2 Hour Closing": fmt1(calculated["DG-2 Hour Closing"]),
        "DG-2 ON Load Hour": fmt1(calculated["DG-2 ON Load Hour"]),
        "DG-2 OFF Load Hour": fmt1(calculated["DG-2 OFF Load Hour"]),
        "DG-2 Running Hrs": fmt1(calculated["DG-2 Running Hrs"]),
        "DG-2 CPH": fmt(calculated["DG-2 CPH"]),
        "DG-2 SEGR": fmt(calculated["DG-2 SEGR"]),
        "Total EB Unit": fmt(calculated["Total EB KWH"]),
        "Total DG Unit": fmt(calculated["Total DG KWH"]),
        "Total Unit Consumption(EB+DG)": fmt(calculated["Total Unit Consumption"]),
        "Total Fuel": fmt(calculated["Total DG Fuel"]),
        "Total DG Hours": fmt1(calculated["Total DG Hours"]),
        "Site Running kW": fmt(calculated["Total Unit Consumption"] / 24),
      };
    });

    // Create worksheet + workbook
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DailyDGLogs");

    // Export Excel file
    XLSX.writeFile(wb, `DailyDGLogs_${siteName}_${formatMonthName(selectedMonth)}${formatYear(selectedMonth)}.xlsx`);
  };

  // 🔹 Download logs as Excel
  const handleDownloadExcelOnlyDGLogs = () => {
    if (!logs.length) {
      alert("No data available to download");
      return;
    }

    // Map logs with calculations
    const exportData = logs.map((entry) => {
      const calculated = calculateFields(entry);
      return {
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
    XLSX.utils.book_append_sheet(wb, ws, "DailyDGLogs");

    // Export Excel file
    XLSX.writeFile(wb, `${siteName}_DGLogs_${formatMonthName(selectedMonth)}${formatYear(selectedMonth)}.xlsx`);
  };

  // 🔹 Field validation color
  const getFieldClass = (name) => {
    const [prefix, type] = name.split(" "); // ["DG-1", "KWH", "Opening"]

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

    return "";
  };

  // 👇 Add this handler function inside the component
  const handleGenerateCCMS = (entry) => {
    // We pass the specific log entry, the site config, and the current fuel rate
    Navigate("/ccms-copy", {
      state: {
        logData: calculateFields(entry), // Send the fully calculated data
        siteConfig: siteConfig,
        fuelRate: fuelRate,
      },
    });
  };

  // 👇 Add this handler function inside the component
  const handleGenerateDayCCMS = (entry) => {
    // We pass the specific log entry, the site config, and the current fuel rate
    Navigate("/ccms-copy", {
      state: {
        logData: calculateFields(entry), // Send the fully calculated data
        siteConfig: siteConfig,
        fuelRate: fuelRate,
      },
    });
  };


  return (
    <div className="daily-log-container">
      <h1 className="dashboard-header">
        <strong>☣️ Daily DG Log Book</strong>
      </h1>
      <div className="noticeboard-header">
        <h1 className={`month ${formatMonthName(selectedMonth)}`}>
          <strong>
            {formatMonthName(selectedMonth)}
          </strong>
        </h1>
        <h1 style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <label>
            Select Month:
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              required
            />
          </label>

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
        </h1>
      </div>

      {/* <div className="chart-container" > */}
      {/* 🔹 New Monthly Stats */}
      {(() => {
        if (!logs.length) return null;

        // calculate all fields
        const calculatedLogs = logs.map((e) => calculateFields(e));

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

        // Totals
        const totalKwh = calculatedLogs.reduce((sum, cl) => sum + (cl["Total DG KWH"] || 0), 0);
        const totalFuel = calculatedLogs.reduce((sum, cl) => sum + (cl["Total DG Fuel"] || 0), 0);
        const totalHrs = calculatedLogs.reduce((sum, cl) => sum + (cl["Total DG Hours"] || 0), 0);
        const totalFilling = calculatedLogs.reduce((sum, cl) => sum + (cl["Total Fuel Filling"] || 0), 0);
        const yesterday = getYesterdayData();
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

        return (
          <div className="chart-container" >
            <h1 style={fuelHours < 12 ? { fontSize: "25px", color: "red" } : { fontSize: "25px", color: "green" }}><strong>⛽Present Stock – {currentFuel} ltrs. </strong></h1>
            <h1 style={fuelHours < 12 ? { fontSize: "25px", color: "red" } : { fontSize: "25px", color: "green" }}> <strong>⏱️BackUp Hours – {fuelHours} Hrs.</strong></h1>

            {/* 🔹 Last Fuel Filling */}
            {(() => {
              const lastFilling = [...logs]
                .map((e) => ({
                  Date: e.Date,
                  DG1: parseFloat(e["DG-1 Fuel Filling"] || 0),
                  DG2: parseFloat(e["DG-2 Fuel Filling"] || 0),
                  DG1Hrs: parseFloat(e["DG-1 Hour Closing"] || 0),
                  DG2Hrs: parseFloat(e["DG-2 Hour Closing"] || 0),
                }))
                .filter((e) => e.DG1 > 0 || e.DG2 > 0)
                .sort((a, b) => (a.Date < b.Date ? 1 : -1))[0]; // latest first

              if (!lastFilling) return null;

              return (
                <p style={{ borderTop: "3px solid #eee", color: "black", fontSize: "10px" }}>
                  📅 Last Fuel Filling – <strong>{lastFilling.Date}</strong> :{" "}
                  <strong>
                    {fmt1(lastFilling.DG1)} Ltrs (DG–1 - {lastFilling.DG1Hrs}), {fmt1(lastFilling.DG2)} Ltrs (DG–2 - {lastFilling.DG2Hrs})
                  </strong>
                </p>
              );
            })()}
            <h1 className="noticeboard-header"><strong>📊Summery - {allValues.length} Days</strong></h1>
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
            <p style={{ borderTop: "3px solid #eee" }}>⚡ Site Running Load – <strong>{fmt(avgSiteRunningKw)} kWh</strong></p>
            <div style={{display: "flex"}}>
              <div>
            <p>📡 Avg IT Load – <strong>{monthlyAvgITLoad} kWh</strong></p>
            <p>⛽ Avg DG CPH – <strong>{fmt1(totalOnLoadCon / totalOnLoadHrs)} Ltrs/Hrs</strong></p>
            </div>
            <div style={{fontSize:"10px"}}>
            <p>⛽DG-1 OEM CPH – <strong>{siteConfig.designCph?.["DG-1" || ""]}Ltrs/⏱️</strong></p>

            <p>⛽DG-2 OEM CPH – <strong>{siteConfig.designCph?.["DG-2"] || ""}Ltrs/⏱️</strong></p>
            </div>
            </div>

            <p style={{ borderTop: "1px solid #eee" }}>⚡ Total DG KW Generation – <strong>{fmt(totalKwh)} kW</strong></p>
            <div style={{ display: "flex" }}>
              <p style={{ marginLeft: "20px" }}>
                • DG-1: <strong>{fmt1(totalDG1Kw)} kW</strong>
              </p>
              <p style={{ marginLeft: "20px" }}>
                • DG-2: <strong>{fmt1(totalDG2Kw)} kW</strong>
              </p>
            </div>
            <p style={{ borderTop: "1px solid #eee" }}>
              ⛽ Total Fuel Filling – <strong>{fmt(totalFilling)}Ltrs. x </strong>
              ₹<input
                type="number"
                step="0.01"
                value={fuelRate}
                onChange={handleFuelChange}
                style={{ width: "70px", marginLeft: "4px", height: "20px" }}
              /><strong style={{fontSize: "10px"}}>/Ltr. = ₹{fmt(totalFilling * fuelRate)}</strong>
            </p>
            <div style={{ display: "flex" }}>
              <p style={{ marginLeft: "20px" }}>
                • DG-1: <strong>{fmt1(totalDG1Filling)} Ltrs</strong>
              </p>
              <p style={{ marginLeft: "20px" }}>
                • DG-2: <strong>{fmt1(totalDG2Filling)} Ltrs</strong>
              </p>
            </div>

            <p style={{ borderTop: "1px solid #eee" }}>⛽ Total Fuel Consumption – <strong>{fmt(totalFuel)} Ltrs</strong></p>
            <div style={{ display: "flex" }}>
              <p style={{ marginLeft: "20px" }}>
                • DG-1: <strong>{fmt1(totalDG1OnLoadCon + totalDG1OffLoadCon)} Ltrs</strong>
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
                • DG-2: <strong>{fmt1(totalDG2OnLoadCon + totalDG2OffLoadCon)} Ltrs</strong>
              </p>
              <p style={{ marginLeft: "40px", fontSize: "11px" }}>
                - ON Load: <strong>{fmt1(totalDG2OnLoadCon)} Ltrs</strong>
              </p>
              <p style={{ marginLeft: "40px", fontSize: "11px" }}>
                - OFF Load: <strong>{fmt1(totalDG2OffLoadCon)} Ltrs</strong>
              </p>
            </div>
            <p style={{ borderTop: "1px solid #eee" }}>⏱️ Total DG Run Hours – <strong>{fmt1(totalHrs)} Hour</strong> ({totalHrsMin} min)</p>
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

      {/* 🔹 Monthly Diesel Reconciliation */}
      {(() => {
        if (!logs.length) return null;

        const startDate = new Date(selectedMonth + "-01");
        const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
        const daysInMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate();
        const totalHours = daysInMonth * 24;

        const calculatedLogs = logs.map((e) => calculateFields(e));

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
            idealCon > 0 ? ((unrecoDiesel / idealCon) * 100).toFixed(1) + "%" : "0%";
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
            <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%", fontSize: "12px", overflowX: "auto", display: "block", maxWidth: "100%", whiteSpace: "nowrap" }}>
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
                    <td>{row.type}</td>
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
      <div>
        Selected Date: <strong style={{ color: "blue" }}>
          {form.Date}
        </strong>
      </div>
      <button
        className="segr-manage-btn warning"
        onClick={() => Navigate('/dg-log-table')}
      >
        🔰 DG Run Logs
      </button>
      {userData?.name === "Suman Adhikari" && (
        <button
          className="segr-manage-btn"
          onClick={() => Navigate('/site-config')}
        >
          ⚙️ Site Settings
        </button>
      )}

      {fuelAlert === true && (userData?.role === "Super Admin" ||
        userData?.role === "Admin" ||
        userData?.role === "Super User") && (
          <button
            className="pm-manage-btn danger"
            onClick={() =>
              Navigate("/fuel-requisition", {
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

      <div className="controls">

        <button
          className="segr-manage-btn info"
          onClick={() => setShowEditModal(!showEditModal)}
        >
          {showEditModal ? "✖ Close" : "✎ Add / Edit DG Log"}
        </button>
      </div>

      {showEditModal && (
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

          {inputFields.map((field) => (
            <label key={field}>
              {field}:
              <input
                type="number"
                step="any"
                name={field}
                value={form[field] || 0 || ""}
                onChange={handleChange}
                className={`${form[field] === "" || form[field] === undefined ? "input-missing" : ""} ${getFieldClass(field)}`}
                disabled={field === "DG-1 Fuel Opening" || field === "DG-2 Fuel Opening" || field === "DG-1 KWH Opening" || field === "DG-2 KWH Opening" || field === "EB-1 KWH Opening" || field === "EB-2 KWH Opening" || field === "DG-1 Hour Opening" || field === "DG-2 Hour Opening" || field === "DG-1 KWH Closing" || field === "DG-2 KWH Closing" || field === "DG-1 Hour Closing" || field === "DG-2 Hour Closing" || field === "DG-1 Off Load Hour" || field === "DG-2 Off Load Hour" || field === "DG-1 Off Load Fuel Consumption" || field === "DG-2 Off Load Fuel Consumption" || field === "DG-1 Fuel Filling" || field === "DG-2 Fuel Filling" || field === "DG-1 Fuel Closing" || field === "DG-2 Fuel Closing"}
              />
            </label>
          ))}

          <button className="submit-btn" type="submit">Save Entry</button>
        </form>
      )}

      <div>
        <h2>📝 DG Logs UpTo – {allValues.length}th {formatMonthName(selectedMonth)}:</h2>
        <button className="download-btn" style={{ padding: "5px", margin: "5px" }} onClick={handleDownloadExcel}>⬇️ Full Excel</button>
        <button className="download-btn" style={{ padding: "5px", margin: "5px" }} onClick={handleDownloadExcelOnlyDGLogs}>⬇️ DG Log Excel</button>
      </div>

      <div className="table-container">
        <table border="1" cellPadding="8" style={{ width: "100%", whiteSpace: "nowrap" }}>
          <thead>
            <tr>
              <th>Date</th>
              <th>DG-1 OPENING KWH</th>
              <th>DG-1 CLOSING KWH</th>
              <th>DG-1 KWH Generation</th>
              <th>DG-2 OPENING KWH</th>
              <th>DG-2 CLOSING KWH</th>
              <th>DG-2 KWH Generation</th>
              <th>EB-1 OPENING KWH</th>
              <th>EB-1 CLOSING KWH</th>
              <th>EB-1 KWH Consumption</th>
              <th>EB-2 OPENING KWH</th>
              <th>EB-2 CLOSING KWH</th>
              <th>EB-2 KWH Consumption</th>
              <th>DG-1 Run Min</th>
              <th>DG-2 Run Min</th>
              <th>DG-1 Fuel Opening</th>
              <th>DG-1 Fuel Closing</th>
              <th>DG-1 Fuel Filling</th>
              <th>DG-1 ON Load Consumption</th>
              <th>DG-1 OFF Load Consumption</th>
              <th>DG-1 Fuel Consumption</th>
              <th>DG-1 Hour Opening</th>
              <th>DG-1 Hour Closing</th>
              <th>DG-1 ON Load Hour</th>
              <th>DG-1 OFF Load Hour</th>
              <th>DG-1 Running Hrs</th>
              <th>DG-1 CPH</th>
              <th>DG-1 SEGR</th>
              <th>DG-2 Fuel Opening</th>
              <th>DG-2 Fuel Closing</th>
              <th>DG-2 Fuel Filling</th>
              <th>DG-2 ON Load Consumption</th>
              <th>DG-2 OFF Load Consumption</th>
              <th>DG-2 Fuel Consumption</th>
              <th>DG-2 Hour Opening</th>
              <th>DG-2 Hour Closing</th>
              <th>DG-2 ON Load Hour</th>
              <th>DG-2 OFF Load Hour</th>
              <th>DG-2 Running Hrs</th>
              <th>DG-2 CPH</th>
              <th>DG-2 SEGR</th>
              <th>Total DG KWH Generation</th>
              <th>Total EB KWH Reading</th>
              <th>Total KWH Consumption(EB+DG)</th>
              <th>Total Fuel Consumption</th>
              <th>Total DG Run Hours</th>
              <th>Site Running kW</th>
              <th>DCPS Load Amps</th>
              <th>UPS Load(kWh)</th>
              <th>Total IT Load(kWh)</th>
              <th>Office Load(kW)</th>
              <th>PUE</th>
              {userData?.role === "Super Admin" || userData?.role === "Admin" && (
                <th>Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {logs.map((entry) => {
              const calculated = calculateFields(entry);

              // thresholds
              let rowClass = "";
              if ((calculated["DG-1 CPH"] > 100 && calculated["DG-1 CPH"] < 80) || (calculated["DG-2 CPH"] > 100 && calculated["DG-2 CPH"] < 80)) {
                rowClass = "row-inefficient"; // 🔴 inefficient
              } else if ((calculated["DG-1 SEGR"] < 3 && calculated["DG-1 SEGR"] > 0) || (calculated["DG-2 SEGR"] < 3 && calculated["DG-2 SEGR"] > 0)) {
                rowClass = "row-warning"; // ⚠️ investigate
              } else if ((calculated["DG-1 OFF Load Consumption"] > 0 && calculated["DG-1 OFF Load Hour"] > 0) || (calculated["DG-2 OFF Load Consumption"] > 0 && calculated["DG-2 OFF Load Hour"] > 0)) {
                rowClass = "row-offload"; // ⚠️ investigate
              }
              return (
                <tr key={entry.id} className={rowClass} onClick={() => { setForm(entry); setShowEditModal(true) }}>
                  <td>{entry.Date}</td>
                  <td>{fmt(calculated["DG-1 KWH Opening"])}</td>
                  <td>{fmt(calculated["DG-1 KWH Closing"])}</td>
                  <td>{fmt(calculated["DG-1 KWH Generation"])}</td>
                  <td>{fmt(calculated["DG-2 KWH Opening"])}</td>
                  <td>{fmt(calculated["DG-2 KWH Closing"])}</td>
                  <td>{fmt(calculated["DG-2 KWH Generation"])}</td>
                  <td>{fmt(calculated["EB-1 KWH Opening"])}</td>
                  <td>{fmt(calculated["EB-1 KWH Closing"])}</td>
                  <td>{fmt(calculated["EB-1 KWH Generation"])}</td>
                  <td>{fmt(calculated["EB-2 KWH Opening"])}</td>
                  <td>{fmt(calculated["EB-2 KWH Closing"])}</td>
                  <td>{fmt(calculated["EB-2 KWH Generation"])}</td>
                  <td>{fmt(calculated["DG-1 Run Min"])}</td>
                  <td>{fmt(calculated["DG-2 Run Min"])}</td>
                  <td>{fmt(calculated["DG-1 Fuel Opening"])}</td>
                  <td>{fmt(calculated["DG-1 Fuel Closing"])}</td>
                  <td>{fmt(calculated["DG-1 Fuel Filling"] || 0)}</td>
                  <td>{fmt(calculated["DG-1 ON Load Consumption"] || 0)}</td>
                  <td>{fmt(calculated["DG-1 OFF Load Consumption"] || 0)}</td>
                  <td>{fmt(calculated["DG-1 Fuel Consumption"])}</td>
                  <td>{fmt1(calculated["DG-1 Hour Opening"])}</td>
                  <td>{fmt1(calculated["DG-1 Hour Closing"])}</td>
                  <td>{fmt1(calculated["DG-1 ON Load Hour"])}</td>
                  <td>{fmt1(calculated["DG-1 OFF Load Hour"])}</td>
                  <td>{fmt1(calculated["DG-1 Running Hrs"])}</td>
                  <td>{fmt(calculated["DG-1 CPH"])}</td>
                  <td>{fmt(calculated["DG-1 SEGR"])}</td>
                  <td>{fmt(calculated["DG-2 Fuel Opening"])}</td>
                  <td>{fmt(calculated["DG-2 Fuel Closing"])}</td>
                  <td>{fmt(calculated["DG-2 Fuel Filling"] || 0)}</td>
                  <td>{fmt(calculated["DG-2 ON Load Consumption"] || 0)}</td>
                  <td>{fmt(calculated["DG-2 OFF Load Consumption"] || 0)}</td>
                  <td>{fmt(calculated["DG-2 Fuel Consumption"])}</td>
                  <td>{fmt1(calculated["DG-2 Hour Opening"])}</td>
                  <td>{fmt1(calculated["DG-2 Hour Closing"])}</td>
                  <td>{fmt1(calculated["DG-2 ON Load Hour"])}</td>
                  <td>{fmt1(calculated["DG-2 OFF Load Hour"])}</td>
                  <td>{fmt1(calculated["DG-2 Running Hrs"])}</td>
                  <td>{fmt(calculated["DG-2 CPH"])}</td>
                  <td>{fmt(calculated["DG-2 SEGR"])}</td>
                  <td>{fmt(calculated["Total DG KWH"])}</td>
                  <td>{fmt(calculated["Total EB KWH"])}</td>
                  <td>{fmt(calculated["Total Unit Consumption"])}</td>
                  <td>{fmt(calculated["Total DG Fuel"])}</td>
                  <td>{fmt1(calculated["Total DG Hours"])}</td>
                  <td>{fmt(calculated["Total Unit Consumption"] / 24)}</td>
                  <td>{fmt(calculated["DCPS Load Amps"])}</td>
                  <td>{fmt(calculated["UPS Load KWH"])}</td>
                  <td>{fmt(calculated["Total IT Load KWH"])}</td>
                  <td>{fmt(calculated["Office kW Consumption"])}</td>
                  <td>{fmt(calculated["PUE"])}</td>

                  <td>
                    {/* 👇 Add the button here */}
                    {calculated['Total Fuel Filling'] > 0 && (
                      <button
                        className="download-btn"
                        onClick={() => handleGenerateCCMS(entry)}
                      >
                        CCMS
                      </button>
                    )}
                    {userData?.role === "Super Admin" || userData?.role === "Admin" && (
                      <button onClick={() => handleDelete(entry.id)}>
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DailyDGLog;
