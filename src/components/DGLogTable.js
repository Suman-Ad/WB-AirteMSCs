// src/components/DGLogTable.js
import React, { useState, useEffect, useRef } from "react";
import { collection, getDocs, doc, updateDoc, getDoc, deleteDoc, query, limit, orderBy, addDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useLocation, useNavigate } from "react-router-dom";
import { format, set, subDays } from "date-fns";
import HSDPrintTemplate from "../components/HSDPrintTemplate";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";


// Convert decimal hours to HH:MM format
const formatTime = (hours) => {
  const h = Math.floor(hours); // integer hours
  const m = Math.round((hours - h) * 60); // minutes from fraction
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} Min`;
};

const DGLogTable = ({ userData }) => {
  const { state } = useLocation();
  const { totalkW, fuelAvalable, siteConfig, dayFuelCon } = state || {};
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState({
    DG1_OnLoad: 0,
    DG1_NoLoad: 0,
    DG2_OnLoad: 0,
    DG2_NoLoad: 0,
  });
  const Navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10) // default today
  );

  const siteName = userData?.site;

  // State for DHR Preview Modal
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [dhrDataForPreview, setDhrDataForPreview] = useState(null);
  const [dhrMessage, setDhrMessage] = useState("");
  // State for HSD Preview
  const [hsdLogs, setHsdLogs] = useState([]);
  const [hsdPreviewOpen, setHsdPreviewOpen] = useState(false);
  const [hsdPreviewData, setHsdPreviewData] = useState(null);
  const [hsdPreviewForm, setHsdPreviewForm] = useState(null);
  // State for Downloading Excel
  const [downloading, setDownloading] = useState(false);
  // State for Excel Bulk Upload
  const [excelPreviewRows, setExcelPreviewRows] = useState([]);
  const [excelErrors, setExcelErrors] = useState([]);
  const [showExcelPreview, setShowExcelPreview] = useState(false);
  const [isUploadingExcel, setIsUploadingExcel] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const fileInputRef = useRef(null);

  // Check if the current log is the last DG fuel filling entry for the day
  const isLastDGFillForDay = () => {
    if (!siteConfig?.dgCount) return false;

    const fuelFillLogs = logs.filter(
      (l) => l.remarks === "Fuel Filling Only"
    );

    return siteConfig.dgCount - fuelFillLogs.length === 0;
  };


  const fetchHsdLogs = async () => {
    try {
      const q = query(
        collection(db, "dgHsdLogs", userData.site, "entries"),
        orderBy("createdAt", "desc"),
        limit(100)
      );

      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setHsdLogs(list);
    } catch (err) {
      console.error("Failed to fetch HSD logs:", err);
    }
  };

  const getHsdForLog = () => {
    return hsdLogs.find(
      (h) => h.date === selectedDate
    );
  };


  const openHsdPreview = () => {
    if (!isLastDGFillForDay()) {
      alert("⚠️ HSD is available only for the final DG fuel filling entry.");
      return;
    }

    const hsd = getHsdForLog();
    if (!hsd) {
      alert("HSD data not found for this date");
      return;
    }

    setHsdPreviewForm({
      date: selectedDate,
      siteName,
    });

    setHsdPreviewData(hsd);
    setHsdPreviewOpen(true);
  };


  useEffect(() => {
    if (siteName && selectedDate) {
      fetchLogs();
      fetchMonthlySummary();
      fetchLogsForSelectedDate();
      fetchHsdLogs();
    }
    // eslint-disable-next-line
  }, [siteName, selectedDate]);

  const fetchLogs = async () => {
    try {
      const dateObj = new Date(selectedDate);
      const monthKey =
        dateObj.toLocaleString("en-US", { month: "short" }) +
        "-" +
        dateObj.getFullYear();

      const runsCollectionRef = collection(
        db,
        "dgLogs",
        siteName,
        monthKey,
        selectedDate,
        "runs"
      );
      const snapshot = await getDocs(runsCollectionRef);
      const data = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setLogs(data);
    } catch (err) {
      console.error("Error fetching logs:", err);
    }
  };

  const fetchMonthlySummary = async () => {
    try {
      const dateObj = new Date(selectedDate);
      const monthKey =
        dateObj.toLocaleString("en-US", { month: "short" }) +
        "-" +
        dateObj.getFullYear();

      // 🔹 Get all date docs under the month
      const monthRef = collection(db, "dgLogs", siteName, monthKey);
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
          siteName,
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

  const handleEdit = (log) => {
    Navigate("/dg-log-entry", {
      state: {
        editMode: true,
        logData: log,
        selectedDate,
      },
    });
  };


  const handleDelete = async (log) => {
    if (!window.confirm("Are you sure you want to delete this log?")) return;

    try {
      const dateObj = new Date(selectedDate);
      const monthKey =
        dateObj.toLocaleString("en-US", { month: "short" }) +
        "-" +
        dateObj.getFullYear();

      // 1️⃣ Delete DG Log
      const logRef = doc(
        db,
        "dgLogs",
        siteName,
        monthKey,
        selectedDate,
        "runs",
        log.id
      );
      await deleteDoc(logRef);

      // 2️⃣ ALSO delete HSD log if Fuel Filling Only
      if (log.remarks === "Fuel Filling Only") {
        const hsdQuery = query(
          collection(db, "dgHsdLogs", siteName, "entries")
        );

        const hsdSnap = await getDocs(hsdQuery);

        const matchedHsd = hsdSnap.docs.find(
          (d) => d.data().date === selectedDate
        );

        if (matchedHsd) {
          await deleteDoc(
            doc(db, "dgHsdLogs", siteName, "entries", matchedHsd.id)
          );
          console.log("HSD log deleted for date:", selectedDate);
        }
      }

      alert("Log deleted successfully ❌");

      fetchLogs();
      fetchMonthlySummary();
      fetchHsdLogs();

    } catch (err) {
      console.error("Error deleting log:", err);
      alert("Failed to delete log. Check console.");
    }
  };

  useEffect(() => {
    const cached = localStorage.getItem("summary");
    if (cached) {
      setSummary(JSON.parse(cached));
    }
  }, []);

  // Fetches logs for the main table view (for the selected date)
  const fetchLogsForSelectedDate = async () => {
    try {
      const dateObj = new Date(selectedDate);
      const monthKey = format(dateObj, "MMM-yyyy");
      const runsCollectionRef = collection(db, "dgLogs", siteName, monthKey, selectedDate, "runs");
      const snapshot = await getDocs(runsCollectionRef);
      const data = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      setLogs(data);
    } catch (err) {
      console.error("Error fetching logs:", err);
      setLogs([]); // Clear logs on error
    }
  };

  // --- DHR Preview Function (Modified) ---
  const openPreviewModal = async () => {
    if (!siteName) return;
    setIsPreviewModalOpen(true);
    setDhrMessage("Generating live preview...");
    setDhrDataForPreview(null);

    let offLoadDGRun = 0;

    try {
      // 1. Determine yesterday's date based on the selected date in the UI
      const yesterday = subDays(new Date(selectedDate), 1);
      const monthKey = format(yesterday, "MMM-yyyy");
      const yesterdayStr = format(yesterday, "yyyy-MM-dd");

      // 2. Fetch DG Run Hours from Yesterday
      const runsRef = collection(db, "dgLogs", siteName, monthKey, yesterdayStr, "runs");
      const runsSnap = await getDocs(runsRef);
      const runs = runsSnap.docs.map((doc) => doc.data());
      runs.forEach((run) => {
        if (run.remarks === "No Load") offLoadDGRun += parseFloat(run.totalRunHours || 0);
      })
      const totalDgRunHours = runsSnap.docs.reduce((sum, doc) => sum + (Number(doc.data().totalRunHours) || 0), 0);
      const dgRunHrsYesterday = formatTime(totalDgRunHours - offLoadDGRun);
      const ebRunHrsYesterday = formatTime(24 - totalDgRunHours > 0 ? 24 - (totalDgRunHours - offLoadDGRun) : 0);

      // 3. Fetch Default Statuses from siteConfig
      const configRef = doc(db, "siteConfigs", siteName?.toUpperCase());
      const configSnap = await getDoc(configRef);
      const defaultConfig = configSnap.exists() ? configSnap.data() : {};

      // 4. Construct the preview data object
      const previewData = {
        "📊 DHR Date": format(new Date(selectedDate), "dd.MM.yyyy"),
        "🏙️ Region": userData?.region,
        "🔄 Circle": userData?.circle,
        "📍 Site Name": siteName,
        "⛽ Diesel Available": `${(fuelAvalable - (dayFuelCon || 0)).toFixed(2)} Ltrs.` || "N/A",
        "🕑 DG Run Hrs (Yesterday)": `${dgRunHrsYesterday}` || "N/A",
        "⚡ EB Run Hrs (Yesterday)": `${ebRunHrsYesterday}` || "N/A",
        "🔌 EB Status": defaultConfig.ebStatus || "N/A",
        "🔋 DG Status": defaultConfig.dgStatus || "N/A",
        "⚙️ SMPS Status": defaultConfig.smpsStatus || "N/A",
        "🔄 UPS Status": defaultConfig.upsStatus || "N/A",
        "❄️ PAC Status": defaultConfig.pacStatus || "N/A",
        "❄️ CRV Status": defaultConfig.crvStatus || "N/A",
        "📝 Major Activity": defaultConfig.majorActivity || "N",
        "🛠️ Inhouse PM": defaultConfig.inHousePm || "N",
        "🚨 Fault Details": defaultConfig.faultDetails || "N",
        "⚡ Total kW Unit": `${totalkW.toFixed(3)} kW` || "N/A",
      };

      setDhrDataForPreview(previewData);
      setDhrMessage(""); // Clear loading message

    } catch (error) {
      console.error("Error generating DHR preview:", error);
      setDhrMessage("❌ Could not generate preview data.");
    }
  };

  const generateShareText = (record) => {
    if (!record) return "";
    // Creates a string from the preview data object for sharing
    return Object.entries(record)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
  };

  const shareWhatsApp = () => window.open(`https://wa.me/?text=${encodeURIComponent(generateShareText(dhrDataForPreview))}`, "_blank");
  const shareTelegram = () => window.open(`https://t.me/share/url?url=${encodeURIComponent(generateShareText(dhrDataForPreview))}`, "_blank");

  const exportMonthlyDGLogsToExcel = async () => {
    try {
      if (!siteName || !selectedDate) {
        alert("Site or Date missing");
        return;
      }
      setDownloading(true);
      const dateObj = new Date(selectedDate);
      const monthKey = format(dateObj, "MMM-yyyy");

      const monthRef = collection(db, "dgLogs", siteName, monthKey);
      const monthSnap = await getDocs(monthRef);

      const excelRows = [];

      for (const dateDoc of monthSnap.docs) {
        const date = dateDoc.id;

        const runsRef = collection(
          db,
          "dgLogs",
          siteName,
          monthKey,
          date,
          "runs"
        );

        const runsSnap = await getDocs(runsRef);

        runsSnap.forEach((docSnap) => {
          const d = docSnap.data();

          excelRows.push({
            Date: date,
            "DG No": d.dgNumber || "",
            "Start Time": d.startTime || "",
            "Stop Time": d.stopTime || "",
            "HR Meter Start": d.hrMeterStart || "",
            "HR Meter End": d.hrMeterEnd || "",
            "Total Run Hours": d.totalRunHours || 0,
            "Fuel Consumption (Ltrs)": d.fuelConsumption || 0,
            "Fuel Filled (Ltrs)": d.fuelFill || 0,
            "OEM CPH": d.oemCPH || "",
            "Achieved CPH": d.cph || "",
            "SEGR": d.segr || "",
            "DG Run %": d.dgRunPercentage || "",
            "Remarks": d.remarks || "",
            "kWH Reading": d.kWHReading || "",
          });
        });
      }

      if (!excelRows.length) {
        alert("No DG logs found for this month");
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(excelRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Monthly DG Logs");

      const excelBuffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
      });

      const fileBlob = new Blob([excelBuffer], {
        type:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      saveAs(
        fileBlob,
        `DG_Logs_${siteName}_${monthKey}.xlsx`
      );

      setDownloading(false);

    } catch (error) {
      console.error("Excel export failed:", error);
      alert("Failed to export Excel");
    }
  };

  const downloadDGBulkUploadTemplate = () => {
    const templateData = [
      {
        Date: "",
        "DG No": "",
        "Start Time (HH:mm)": "",
        "Stop Time (HH:mm)": "",
        "HR Meter Start": "",
        "HR Meter End": "",
        "Fuel Consumption": "",
        "Fuel Filled": "",
        "Remarks": "",
        "kWH Reading": "",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DG_LOGS");

    XLSX.writeFile(wb, "DG_Bulk_Upload_Template.xlsx");
  };

  const normalizeExcelDate = (value) => {
    // Case 1: Already string date
    if (typeof value === "string") {
      const d = new Date(value);
      return isNaN(d) ? value : format(d, "yyyy-MM-dd");
    }

    // Case 2: Excel serial number
    if (typeof value === "number") {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const date = new Date(excelEpoch.getTime() + value * 86400000);
      return format(date, "yyyy-MM-dd");
    }

    return "";
  };

  const normalizeExcelTime = (value) => {
    // Case 1: already string
    if (typeof value === "string") {
      const d = new Date(`1970-01-01 ${value}`);
      if (!isNaN(d)) {
        return format(d, "HH:mm");
      }
      return value;
    }

    // Case 2: Excel serial time
    if (typeof value === "number") {
      const totalMinutes = Math.round(value * 24 * 60);
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }

    return "";
  };

  const getDGDuplicateKey = (row) => {
    return [
      normalizeExcelDate(row.Date),
      row["DG No"],
      normalizeExcelTime(row["Start Time (HH:mm)"]),
      normalizeExcelTime(row["Stop Time (HH:mm)"]),
      Number(row["HR Meter Start"]) || 0,
      Number(row["HR Meter End"]) || 0,
    ].join("|");
  };

  const resetExcelInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };


  const checkFirestoreDuplicates = async (rows) => {
    const duplicateErrors = [];

    const groupedByMonth = {};

    rows.forEach((row, index) => {
      if (!row.Date || !row["DG No"]) return;

      const dateObj = new Date(normalizeExcelDate(row.Date));
      const monthKey = format(dateObj, "MMM-yyyy");
      const dateKey = format(dateObj, "yyyy-MM-dd");

      if (!groupedByMonth[monthKey]) groupedByMonth[monthKey] = [];
      groupedByMonth[monthKey].push({ row, index, dateKey });
    });

    for (const monthKey in groupedByMonth) {
      for (const item of groupedByMonth[monthKey]) {
        const { row, index, dateKey } = item;

        const runsRef = collection(
          db,
          "dgLogs",
          siteName,
          monthKey,
          dateKey,
          "runs"
        );

        const snap = await getDocs(runsRef);

        const excelKey = getDGDuplicateKey(row);

        snap.forEach((docSnap) => {
          const dbRow = docSnap.data();

          const dbKey = [
            normalizeExcelDate(dateKey),
            dbRow.dgNumber,
            dbRow.startTime,
            dbRow.stopTime,
            Number(dbRow.hrMeterStart) || 0,
            Number(dbRow.hrMeterEnd) || 0,
          ].join("|");

          if (dbKey === excelKey) {
            duplicateErrors.push({
              row: index + 2,
              message:
                "Exact DG run already exists (Date + DG + Time + HR Meter)",
            });
          }
        });
      }
    }

    return duplicateErrors;
  };

  const handleBulkExcelUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async (evt) => {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets["DG_LOGS"];

      if (!sheet) {
        alert("DG_LOGS sheet not found");
        return;
      }

      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      const rows = rawRows.map((row) => ({
        ...row,
        Date: normalizeExcelDate(row.Date),
        "Start Time (HH:mm)": normalizeExcelTime(row["Start Time (HH:mm)"]),
        "Stop Time (HH:mm)": normalizeExcelTime(row["Stop Time (HH:mm)"]),
      }));

      const errors = [];

      const seenKeys = new Set();

      rows.forEach((row, index) => {
        const excelRow = index + 2;

        // Required fields check (keep existing)
        if (
          !row.Date ||
          !row["DG No"] ||
          !row["Start Time (HH:mm)"] ||
          !row["Stop Time (HH:mm)"]
        ) {
          errors.push({
            row: excelRow,
            message: "Missing required fields",
          });
          return;
        }

        // HR meter validation
        const hrStart = Number(row["HR Meter Start"]);
        const hrEnd = Number(row["HR Meter End"]);

        if (isNaN(hrStart) || isNaN(hrEnd) || hrEnd < hrStart) {
          errors.push({
            row: excelRow,
            message: "Invalid HR Meter values",
          });
          return;
        }

        // 🔁 Excel duplicate check
        const key = getDGDuplicateKey(row);


        if (seenKeys.has(key)) {
          errors.push({
            row: excelRow,
            message: "Duplicate DG run found in Excel",
          });
          return;
        }

        seenKeys.add(key);
      });
      // ✅ THIS NOW WORKS
      setCheckingDuplicates(true);
      try {
        const firestoreDuplicates = await checkFirestoreDuplicates(rows);
        setExcelErrors([...errors, ...firestoreDuplicates]);
      } finally {
        setCheckingDuplicates(false);
      }


      setExcelPreviewRows(rows);
      setExcelErrors([...errors]);
      setShowExcelPreview(true);
    };

    reader.readAsArrayBuffer(file);
  };

  const calculateRunHoursFromHrMeter = (start, end) => {
    const s = Number(start);
    const e = Number(end);

    if (isNaN(s) || isNaN(e) || e < s) return 0;

    return Number((e - s).toFixed(2));
  };

  const uploadExcelData = async (rows) => {
    for (const row of rows) {
      if (
        !row.Date ||
        !row["DG No"] ||
        !row["Start Time (HH:mm)"] ||
        !row["Stop Time (HH:mm)"] ||
        !row.Remarks
      ) {
        continue; // ❌ skip invalid
      }

      const dateObj = new Date(row.Date);
      const monthKey = format(dateObj, "MMM-yyyy");
      const dateKey = format(dateObj, "yyyy-MM-dd");

      const runsRef = collection(
        db,
        "dgLogs",
        siteName,
        monthKey,
        dateKey,
        "runs"
      );

      const hrMeterStart = Number(row["HR Meter Start"]) || 0;
      const hrMeterEnd = Number(row["HR Meter End"]) || 0;

      const totalRunHours = calculateRunHoursFromHrMeter(
        hrMeterStart,
        hrMeterEnd
      );

      await addDoc(runsRef, {
        dgNumber: row["DG No"],
        startTime: row["Start Time (HH:mm)"],
        stopTime: row["Stop Time (HH:mm)"],
        hrMeterStart,
        hrMeterEnd,
        totalRunHours,
        fuelConsumption: Number(row["Fuel Consumption"]) || 0,
        fuelFill: Number(row["Fuel Filled"]) || 0,
        oemCPH: Number(row["OEM CPH"]) || 0,
        cph: Number(row["Achieved CPH"]) || 0,
        segr: Number(row["SEGR"]) || 0,
        dgRunPercentage: Number(row["DG Run %"]) || 0,
        remarks: row.Remarks,
        kWHReading: Number(row["kWH Reading"]) || 0,
        createdAt: new Date(),
        createdBy: userData?.email,
        uploadSource: "EXCEL",
      });
    }

    alert("✅ Excel data uploaded successfully");
    fetchLogs();
    fetchMonthlySummary();
  };

  const confirmExcelUpload = async () => {
    if (!excelPreviewRows.length) return;

    if (
      userData?.role === "User" ||
      (userData?.role === "Super User" &&
        userData?.designation === "Vertiv Technician")
    ) {
      alert("Not Authorized");
      return;
    }

    if (
      excelErrors.length &&
      !window.confirm(
        `⚠️ ${excelErrors.length} rows have errors.\nThey will be skipped.\n\nContinue upload?`
      )
    ) {
      return;
    }

    const hasExactDuplicates = excelErrors.some(e =>
      e.message.includes("Exact DG run")
    );

    if (hasExactDuplicates) {
      alert(
        "❌ Exact duplicate DG runs detected.\n\nPlease remove duplicate rows and re-upload."
      );
      return;
    }
    setIsUploadingExcel(true);

    await uploadExcelData(excelPreviewRows);

    resetExcelInput(); // ✅ reset file input
    setIsUploadingExcel(false);
    setShowExcelPreview(false);
    setExcelPreviewRows([]);
    setExcelErrors([]);
  };



  return (
    <div className="daily-log-container">
      <h2 className="dashboard-header">
        <strong>🎯 DG Run Logs – {siteName}</strong>
      </h2>
      <button
        className="segr-manage-btn warning"
        onClick={() => Navigate("/dg-log-entry", { state: { siteConfig , isDGOnLoad: false} })}
      >
        ✎ DG Run Log Entry
      </button>

      {/* Summary table */}
      <div style={{ marginTop: "2rem" }}>
        <h1><strong>📊 Monthly Summary ({selectedDate.slice(0, 7)})</strong></h1>
        {(summary.DG1_OnLoad > 0 || summary.DG1_NoLoad > 0 || summary.DG2_OnLoad > 0 || summary.DG2_NoLoad > 0) ? (
          <table border="1" cellPadding="8" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>DG No</th>
                <th>On Load Count</th>
                <th>No Load Count</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>DG-1</td>
                <td>{summary.DG1_OnLoad}</td>
                <td>{summary.DG1_NoLoad}</td>
              </tr>
              <tr>
                <td>DG-2</td>
                <td>{summary.DG2_OnLoad}</td>
                <td>{summary.DG2_NoLoad}</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <h3><strong>Loading.......</strong></h3>
        )}
      </div>
      {/* Bulk Upload Section */}
      {userData?.role !== "User" && !(userData?.role === "Super User" && userData?.designation === "Vertiv Technician") && (
        <div className="child-container" style={{ border: "1px solid #000", borderRadius: "15px", marginTop: "2rem", padding: "1rem" }}>
          <h2>📥 Bulk Upload DG Logs (Excel)</h2>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label><strong>📥 Bulk Upload Template: </strong></label>
            <b onClick={downloadDGBulkUploadTemplate}
              style={{ fontSize: "12px", height: "fit-content", cursor: "pointer", color: "blue", textDecoration: "underline" }}>
              📥 Download Excel Upload Template
            </b>
          </div>
          <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "10px" }}>
            <label><strong>⬆️ Upload Filled Excel File: </strong></label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleBulkExcelUpload}
              disabled={checkingDuplicates || isUploadingExcel}
            />
            {checkingDuplicates && <span style={{ color: "orange" }}>Checking for duplicates...</span>}
          </div>
          {showExcelPreview && (
            <div className="modal-backdrop">
              <div className="modal-content" style={{ maxWidth: "90%" }}>
                <h2>📊 Excel Upload Preview</h2>

                <p>
                  Total Rows: <b>{excelPreviewRows.length}</b> | Errors:{" "}
                  <b style={{ color: "red" }}>{excelErrors.length}</b>
                </p>

                <div style={{ maxHeight: "400px", overflow: "auto" }}>
                  <table border="1" cellPadding="6" width="100%">
                    <thead>
                      <tr>
                        <th>#</th>
                        {Object.keys(excelPreviewRows[0] || {}).map((key) => (
                          <th key={key}>{key}</th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {excelPreviewRows.map((row, i) => {
                        const hasError = excelErrors.some(e => e.row === i + 2);

                        return (
                          <tr key={i} style={hasError ? { background: "#ffe6e6" } : {}}>
                            <td>{i + 1}</td>
                            {Object.keys(excelPreviewRows[0] || {}).map((key) => (
                              <td key={key}>{row[key]}</td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: "15px", display: "flex", gap: "10px" }}>
                  <button
                    onClick={() => {
                      setShowExcelPreview(false);
                      setExcelPreviewRows([]);
                      setExcelErrors([]);
                      resetExcelInput(); // ✅ reset on cancel
                    }}
                  >
                    ❌ Cancel
                  </button>
                  <button
                    onClick={confirmExcelUpload}
                    disabled={isUploadingExcel}
                  >
                    {isUploadingExcel ? "Uploading..." : "✅ Confirm Upload"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Date selector & DHR Preview Button */}
      <div style={{ margin: "1rem 0", display: "flex", alignItems: "center", gap: "15px" }}>
        <div>
          <label>Select Date: </label>
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
        </div>
        <button onClick={openPreviewModal} className="segr-manage-btn">
          👁️ Preview & Share DHR
        </button>
        {hsdLogs.find(h => h.date === selectedDate)?.hsdPdfUrl ? (
          <a
            href={hsdLogs.find(h => h.date === selectedDate).hsdPdfUrl}
            target="_blank"
            rel="noreferrer"
            style={{ cursor: "pointer" }}
          >
            📄 View PDF
          </a>
        ) : (
          ""
        )}
        <button
          onClick={exportMonthlyDGLogsToExcel}
          className="segr-manage-btn success"
        >
          {downloading ? "📤 Downloading......" : "📤 Export Monthly DG Logs (Excel)"}
        </button>
      </div>

      {logs.length === 0 ? (
        <p>No logs found for {selectedDate}.</p>
      ) : (
        <div className="table-container">
          <table border="1" cellPadding="8" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>DG No</th>
                <th style={{ whiteSpace: "nowrap" }}>Start Time</th>
                <th style={{ whiteSpace: "nowrap" }}>Stop Time</th>
                <th>Hr Meter Start</th>
                <th>Hr Meter End</th>
                <th>Total Run Hours</th>
                <th>Opening kWH</th>
                <th>Closing kWH</th>
                <th>kWH Reading</th>
                <th>Fuel Consumption (Ltrs)</th>
                <th>Remarks</th>
                <th>Fuel Filling (Ltrs)</th>
                <th>OEM CPH (Ltrs)</th>
                <th>Achieve CPH (Ltrs)</th>
                <th>SEGR</th>
                <th>DG Run %</th>
                <th>HSD Template</th>
                <th>Actions</th>
                <th>Entry By</th>     {/* ✅ */}
                <th>Updated By</th>   {/* ✅ */}
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{log.dgNumber}</td>
                  <td style={{}}>{log.startTime} Hrs</td>
                  <td>{log.stopTime} Hrs</td>
                  <td>{log.hrMeterStart}</td>
                  <td>{log.hrMeterEnd}</td>
                  <td>
                    {typeof log.totalRunHours === "number"
                      ? log.totalRunHours.toFixed(1)
                      : "0.0"}
                    <span style={{ fontSize: "10px" }}>
                      (
                      {typeof log.totalRunHours === "number"
                        ? `${(log.totalRunHours * 60).toFixed(0)}_Min`
                        : "0_Min"}
                      )
                    </span>
                  </td>
                  <td>{log.kwhMeterStart}</td>
                  <td>{log.kwhMeterEnd}</td>
                  <td>{log.kWHReading || 0}</td>
                  <td>{log.fuelConsumption || 0}</td>
                  <td>{log.remarks}</td>
                  <td>{log.fuelFill ? log.fuelFill : 0}</td>
                  <td>{log.oemCPH ? log.oemCPH : "N/A"}</td>
                  <td style={log.cph > log.oemCPH ? { color: "Red" } : log.cph?.toFixed(0) === log.oemCPH ? { color: "orange" } : { color: "Green" }}
                    title={log.cph > log.oemCPH ? "High" : log.cph?.toFixed(0) === log.oemCPH ? "In-Line" : "Low"}
                  >{log.cph?.toFixed(2)}<span style={log.cph > log.oemCPH ? { color: "Red", fontSize: "10px" } : log.cph?.toFixed(0) === log.oemCPH ? { color: "orange", fontSize: "10px" } : { color: "Green", fontSize: "10px" }}>{log.cph > log.oemCPH ? "High" : log.cph?.toFixed(0) === log.oemCPH ? "In-Line" : "Low"}</span></td>
                  <td style={log.segr < 3 ? { color: "red" } : { color: "green" }}>{log.segr}</td>
                  <td>{log.dgRunPercentage}%</td>
                  <td>
                    {log.remarks === "Fuel Filling Only" && isLastDGFillForDay() && (
                      <button
                        className="text-blue-600 underline"
                        onClick={openHsdPreview}
                      >
                        👁 View HSD
                      </button>
                    )}
                  </td>

                  <td style={{ display: "flex" }}>
                    <button onClick={() => handleEdit(log)}>Edit</button>
                    <button
                      style={{ marginLeft: "8px", color: "red" }}
                      onClick={() => handleDelete(log)}
                    >
                      ❌
                    </button>
                  </td>
                  <td>
                    {log.enteredBy ? (
                      <>
                        <strong>{log.enteredBy.name}</strong>
                        <br />
                        <small style={{ color: "#666" }}>{log.enteredBy.empId}</small>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>

                  <td>
                    {log.updatedBy ? (
                      <>
                        <strong>{log.updatedBy.name}</strong>
                        <br />
                        <small style={{ color: "#666" }}>{log.updatedBy.empId}</small>
                      </>
                    ) : (
                      <span style={{ color: "#999" }}>Not Updated</span>
                    )}
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hsdPreviewOpen && hsdPreviewData && hsdPreviewForm && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <HSDPrintTemplate
            form={hsdPreviewForm}
            hsdForm={hsdPreviewData}
            siteConfig={siteConfig}
            setPreviewOpen={setHsdPreviewOpen}
          />
        </div>
      )}

      {/* DHR Preview Modal */}
      {isPreviewModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="noticeboard-header" style={{ display: "flex" }}>
              <h1 style={{ whiteSpace: "nowrap" }}>Live DHR Preview</h1>
              <button onClick={() => setIsPreviewModalOpen(false)} className="modal-close-btn" style={{ marginLeft: "80px" }}>&times;</button>
            </div>

            {dhrDataForPreview ? (
              <div>
                {Object.entries(dhrDataForPreview).map(([key, value]) => (
                  <div key={key} className="preview-item">
                    <strong>{key}:</strong> {value}
                  </div>
                ))}
                <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                  <button onClick={shareWhatsApp}>Share WhatsApp</button>
                  <button onClick={shareTelegram}>Share Telegram</button>
                </div>
              </div>
            ) : (
              <p>{dhrMessage}</p>
            )}
          </div>
        </div>
      )}


    </div>
  );
};

export default DGLogTable;
