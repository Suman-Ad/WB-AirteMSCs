// src/config/formulasConfig.js
export const formulasConfig = {
  
  Diesel_Back_Up: {
    Tota_Stock_Capacity: "=DG_fuel_tank_capacity + External_Stock_capacity_Barrel_UG_Buffer_Ltr",
    Total_Stock_available: "=Present_Diesel_Stock_in_DG_tank_Ltr + External_Stock_availiabl_at_MSC_Ltr",
    Fuel_back_up_Hrs: "=(Total_Stock_available / DG_CPH)",
    Category: "=IF(Fuel_back_up_Hrs>12, \">12\", \"<12\")",
    Excluding_Day_tank: "=IF(External_Stock_capacity_Barrel_UG_Buffer_Ltr>2500, \">2500\", \"<2500\")",
    Including_Day_tank: "=IF(Tota_Stock_Capacity>2500, \">2500\", \"<2500\")",
    MSC_Status_Grater_Less_2500_Lts: "=IF(Tota_Stock_Capacity>2500, \">2500\", \"<2500\")",
    Status: "=IF(Fuel_back_up_Hrs>12, \"Ok\", \"Not Ok\")",
  },
  Infra_Update: {
    Infra_Uptime_Percentage: "=((238*60*60)-(((1*0*60)+0)*0))/(238*60*60)*100"
  },

  Manpower_Availability :{
    Total_Manpower: "=SEng_Circle_SPOC + Engg	+ Supervisor + Technician",
    HC_Availability_as_per_LOI: "=IF(Total_Manpower<7, \"Not Ok\", \"Ok\")"

  },

  Final_Summary: [
    { Edge_Data_Centres_Count: "Category Checks", WB: "12" },

    // Diesel backup calculations
    { Edge_Data_Centres_Count: "Sites Less Than 12 Hrs Diesel Back Up", WB: "=IF(Diesel_Back_Up.Fuel_back_up_Hrs>12, \"0\", \"1\")" },
    { Edge_Data_Centres_Count: "Sites More Than 12 Hrs Diesel Back Up", WB: "=IF(Diesel_Back_Up.Fuel_back_up_Hrs>12, 1, 0)" },
    { Edge_Data_Centres_Count: "MSC more than 2500 Litres excluding Day Tanks", WB: "=COUNTIF(Diesel_Back_Up.Excluding_Day_tank_ARRAY_RAW, \">\", 2500)" },
    { Edge_Data_Centres_Count: "MSC more than 2500 Litres Including Day Tanks", WB: "=COUNTIF(Diesel_Back_Up.Including_Day_tank_ARRAY_RAW, \">\", 2500)" },

    // DG / EB backup hours
    { Edge_Data_Centres_Count: "DG Running Hrs.", WB: "=SUMARRAY(DG_EB_Backup.Total_DG_Run_hrs_ARRAY)" },
    { Edge_Data_Centres_Count: "EB Availability Hrs.", WB: "=24 - (SUMARRAY(DG_EB_Backup.Total_Power_Failure_hrs_ARRAY) / COUNTARRAY(DG_EB_Backup.Total_Power_Failure_hrs_ARRAY))" },

    // Infra uptime
    { Edge_Data_Centres_Count: "Infra Uptime", WB: "=AVGARRAY(Infra_Update.Infra_Uptime_Percentage_ARRAY)" },
    { Edge_Data_Centres_Count: "Infra Uptime with Redundancy", WB: "=AVGARRAY(Infra_Update.Infra_Uptime_Percentage_ARRAY)" },

    // Fault details
    { Edge_Data_Centres_Count: "Minor Fault Details (If any)", WB: "=COUNTIF(Fault_Details.Severity_Major_Minor_ARRAY_RAW, \"=\", \"Minor\")" },
    { Edge_Data_Centres_Count: "Major Fault Details (If any)", WB: "=COUNTIF(Fault_Details.Severity_Major_Minor_ARRAY_RAW, \"=\", \"Major\")" },

    // Planned activity
    { Edge_Data_Centres_Count: "Planned Activity Details", WB: "=COUNTIF(Planned_Activity_Details.Activity_Planned_Y_N_ARRAY_RAW, \"=\", \"Y\")" },

    { Edge_Data_Centres_Count: "Category Checks", WB: "12" },

    // Manpower availability
    { Edge_Data_Centres_Count: "O&M Manpower Availability as Per LOI", WB: "=COUNTIF(Manpower_Availability.HC_Availability_as_per_LOI_ARRAY_RAW, \"=\", \"Yes\")" },

    // In-house PM
    { Edge_Data_Centres_Count: "In House PM Planned (Jul'25 Month)", WB: "=COUNTARRAY(In_House_PM.Equipment_Category_ARRAY_RAW)" },
    { Edge_Data_Centres_Count: "In House PM Completed (Jul'25 Month)", WB: "=COUNTIF(In_House_PM.PM_Status_ARRAY_RAW, \"=\", \"DONE\")" },
    { Edge_Data_Centres_Count: "Inhouse PM Completion %", WB: "=(COUNTIF(In_House_PM.PM_Status_ARRAY_RAW, \"=\", \"DONE\") / COUNTARRAY(In_House_PM.Equipment_Category_ARRAY_RAW)) * 100" },

    // OEM PM
    { Edge_Data_Centres_Count: "OEM PM Planned (Jul'25 Month)", WB: "=COUNTARRAY(OEM_PM.Equipment_Category_ARRAY_RAW)" },
    { Edge_Data_Centres_Count: "OEM PM Completed (Jul'25 Month)", WB: "=COUNTIF(OEM_PM.PM_Status_ARRAY_RAW, \"=\", \"DONE\")" },
    { Edge_Data_Centres_Count: "OEM PM Completion %", WB: "=(COUNTIF(OEM_PM.PM_Status_ARRAY_RAW, \"=\", \"DONE\") / COUNTARRAY(OEM_PM.Equipment_Category_ARRAY_RAW)) * 100" },

    // Incidents / EOL replacements
    { Edge_Data_Centres_Count: "Incidents / Accidents Reported", WB: "=COUNTARRAY(Fault_Details.Site_Name_ARRAY_RAW)" },
    { Edge_Data_Centres_Count: "EOL Replacement Planned", WB: "=COUNTARRAY(EOL_Replacement.Planned_ARRAY_RAW)" },
    { Edge_Data_Centres_Count: "EOL Replacement Completed", WB: "=COUNTARRAY(EOL_Replacement.Completed_ARRAY_RAW)" },

    // Governance calls
    { Edge_Data_Centres_Count: "Operational Governance Call Planned", WB: "=COUNTIF(Operational_Governance_Call.Governance_Meeting_Status_Planned_ARRAY_RAW, \"=\", \"Y\")" },
    { Edge_Data_Centres_Count: "Operational Governance Call Executed", WB: "=COUNTIF(Operational_Governance_Call.Governance_Meeting_Status_Done_ARRAY_RAW, \"=\", \"Y\")" }
  ]

};
