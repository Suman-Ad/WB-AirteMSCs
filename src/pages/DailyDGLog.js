// src/components/DailyDGLog1.js
import React, { useEffect, useState } from "react";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
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

  const fmt = (val) => (val !== undefined && val !== null ? Number(val).toFixed(1) : "0.0");


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




      result[`DG-${i} KWH Generation`] = kwhClose - kwhOpen;
      result[`DG-${i} Fuel Consumption`] = fuelOpen - fuelClose + fuelFill;
      result[`DG-${i} Running Hrs`] = hrClose - hrOpen;
      result[`DG-${i} CPH`] = hrClose > hrOpen ? (fuelOpen - fuelClose + fuelFill)/(hrClose - hrOpen) : 0;
      result[`DG-${i} SEGR`] = (fuelOpen - fuelClose + fuelFill) > 0 ? (kwhClose - kwhOpen)/(fuelOpen - fuelClose + fuelFill) : 0;
      result[`DG-${i} Run Min`] = (hrClose - hrOpen)*60;


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

    result["Average SEGR"] =
      ((result["DG-1 SEGR"] || 0) + (result["DG-2 SEGR"] || 0))/2;

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
  const segrValues = logs
  .map((entry) => calculateFields(entry)["Average SEGR"])
  .filter((val) => val > 0); // skip zero / invalid
  const monthlyAvgSEGR =
    segrValues.length > 0
      ? (
          segrValues.reduce((sum, val) => sum + val, 0) / segrValues.length
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
      if (!logs.length) return null;
      const sorted = [...logs].sort((a, b) => new Date(a.Date) - new Date(b.Date));
      const yesterday = sorted[sorted.length - 1]; // last entry
      return yesterday;
    };

  useEffect(() => {
    if (logs.length > 0) {
      const yesterday = getYesterdayData();
      if (yesterday) {
        setForm({
          Date: getFormattedDate(),
          "DG-1 KWH Opening": yesterday["DG-1 KWH Closing"] || "",
          "DG-2 KWH Opening": yesterday["DG-2 KWH Closing"] || "",
          "DG-1 Fuel Opening": yesterday["DG-1 Fuel Closing"] || "",
          "DG-2 Fuel Opening": yesterday["DG-2 Fuel Closing"] || "",
          "DG-1 Hour Opening": yesterday["DG-1 Hour Closing"] || "",
          "DG-2 Hour Opening": yesterday["DG-2 Hour Closing"] || "",
          "EB-1 KWH Opening": yesterday["EB-1 KWH Closing"] || "",
          "EB-2 KWH Opening": yesterday["EB-2 KWH Closing"] || "",
        });
      }
    }
  }, [logs]);


  useEffect(() => {
    fetchLogs();
  }, [selectedMonth, siteName]);

  // 🔹 Handle input
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
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

    await setDoc(docRef, { ...form }, { merge: true });

    setForm({ Date: getFormattedDate() });
    fetchLogs();
  };

  // 🔹 Delete log
  const handleDelete = async (id) => {
    const monthKey = selectedMonth;
    await deleteDoc(doc(db, "dailyDGLogs", siteName, monthKey, id));
    fetchLogs();
  };

  // 🔹 Input fields
  const inputFields = [];

  // DGs
  for (let i = 1; i <= 2; i++) {
    inputFields.push(
      `DG-${i} KWH Opening`,
      `DG-${i} KWH Closing`,
      `DG-${i} Fuel Opening`,
      `DG-${i} Fuel Closing`,
      `DG-${i} Fuel Filling`,   // 🆕 New field
      `DG-${i} Hour Opening`,
      `DG-${i} Hour Closing`
    );
  }

  // EBs
  for (let i = 1; i <= 2; i++) {
    inputFields.push(`EB-${i} KWH Opening`, `EB-${i} KWH Closing`);
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
        "DG-1 KWH Opening": calculated["DG-1 KWH Opening"],
        "DG-1 KWH Closing": calculated["DG-1 KWH Closing"],
        "DG-1 Generation": calculated["DG-1 KWH Generation"],
        "DG-2 KWH Opening": calculated["DG-2 KWH Opening"],
        "DG-2 KWH Closing": calculated["DG-2 KWH Closing"],
        "DG-2 Generation": calculated["DG-2 KWH Generation"],
        "Total DG KWH Generation": calculated["Total DG KWH"],
        "EB-1 KWH Opening": calculated["EB-1 KWH Opening"],
        "EB-1 KWH Closing": calculated["EB-1 KWH Closing"],
        "EB-1 Generation": calculated["EB-1 KWH Generation"],
        "EB-2 KWH Opening": calculated["EB-2 KWH Opening"],
        "EB-2 KWH Closing": calculated["EB-2 KWH Closing"],
        "EB-2 Generation": calculated["EB-2 KWH Generation"],
        "Total EB KWH Generation": calculated["Total EB KWH"],
        "DG-1 Run Min": calculated["DG-1 Run Min"],
        "DG-2 Run Min": calculated["DG-2 Run Min"],
        "DG-1 Fuel Opening": calculated["DG-1 Fuel Opening"],
        "DG-1 Fuel Closing": calculated["DG-1 Fuel Closing"],
        "DG-1 Fuel Filling": calculated["DG-1 Fuel Filling"],
        "DG-1 Fuel Consumption": calculated["DG-1 Fuel Consumption"],
        "DG-1 Hour Opening": calculated["DG-1 Hour Opening"],
        "DG-1 Hour Closing": calculated["DG-1 Hour Closing"],
        "DG-1 Running Hrs": calculated["DG-1 Running Hrs"],
        "DG-1 CPH": calculated["DG-1 CPH"],
        "DG-1 SEGR": calculated["DG-1 SEGR"],
        "DG-2 Fuel Opening": calculated["DG-2 Fuel Opening"],
        "DG-2 Fuel Closing": calculated["DG-2 Fuel Closing"],
        "DG-2 Fuel Filling": calculated["DG-2 Fuel Filling"],
        "DG-2 Fuel Consumption": calculated["DG-2 Fuel Consumption"],
        "DG-2 Hour Opening": calculated["DG-2 Hour Opening"],
        "DG-2 Hour Closing": calculated["DG-2 Hour Closing"],
        "DG-2 Running Hrs": calculated["DG-2 Running Hrs"],
        "DG-2 CPH": calculated["DG-2 CPH"],
        "DG-2 SEGR": calculated["DG-2 SEGR"],
        "Total Fuel": calculated["Total DG Fuel"],
        "Total DG Hours": calculated["Total DG Hours"],
        };
    });

    // Create worksheet + workbook
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DailyDGLogs");

    // Export Excel file
    XLSX.writeFile(wb, `DailyDGLogs_${siteName}_${selectedMonth}.xlsx`);
    };


  return (
    <div className="daily-log-container">
      <h1 className="dashboard-header"><strong>{siteName} – Daily DG Log – {formatYear(selectedMonth)}</strong> </h1>
      <div className="chart-container">
        <strong><h1 className={`month ${formatMonthName(selectedMonth)}`}>{formatMonthName(selectedMonth)}</h1></strong>
        <h2 className={monthlyAvgSEGR < 3 ? "avg-segr low" : "avg-segr high"}>
          Average SEGR – <strong>{monthlyAvgSEGR}</strong>
        </h2>
        <p className={monthlyAvgDG1SEGR < 3 ? "avg-segr low" : "avg-segr high"}>DG-1 Average SEGR – {monthlyAvgDG1SEGR}</p>
        <p className={monthlyAvgDG2SEGR < 3 ? "avg-segr low" : "avg-segr high"}>DG-2 Average SEGR – {monthlyAvgDG2SEGR}</p>
      </div>
      <label>
        Select Month:
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        />
      </label>

      <form className="daily-log-form" onSubmit={handleSubmit}>
        <label>
          Date:
          <input
            type="date"
            name="Date"
            value={form.Date || ""}
            onChange={handleChange}
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
              className={form[field] === "" || form[field] === undefined ? "input-missing" : ""}
            />
          </label>
        ))}

        <button className="submit-btn" type="submit">Save Entry</button>
      </form>
      
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
              <th>DG-1 Fuel Consumption</th>
              <th>DG-1 Hour Opening</th>
              <th>DG-1 Hour Closing</th>
              <th>DG-1 Running Hrs</th>
              <th>DG-1 CPH</th>
              <th>DG-1 SEGR</th>
              <th>DG-2 Fuel Opening</th>
              <th>DG-2 Fuel Closing</th>
              <th>DG-2 Fuel Filling</th>
              <th>DG-2 Fuel Consumption</th>
              <th>DG-2 Hour Opening</th>
              <th>DG-2 Hour Closing</th>
              <th>DG-2 Running Hrs</th>
              <th>DG-2 CPH</th>
              <th>DG-2 SEGR</th>
              <th>Total DG KWH Generation</th>
              <th>Total EB KWH Reading</th>
              <th>Total KWH Consumption(EB+DG)</th>
              <th>Total Fuel Consumption</th>
              <th>Total DG Run Hours</th>
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
                <tr key={entry.id} className={rowClass}>
                  <td>{entry.Date}</td>
                  <td>{calculated["DG-1 KWH Opening"]}</td>
                  <td>{calculated["DG-1 KWH Closing"]}</td>
                  <td>{calculated["DG-1 KWH Generation"]}</td>
                  <td>{calculated["DG-2 KWH Opening"]}</td>
                  <td>{calculated["DG-2 KWH Closing"]}</td>
                  <td>{calculated["DG-2 KWH Generation"]}</td>
                  <td>{calculated["EB-1 KWH Opening"]}</td>
                  <td>{calculated["EB-1 KWH Closing"]}</td>
                  <td>{calculated["EB-1 KWH Generation"]}</td>
                  <td>{calculated["EB-2 KWH Opening"]}</td>
                  <td>{calculated["EB-2 KWH Closing"]}</td>
                  <td>{calculated["EB-2 KWH Generation"]}</td>
                  <td>{fmt(calculated["DG-1 Run Min"])}</td>
                  <td>{fmt(calculated["DG-2 Run Min"])}</td>
                  <td>{calculated["DG-1 Fuel Opening"]}</td>
                  <td>{calculated["DG-1 Fuel Closing"]}</td>
                  <td>{calculated["DG-1 Fuel Filling"] || 0}</td>
                  <td>{calculated["DG-1 Fuel Consumption"]}</td>
                  <td>{calculated["DG-1 Hour Opening"]}</td>
                  <td>{calculated["DG-1 Hour Closing"]}</td>
                  <td>{fmt(calculated["DG-1 Running Hrs"])}</td>
                  <td>{fmt(calculated["DG-1 CPH"])}</td>
                  <td>{fmt(calculated["DG-1 SEGR"])}</td>
                  <td>{calculated["DG-2 Fuel Opening"]}</td>
                  <td>{calculated["DG-2 Fuel Closing"]}</td>
                  <td>{calculated["DG-2 Fuel Filling"] || 0}</td>
                  <td>{calculated["DG-2 Fuel Consumption"]}</td>
                  <td>{calculated["DG-2 Hour Opening"]}</td>
                  <td>{calculated["DG-2 Hour Closing"]}</td>
                  <td>{fmt(calculated["DG-2 Running Hrs"])}</td>
                  <td>{fmt(calculated["DG-2 CPH"])}</td>
                  <td>{fmt(calculated["DG-2 SEGR"])}</td>
                  <td>{calculated["Total DG KWH"]}</td>
                  <td>{calculated["Total EB KWH"]}</td>
                  <td>{calculated["Total Unit Consumption"]}</td>
                  <td>{calculated["Total DG Fuel"]}</td>
                  <td>{fmt(calculated["Total DG Hours"])}</td>
                  
                  <td>
                    <button onClick={() => setForm(entry)}>Edit</button>
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
