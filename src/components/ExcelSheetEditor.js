// ExcelSheetEditor.js

import React, { useState, useEffect } from "react";
import "../assets/ExcelSheetEditor.css";

const sheetTemplates = {
  Final_Summary: [
    { Edge_Data_Centres_Count: "Category Checks", WB: "12"},
    { Edge_Data_Centres_Count: "Sites Less Than 12 Hrs Diesel Back Up", WB: ""},
    { Edge_Data_Centres_Count: "Sites More Than 12 Hrs Diesel Back Up", WB: ""},
    { Edge_Data_Centres_Count: "MSC more than 2500 Litres excluding Day Tanks", WB: ""},
    { Edge_Data_Centres_Count: "MSC more than 2500 Litres Including Day Tanks", WB: ""},
    { Edge_Data_Centres_Count: "DG Running Hrs.", WB: ""},
    { Edge_Data_Centres_Count: "EB Availability Hrs.", WB: ""},
    { Edge_Data_Centres_Count: "Infra Uptime", WB: ""},
    { Edge_Data_Centres_Count: "Infra Uptime with Redundancy", WB: ""},
    { Edge_Data_Centres_Count: "Minor Fault Details (If any)", WB: ""},
    { Edge_Data_Centres_Count: "Major Fault Details (If any)", WB: ""},
    { Edge_Data_Centres_Count: "Planned Activity Details", WB: ""},
    { Edge_Data_Centres_Count: "Category Checks", WB: "12"},
    { Edge_Data_Centres_Count: "O&M Manpower Availability as Per LOI", WB: ""},
    { Edge_Data_Centres_Count: "In House PM Planned (Jul'25 Month)", WB: ""},
    { Edge_Data_Centres_Count: "In House PM Completed (Jul'25 Month)", WB: ""},
    { Edge_Data_Centres_Count: "Inhouse PM Completion %", WB: ""},
    { Edge_Data_Centres_Count: "OEM PM Planned (Jul'25 Month)", WB: ""},
    { Edge_Data_Centres_Count: "OEM PM Completed (Jul'25 Month)", WB: ""},
    { Edge_Data_Centres_Count: "OEM PM Completion %", WB: ""},
    { Edge_Data_Centres_Count: "Incidents / Accidents Reported", WB: ""},
    { Edge_Data_Centres_Count: "EOL Replacement Planned", WB: ""},
    { Edge_Data_Centres_Count: "EOL Replacement Completed", WB: ""},
    { Edge_Data_Centres_Count: "Operational Governance Call Planned", WB: ""},
    { Edge_Data_Centres_Count: "Operational Governance Call Executed", WB: ""},
  ],
  Diesel_Back_Up: [
    { Circle: "", MSC_Location: "", DG_fuel_tank_capacity: "", Present_Diesel_Stock_in_DG_tank_Ltr: "", MSC_Status_Grater_Less_2500_Lts: "",  External_Stock_capacity_Barrel_UG_Buffer_Ltr: "", External_Stock_availiabl_at_MS_Ltr: "", Tota_Stock_Capacity: "", Total_Stock_available:"", Status:"", DG_CPH:"", Fuel_back_up_Hrs:"", Category:"", Remark:"" , Including_Day_tank:"", Excluding_Day_tank: ""},
  ],
  DG_EB_Backup: [
    { SlNo: "", Circle: "", Site_Name: "", Total_Power_Failure_hrs: "", Total_DG_Run_hrs:"", remark: "" },
  ],
  Infra_Update: [
    { SlNo: "", Circle: "", Site_Name: "", Site_ID:"", Infra_Uptime_Percentage: "" },
  ],
  Fault_Details: [
    { slNo: "", faultType: "", resolution: "", remark: "" },
  ],
  Planned_Activity_Details: [
    { Date: "", Circle: "", Site_Name: "", Site_ID: "", Activity_Planned_Y_N: "", Activity_Description: "", Activity_Execution_Status: "", Category: "" },
  ],
  Manpower_Availability: [
    { SlNo: "", Circle: "", Site_Name: "", Region: "", SEng_Circle_SPOC:"", Engg:"", Supervisor:"", Technician:"", Total_Manpower: "", HC_Availability_as_per_LOI: "", Remark: ""},
  ],
  Sheet1: [
    { slNo: "", data1: "", data2: "", remark: "" },
  ],
  In_House_PM: [
    { slNo: "", system: "", pmDate: "", status: "", remark: "" },
  ],
  Sheet2: [
    { slNo: "", key: "", value: "", remark: "" },
  ],
  OEM_PM: [
    { slNo: "", oemName: "", visitDate: "", purpose: "", remark: "" },
  ],
  Operational_Governance_Call: [
    { slNo: "", topic: "", discussedBy: "", outcome: "", remark: "" },
  ],
};

const ExcelSheetEditor = ({ sheetKey, rows, onSave }) => {
  const [data, setData] = useState([]);

  useEffect(() => {
    if (rows.length === 0) {
      setData(sheetTemplates[sheetKey] || []);
    } else {
      setData(rows);
    }
  }, [rows, sheetKey]);

  const handleChange = (index, field, value) => {
    const updated = [...data];
    updated[index][field] = value;
    setData(updated);
  };

  const handleAddRow = () => {
    setData([...data, { ...sheetTemplates[sheetKey][0] }]);
  };

  const handleSave = () => {
    onSave(data);
  };

  return (
    <div>
      <table className="sheet-table">
        <thead>
          <tr>
            {Object.keys(sheetTemplates[sheetKey][0]).map((col) => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {Object.keys(row).map((field) => (
                <td key={field}>
                  <input
                    type="text"
                    value={row[field]}
                    onChange={(e) => handleChange(rowIndex, field, e.target.value)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <button onClick={handleAddRow}>➕ Add Row</button>
      <button onClick={handleSave} style={{ marginLeft: "1rem" }}>
        💾 Save Sheet
      </button>
    </div>
  );
};

export default ExcelSheetEditor;
