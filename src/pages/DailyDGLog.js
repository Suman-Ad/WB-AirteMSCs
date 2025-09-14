// src/components/DailyDGLog1.js
import React, { useEffect, useState } from "react";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import "../assets/DailyDGLog.css";
import * as XLSX from "xlsx";


const getFormattedDate = () => {
  const d = new Date();
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
};

const DailyDGLog = ({ userData }) => {
  const [form, setForm] = useState({ Date: getFormattedDate() });
  const [logs, setLogs] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7) // YYYY-MM
  );

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
      result[`DG-${i} CPH`] = hrClose > hrOpen ? totalFuelCon/(hrClose - hrOpen) : 0;
      result[`DG-${i} SEGR`] = totalFuelCon - offLoadFuelCon > 0 ? (kwhClose - kwhOpen)/(totalFuelCon - offLoadFuelCon) : 0;
      result[`DG-${i} Run Min`] = (hrClose - hrOpen)*60;
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
    return result;
  };

  // compute individual DG averages
  const dg1Values = logs
  .map((entry) => calculateFields(entry)["DG-1 SEGR"])
  .filter((val) => val > 0);
  const monthlyAvgDG1SEGR =
    dg1Values.length > 0
      ? (
          dg1Values.reduce((sum, val) => sum + val, 0) / dg1Values.length
        ).toFixed(2)
      : 0;

  const dg2Values = logs
  .map((entry) => calculateFields(entry)["DG-2 SEGR"])
  .filter((val) => val > 0);
  const monthlyAvgDG2SEGR =
    dg2Values.length > 0
      ? (
          dg2Values.reduce((sum, val) => sum + val, 0) / dg2Values.length
        ).toFixed(2)
      : 0;

  // compute monthly average SEGR
  const allSEGRValues = logs.flatMap((entry) => {
    const cl = calculateFields(entry);
    return [cl["DG-1 SEGR"], cl["DG-2 SEGR"]].filter((val) => val > 0);
  });
  const monthlyAvgSEGR =
    allSEGRValues.length > 0
      ? (
          allSEGRValues.reduce((sum, val) => sum + val, 0) / allSEGRValues.length
        ).toFixed(2)
      : 0;

  const formatMonthName = (ym) => {
    const [year, month] = ym.split("-");
    const date = new Date(year, month - 1); // month is 0-based
    return date.toLocaleString("default", { month: "long"}); // , year: "numeric" 
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
  };

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
    }
  }, [logs, form.Date]);   // ✅ run also when Date changes


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
      if (form[field] === undefined || form[field] === "") {
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

        if (kwhClose < kwhOpen) {
        return alert(`DG-${i} KWH Closing cannot be less than Opening`);
        }
        if (hrClose < hrOpen) {
        return alert(`DG-${i} Hour Closing cannot be less than Opening`);
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

  // EBs
  for (let i = 1; i <= 2; i++) {
    inputFields.push(`EB-${i} KWH Opening`, `EB-${i} KWH Closing`);
  }

  // DGs
  for (let i = 1; i <= 2; i++) {
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
        "Site Running kW": fmt(calculated["Total Unit Consumption"]/24),
        };
    });

    // Create worksheet + workbook
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DailyDGLogs");

    // Export Excel file
    XLSX.writeFile(wb, `DailyDGLogs_${siteName}_${formatMonthName(selectedMonth)}${formatYear(selectedMonth)}.xlsx`);
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


  return (
    <div className="daily-log-container">
      <h1 className="dashboard-header"><strong>{siteName} – Daily DG Log – {formatYear(selectedMonth)}</strong> </h1>
      <div className="chart-container" >
        <strong>
          <h1 className={`month ${formatMonthName(selectedMonth)}`}>
            {formatMonthName(selectedMonth)}
          </h1>
        </strong>

        {/* Average SEGR */}
        <h2 className={monthlyAvgSEGR < 3 ? "avg-segr low" : "avg-segr high"}>
          Average SEGR – <strong>{monthlyAvgSEGR}</strong>
        </h2>
        <p className={monthlyAvgDG1SEGR < 3 ? "avg-segr low" : "avg-segr high"}>
          DG-1 Average SEGR – {monthlyAvgDG1SEGR}
        </p>
        <p className={monthlyAvgDG2SEGR < 3 ? "avg-segr low" : "avg-segr high"} >
          DG-2 Average SEGR – {monthlyAvgDG2SEGR}
        </p>

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

          // Totals
          const totalKwh = calculatedLogs.reduce((sum, cl) => sum + (cl["Total DG KWH"] || 0), 0);
          const totalFuel = calculatedLogs.reduce((sum, cl) => sum + (cl["Total DG Fuel"] || 0), 0);
          const totalHrs = calculatedLogs.reduce((sum, cl) => sum + (cl["Total DG Hours"] || 0), 0);
          const totalFilling = calculatedLogs.reduce((sum, cl) => sum + (cl["Total Fuel Filling"] || 0), 0);

          const siteRunningKwValues = calculatedLogs
            .map(cl => cl["Site Running kW"])
            .filter(v => v > 0);

          const avgSiteRunningKw =
            siteRunningKwValues.length > 0
              ? (siteRunningKwValues.reduce((sum, v) => sum + v, 0) / siteRunningKwValues.length).toFixed(2)
              : 0;

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
          const totalOffLoadCon =
            calculatedLogs.reduce(
              (sum, cl) => sum + (cl["DG-1 OFF Load Consumption"] || 0) + (cl["DG-2 OFF Load Consumption"] || 0),
              0
            );

          // ON / OFF load hours + minutes
          const totalOnLoadHrs =
            calculatedLogs.reduce(
              (sum, cl) => sum + (cl["DG-1 ON Load Hour"] || 0) + (cl["DG-2 ON Load Hour"] || 0),
              0
            );
          const totalOffLoadHrs =
            calculatedLogs.reduce(
              (sum, cl) => sum + (cl["DG-1 OFF Load Hour"] || 0) + (cl["DG-2 OFF Load Hour"] || 0),
              0
            );

          const totalOnLoadMin = (totalOnLoadHrs * 60).toFixed(0);
          const totalOffLoadMin = (totalOffLoadHrs * 60).toFixed(0);

          return (
            <div className="monthly-stats" >
              {/* <p><strong>📊 Avg DG CPH – {monthlyAvgCPH}/Hrs</strong></p> */}
              <p style={{ fontSize: "20px"}}><strong>⚡ Site Running Load – {fmt(avgSiteRunningKw)} kWh</strong></p>
              <p style={{ borderTop: "1px solid #eee"}}>⚡ Total DG KW Generation – <strong>{fmt(totalKwh)} kW</strong></p>
              <p style={{ marginLeft: "20px" }}>
                • DG-1: <strong>{fmt1(totalDG1Kw)} kW</strong>
              </p>
              <p style={{ marginLeft: "20px" }}>
                • DG-2: <strong>{fmt1(totalDG2Kw)} kW</strong>
              </p>
              <p style={{ borderTop: "1px solid #eee"}}>⛽ Total Fuel Filling – <strong>{fmt(totalFilling)} Ltrs</strong></p>
              <p style={{ marginLeft: "20px" }}>
                • DG-1: <strong>{fmt1(totalDG1Filling)} Ltrs</strong>
              </p>
              <p style={{ marginLeft: "20px" }}>
                • DG-2: <strong>{fmt1(totalDG2Filling)} Ltrs</strong>
              </p>
              <p style={{ borderTop: "1px solid #eee"}}>⛽ Total DG Fuel Consumption – <strong>{fmt(totalFuel)} Ltrs</strong></p>
              <p style={{ marginLeft: "20px" }}>
                • ON Load: <strong>{fmt1(totalOnLoadCon)} Ltrs</strong>
              </p>
              <p style={{ marginLeft: "20px" }}>
                • OFF Load: <strong>{fmt1(totalOffLoadCon)} Ltrs</strong>
              </p>
              <p style={{ borderTop: "1px solid #eee"}}>⏱️ Total DG Run Hours – <strong>{fmt1(totalHrs)} Hour</strong></p>
              <p style={{ marginLeft: "20px" }}>
                • ON Load: <strong>{fmt1(totalOnLoadHrs)} hrs</strong> ({totalOnLoadMin} min)
              </p>
              <p style={{ marginLeft: "20px" }}>
                • OFF Load: <strong>{fmt1(totalOffLoadHrs)} hrs</strong> ({totalOffLoadMin} min)
              </p>
            </div>
          );
        })()}

        {/* Last update info */}
        {(userData?.role === "Super Admin" ||
          userData?.role === "Admin" ||
          userData?.role === "Super User") &&
          (() => {
            const entry = logs.find((e) => e.Date === form.Date);
            return entry ? (
              <p style={{ fontSize: 12, color: "#666" }}>
                Last Update By: <strong>{entry.updatedBy}</strong>{" "}
                {entry.updatedAt?.toDate().toLocaleString()}
              </p>
            ) : null;
          })()
        }
      </div>
      <div className="controls">
        <label>
          Select Month:
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
          <button 
            className="pm-manage-btn info" 
            onClick={() => setShowEditModal(!showEditModal)}
          >
            {showEditModal ? "✖ Close" : "✎ Edit / Add Log"}
          </button>
        </label>
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
              value={form[field] || ""}
              onChange={handleChange}
              className={`${form[field] === "" || form[field] === undefined ? "input-missing" : ""} ${getFieldClass(field)}`}
            />
          </label>
        ))}

        <button className="submit-btn" type="submit">Save Entry</button>
      </form>
      )}
      


      
      <div>
          <h2>📝 {formatMonthName(selectedMonth)} Logs :</h2>
          <button className="download-btn" onClick={handleDownloadExcel}>⬇️ Download Excel</button>
      </div>

      <div className="logs-table">
        <table>
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
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((entry) => {
              const calculated = calculateFields(entry);

              // thresholds
              let rowClass = "";
              if (calculated["DG-1 CPH"] > 5 || calculated["DG-2 CPH"] > 5) {
              rowClass = "row-inefficient"; // 🔴 inefficient
              } else if (calculated["DG-1 SEGR"] < 3 || calculated["DG-2 SEGR"] < 3) {
              rowClass = "row-warning"; // ⚠️ investigate
              }
              return (
                <tr key={entry.id} className={rowClass} onClick={() => {setForm(entry); setShowEditModal(true)}}>
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
                  <td>{fmt(calculated["Total Unit Consumption"]/24)}</td>
                  
                  <td>
                    {/* <button onClick={() => {setForm(entry); setShowEditModal(true)}}>Edit</button> */}
                    <button onClick={() => handleDelete(entry.id)}>
                      Delete
                    </button>
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
