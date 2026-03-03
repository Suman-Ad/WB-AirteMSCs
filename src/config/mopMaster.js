// mopMaster.js

 export const calculateDuration = (startTime, endTime) => {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  const startTotalMinutes = startHour * 60 + startMinute;
  const endTotalMinutes = endHour * 60 + endMinute;
  const durationMinutes = endTotalMinutes - startTotalMinutes;
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  return `${hours} Hrs ${minutes} Mins`;
};

export const getMopMaster = (userData, row, siteConfig) => ({
  "UPS Preventive maintenance (In House)": {
    header: {
      title: "UPS Inhouse PM activity MOP",
      docNo: "Nxtra/MOP/UPS Maintenance/DOC No. 1.12/Rev.00",
      releaseDate: "01-01-2026"
    },

    siteInfo: {
      city: userData?.site || "Unknown City",
      location: `${userData?.site} MSC` || "Unknown MSC",
      floor: row?.floor || "Unknown Floor",
      tier : siteConfig?.siteCategory === "Super Critical" ? "T1/T2" : "T2/T2",
    },

    activityInfo: {
      nature: "Inhouse PM of UPS System",
      startDate: row?._sheetDate || "",
      endDate: row?._sheetDate || "",
      startTime: row?.activityStartTime || "",
      endTime: row?.activityEndTime || "",
      duration: row?.activityStartTime && row?.activityEndTime ? calculateDuration(row.activityStartTime, row.activityEndTime) : "", 
      owner: siteConfig?.omName || "Unknown Owner",
      oem: row?.vendor,
      stakeholders: "Nxtra Data Operations Team",
      serviceImpact: "Non-Service-Affecting"
    },

    preChecks: [
      ["Site Survey report with GA drawing & SLD layouts ( Power Connection , Fesibility )", "Yes/No/NA", "N/A"],
      ["Ensure New UPS System and other Accessories are delivered at site.", "Yes/No/NA", "N/A"],
      ["Is new UPS compatible with existing UPS setup (Eg. Compatible with Iso. Transformer/ 3P 4 Wire or 3P 3 Wire System)", "Yes/No/NA", "N/A"],
      ["Ensure Pre energization & testing of UPS is performed by OEM at Sites.      ", "Yes/No/NA", "N/A"],
      ["Ensure required resources and tools & PPE are available and Healthiness to be ensured at site prior to start of the activity.", "Yes/No/NA", "Yes"],
      ["Ensure emergency spares for UPS are available at site.", "Yes/No/NA", "N/A"],
      ["Ensure recent DR Test has been performed for all the Racks/Nodes  (30 Days)", "Yes/No/NA", "No"],
      ["All Input & Output Breaker trip setting from source to racks level to be ensured to be at 100%. Attach additional Checklist.", "Yes/No/NA", "Yes"],
      ["All Input& Output (Till Rack Level) Circuit Breaker (ACB/MCCB/MCB)Rating vs loading comparision done (Any breaker loading must not exceed 70% of rated load) .Attach additional Checklist.", "Yes/No/NA", "Yes"],
      ["Ensure to note down temperature of the cable as well by the use of thermal gun and check for any abnormal temperature and Note down all room temperatures of all concerned locations", "Yes/No/NA", "Yes"],
      ["All Input & Output cables Rating vs Loading comparision to be done (Loading must not be more than 50% of ots rated Current) Attach additional Checklist.", "Yes/No/NA", "Yes"],
      ["Ensure online battery discharge/backup test should be carried out before one days for 5 minutes and check all cells voltage. Attach additional Checklist.", "Yes/No/NA", "Yes"],
      ["Ensure Panel Automation status is working fine", "Yes/No/NA", "Yes"],
      ["Ensure No open observations from recent PM of UPS & BB", "Yes/No/NA", "Yes"],
      ["Thorough inspection of Isolation Transformers (If applicable) to be done, Rated capacity of Isolation transformer/Check input,output cables ratings, winding and cables temrature. ", "Yes/No/NA", "Yes"],
      ["Site will be on DG, So Health checkup of DG sets and availability of Diesel Stock to be ensured", "Yes/No/NA", "Yes"],
      ["LOTO must be done after denergizing the feeders during the activity", "Yes/No/NA", "Yes"],
      ["Ensure SA approval for all Single Source Nodes is inplace ", "Yes/No/NA", "Yes"],
      ["After disconnection of the power cables, end terminations must be properly insulated before pulling out of the glands/UPS/Panel.", "Yes/No/NA", "N/A"],
      ["Ensure All Stake holders are informed/Approval is inplace/CRQ is approvedStakeholder approval & CRQ done", "Yes/No/NA", "Yes"]
    ],

    loadDetails: [
      ["UPS-1", "40 KVA", row?.floor, "25.6%"],
      ["UPS-2", "40 KVA", row?.floor, "25.5%"]
    ],

    risk: [
      "Risk Level 1 - PM of UPS-1",
      "Risk Level 2 - PM of UPS-2"
    ],

    mitigation: [
      "Transfer load of UPS-1 to maintenance bypass and DG source",
      "Transfer load of UPS-2 to maintenance bypass and DG source"
    ],

    activitySteps: [
      "Switch ON DG Set and transfer input source of both UPS to DG power.  ",
      "Physical inspection any damages ,heating ,health ,hygiene etc of UPS , Input , Output panel , PDUS , earth connection and Battery Banks cells.",
      "Check Input voltage/other parameters of UPS-1 from display. Check all UPS parameters Setting as per golden parameters and as per OEM PM checklist.",
      "Check Input voltage/other parameters of UPS-1 physically (through multimeters) and check all parameters such as L-L , L-N ,L-E, N-E Voltage.",
      "Check and keep recod of load balacing of all three phases. L1: ….Amp , L2…Amp  and L3…Amp.",
      "Check all UPS display and ensure there should not be any alarms.",
      "Check Input voltage/other parameters of UPS-1 from display. Check all UPS paramaters Setting as per golden paramaters and as per OEM PM checklist.",
      "Clean the UPS-1 system Externally (online PM).",
      "Ensure IR testing on power and control cable termination points.",
      "Keep record of all equipements load current if any equipement s has been added with date and time.",
      "Check BMS connectivity and Alarm standardation and testing date.",
      "Check UPS Display time and date are in sync with real time.",
      "Put UPS-1 on battery mode by doing battery test setting in controller for 15 minutes and keep record of battery cells voltage.",
      "Check UPS -1 display for any alarms during battery disrchage test.",
      "Check UPS-1 display and ensure there should not be any alarms after completion of discharge test and UPS on normal mode.",
      "Check UPS-1 functionality for 30 mins.",
      "Verify all parameters of UPS-1 and documentation done."
    ],

    rollback: [
      "The first step, if there is some abnormality observed during the maintenance would be to stop the maintenance.",
      "(1) Interrupt the maintenance and check the UPS alarm.",
      "(2) Escalate and inform all the stake holders.",
      "(3) Re-schedule the maintenance if required.",
    ],

    infra: [
      ["Nxtra CIH", siteConfig?.authorizedBy || "Unknown CIH"],
      ["SIM", siteConfig?.sim || "Unknown SIM"],
      ["O&M Partner", "Vertiv Energy Pvt Ltd"],
      ["Panel AMC Partner", "Alexis Telecom Pvt Ltd"]
    ],

    proactive: [
      "1. Complete activity will be carried out under CCTV Survilance. In case CCTV is not available at the activity location, intrim arrangments will be made.",
      "2. BMS/CCTV System power supply must not be affected under any circuimstance during the activity.",
      "3. Continuous monitoring and vigilance of BMS System will be ensured throughout the activity.",
      "4. Only one critical activity will be carried out at a time PAN india."
    ],

    spares: [
      ["Lugs – Ring Type", "xx Sqmm", "YY", "NA"],
      ["Lugs – Pin Type", "xx Sqmm", "YY", "NA"],
      ["Heat shrink sleeves", "XX", "YY", "NA"],
      ["PVC insulation tape", "XX", "YY", "NA"],
      ["Blower", "XX", "YY", "NA"],
      ["UPS spares (fuse, fan)", "XX", "YY", "NA"],
       ["Any other …...", "XX", "YY", "NA"]
    ],

    approval: {
      createdBy: siteConfig?.omName || "Unknown Creator",
      reviewer: `${siteConfig?.preparedBy || "Unknown Review By"} / Mr. Amit Kumar Mondal`,
      approver: siteConfig?.authorizedBy || "Unknown Approver",
      crNumber: row?.crqNo || "To Be Raised"
    }
  },

  "UPS Preventive maintenance (OEM)": {
    header: {
      title: "UPS OEM PM activity MOP",
      docNo: "Nxtra/MOP/UPS Maintenance/DOC No. 1.12/Rev.00",
      releaseDate: "01-01-2026"
    },

    siteInfo: {
      city: userData?.site || "Unknown City",
      location: `${userData?.site} MSC` || "Unknown MSC",
      floor: row?.floor || "Unknown Floor",
      tier : siteConfig?.siteCategory === "Super Critical" ? "T1/T2" : "T2/T2",
    },

    activityInfo: {
      nature: "OEM PM of UPS System",
      startDate: row?._sheetDate || "",
      endDate: row?._sheetDate || "",
      startTime: row?.activityStartTime || "",
      endTime: row?.activityEndTime || "",
      duration: row?.activityStartTime && row?.activityEndTime ? calculateDuration(row.activityStartTime, row.activityEndTime) : "", 
      owner: siteConfig?.omName || "Unknown Owner",
      oem: row?.vendor,
      stakeholders: "Nxtra Data Operations Team",
      serviceImpact: "Non-Service-Affecting"
    },

    preChecks: [
      ["Site Survey report with GA drawing & SLD layouts ( Power Connection , Fesibility )", "Yes/No/NA", "N/A"],
      ["Ensure New UPS System and other Accessories are delivered at site.", "Yes/No/NA", "N/A"],
      ["Is new UPS compatible with existing UPS setup (Eg. Compatible with Iso. Transformer/ 3P 4 Wire or 3P 3 Wire System)", "Yes/No/NA", "N/A"],
      ["Ensure Pre energization & testing of UPS is performed by OEM at Sites.      ", "Yes/No/NA", "N/A"],
      ["Ensure required resources and tools & PPE are available and Healthiness to be ensured at site prior to start of the activity.", "Yes/No/NA", "Yes"],
      ["Ensure emergency spares for UPS are available at site.", "Yes/No/NA", "N/A"],
      ["Ensure recent DR Test has been performed for all the Racks/Nodes  (30 Days)", "Yes/No/NA", "No"],
      ["All Input & Output Breaker trip setting from source to racks level to be ensured to be at 100%. Attach additional Checklist.", "Yes/No/NA", "Yes"],
      ["All Input& Output (Till Rack Level) Circuit Breaker (ACB/MCCB/MCB)Rating vs loading comparision done (Any breaker loading must not exceed 70% of rated load) .Attach additional Checklist.", "Yes/No/NA", "Yes"],
      ["Ensure to note down temperature of the cable as well by the use of thermal gun and check for any abnormal temperature and Note down all room temperatures of all concerned locations", "Yes/No/NA", "Yes"],
      ["All Input & Output cables Rating vs Loading comparision to be done (Loading must not be more than 50% of ots rated Current) Attach additional Checklist.", "Yes/No/NA", "Yes"],
      ["Ensure online battery discharge/backup test should be carried out before one days for 5 minutes and check all cells voltage. Attach additional Checklist.", "Yes/No/NA", "Yes"],
      ["Ensure Panel Automation status is working fine", "Yes/No/NA", "Yes"],
      ["Ensure No open observations from recent PM of UPS & BB", "Yes/No/NA", "Yes"],
      ["Thorough inspection of Isolation Transformers (If applicable) to be done, Rated capacity of Isolation transformer/Check input,output cables ratings, winding and cables temrature. ", "Yes/No/NA", "Yes"],
      ["Site will be on DG, So Health checkup of DG sets and availability of Diesel Stock to be ensured", "Yes/No/NA", "Yes"],
      ["LOTO must be done after denergizing the feeders during the activity", "Yes/No/NA", "Yes"],
      ["Ensure SA approval for all Single Source Nodes is inplace ", "Yes/No/NA", "Yes"],
      ["After disconnection of the power cables, end terminations must be properly insulated before pulling out of the glands/UPS/Panel.", "Yes/No/NA", "N/A"],
      ["Ensure All Stake holders are informed/Approval is inplace/CRQ is approvedStakeholder approval & CRQ done", "Yes/No/NA", "Yes"]
    ],

    loadDetails: [
      ["UPS-1", "40 KVA", row?.floor, "25.6%"],
      ["UPS-2", "40 KVA", row?.floor, "25.5%"]
    ],

    risk: [
      "Risk Level 1 - PM of UPS-1",
      "Risk Level 2 - PM of UPS-2"
    ],

    mitigation: [
      "Transfer load of UPS-1 to maintenance bypass and DG source",
      "Transfer load of UPS-2 to maintenance bypass and DG source"
    ],

    activitySteps: [
      "Switch ON DG Set and transfer input source of both UPS to DG power.  ",
      "Physical inspection any damages ,heating ,health ,hygiene etc of UPS , Input , Output panel , PDUS , earth connection and Battery Banks cells.",
      "Check Input voltage/other parameters of UPS-1 from display. Check all UPS parameters Setting as per golden parameters and as per OEM PM checklist.",
      "Check Input voltage/other parameters of UPS-1 physically (through multimeters) and check all parameters such as L-L , L-N ,L-E, N-E Voltage.",
      "Check and keep recod of load balacing of all three phases. L1: ….Amp , L2…Amp  and L3…Amp.",
      "Check all UPS display and ensure there should not be any alarms.",
      "Check Input voltage/other parameters of UPS-1 from display. Check all UPS paramaters Setting as per golden paramaters and as per OEM PM checklist.",
      "Clean the UPS-1 system Externally (online PM).",
      "Ensure IR testing on power and control cable termination points.",
      "Keep record of all equipements load current if any equipement s has been added with date and time.",
      "Check BMS connectivity and Alarm standardation and testing date.",
      "Check UPS Display time and date are in sync with real time.",
      "Put UPS-1 on battery mode by doing battery test setting in controller for 15 minutes and keep record of battery cells voltage.",
      "Check UPS -1 display for any alarms during battery disrchage test.",
      "Check UPS-1 display and ensure there should not be any alarms after completion of discharge test and UPS on normal mode.",
      "Check UPS-1 functionality for 30 mins.",
      "Verify all parameters of UPS-1 and documentation done."
    ],

    rollback: [
      "The first step, if there is some abnormality observed during the maintenance would be to stop the maintenance.",
      "(1) Interrupt the maintenance and check the UPS alarm.",
      "(2) Escalate and inform all the stake holders.",
      "(3) Re-schedule the maintenance if required.",
    ],

    infra: [
      ["Nxtra CIH", siteConfig?.authorizedBy || "Unknown CIH"],
      ["SIM", siteConfig?.sim || "Unknown SIM"],
      ["O&M Partner", "Vertiv Energy Pvt Ltd"],
      ["Panel AMC Partner", "Alexis Telecom Pvt Ltd"]
    ],

    proactive: [
      "1. Complete activity will be carried out under CCTV Survilance. In case CCTV is not available at the activity location, intrim arrangments will be made.",
      "2. BMS/CCTV System power supply must not be affected under any circuimstance during the activity.",
      "3. Continuous monitoring and vigilance of BMS System will be ensured throughout the activity.",
      "4. Only one critical activity will be carried out at a time PAN india."
    ],

    spares: [
      ["Lugs – Ring Type", "xx Sqmm", "YY", "NA"],
      ["Lugs – Pin Type", "xx Sqmm", "YY", "NA"],
      ["Heat shrink sleeves", "XX", "YY", "NA"],
      ["PVC insulation tape", "XX", "YY", "NA"],
      ["Blower", "XX", "YY", "NA"],
      ["UPS spares (fuse, fan)", "XX", "YY", "NA"],
      ["Any other …...", "XX", "YY", "NA"]
    ],

    approval: {
      createdBy: siteConfig?.omName || "Unknown Creator",
      reviewer: `${siteConfig?.preparedBy || "Unknown Review By"} / Mr. Amit Kumar Mondal`,
      approver: siteConfig?.authorizedBy || "Unknown Approver",
      crNumber: row?.crqNo || "To Be Raised"
    }
  },

  "UPS EOL replacement/upgradation": {
    header: {
      title: "UPS EOL replacement/upgradation activity MOP",
      docNo: "Nxtra/MOP/UPS Maintenance/DOC No. 1.12/Rev.00",
      releaseDate: "01-01-2026"
    },

    siteInfo: {
      city: userData?.site || "Unknown City",
      location: `${userData?.site} MSC` || "Unknown MSC",
      floor: row?.floor || "Unknown Floor",
      tier : siteConfig?.siteCategory === "Super Critical" ? "T1/T2" : "T2/T2",
    },

    activityInfo: {
      nature: "OEM PM of UPS System",
      startDate: row?._sheetDate || "",
      endDate: row?._sheetDate || "",
      startTime: row?.activityStartTime || "",
      endTime: row?.activityEndTime || "",
      duration: row?.activityStartTime && row?.activityEndTime ? calculateDuration(row.activityStartTime, row.activityEndTime) : "", 
      owner: siteConfig?.omName || "Unknown Owner",
      oem: row?.vendor,
      stakeholders: "Nxtra Data Operations Team",
      serviceImpact: "Non-Service-Affecting"
    },

    preChecks: [
      ["Site Survey report with GA drawing & SLD layouts ( Power Connection , Fesibility )", "Yes/No/NA", "N/A"],
      ["Ensure New UPS System and other Accessories are delivered at site.", "Yes/No/NA", "N/A"],
      ["Is new UPS compatible with existing UPS setup (Eg. Compatible with Iso. Transformer/ 3P 4 Wire or 3P 3 Wire System)", "Yes/No/NA", "N/A"],
      ["Ensure Pre energization & testing of UPS is performed by OEM at Sites.      ", "Yes/No/NA", "N/A"],
      ["Ensure required resources and tools & PPE are available and Healthiness to be ensured at site prior to start of the activity.", "Yes/No/NA", "Yes"],
      ["Ensure emergency spares for UPS are available at site.", "Yes/No/NA", "N/A"],
      ["Ensure recent DR Test has been performed for all the Racks/Nodes  (30 Days)", "Yes/No/NA", "No"],
      ["All Input & Output Breaker trip setting from source to racks level to be ensured to be at 100%. Attach additional Checklist.", "Yes/No/NA", "Yes"],
      ["All Input& Output (Till Rack Level) Circuit Breaker (ACB/MCCB/MCB)Rating vs loading comparision done (Any breaker loading must not exceed 70% of rated load) .Attach additional Checklist.", "Yes/No/NA", "Yes"],
      ["Ensure to note down temperature of the cable as well by the use of thermal gun and check for any abnormal temperature and Note down all room temperatures of all concerned locations", "Yes/No/NA", "Yes"],
      ["All Input & Output cables Rating vs Loading comparision to be done (Loading must not be more than 50% of ots rated Current) Attach additional Checklist.", "Yes/No/NA", "Yes"],
      ["Ensure online battery discharge/backup test should be carried out before one days for 5 minutes and check all cells voltage. Attach additional Checklist.", "Yes/No/NA", "Yes"],
      ["Ensure Panel Automation status is working fine", "Yes/No/NA", "Yes"],
      ["Ensure No open observations from recent PM of UPS & BB", "Yes/No/NA", "Yes"],
      ["Thorough inspection of Isolation Transformers (If applicable) to be done, Rated capacity of Isolation transformer/Check input,output cables ratings, winding and cables temrature. ", "Yes/No/NA", "Yes"],
      ["Site will be on DG, So Health checkup of DG sets and availability of Diesel Stock to be ensured", "Yes/No/NA", "Yes"],
      ["LOTO must be done after denergizing the feeders during the activity", "Yes/No/NA", "Yes"],
      ["Ensure SA approval for all Single Source Nodes is inplace ", "Yes/No/NA", "Yes"],
      ["After disconnection of the power cables, end terminations must be properly insulated before pulling out of the glands/UPS/Panel.", "Yes/No/NA", "N/A"],
      ["Ensure All Stake holders are informed/Approval is inplace/CRQ is approvedStakeholder approval & CRQ done", "Yes/No/NA", "Yes"]
    ],

    loadDetails: [
      ["UPS-1", "40 KVA", row?.floor, "25.6%"],
      ["UPS-2", "40 KVA", row?.floor, "25.5%"]
    ],

    risk: [
      "Risk Level 1 - PM of UPS-1",
      "Risk Level 2 - PM of UPS-2"
    ],

    mitigation: [
      "Transfer load of UPS-1 to maintenance bypass and DG source",
      "Transfer load of UPS-2 to maintenance bypass and DG source"
    ],

    activitySteps: [
      "Switch ON DG Set and transfer input source of both UPS to DG power.  ",
      "Physical inspection any damages ,heating ,health ,hygiene etc of UPS , Input , Output panel , PDUS , earth connection and Battery Banks cells.",
      "Check Input voltage/other parameters of UPS-1 from display. Check all UPS parameters Setting as per golden parameters and as per OEM PM checklist.",
      "Check Input voltage/other parameters of UPS-1 physically (through multimeters) and check all parameters such as L-L , L-N ,L-E, N-E Voltage.",
      "Check and keep recod of load balacing of all three phases. L1: ….Amp , L2…Amp  and L3…Amp.",
      "Check all UPS display and ensure there should not be any alarms.",
      "Check Input voltage/other parameters of UPS-1 from display. Check all UPS paramaters Setting as per golden paramaters and as per OEM PM checklist.",
      "Clean the UPS-1 system Externally (online PM).",
      "Ensure IR testing on power and control cable termination points.",
      "Keep record of all equipements load current if any equipement s has been added with date and time.",
      "Check BMS connectivity and Alarm standardation and testing date.",
      "Check UPS Display time and date are in sync with real time.",
      "Put UPS-1 on battery mode by doing battery test setting in controller for 15 minutes and keep record of battery cells voltage.",
      "Check UPS -1 display for any alarms during battery disrchage test.",
      "Check UPS-1 display and ensure there should not be any alarms after completion of discharge test and UPS on normal mode.",
      "Check UPS-1 functionality for 30 mins.",
      "Verify all parameters of UPS-1 and documentation done."
    ],

    rollback: [
      "The first step, if there is some abnormality observed during the maintenance would be to stop the maintenance.",
      "(1) Interrupt the maintenance and check the UPS alarm.",
      "(2) Escalate and inform all the stake holders.",
      "(3) Re-schedule the maintenance if required.",
    ],

    infra: [
      ["Nxtra CIH", siteConfig?.authorizedBy || "Unknown CIH"],
      ["SIM", siteConfig?.sim || "Unknown SIM"],
      ["O&M Partner", "Vertiv Energy Pvt Ltd"],
      ["Panel AMC Partner", "Alexis Telecom Pvt Ltd"]
    ],

    proactive: [
      "1. Complete activity will be carried out under CCTV Survilance. In case CCTV is not available at the activity location, intrim arrangments will be made.",
      "2. BMS/CCTV System power supply must not be affected under any circuimstance during the activity.",
      "3. Continuous monitoring and vigilance of BMS System will be ensured throughout the activity.",
      "4. Only one critical activity will be carried out at a time PAN india."
    ],

    spares: [
      ["Lugs – Ring Type", "xx Sqmm", "YY", "NA"],
      ["Lugs – Pin Type", "xx Sqmm", "YY", "NA"],
      ["Heat shrink sleeves", "XX", "YY", "NA"],
      ["PVC insulation tape", "XX", "YY", "NA"],
      ["Blower", "XX", "YY", "NA"],
      ["UPS spares (fuse, fan)", "XX", "YY", "NA"],
      ["Any other …...", "XX", "YY", "NA"]
    ],

    approval: {
      createdBy: siteConfig?.omName || "Unknown Creator",
      reviewer: `${siteConfig?.preparedBy || "Unknown Review By"} / Mr. Amit Kumar Mondal`,
      approver: siteConfig?.authorizedBy || "Unknown Approver",
      crNumber: row?.crqNo || "To Be Raised"
    }
  },

});