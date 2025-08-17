// src/components/ExcelSheetEditor.js
import React, { useState, useEffect, useMemo } from "react";
import "../assets/ExcelSheetEditor.css";
import { Parser } from 'hot-formula-parser';
import structuredClone from '@ungap/structured-clone';
import { formulasConfig } from "../config/formulasConfig";
import * as XLSX from "xlsx";


const DEBOUNCE_DELAY = 1500;
// const numericKeyPattern = /(ltr|capacity|dg|cph|hrs|qty|total|stock|rating|kva|tr|count|uptime|amount|number|SlNo|remarks)/i;
const numericKeyPattern = /(qty|rating|kva|tr|count|uptime|amount|number|SlNo|remarks|Total|CPH)/i;



export const sheetTemplates = {
  Final_Summary: [
    { Edge_Data_Centres_Count: "Category Checks", WB: "" },
    { Edge_Data_Centres_Count: "Sites Less Than 12 Hrs Diesel Back Up", WB: "" },
    { Edge_Data_Centres_Count: "Sites More Than 12 Hrs Diesel Back Up", WB: "" },
    { Edge_Data_Centres_Count: "MSC more than 2500 Litres excluding Day Tanks", WB: "" },
    { Edge_Data_Centres_Count: "MSC more than 2500 Litres Including Day Tanks", WB: "" },
    { Edge_Data_Centres_Count: "DG Running Hrs.", WB: "" },
    { Edge_Data_Centres_Count: "EB Availability Hrs.", WB: "" },
    { Edge_Data_Centres_Count: "Infra Uptime", WB: "" },
    { Edge_Data_Centres_Count: "Infra Uptime with Redundancy", WB: "" },
    { Edge_Data_Centres_Count: "Minor Fault Details (If any)", WB: "" },
    { Edge_Data_Centres_Count: "Major Fault Details (If any)", WB: "" },
    { Edge_Data_Centres_Count: "Planned Activity Details", WB: "" },
    { Edge_Data_Centres_Count: "Category Checks", WB: "" },
    { Edge_Data_Centres_Count: "O&M Manpower Availability as Per LOI", WB: "" },
    { Edge_Data_Centres_Count: "In House PM Planned (Jul'25 Month)", WB: "" },
    { Edge_Data_Centres_Count: "In House PM Completed (Jul'25 Month)", WB: "" },
    { Edge_Data_Centres_Count: "Inhouse PM Completion %", WB: "" },
    { Edge_Data_Centres_Count: "OEM PM Planned (Jul'25 Month)", WB: "" },
    { Edge_Data_Centres_Count: "OEM PM Completed (Jul'25 Month)", WB: "" },
    { Edge_Data_Centres_Count: "OEM PM Completion %", WB: "" },
    { Edge_Data_Centres_Count: "Incidents / Accidents Reported", WB: "" },
    { Edge_Data_Centres_Count: "EOL Replacement Planned", WB: "" },
    { Edge_Data_Centres_Count: "EOL Replacement Completed", WB: "" },
    { Edge_Data_Centres_Count: "Operational Governance Call Planned", WB: "" },
    { Edge_Data_Centres_Count: "Operational Governance Call Executed", WB: "" },
  ],
  Diesel_Back_Up: [
    {
      Circle: "", Site_Name: "", DG_fuel_tank_capacity: "",
      Present_Diesel_Stock_in_DG_tank_Ltr: "", MSC_Status_Grater_Less_2500_Lts: "",
      External_Stock_capacity_Barrel_UG_Buffer_Ltr: "", External_Stock_availiabl_at_MSC_Ltr: "",
      Tota_Stock_Capacity: "", Total_Stock_available: "", Status: "", DG_CPH: "",
      Fuel_back_up_Hrs: "", Category: "", Remark: "", Including_Day_tank: "", Excluding_Day_tank: "",
    },
  ],
  DG_EB_Backup: [
    { SlNo: "", Circle: "", Site_Name: "", Total_Power_Failure_hrs: "", Total_DG_Run_hrs: "", Remark: "" },
  ],
  Infra_Update: [
    { SlNo: "", Circle: "", Site_Name: "", Site_ID: "", Infra_Uptime_Percentage: "" },
  ],
  Fault_Details: [
    { 
      SlNo: "", Region: "", Circle: "", Date: "", Complaint_Reg_by:"", Site_Name: "", 
      Site_ID: "", Location:"", Equipment_Type:"", Equipment_Name:"", Equipment_Make:"", 
      Equipment_Capacity:"", Equipment_Sl_No:"", Complaint_ID:"", Complaint_Open_Date:"", 
      Complaint_Open_Time:"", Severity_Major_Minor:"", Service_Provider:"", Issue_Details:"", 
      Reason_Category:"", Real_Reason_of_Incident:"", Status_Open_Close:"", Open_Complaint:"", 
      Closure_Date:"", Closure_Time:"", Ageing_In_Hours:"", Outage_Duration_In_Min:"", 
      Total_Month_Min: "", Uptime_Percentage: "", TAT_as_per_SOW: "", Time_taken_more_than_TAT:"", 
      TAT_Status:"", Name_of_Service_Engineer:"", Action_Taken_for_clouser:"", Remarks: ""
    },
  ],
  Planned_Activity_Details: [
    {
      Date: "", Circle: "", Site_Name: "", Site_ID: "", Activity_Planned_Y_N: "",
      Activity_Description: "", Activity_Execution_Status: "", Category: ""
    },
  ],
  Manpower_Availability: [
    {
      SlNo: "", Circle: "", Site_Name: "", Region: "", SEng_Circle_SPOC: "",
      Engg: "", Supervisor: "", Technician: "", Total_Manpower: "",
      HC_Availability_as_per_LOI: "", Remark: ""
    },
  ],
  Sheet1: [{ SlNo: "", data1: "", data2: "", remark: "" }],
  In_House_PM: [
    {
      Circle: "", Site_Name: "", Equipment_Category: "", In_House_PM_Frequency: "",
      Month: "", In_House_Plan_Date: "", In_House_Done_Date: "", PM_Status: "", Remarks: ""
    },
  ],
  Sheet2: [{ SlNo: "", key: "", value: "", remark: "" }],
  OEM_PM: [
    {
      Region: "", Circle: "", Site_Name: "", Equipment_Category: "", Equipment_Name_and_No: "",
      Equipment_Make: "", Unit_of_measure_kva_TR_etc: "", Rating_Capacity: "", Qty: "",
      OEM_PM_Frequency: "", AMC_Partner_Name: "", Month: "",
      OEM_PM_Plan_Date: "", OEM_PM_Done_Date: "", PM_Status: "", Remarks: "", Floor_Name: "", Room_Name: ""
    },
  ],
  Operational_Governance_Call: [
    {
      Circle: "", Site_Name: "", Governance_Meeting_Status_Planned: "",
      Governance_Meeting_Status_Done: "", Remark_Agenda: ""
    },
  ],
};

