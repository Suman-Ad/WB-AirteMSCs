// src/components/ExcelSheetEditor.js
import React, { useState, useEffect } from "react";
import "../assets/ExcelSheetEditor.css";
import { Parser } from 'hot-formula-parser';
import structuredClone from '@ungap/structured-clone';

const parser = new Parser();

const DEBOUNCE_DELAY = 1500;


const sheetTemplates = {
  Final_Summary: [
    { Edge_Data_Centres_Count: "Category Checks", WB: "12" },
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
    { Edge_Data_Centres_Count: "Category Checks", WB: "12" },
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
      Month: "", In_House_Plan_Date: "", In_House_Done_Date: "", PM_Status: ""
    },
  ],
  Sheet2: [{ SlNo: "", key: "", value: "", remark: "" }],
  OEM_PM: [
    {
      Region: "", Circle: "", Site_Name: "", Equipment_Category: "", Equipment_Name_and_No: "",
      Equipment_Make: "", Unit_of_measure_kva_TR_etc: "", Rating_Capacity: "", Qty: "",
      In_House_PM_Frequency: "", AMC_partner_Name: "", Month: "",
      OEM_Plan_Date: "", OEM_Done_Date: "", PM_Status: ""
    },
  ],
  Operational_Governance_Call: [
    {
      Circle: "", Site_Name: "", Governance_Meeting_Status_Planned: "",
      Governance_Meeting_Status_Done: "", Remark_Agenda: ""
    },
  ],
};

const ExcelSheetEditor = ({ sheetKey, rows, onSave, lastUpdated, userData, selectedDate }) => {
  const [rawData, setRawData] = useState([]);
  const [timeoutId, setTimeoutId] = useState(null);

  const templateRows = sheetTemplates[sheetKey] || [];
  const columns = templateRows.length > 0 ? Object.keys(templateRows[0]) : [];

  // ✅ Evaluate formulas without mutating rawData
  const evaluateFormulas = (rows) => {
    return rows.map((row) => {
      const evaluated = { ...row };
      const parser = new Parser(); // ✅ fresh parser per row

      // Assign numeric values to variables
      Object.entries(row).forEach(([key, val]) => {
        const num = parseFloat(val);
        if (!isNaN(num)) parser.setVariable(key, num);
      });

      // Evaluate any formula fields
      Object.entries(row).forEach(([key, val]) => {
        if (typeof val === "string" && val.trim().startsWith("=")) {
          const formula = val.trim().substring(1);
          const result = parser.parse(formula);
          evaluated[key] = !result.error ? result.result : "#ERROR";
        }
      });

      return evaluated;
    });
  };

  useEffect(() => {
    let initData = [];

    const isBlank = rows.length === 0 || rows.every(row =>
      Object.values(row).every(val => val === "" || val === null || val === undefined)
    );

    if (isBlank && templateRows.length) {
      initData = structuredClone(templateRows).map((row) => {
        const filledRow = { ...row };
        Object.keys(row).forEach((key) => {
          const lowerKey = key.toLowerCase();
          if (lowerKey.includes("circle") && userData?.circle) filledRow[key] = userData.circle;
          if (lowerKey.includes("site_name") && userData?.site) filledRow[key] = userData.site;
          if (lowerKey.includes("region") && userData?.region) filledRow[key] = userData.region;
          if (lowerKey.includes("site_id") && userData?.siteId) filledRow[key] = userData.siteId;
          if (lowerKey.includes("date") && selectedDate) filledRow[key] = selectedDate;
          if (lowerKey.includes("DG_fuel_tank_capacity") && "1980.00") filledRow[key] = "1980.00";
          if (lowerKey.includes("MSC_Status_Grater_Less_2500_Lts") && "<2500") filledRow[key] = "<2500";
          if (lowerKey.includes("Tota_Stock_Capacity") && "=DG_fuel_tank_capacity + External_Stock_capacity_Barrel_UG_Buffer_Ltr") filledRow[key] = "=DG_fuel_tank_capacity + External_Stock_capacity_Barrel_UG_Buffer_Ltr";
          if (lowerKey.includes("Total_Stock_availables") && "=Present_Diesel_Stock_in_DG_tank_Ltr + External_Stock_availiabl_at_MSC_Ltr") filledRow[key] = "=Present_Diesel_Stock_in_DG_tank_Ltr + External_Stock_availiabl_at_MSC_Ltr";
          if (lowerKey.includes("Fuel_back_up_Hrs") && "=Total_Stock_available + DG_CPH") filledRow[key] = "=Total_Stock_available + DG_CPH";
          if (lowerKey.includes("Category") && "=if(Fuel_back_up_Hrs>12, >12, <12)") filledRow[key] = "=if(Fuel_back_up_Hrs>12, >12, <12)";
          if (lowerKey.includes("Infra_Uptime_Percentage") && "=((238*60*60)-(((1*0*60)+0)*0))/(238*60*60)") filledRow[key] = "=((238*60*60)-(((1*0*60)+0)*0))/(238*60*60)";


        });
        return filledRow;
      });
    } else {
      initData = [...rows];
    }

    setRawData(initData);
  }, [rows, sheetKey, userData, selectedDate]);

  const isFormulaCell = (rowIndex, colKey) => {
    const rawValue = rawData[rowIndex]?.[colKey];
    return typeof rawValue === "string" && rawValue.trim().startsWith("=");
  };

  const handleChange = (rowIndex, field, value) => {
    // ⛔ Prevent editing formula fields
    if (isFormulaCell(rowIndex, field)) return;

    const updated = [...rawData];
    updated[rowIndex][field] = value;
    setRawData(updated);

    if (timeoutId) clearTimeout(timeoutId);
    const id = setTimeout(() => onSave(updated), DEBOUNCE_DELAY);
    setTimeoutId(id);
  };

  const handleAddRow = () => {
    const newRow = columns.reduce((acc, key) => ({ ...acc, [key]: "" }), {});
    setRawData((prev) => [...prev, newRow]);
  };

  

  const evaluatedData = evaluateFormulas(rawData);

  return (
    <div className="sheet-editor-container">
      <div className="sheet-scroll-block sheet-header">
        💾 ⏱ Last Updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : "Never"}
      </div>

      <table className="sheet-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {evaluatedData.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((col) => (
                <td key={col} className="sheet-cell">
                  <input
                    type="text"
                    value={row[col] ?? ""}
                    onChange={(e) => handleChange(rowIndex, col, e.target.value)}
                    disabled={isFormulaCell(rowIndex, col)}
                    className={isFormulaCell(rowIndex, col) ? "formula-cell" : ""}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <button onClick={handleAddRow}>➕ Add Row</button>
    </div>
  );
};

export { sheetTemplates, ExcelSheetEditor };
