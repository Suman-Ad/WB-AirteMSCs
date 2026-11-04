// src/components/DGLogTable.js
import React, { useState, useEffect, useMemo, useRef } from "react";
import { collection, getDocs, doc, updateDoc, getDoc, deleteDoc, query, limit, orderBy, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useLocation, useNavigate } from "react-router-dom";
import { format, set, subDays } from "date-fns";
import HSDPrintTemplate from "../components/HSDPrintTemplate";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import "../assets/DGLogTable.css";


// Convert decimal hours to HH:MM format
const formatTime = (hours) => {
  const h = Math.floor(hours); // integer hours
  const m = Math.round((hours - h) * 60); // minutes from fraction
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} Min`;
};

const DGLogTable = ({ userData }) => {
  const { state } = useLocation();
  const { totalkW, fuelAvalable, siteConfig, dayFuelCon, siteName, avgSiteRunningKw } = state || {};
  const [logs, setLogs] = useState([]);
  const [monthlyLogs, setMonthlyLogs] = useState([]);
  const [isMonthlyLogsLoading, setIsMonthlyLogsLoading] = useState(false);
  const [monthlyFilters, setMonthlyFilters] = useState({
    dgNumber: "ALL",
    runType: "ALL",
    performance: "ALL",
  });
  const [summary, setSummary] = useState({});
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);
  const Navigate = useNavigate();

  const configuredDGNumbers = useMemo(() => {
    const dgCount = Number(siteConfig?.dgCount) || Object.keys(siteConfig?.dgConfigs || {}).length || 2;
    return Array.from({ length: dgCount }, (_, index) => `DG-${index + 1}`);
  }, [siteConfig?.dgCount, siteConfig?.dgConfigs]);

  const getISTDate = () => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    const parts = formatter.formatToParts(now);
    const year = parts.find(p => p.type === "year").value;
    const month = parts.find(p => p.type === "month").value;
    const day = parts.find(p => p.type === "day").value;

    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState(getISTDate());

  // const siteName = userData?.site;

  const uploadedBy = {
    uid: userData.uid || "",
    name: userData.name || "",
    role: userData.role || "",
    empId: userData.empId || "",
  };

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
      fetchMonthlyLogs();
      fetchHsdLogs();
    }
    // eslint-disable-next-line
  }, [siteName, selectedDate, configuredDGNumbers]);

  const fetchLogs = async () => {
    try {
      const dateObj = new Date(selectedDate + "T00:00:00");
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
    setIsSummaryLoading(true);
    try {
      const dateObj = new Date(selectedDate + "T00:00:00");
      const monthKey =
        dateObj.toLocaleString("en-US", { month: "short" }) +
        "-" +
        dateObj.getFullYear();

      // 🔹 Get all date docs under the month
      const monthRef = collection(db, "dgLogs", siteName, monthKey);
      const monthSnapshot = await getDocs(monthRef);

      const counts = Object.fromEntries(
        configuredDGNumbers.map((dgNumber) => [dgNumber, { onLoad: 0, noLoad: 0 }])
      );

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
          if (!counts[data.dgNumber]) return;
          if (data.remarks === "On Load") counts[data.dgNumber].onLoad++;
          if (data.remarks === "No Load") counts[data.dgNumber].noLoad++;
        });
      }

      setSummary(counts);

    } catch (err) {
      console.error("Error fetching monthly summary:", err);
    } finally {
      setIsSummaryLoading(false);
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
      const dateObj = new Date(selectedDate + "T00:00:00");
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
      fetchMonthlyLogs();
      fetchHsdLogs();

    } catch (err) {
      console.error("Error deleting log:", err);
      alert("Failed to delete log. Check console.");
    }
  };

  // Fetches logs for the main table view (for the selected date)
  const fetchLogsForSelectedDate = async () => {
    try {
      const dateObj = new Date(selectedDate + "T00:00:00");
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

  // Fetch every run for the selected month so it can be reviewed below the daily table.
  const fetchMonthlyLogs = async () => {
    if (!siteName || !selectedDate) return;

    setIsMonthlyLogsLoading(true);
    try {
      const monthKey = format(new Date(selectedDate + "T00:00:00"), "MMM-yyyy");
      const monthSnapshot = await getDocs(collection(db, "dgLogs", siteName, monthKey));
      const runsByDate = await Promise.all(
        monthSnapshot.docs.map(async (dateDoc) => {
          const runsSnapshot = await getDocs(
            collection(db, "dgLogs", siteName, monthKey, dateDoc.id, "runs")
          );
          return runsSnapshot.docs.map((runDoc) => ({
            id: runDoc.id,
            date: dateDoc.id,
            ...runDoc.data(),
          }));
        })
      );

      setMonthlyLogs(
        runsByDate
          .flat()
          .sort((a, b) => `${b.date}-${b.startTime || ""}`.localeCompare(`${a.date}-${a.startTime || ""}`))
      );
    } catch (err) {
      console.error("Error fetching monthly DG logs:", err);
      setMonthlyLogs([]);
    } finally {
      setIsMonthlyLogsLoading(false);
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
      const yesterday = subDays(new Date(selectedDate + "T00:00:00"), 1);
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
        "📊 DHR Date": format(new Date(selectedDate + "T00:00:00"), "dd.MM.yyyy"),
        "🏙️ Region": userData?.region,
        "🔄 Circle": userData?.circle,
        "📍 Site Name": siteName,
        "⛽ Diesel Available": `${(fuelAvalable).toFixed(2)} Ltrs.` || "N/A",
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
      const dateObj = new Date(selectedDate + "T00:00:00");
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
            "Opening kWH Reading": d.kwhMeterStart || 0,
            "Closing kWH Reading": d.kwhMeterEnd || 0,
            "kWH Reading": d.kWHReading || "",
            "Fuel Consumption (Ltrs)": d.fuelConsumption || 0,
            "Fuel Filled (Ltrs)": d.fuelFill || 0,
            "OEM CPH": d.oemCPH || "",
            "Achieved CPH": d.cph || "",
            "SEGR": d.segr || "",
            "DG Run %": d.dgRunPercentage || "",
            "Remarks": d.remarks || "",
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
        "Remarks": "On Load / No Load",
        "Opening kWH Reading": "",
        "Closing kWH Reading": "",
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
        kwhMeterStart: Number(row["Opening kWH Reading"]) || 0, // Assuming kWH Reading is the end reading. Adjust if needed.
        kwhMeterEnd: Number(row["Closing kWH Reading"]) || 0, // Assuming kWH Reading is the end reading. Adjust if needed.
        kWHReading: (Number(row["Closing kWH Reading"]) - Number(row["Opening kWH Reading"])) || 0,
        createdAt: serverTimestamp(),
        createdBy: uploadedBy,
        uploadSource: "EXCEL",
      });
    }

    alert("✅ Excel data uploaded successfully");
    fetchLogs();
    fetchMonthlySummary();
    fetchMonthlyLogs();
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

  const monthlyDGNumbers = useMemo(
    () => [...new Set(monthlyLogs.map((log) => log.dgNumber).filter(Boolean))].sort(),
    [monthlyLogs]
  );

  const isHighCPH = (log) => {
    const cph = Number(log.cph);
    const oemCPH = Number(log.oemCPH);
    return Number.isFinite(cph) && Number.isFinite(oemCPH) && cph > oemCPH;
  };

  const isLowSEGR = (log) => {
    const segr = Number(log.segr);
    return Number.isFinite(segr) && segr > 0 && segr < 3;
  };

  const filteredMonthlyLogs = useMemo(() => monthlyLogs.filter((log) => {
    return (
      (monthlyFilters.dgNumber === "ALL" || log.dgNumber === monthlyFilters.dgNumber) &&
      (monthlyFilters.runType === "ALL" || log.remarks === monthlyFilters.runType) &&
      (monthlyFilters.performance === "ALL" ||
        (monthlyFilters.performance === "HIGH_CPH" && isHighCPH(log)) ||
        (monthlyFilters.performance === "LOW_SEGR" && isLowSEGR(log)))
    );
  }), [monthlyLogs, monthlyFilters]);



  return (
    <div className="daily-log-container dg-log-page">
      <h2 className="dashboard-header">
        <strong>🎯 DG Run Logs – {siteName}</strong>
      </h2>
      <button
        className="segr-manage-btn warning"
        onClick={() => Navigate("/dg-log-entry", { state: { isDGOnLoad: false, siteName } })}
      >
        ✎ DG No Load Run / Fuel Filling Log Entry
      </button>

      {/* Summary table */}
      <section className="dg-log-panel dg-count-panel">
        <h2>Monthly run counts · {selectedDate.slice(0, 7)}</h2>
        {!isSummaryLoading ? (
          <div className="dg-summary-scroll"><table className="dg-count-table">
            <thead>
              <tr>
                <th>DG No</th>
                <th>On Load Count</th>
                <th>No Load Count</th>
              </tr>
            </thead>
            <tbody>
              {configuredDGNumbers.map((dgNumber) => (
                <tr key={dgNumber}>
                  <td>{dgNumber}</td>
                  <td>{summary[dgNumber]?.onLoad || 0}</td>
                  <td>{summary[dgNumber]?.noLoad || 0}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        ) : (
          <p role="status">Loading monthly run counts…</p>
        )}
      </section>
      {/* Bulk Upload Section */}
      {userData?.role !== "User" && !(userData?.role === "Super User" && userData?.designation === "Vertiv Technician") && (
        <div className="child-container dg-log-panel dg-upload-panel">
          <h2>📥 Bulk Upload DG Logs (Excel)</h2>
          <div className="dg-upload-row">
            <label><strong>📥 Bulk Upload Template: </strong></label>
            <b onClick={downloadDGBulkUploadTemplate}
              style={{ fontSize: "12px", height: "fit-content", cursor: "pointer", color: "blue", textDecoration: "underline" }}>
              📥 Download Excel Upload Template
            </b>
          </div>
          <div className="dg-upload-row">
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
      <div className="dg-log-toolbar">
        <div>
          <label htmlFor="dg-log-date">Select date</label>
          <input id="dg-log-date" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
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

      </div>
      <h2 id="daily-dg-log-table-title">
        Daily DG runs · {format(new Date(selectedDate + "T00:00:00"), "dd MMM yyyy")}
      </h2>
      {logs.length === 0 ? (
        <p>No logs found for {selectedDate}.</p>
      ) : (
        <div className="dg-table-scroll" role="region" aria-labelledby="daily-dg-log-table-title" tabIndex={0}>
          <table className="dg-run-table dg-daily-table">
            <caption>Daily DG runs. Scroll horizontally to view all readings and actions.</caption>
            <thead>
              <tr>
                <th scope="col">DG No</th>
                <th style={{ whiteSpace: "nowrap" }}>Start Time</th>
                <th style={{ whiteSpace: "nowrap" }}>Stop Time</th>
                <th>Hr Meter Start</th>
                <th>Hr Meter End</th>
                <th>Total Run Hours</th>
                <th>Opening (kWh)</th>
                <th>Closing (kWh)</th>
                <th>Generation (kWh)</th>
                <th>Fuel Consumption (Ltrs)</th>
                <th>Remarks</th>
                <th>Fuel Filling (Ltrs)</th>
                <th>OEM CPH (Ltrs)</th>
                <th>Achieve CPH (Ltrs)</th>
                <th>Average load (kW)</th>
                <th>SEGR</th>
                <th>DG Run %</th>
                <th>HSD Template</th>
                <th>Actions</th>
                <th>Entry By</th>     {/* ✅ */}
                <th>Updated By</th>   {/* ✅ */}
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const runningKWH = Number(log.totalRunHours) > 0 && Number.isFinite(Number(log.kWHReading))
                    ? (Number(log.kWHReading) / Number(log.totalRunHours)).toFixed(1) : "—";
                return (
                  <tr key={log.id}>
                    <td>{log.dgNumber}</td>
                    <td>{log.startTime} Hrs</td>
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
                    <td><span className={`dg-run-type ${log.remarks === "On Load" ? "is-on-load" : log.remarks === "No Load" ? "is-no-load" : "is-filling"}`}>{log.remarks || "—"}</span></td>
                    <td style={{ fontSize: "12px" }}>
                      {(log.fuelFill || log.exFuelFill) ? (
                        <div>
                          Day🛢️: {log.fuelFill ? log.fuelFill : 0}L
                          <p style={{ fontSize: "12px" }}>
                            Ex.🛢️:{log.exFuelFill ? log.exFuelFill : 0}L
                          </p>
                          = {Number(log.fuelFill || 0) + Number(log.exFuelFill || 0)}L
                        </div>
                      ) : 0}
                    </td>
                    <td>{log.oemCPH ? log.oemCPH : "N/A"}</td>
                    <td style={log.cph > log.oemCPH ? { color: "Red" } : (log.cph != null && Number.isFinite(Number(log.cph)) ? Number(log.cph).toFixed(0) : null) === log.oemCPH ? { color: "orange" } : { color: "Green" }}
                      title={log.cph > log.oemCPH ? "High" : (log.cph != null && Number.isFinite(Number(log.cph)) ? Number(log.cph).toFixed(0) : null) === log.oemCPH ? "In-Line" : "Low"}
                    >{log.cph != null && Number.isFinite(Number(log.cph)) ? Number(log.cph).toFixed(2) : "—"}<span style={log.cph > log.oemCPH ? { color: "Red", fontSize: "10px" } : (log.cph != null && Number.isFinite(Number(log.cph)) ? Number(log.cph).toFixed(0) : null) === log.oemCPH ? { color: "orange", fontSize: "10px" } : { color: "Green", fontSize: "10px" }}>{log.cph > log.oemCPH ? "High" : (log.cph != null && Number.isFinite(Number(log.cph)) ? Number(log.cph).toFixed(0) : null) === log.oemCPH ? "In-Line" : "Low"}</span></td>
                    <td style={(runningKWH < avgSiteRunningKw && runningKWH > 0) ? { color: "Red" } : runningKWH === avgSiteRunningKw ? {} : runningKWH <= 0 ? { color: "" } : { color: "Green" }}>{runningKWH}</td>
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

                    <td><div className="dg-row-actions">
                      <button type="button" onClick={() => handleEdit(log)}>Edit</button>
                      <button
                        className="dg-delete-button"
                        aria-label={`Delete ${log.dgNumber} run at ${log.startTime || "unspecified time"}`}
                        onClick={() => handleDelete(log)}
                      >
                        Delete
                      </button>
                    </div></td>
                    <td>
                      {log.enteredBy ? (
                        <>
                          <strong>{log.enteredBy.name}</strong>
                          <br />
                          <small className="dg-muted">{log.enteredBy.empId}</small>
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
                          <small className="dg-muted">{log.updatedBy.empId}</small>
                        </>
                      ) : (
                        <span className="dg-muted">Not updated</span>
                      )}
                    </td>

                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <section className="dg-monthly-section" aria-labelledby="monthly-dg-log-table-title">
        <h2 id="monthly-dg-log-table-title">
          Full month DG runs ({format(new Date(selectedDate + "T00:00:00"), "MMMM yyyy")})
        </h2>
        <div className="monthly-log-filters dg-log-filters">
          <label>
            DG
            <select
              value={monthlyFilters.dgNumber}
              onChange={(event) => setMonthlyFilters((filters) => ({ ...filters, dgNumber: event.target.value }))}
            >
              <option value="ALL">All DGs</option>
              {monthlyDGNumbers.map((dgNumber) => <option key={dgNumber} value={dgNumber}>{dgNumber}</option>)}
            </select>
          </label>
          <label>
            Run Type
            <select
              value={monthlyFilters.runType}
              onChange={(event) => setMonthlyFilters((filters) => ({ ...filters, runType: event.target.value }))}
            >
              <option value="ALL">All Run Types</option>
              <option value="On Load">On Load</option>
              <option value="No Load">No Load</option>
              <option value="Fuel Filling Only">Fuel Filling Only</option>
            </select>
          </label>
          <label>
            Performance
            <select
              value={monthlyFilters.performance}
              onChange={(event) => setMonthlyFilters((filters) => ({ ...filters, performance: event.target.value }))}
            >
              <option value="ALL">All Performance</option>
              <option value="HIGH_CPH">High CPH</option>
              <option value="LOW_SEGR">Low SEGR (&lt; 3)</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => setMonthlyFilters({ dgNumber: "ALL", runType: "ALL", performance: "ALL" })}
          >
            Clear Filters
          </button>
          <span>{filteredMonthlyLogs.length} of {monthlyLogs.length} logs</span>
          <button
            onClick={exportMonthlyDGLogsToExcel}
            className="segr-manage-btn success"
          >
            {downloading ? "📤 Downloading......" : "📤 Export Monthly DG Logs (Excel)"}
          </button>
        </div>
        {isMonthlyLogsLoading ? (
          <p>Loading monthly DG logs…</p>
        ) : monthlyLogs.length === 0 ? (
          <p>No DG logs found for this month.</p>
        ) : filteredMonthlyLogs.length === 0 ? (
          <p>No monthly logs match the selected filters.</p>
        ) : (
          <div className="dg-table-scroll" role="region" aria-labelledby="monthly-dg-log-table-title" tabIndex={0}>
            <table className="dg-run-table dg-monthly-table">
              <caption>Monthly DG runs. Date and DG number remain visible while scrolling.</caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">DG No</th>
                  <th>Start Time</th>
                  <th>Stop Time</th>
                  <th>Hr Meter Start</th>
                  <th>Hr Meter End</th>
                  <th>Total Run Hours</th>
                  <th>Opening (kWh)</th>
                  <th>Closing (kWh)</th>
                  <th>Generation (kWh)</th>
                  <th>Fuel Consumption (Ltrs)</th>
                  <th>Fuel Filling (Ltrs)</th>
                  <th>Remarks</th>
                  <th>OEM CPH</th>
                  <th>Achieved CPH</th>
                  <th>Average load (kW)</th>
                  <th>SEGR</th>
                  <th>DG Run %</th>
                  <th>Entry By</th>
                  <th>Updated By</th>
                </tr>
              </thead>
              <tbody>
                {filteredMonthlyLogs.map((log) => {
                  const runningKWH = Number(log.totalRunHours) > 0 && Number.isFinite(Number(log.kWHReading))
                    ? (Number(log.kWHReading) / Number(log.totalRunHours)).toFixed(1) : "—";
                  return (
                    <tr key={`${log.date}-${log.id}`}>
                      <td>{format(new Date(log.date + "T00:00:00"), "dd MMM yyyy")}</td>
                      <td>{log.dgNumber || "—"}</td>
                      <td>{log.startTime ? `${log.startTime} Hrs` : "—"}</td>
                      <td>{log.stopTime ? `${log.stopTime} Hrs` : "—"}</td>
                      <td>{log.hrMeterStart ?? "—"}</td>
                      <td>{log.hrMeterEnd ?? "—"}</td>
                      <td>{Number(log.totalRunHours || 0).toFixed(1)}</td>
                      <td>{log.kwhMeterStart ?? 0}</td>
                      <td>{log.kwhMeterEnd ?? 0}</td>
                      <td>{log.kWHReading ?? 0}</td>
                      <td>{log.fuelConsumption ?? 0}</td>
                      <td>{Number(log.fuelFill || 0) + Number(log.exFuelFill || 0)}</td>
                      <td><span className={`dg-run-type ${log.remarks === "On Load" ? "is-on-load" : log.remarks === "No Load" ? "is-no-load" : "is-filling"}`}>{log.remarks || "—"}</span></td>
                      <td>{log.oemCPH ?? "N/A"}</td>
                      <td
                        style={isHighCPH(log) ? { color: "red", fontWeight: "bold" } : {}}
                        title={isHighCPH(log) ? "High CPH" : undefined}
                      >
                        {log.cph != null ? Number(log.cph).toFixed(2) : "N/A"}
                      </td>
                      <td style={(runningKWH < avgSiteRunningKw && runningKWH > 0) ? { color: "Red" } : runningKWH === avgSiteRunningKw ? {} : runningKWH <= 0 ? { color: "" } : { color: "Green" }}>{runningKWH}</td>
                      <td
                        style={isLowSEGR(log) ? { color: "red", fontWeight: "bold" } : {}}
                        title={isLowSEGR(log) ? "Low SEGR" : undefined}
                      >
                        {log.segr ?? "—"}
                      </td>
                      <td>{log.dgRunPercentage != null ? `${log.dgRunPercentage}%` : "—"}</td>
                      <td>{log.enteredBy?.name || "—"}</td>
                      <td>{log.updatedBy?.name || "Not Updated"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