const siteWiseDefaults = {
  Diesel_Back_Up: {
    DG_fuel_tank_capacity: {
      "Andaman": 1060.00,
      "Asansol": 1980.00,
      "Berhampore": 1980.00,
      "Globsyn": 1400.00,
      "Mira Tower": 1980.00,
      "New Alipore": 990.00,
      "DLF": 1980.00,
      "Infinity-I": 1890.00,
      "Infinity-II": 1980.00,
      "Kharagpur": 1980.00,
      "SDF": 1980.00,
      "Siliguri": 2970.00

    },
    
    External_Stock_capacity_Barrel_UG_Buffer_Ltr: {
      "Andaman": 850.00,
      "Asansol": 200.00,
      "Berhampore": 400.00,
      "Globsyn": 0.00,
      "Mira Tower": 0.00,
      "New Alipore": 0.00,
      "DLF": 0.00,
      "Infinity-I": 0.00,
      "Infinity-II": 0.00,
      "Kharagpur": 2000.00,
      "SDF": 0.00,
      "Siliguri": 1990.00

    },

    DG_CPH: {
      "Andaman": 28.00,
      "Asansol": 96.00,
      "Berhampore": 95.00,
      "Globsyn": 80.00,
      "Mira Tower": 48.00,
      "New Alipore": 42.00,
      "DLF": 140.00,
      "Infinity-I": 111.60,
      "Infinity-II": 147.00,
      "Kharagpur": 261.00,
      "SDF": 45.00,
      "Siliguri": 165.00
      
    }
    
  },

  Manpower_Availability: {
      SEng_Circle_SPOC: {
        "Andaman": 0.00,
        "Asansol": 0.00,
        "Berhampore": 1.00,
        "Globsyn": 0.00,
        "Mira Tower": 0.00,
        "New Alipore": 0.00,
        "DLF": 0.00,
        "Infinity-I": 1.00,
        "Infinity-II": 0.00,
        "Kharagpur": 0.00,
        "SDF": 0.00,
        "Siliguri": 0.00
      },

      Engg: {
        "Andaman": 1.00,
        "Asansol": 1.00,
        "Berhampore": 1.00,
        "Globsyn": 1.00,
        "Mira Tower": 0.00,
        "New Alipore": 1.00,
        "DLF": 1.00,
        "Infinity-I": 1.00,
        "Infinity-II": 1.00,
        "Kharagpur": 1.00,
        "SDF": 1.00,
        "Siliguri": 1.00

      }, 
      
      Supervisor: {
        "Andaman": 1.00,
        "Asansol": 1.00,
        "Berhampore": 0.00,
        "Globsyn": 1.00,
        "Mira Tower": 0.00,
        "New Alipore": 1.00,
        "DLF": 1.00,
        "Infinity-I": 1.00,
        "Infinity-II": 1.00,
        "Kharagpur": 1.00,
        "SDF": 1.00,
        "Siliguri": 1.00

      }, 
      Technician: {
        "Andaman": 5.00,
        "Asansol": 7.00,
        "Berhampore": 7.00,
        "Globsyn": 7.00,
        "Mira Tower": 7.00,
        "New Alipore": 7.00,
        "DLF": 10.00,
        "Infinity-I": 9.00,
        "Infinity-II": 7.00,
        "Kharagpur": 7.00,
        "SDF": 7.00,
        "Siliguri": 7.00
      },
    },
};

