// src/components/ExcelSheetEditor.js
import React, { useState, useEffect } from "react";
import "../assets/ExcelSheetEditor.css";

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
      Circle: "", MSC_Location: "", DG_fuel_tank_capacity: "",
      Present_Diesel_Stock_in_DG_tank_Ltr: "", MSC_Status_Grater_Less_2500_Lts: "",
      External_Stock_capacity_Barrel_UG_Buffer_Ltr: "", External_Stock_availiabl_at_MS_Ltr: "",
      Tota_Stock_Capacity: "", Total_Stock_available: "", Status: "", DG_CPH: "",
      Fuel_back_up_Hrs: "", Category: "", Remark: "", Including_Day_tank: "", Excluding_Day_tank: "",
    },
  ],
  DG_EB_Backup: [
    { SlNo: "", Circle: "", Site_Name: "", Total_Power_Failure_hrs: "", Total_DG_Run_hrs: "", remark: "" },
  ],
  Infra_Update: [
    { SlNo: "", Circle: "", Site_Name: "", Site_ID: "", Infra_Uptime_Percentage: "" },
  ],
  Fault_Details: [
    { slNo: "", faultType: "", resolution: "", remark: "" },
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
  Sheet1: [{ slNo: "", data1: "", data2: "", remark: "" }],
  In_House_PM: [
    {
      Circle: "", Site_Name: "", Equipment_Category: "", In_House_PM_Frequency: "",
      Month: "", In_House_Plan_Date: "", In_House_Done_Date: "", PM_Status: ""
    },
  ],
  Sheet2: [{ slNo: "", key: "", value: "", remark: "" }],
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

const ExcelSheetEditor = ({ sheetKey, rows, onSave, lastUpdated }) => {
  const [data, setData] = useState([]);
  const [timeoutId, setTimeoutId] = useState(null);

  // ✅ Use column order from templates
  const columns = sheetTemplates[sheetKey]
    ? Object.keys(sheetTemplates[sheetKey][0])
    : [];

  useEffect(() => {
    if (rows.length === 0 && sheetTemplates[sheetKey]) {
      setData(sheetTemplates[sheetKey].map((row) => ({ ...row })));
    } else {
      setData(rows);
    }
  }, [rows, sheetKey]);

  const handleChange = (index, field, value) => {
    const updated = [...data];
    updated[index][field] = value;
    setData(updated);

    // Debounced auto-save
    if (timeoutId) clearTimeout(timeoutId);
    const id = setTimeout(() => onSave(updated), DEBOUNCE_DELAY);
    setTimeoutId(id);
  };

  const handleAddRow = () => {
    setData([...data, { ...columns.reduce((acc, col) => ({ ...acc, [col]: "" }), {}) }]);
  };

  return (
    <div>
      <div style={{ fontSize: "0.85rem", color: "#666", marginBottom: "6px" }}>
        ⏱ Last Updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : "Never"}
      </div>

      <table className="sheet-table">
        <thead>
          <tr>
            {columns.map((col) => <th key={col}>{col}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((col) => (
                <td key={col}>
                  <input
                    type="text"
                    value={row[col] || ""}
                    onChange={(e) => handleChange(rowIndex, col, e.target.value)}
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