const ExcelSheetEditor = ({ sheetKey, rows, onSave, lastUpdated, userData, selectedDate, allSheetsData = {} }) => {
  // rawData holds the original values (including "=..." formulas)
  const [rawData, setRawData] = useState([]);
  const [saveTimeout, setSaveTimeout] = useState(null);

  const templateRows = sheetTemplates[sheetKey] || [];
  const columns = templateRows.length ? Object.keys(templateRows[0]) : [];
  const [lastBulkUpload, setLastBulkUpload] = useState(null);

  const canUploadThisMonth = () => {
    if (!lastBulkUpload) return true;
    const last = new Date(lastBulkUpload);
    const now = new Date(selectedDate);
    return last.getFullYear() !== now.getFullYear() || last.getMonth() !== now.getMonth();
  };

  // Utility: default numeric blanks to 0 so parser sees numbers
  const sanitizeRowDefaults = (row, template = {}) => {
    const r = { ...row };
    columns.forEach((key) => {
      const val = r[key];
      if (typeof val === "string" && val.trim().startsWith("=")) return; // keep formulas
      if ((val === "" || val === null || val === undefined)) {
        // prefer template default number if present
        if (typeof template[key] === "number") r[key] = template[key];
        else if (numericKeyPattern.test(key)) r[key] = 0;
        else r[key] = "";
      }
    });
    return r;
  };

  // ---------- REPLACE evaluateFormulas with this ----------
  const evaluateFormulas = (rowsToEval = [], allSheets = {}) => {
    // We'll evaluate row-by-row, using a fresh Parser per row, but pre-populating
    // the parser with sheet-wide aggregates for cross-sheet formulas.
    const evaluateRow = (row, allSheetsData) => {
      const parser = new Parser();

      // Helper: compute aggregates and set variables on parser for ALL sheets
      const populateAllSheetVariables = (all) => {
        console.log("Populating variables for sheets:", Object.keys(all || {}));
        Object.entries(all || {}).forEach(([sheetName, sheetRows]) => {
          if (!Array.isArray(sheetRows) || sheetRows.length === 0) return;

          // collect columns from first row (assumes consistent schema)
          const columns = Object.keys(sheetRows[0]);
          columns.forEach((col) => {
            // raw values array (keep strings for categorical)
            const rawArr = sheetRows
              .map(r => (r ? r[col] : undefined))
              .filter(v => v !== undefined && v !== null);

            // numeric array (parsed)
            const numArr = rawArr
              .map(v => {
                if (typeof v === "string" && v.trim().startsWith("=")) return NaN; // formulas => skip
                const n = parseFloat(v);
                return isNaN(n) ? NaN : n;
              })
              .filter(x => !isNaN(x));

            const sum = numArr.reduce((a, b) => a + b, 0);
            const count = numArr.length;
            const avg = count ? sum / count : 0;
            const min = count ? Math.min(...numArr) : 0;
            const max = count ? Math.max(...numArr) : 0;

            // Primary variables available to formulas:
            // sheet.col => by default we expose the SUM (so SUM(...) usage still works)
            parser.setVariable(`${sheetName}.${col}`, sum);
            parser.setVariable(`${sheetName}.${col}_SUM`, sum);
            parser.setVariable(`${sheetName}.${col}_AVG`, avg);
            parser.setVariable(`${sheetName}.${col}_COUNT`, count);
            parser.setVariable(`${sheetName}.${col}_MIN`, min);
            parser.setVariable(`${sheetName}.${col}_MAX`, max);

            // Expose arrays too:
            parser.setVariable(`${sheetName}.${col}_ARRAY`, numArr);
            parser.setVariable(`${sheetName}.${col}_ARRAY_RAW`, rawArr);

            // Also expose underscore variants to be flexible: Sheet_Col
            parser.setVariable(`${sheetName}_${col}`, sum);
            parser.setVariable(`${sheetName}_${col}_ARRAY`, numArr);
            parser.setVariable(`${sheetName}_${col}_ARRAY_RAW`, rawArr);
          });
        });
      };

      // Custom helper functions for formulas
      const registerHelpers = () => {
        // SUMARRAY(array) -> sum of numeric items
        parser.setFunction("SUMARRAY", (...args) => {
          const arr = Array.isArray(args[0]) ? args[0] : [args[0]];
          return arr.reduce((acc, v) => {
            const n = parseFloat(v);
            return acc + (isNaN(n) ? 0 : n);
          }, 0);
        });

        // AVGARRAY(array)
        parser.setFunction("AVGARRAY", (...args) => {
          const arr = Array.isArray(args[0]) ? args[0] : [args[0]];
          const nums = arr.map(v => parseFloat(v)).filter(n => !isNaN(n));
          if (nums.length === 0) return 0;
          return nums.reduce((a,b)=>a+b,0)/nums.length;
        });

        // COUNTARRAY(array) -> count numeric values
        parser.setFunction("COUNTARRAY", (...args) => {
          const arr = Array.isArray(args[0]) ? args[0] : [args[0]];
          return arr.map(v => parseFloat(v)).filter(n => !isNaN(n)).length;
        });

        // COUNTIF(array, comparatorString, threshold)
        parser.setFunction("COUNTIF", (...args) => {
          // args: [array, comparator, threshold]
          const arr = Array.isArray(args[0]) ? args[0] : [args[0]];
          const comp = args[1];
          const threshold = args[2];
          if (!comp) return 0;
          const compStr = String(comp).trim();
          // comparator can be ">", "<", ">=", "<=", "=", "!="
          const compare = (val) => {
            // if threshold is numeric-like compare numerically, else compare as strings
            const numT = parseFloat(threshold);
            const numVal = parseFloat(val);
            const bothNum = !isNaN(numT) && !isNaN(numVal);
            switch (compStr) {
              case ">": return bothNum ? (numVal > numT) : (String(val) > String(threshold));
              case "<": return bothNum ? (numVal < numT) : (String(val) < String(threshold));
              case ">=": return bothNum ? (numVal >= numT) : (String(val) >= String(threshold));
              case "<=": return bothNum ? (numVal <= numT) : (String(val) <= String(threshold));
              case "!=": return bothNum ? (numVal != numT) : (String(val) != String(threshold));
              case "=":
              default: return bothNum ? (numVal == numT) : (String(val) == String(threshold));
            }
          };
          return arr.reduce((acc, v) => acc + (compare(v) ? 1 : 0), 0);
        });

        // helper to quickly sum arrays too (keeps familiar name)
        parser.setFunction("SUMARRAY_VALUES", (...args) => {
          const arr = Array.isArray(args[0]) ? args[0] : [args[0]];
          return arr.reduce((acc, v) => {
            const n = parseFloat(v);
            return acc + (isNaN(n) ? 0 : n);
          }, 0);
        });
      };

      // populate parser with sheet-wide variables + helpers
      populateAllSheetVariables(allSheetsData);
      registerHelpers();

      // Now set variables for THIS row's non-formula keys (so formulas that refer to column names without prefix work inside same sheet)
      Object.entries(row || {}).forEach(([k, v]) => {
        if (typeof v === "string" && v.trim().startsWith("=")) return;
        const n = parseFloat(v);
        if (!isNaN(n)) parser.setVariable(k, n);
        else parser.setVariable(k, v);
      });

      // Evaluate formulas in this row (iteratively, so formula fields depending on other formula fields can resolve)
      const evaluated = { ...row };
      const formulaKeys = Object.keys(row || {}).filter(k => typeof row[k] === "string" && row[k].trim().startsWith("="));
      const maxIter = Math.max(3, formulaKeys.length);
      for (let iter = 0; iter < maxIter; iter++) {
        let changed = false;
        for (const k of formulaKeys) {
          const rawFormula = row[k].trim().substring(1);
          const res = parser.parse(rawFormula);
          if (!res.error) {
            if (evaluated[k] !== res.result) {
              evaluated[k] = res.result;
              // make result available as variable for other formulas in this row
              parser.setVariable(k, res.result);
              changed = true;
            }
          } else {
            evaluated[k] = "#ERROR";
          }
        }
        if (!changed) break;
      }

      // coerce non-formula fields to numbers when possible
      Object.entries(row || {}).forEach(([k, v]) => {
        if (!(typeof v === "string" && v.trim().startsWith("="))) {
          const n = parseFloat(v);
          evaluated[k] = !isNaN(n) ? n : (v ?? "");
        }
      });

      return evaluated;
    }; // end evaluateRow

    // run over all rows
    return (rowsToEval || []).map(r => evaluateRow(r, allSheets));
  };
  // ---------- end evaluateFormulas ----------


  // initialize rawData from incoming rows or from template
  useEffect(() => {
    if (sheetKey === "Final_Summary") {
      const fsFormulas = formulasConfig.Final_Summary;
      rows = rows.map((row, idx) => {
        const formulaRow = fsFormulas[idx];
        if (formulaRow && formulaRow.WB && formulaRow.WB.startsWith("=")) {
          return { ...row, WB: formulaRow.WB };
        }
        return row;
      });
    }

    
    let init = [];
    const isBlank = !rows || rows.length === 0 || rows.every(r => Object.values(r).every(v => v === "" || v === null || v === undefined));
    
    if (isBlank && templateRows.length) {
      init = structuredClone(templateRows).map((tpl) => {
        console.log("Initializing row formulas for sheet", sheetKey, init);

        const filled = { ...tpl };
        // auto-fill from userData/selectedDate
        Object.keys(filled).forEach((k) => {
          const low = k.toLowerCase();
          if (low.includes("circle") && userData?.circle) filled[k] = userData.circle;
          if ((low.includes("site_name") || low.includes("msc_location")) && userData?.site) filled[k] = userData.site;
          if (low.includes("region") && userData?.region) filled[k] = userData.region;
          if (low.includes("site_id") && userData?.siteId) filled[k] = userData.siteId;
          if (low.includes("date") && selectedDate) filled[k] = selectedDate;
          // site-wise column default
          if (siteWiseDefaults[sheetKey] && siteWiseDefaults[sheetKey][k] && userData?.site) {
            const siteDefaultMap = siteWiseDefaults[sheetKey][k];
            if (siteDefaultMap[userData.site] !== undefined) {
              filled[k] = siteDefaultMap[userData.site];
            }
          }
        });

        // ensure formulas from config are present
        const cfg = formulasConfig[sheetKey] || {};
        Object.entries(cfg).forEach(([field, formula]) => {
          if (!filled[field] || typeof filled[field] !== "string" || !filled[field].trim().startsWith("=")) {
            filled[field] = formula;
          }
        });

        return sanitizeRowDefaults(filled, tpl);
      });
    } else {
      init = (rows || []).map(r => sanitizeRowDefaults(r, templateRows[0] || {}));
      // Ensure formulas from config are present if missing in DB rows
      const cfg = formulasConfig[sheetKey] || {};
      init = init.map(r => {
        const copy = { ...r };
        Object.entries(cfg).forEach(([field, formula]) => {
          if (!copy[field] || typeof copy[field] !== "string" || !copy[field].trim().startsWith("=")) {
            copy[field] = formula;
          }
        });
        return copy;
      });
    }

    setRawData(init);
  }, [rows, sheetKey, userData, selectedDate]); // re-init on these changes

  // Debounced save of rawData (saves formulas + inputs)
  const scheduleSave = (updatedRaw) => {
    if (saveTimeout) clearTimeout(saveTimeout);
    const id = setTimeout(() => {
      if (onSave) onSave(updatedRaw);
    }, DEBOUNCE_DELAY);
    setSaveTimeout(id);
  };

  // detect formula cell by looking at rawData cell OR formulasConfig
  const isFormulaCell = (rowIndex, colKey) => {
    const raw = rawData[rowIndex]?.[colKey];
    if (typeof raw === "string" && raw.trim().startsWith("=")) return true;
    if (formulasConfig[sheetKey] && typeof formulasConfig[sheetKey][colKey] === "string") return true;
    return false;
  };

  const handleChange = (rowIndex, field, value) => {
    // Prevent edits on formula cells
    if (isFormulaCell(rowIndex, field)) return;

    let finalValue = value;

    // If field matches numericKeyPattern, allow floats
    if (numericKeyPattern.test(field)) {
      if (value === "" || value === null) {
        finalValue = "";
      } else {
        const parsed = parseFloat(value);
        finalValue = isNaN(parsed) ? value : parsed;
      }
    }

    const updated = [...rawData];
    updated[rowIndex] = { ...updated[rowIndex], [field]: finalValue };
    setRawData(updated);
    scheduleSave(updated);
  };

  const handleAddRow = () => {
    const baseTemplate = templateRows.length ? structuredClone(templateRows[0]) : {};
    // include formulas from config by default for new rows
    const cfg = formulasConfig[sheetKey] || {};
    const newRow = (columns.length ? columns.reduce((acc, k) => ({ ...acc, [k]: baseTemplate[k] ?? (cfg[k] ?? "") }), {}) : baseTemplate);
    const sanitized = sanitizeRowDefaults(newRow, baseTemplate);
    const updated = [...rawData, sanitized];
    setRawData(updated);
    scheduleSave(updated);
  };

  const handleDeleteRow = (rowIndex) => {
    const updated = rawData.filter((_, idx) => idx !== rowIndex);
    setRawData(updated);
    scheduleSave(updated);
  };


  const handleFileUpload = (e) => {
    if (!canUploadThisMonth()) {
      alert("Bulk upload already done for this month. Try again next month.");
      e.target.value = ""; // reset file input
      return;
    }

    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[sheetKey];
      if (!sheet) {
        alert(`No sheet named ${sheetKey} found in uploaded file`);
        return;
      }

      const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });

      // Merge into rawData
      const merged = [...rawData, ...jsonData].map(r =>
        sanitizeRowDefaults(r, templateRows[0] || {})
      );

      setRawData(merged);
      scheduleSave(merged);

      // Mark upload date
      setLastBulkUpload(new Date().toISOString());
    };
    reader.readAsArrayBuffer(file);
  };



  // evaluated view for rendering
  const evaluatedData = useMemo(() => evaluateFormulas(rawData, allSheetsData), [rawData, sheetKey, allSheetsData]);


  return (
    <div className="sheet-editor-container">
      <div className="sheet-scroll-block sheet-header">
        💾 ⏱ Last Updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : "Never"}
      </div>

      <table className="sheet-table">
        <thead>
          <tr>
            {columns.map(col => <th key={col}>{col}</th>)}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {evaluatedData.map((row, rIdx) => (
            <tr key={rIdx}>
              {columns.map(col => (
                <td key={col} className="sheet-cell">
                  <input
                    type={numericKeyPattern.test(col) ? "number" : "text"}
                    step={numericKeyPattern.test(col) ? "any" : undefined}
                    value={row[col] ?? ""}
                    onChange={(e) => handleChange(rIdx, col, e.target.value)}
                    disabled={isFormulaCell(rIdx, col)}
                    className={isFormulaCell(rIdx, col) ? "formula-cell" : ""}
                  />
                </td>
              ))}
              <td>
                <button
                  onClick={() => handleDeleteRow(rIdx)}
                  style={{ color: "white", background: "red", border: "none", padding: "4px 8px", cursor: "pointer" }}
                >
                  🗑 Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>

      </table>

      <button onClick={handleAddRow}>➕ Add Row</button>
      {(sheetKey === "In_House_PM" || sheetKey === "OEM_PM") &&
        (userData?.role === "Super Admin" || userData?.role === "Admin" || userData?.role === "Super User") && (
          <div className="upload-block">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
            />
            {lastBulkUpload && (
              <small>
                Last bulk upload: {new Date(lastBulkUpload).toLocaleDateString()}
              </small>
            )}
          </div>
        )}
    </div>
  );
};

export default ExcelSheetEditor;
