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
      tier: siteConfig?.siteCategory === "Super Critical" ? "T1/T2" : "T2/T2",
    },

    activityInfo: {
      nature: row?.notes ? row?.notes : "Inhouse PM of UPS System",
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
      ["Site Survey report with GA drawing & SLD layouts ( Power Connection , Fesibility )", "Tick(Yes/No/NA)", "N/A"],
      ["Ensure New UPS System and other Accessories are delivered at site.", "Tick(Yes/No/NA)", "N/A"],
      ["Is new UPS compatible with existing UPS setup (Eg. Compatible with Iso. Transformer/ 3P 4 Wire or 3P 3 Wire System)", "Tick(Yes/No/NA)", "N/A"],
      ["Ensure Pre energization & testing of UPS is performed by OEM at Sites.      ", "Tick(Yes/No/NA)", "N/A"],
      ["Ensure required resources and tools & PPE are available and Healthiness to be ensured at site prior to start of the activity.", "Tick(Yes/No/NA)", "Yes"],
      ["Ensure emergency spares for UPS are available at site.", "Tick(Yes/No/NA)", "N/A"],
      ["Ensure recent DR Test has been performed for all the Racks/Nodes  (30 Days)", "Tick(Yes/No/NA)", "No"],
      ["All Input & Output Breaker trip setting from source to racks level to be ensured to be at 100%. Attach additional Checklist.", "Tick(Yes/No/NA)", "Yes"],
      ["All Input& Output (Till Rack Level) Circuit Breaker (ACB/MCCB/MCB)Rating vs loading comparision done (Any breaker loading must not exceed 70% of rated load) .Attach additional Checklist.", "Tick(Yes/No/NA)", "Yes"],
      ["Ensure to note down temperature of the cable as well by the use of thermal gun and check for any abnormal temperature and Note down all room temperatures of all concerned locations", "Tick(Yes/No/NA)", "Yes"],
      ["All Input & Output cables Rating vs Loading comparision to be done (Loading must not be more than 50% of ots rated Current) Attach additional Checklist.", "Tick(Yes/No/NA)", "Yes"],
      ["Ensure online battery discharge/backup test should be carried out before one days for 5 minutes and check all cells voltage. Attach additional Checklist.", "Tick(Yes/No/NA)", "Yes"],
      ["Ensure Panel Automation status is working fine", "Tick(Yes/No/NA)", "Yes"],
      ["Ensure No open observations from recent PM of UPS & BB", "Tick(Yes/No/NA)", "Yes"],
      ["Thorough inspection of Isolation Transformers (If applicable) to be done, Rated capacity of Isolation transformer/Check input,output cables ratings, winding and cables temrature. ", "Tick(Yes/No/NA)", "Yes"],
      ["Site will be on DG, So Health checkup of DG sets and availability of Diesel Stock to be ensured", "Tick(Yes/No/NA)", "Yes"],
      ["LOTO must be done after denergizing the feeders during the activity", "Tick(Yes/No/NA)", "Yes"],
      ["Ensure SA approval for all Single Source Nodes is inplace ", "Tick(Yes/No/NA)", "Yes"],
      ["After disconnection of the power cables, end terminations must be properly insulated before pulling out of the glands/UPS/Panel.", "Tick(Yes/No/NA)", "N/A"],
      ["Ensure All Stake holders are informed/Approval is inplace/CRQ is approvedStakeholder approval & CRQ done", "Tick(Yes/No/NA)", "Yes"]
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

    network: [
      ["Core Team", "Mr. Parthasarathi Dey"],
      ["Transmission Team", "Mr. Pradip Moitra"],
      ["OPS Head", "Mr. Sujit Panday"],
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
      tier: siteConfig?.siteCategory === "Super Critical" ? "T1/T2" : "T2/T2",
    },

    activityInfo: {
      nature: row?.notes ? row?.notes : "OEM PM of UPS System",
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
      ["Site Survey report with GA drawing & SLD layouts ( Power Connection , Fesibility )", "Tick(Yes/No/NA)", "N/A"],
      ["Ensure New UPS System and other Accessories are delivered at site.", "Tick(Yes/No/NA)", "N/A"],
      ["Is new UPS compatible with existing UPS setup (Eg. Compatible with Iso. Transformer/ 3P 4 Wire or 3P 3 Wire System)", "Tick(Yes/No/NA)", "N/A"],
      ["Ensure Pre energization & testing of UPS is performed by OEM at Sites.      ", "Tick(Yes/No/NA)", "N/A"],
      ["Ensure required resources and tools & PPE are available and Healthiness to be ensured at site prior to start of the activity.", "Tick(Yes/No/NA)", "Yes"],
      ["Ensure emergency spares for UPS are available at site.", "Tick(Yes/No/NA)", "N/A"],
      ["Ensure recent DR Test has been performed for all the Racks/Nodes  (30 Days)", "Tick(Yes/No/NA)", "No"],
      ["All Input & Output Breaker trip setting from source to racks level to be ensured to be at 100%. Attach additional Checklist.", "Tick(Yes/No/NA)", "Yes"],
      ["All Input& Output (Till Rack Level) Circuit Breaker (ACB/MCCB/MCB)Rating vs loading comparision done (Any breaker loading must not exceed 70% of rated load) .Attach additional Checklist.", "Tick(Yes/No/NA)", "Yes"],
      ["Ensure to note down temperature of the cable as well by the use of thermal gun and check for any abnormal temperature and Note down all room temperatures of all concerned locations", "Tick(Yes/No/NA)", "Yes"],
      ["All Input & Output cables Rating vs Loading comparision to be done (Loading must not be more than 50% of ots rated Current) Attach additional Checklist.", "Tick(Yes/No/NA)", "Yes"],
      ["Ensure online battery discharge/backup test should be carried out before one days for 5 minutes and check all cells voltage. Attach additional Checklist.", "Tick(Yes/No/NA)", "Yes"],
      ["Ensure Panel Automation status is working fine", "Tick(Yes/No/NA)", "Yes"],
      ["Ensure No open observations from recent PM of UPS & BB", "Tick(Yes/No/NA)", "Yes"],
      ["Thorough inspection of Isolation Transformers (If applicable) to be done, Rated capacity of Isolation transformer/Check input,output cables ratings, winding and cables temrature. ", "Tick(Yes/No/NA)", "Yes"],
      ["Site will be on DG, So Health checkup of DG sets and availability of Diesel Stock to be ensured", "Tick(Yes/No/NA)", "Yes"],
      ["LOTO must be done after denergizing the feeders during the activity", "Tick(Yes/No/NA)", "Yes"],
      ["Ensure SA approval for all Single Source Nodes is inplace ", "Tick(Yes/No/NA)", "Yes"],
      ["After disconnection of the power cables, end terminations must be properly insulated before pulling out of the glands/UPS/Panel.", "Tick(Yes/No/NA)", "N/A"],
      ["Ensure All Stake holders are informed/Approval is inplace/CRQ is approvedStakeholder approval & CRQ done", "Tick(Yes/No/NA)", "Yes"]
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

    network: [
      ["Core Team", "Mr. Parthasarathi Dey"],
      ["Transmission Team", "Mr. Pradip Moitra"],
      ["OPS Head", "Mr. Sujit Panday"],
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
      tier: siteConfig?.siteCategory === "Super Critical" ? "T1/T2" : "T2/T2",
    },

    activityInfo: {
      nature: row?.notes ? row?.notes : "Replacement/Upgradation of UPS",
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
      ["Site Survey report with GA drawing & SLD layouts ( Power Connection , Fesibility )", "Tick(Yes/No/NA)", "N/A"],
      ["Ensure New UPS System and other Accessories are delivered at site.", "Tick(Yes/No/NA)", "N/A"],
      ["Is new UPS compatible with existing UPS setup (Eg. Compatible with Iso. Transformer/ 3P 4 Wire or 3P 3 Wire System)", "Tick(Yes/No/NA)", "N/A"],
      ["Ensure Pre energization & testing of UPS is performed by OEM at Sites.      ", "Tick(Yes/No/NA)", "N/A"],
      ["Ensure required resources and tools & PPE are available and Healthiness to be ensured at site prior to start of the activity.", "Tick(Yes/No/NA)", "Yes"],
      ["Ensure emergency spares for UPS are available at site.", "Tick(Yes/No/NA)", "N/A"],
      ["Ensure recent DR Test has been performed for all the Racks/Nodes  (30 Days)", "Tick(Yes/No/NA)", "No"],
      ["All Input & Output Breaker trip setting from source to racks level to be ensured to be at 100%. Attach additional Checklist.", "Tick(Yes/No/NA)", "Yes"],
      ["All Input& Output (Till Rack Level) Circuit Breaker (ACB/MCCB/MCB)Rating vs loading comparision done (Any breaker loading must not exceed 70% of rated load) .Attach additional Checklist.", "Tick(Yes/No/NA)", "Yes"],
      ["Ensure to note down temperature of the cable as well by the use of thermal gun and check for any abnormal temperature and Note down all room temperatures of all concerned locations", "Tick(Yes/No/NA)", "Yes"],
      ["All Input & Output cables Rating vs Loading comparision to be done (Loading must not be more than 50% of ots rated Current) Attach additional Checklist.", "Tick(Yes/No/NA)", "Yes"],
      ["Ensure online battery discharge/backup test should be carried out before one days for 5 minutes and check all cells voltage. Attach additional Checklist.", "Tick(Yes/No/NA)", "Yes"],
      ["Ensure Panel Automation status is working fine", "Tick(Yes/No/NA)", "Yes"],
      ["Ensure No open observations from recent PM of UPS & BB", "Tick(Yes/No/NA)", "Yes"],
      ["Thorough inspection of Isolation Transformers (If applicable) to be done, Rated capacity of Isolation transformer/Check input,output cables ratings, winding and cables temrature. ", "Tick(Yes/No/NA)", "Yes"],
      ["Site will be on DG, So Health checkup of DG sets and availability of Diesel Stock to be ensured", "Tick(Yes/No/NA)", "Yes"],
      ["LOTO must be done after denergizing the feeders during the activity", "Tick(Yes/No/NA)", "Yes"],
      ["Ensure SA approval for all Single Source Nodes is inplace ", "Tick(Yes/No/NA)", "Yes"],
      ["After disconnection of the power cables, end terminations must be properly insulated before pulling out of the glands/UPS/Panel.", "Tick(Yes/No/NA)", "N/A"],
      ["Ensure All Stake holders are informed/Approval is inplace/CRQ is approvedStakeholder approval & CRQ done", "Tick(Yes/No/NA)", "Yes"]
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

    network: [
      ["Core Team", "Mr. Parthasarathi Dey"],
      ["Transmission Team", "Mr. Pradip Moitra"],
      ["OPS Head", "Mr. Sujit Panday"],
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

  "Fault / Alarm / Break Down - UPS": {
    header: {
      title: "Fault / Alarm / Break Down - UPS activity MOP",
      docNo: "Nxtra/MOP/UPS Maintenance/DOC No. 1.13/Rev.00",
      releaseDate: "01-01-2026"
    },

    siteInfo: {
      city: userData?.site || "Unknown City",
      location: `${userData?.site} MSC` || "Unknown MSC",
      floor: row?.floor || "Unknown Floor",
      tier: siteConfig?.siteCategory === "Super Critical" ? "T1/T2" : "T2/T2",
    },

    activityInfo: {
      nature: row?.notes ? row?.notes : "Fault / Alarm / Break Down - UPS",
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
      ["Site Survey report has to be submitted along with GA drawing and SLD layouts ( Power Connection , Fesibility )", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure New UPS System and other Accessories are delivered at site.", "Tick (Yes/No/NA)", "N/A"],
      ["Is new UPS compatible with existing UPS setup (Eg. Compatible with Iso. Transformer/ 3P 4 Wire or 3P 3 Wire System)", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure Pre energization & testing of UPS is performed by OEM at Sites.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure required resources and tools & PPE are available and Healthiness to be ensured at site prior to start of the activity.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure emergency spares for UPS are available at site.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure recent DR Test has been performed for all the Racks/Nodes  (30 Days)", "Tick (Yes/No/NA)", "N/A"],
      ["All Input & Output Breaker trip setting from source to racks level to be ensured to be at 100%. Attach additional Checklist.", "Tick (Yes/No/NA)", "N/A"],
      ["All Input& Output (Till Rack Level) Circuit Breaker (ACB/MCCB/MCB)Rating vs loading comparision done (Any breaker loading must not exceed 70% of rated load) .Attach additional Checklist.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure to note down temperature of the cable as well by the use of thermal gun and check for any abnormal temperature and Note down all room temperatures of all concerned locations", "Tick (Yes/No/NA)", "N/A"],
      ["All Input & Output cables Rating vs Loading comparision to be done (Loading must not be more than 50% of ots rated Current) Attach additional Checklist.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure online battery discharge/backup test should be carried out before one days for 5 minutes and check all cells voltage. Attach additional Checklist.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure Panel Automation status is working fine", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure No open observations from recent PM of UPS & BB", "Tick (Yes/No/NA)", "N/A"],
      ["Thorough inspection of Isolation Transformers (If applicable) to be done, Rated capacity of Isolation transformer/Check input,output cables ratings, winding and cables temrature.", "Tick (Yes/No/NA)", "N/A"],
      ["Site will be on DG, So Health checkup of DG sets and availability of Diesel Stock to be ensured", "Tick (Yes/No/NA)", "N/A"],
      ["LOTO must be done after denergizing the feeders during the activity", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure SA approval for all Single Source Nodes is inplace", "Tick (Yes/No/NA)", "N/A"],
      ["After disconnection of the power cables, end terminations must be properly insulated before pulling out of the glands/UPS/Panel.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure All Stake holders are informed/Approval is inplace/CRQ is approved", "Tick (Yes/No/NA)", "N/A"]
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
      "Switch ON DG Set and transfer site load on DG power.",
      "Ensure NO alarm on any infra equipments ( UPS /SMPS/PAC etc).",
      "Ensure all the loads are transferred to DG and check the UPS display status.",
      "Ensure all the loads are transferred to DG and inform all concerned users.",
      "Check all ACDBs connected with UPS-1.",
      "Remove faulty Static/Inverter/Charger module from UPS (OEM authorised engineer will do rectification work only).",
      "Insert new module in UPS and do configuration by OEM engineer.",
      "OEM engineer will confirm the UPS normal status.",
      "Then transfer the Data Centre load from DG to EB.",
      "Verify all parameters of UPS-2 and documentation done."
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

    network: [
      ["Core Team", "Mr. Parthasarathi Dey"],
      ["Transmission Team", "Mr. Pradip Moitra"],
      ["OPS Head", "Mr. Sujit Panday"],
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

  "UPS BB EOL Replacement/Upgradation": {
    header: {
      title: "UPS BB EOL Replacement/Upgradationn activity MOP",
      docNo: "Nxtra/MOP/BB Replacement/DOC No. 4.10/Rev.00",
      releaseDate: "01-01-2026"
    },

    siteInfo: {
      city: userData?.site || "Unknown City",
      location: `${userData?.site} MSC` || "Unknown MSC",
      floor: row?.floor || "Unknown Floor",
      tier: siteConfig?.siteCategory === "Super Critical" ? "T1/T2" : "T2/T2",
    },

    activityInfo: {
      nature: row?.notes ? row?.notes : "Replacement/Upgradation of Battery Bank System",
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
      ["Check the all approvals and CR available on before starting the activity", "Tick(Yes/No/NA)", "N/A"],
      ["Site Survey report has to be submitted along with GA drawing and SLD layouts (Space , Feasibility )", "Tick(Yes/No/NA)", "N/A"],
      ["Ensure New Battery Bank System and other Accessories are delivered at site.", "Tick(Yes/No/NA)", "N/A"],
      ["Is new Battery Bank compatible with existing Battery Bank setup (Eg. Compatible with Design & Space for installation", "Tick(Yes/No/NA)", "N/A"],
      ["Ensure Pre check of Battery Bank is performed by OEM at Site.", "Tick(Yes/No/NA)", "N/A"],
      ["Ensure required resources and insulated tools & PPE are available and Healthiness to be ensured at site prior to start of the activity.", "Tick(Yes/No/NA)", "Yes"],
      ["Ensure emergency spares for Battery Bank are available at site.", "Tick(Yes/No/NA)", "N/A"],
      ["Check the New Battery defective if any found", "Tick(Yes/No/NA)", "No"],
      ["Backup analysis to be done and ensure BB connected should be capable of taking load in case load shifts on battery during activity", "Tick(Yes/No/NA)", "Yes"],
      ["All Input& Output (Till Rack Level) Circuit Breaker (ACB/MCCB/MCB)Rating vs loading comparision done (Any breaker loading must not exceed 70% of rated load) .Attach additional Checklist.", "Tick(Yes/No/NA)", "Yes"],
      ["All Input & Output Breaker trip setting from source to racks level to be ensured to be at 100%. Attach additional Checklist.", "Tick(Yes/No/NA)", "Yes"],
      ["All Input & Output cables Rating vs Loading comparision to be done (Loading must not be more than 50% of ots rated Current) Attach additional Checklist.", "Tick(Yes/No/NA)", "Yes"],
      ["Ensure to check health of battery banks which will remain connected with UPS/SMPS during activity", "Tick(Yes/No/NA)", "Yes"],
      ["Release gas through the vent plug and get ready for the activity", "Tick(Yes/No/NA)", "Yes"],
      ["Ensure Panel Automation status is working fine", "Tick(Yes/No/NA)", "Yes"],
      ["Ensure No open observations from recent PM of UPS & BB", "Tick(Yes/No/NA)", "Yes"],
      ["Thorough inspection of Isolation Transformers (If applicable) to be done, Rated capacity of Isolation transformer/Check input,output cables ratings, winding and cables temrature. ", "Tick(Yes/No/NA)", "Yes"],
      ["Site will be on DG, So Health checkup of DG sets and availability of Diesel Stock to be ensured", "Tick(Yes/No/NA)", "Yes"],
      ["LOTO must be done after denergizing the feeders during the activity", "Tick(Yes/No/NA)", "Yes"],
      ["Ensure SA approval for all Single Source Nodes is inplace ", "Tick(Yes/No/NA)", "Yes"],
      ["After disconnection of the power cables, end terminations must be properly insulated before pulling out of the glands/UPS/Panel.", "Tick(Yes/No/NA)", "N/A"],
      ["Ensure All Stake holders are informed/Approval is inplace/CRQ is approvedStakeholder approval & CRQ done", "Tick(Yes/No/NA)", "Yes"]
    ],

    loadDetails: [
      ["Battery Bank-1", "64AH 400V", row?.floor, "15.6%"],
      ["Battery Bank-2", "65AH 400V", row?.floor, "15.5%"],
      ["Battery Bank-3", "65AH 400V", row?.floor, "15.5%"],
      ["Battery Bank-4", "65AH 400V", row?.floor, "15.5%"]
    ],

    risk: [
      "Risk Level 1 - UPS/SMPS will be connected with single battery bank",
      "Risk Level 2 – Transfer of MSC load from Battery Bank-2 to Battery Bank-1 while replacement of existing Battery Bank-2 with new Battery Bank work will be carried out.",
      "Risk Level 3 –  Re-transfer of MSC load on new Battery Bank-2 from Battery Bank 1 after completion of replacement work and testing."
    ],

    mitigation: [
      "1. Transfer of load from Battery Bank-2 to Battery Bank-1 will be done gradually to ensure seamless transfer from one source to other source. Also prior change Battery on DG mode only for UPS or SMPS system.",
      "2. After shifting of MSC load from Battery Bank-2 to Battery Bank-1, Entire the total load Will be run on Battery Bank-1 should be below 70% capacity",
      "3. Retransfer of MSC Source A from Battery Bank-1 to Battery Bank-2 will be done gradually to ensure seamless transfer."
    ],

    activitySteps: [
      "Switch ON DG Set and transfer site load on DG power.",
      "Ensure NO alarm on any infra equipment's ( Battery Bank /SMPS/PAC etc)",
      "After shifting all load power Now check Battery Bank-2 O/P Current at zero level and ensure that No load are connected on Battery Bank -2",
      "Switch OFF outgoing breakers in Battery Bank 2 in the SMPS/UPS one by one.",
      "Ensure the entire MSC load is transferred on Battery Bank 1 and check all parameters.",
      "Shut down Battery Bank-2.",
      "Switch OFF the input source to Battery Bank-2and apply LOTO",
      "Disconnect the cable terminations in Battery Bank-2 and remove the cables.",
      "Dismantle and remove old Battery Bank-2",
      "Carry out required modifications in the base frame to suit new Battery Bank.",
      "Positioning of new Battery Bank on the base frame and complete the installation.",
      "Double Cross check bolt nut tightness & Connect the input, output and Battery Bank cables in the new Battery Bank.",
      "Release LOTO and Switch ON the input power to new Battery Bank-2.and check all parameters Ex Correct Polarity, voltage.",
      "Testing and commissioning of the new Battery Bank. Check all setting of parameters in SMPS/UPS  charging voltage/current.",
      "Verify all parameters in the new Battery Bank current & if any Abnormalities.",
      "Switch on the Battery Breaker/Fuse in the SMPS/UPS system, Test the Battery Bank shifting load on battery mode.",
      "Take post activity services confirmation from all active equipment stake holders and close the activity."
    ],

    rollback: [
      "If in case of any issues observed in any of the Battery Bank while shifting  load from Battery Bank-2 to Battery Bank-1, activity will be stopped immediately, and load will be restored back on old Battery Bank.",
    ],

    infra: [
      ["Nxtra CIH", siteConfig?.authorizedBy || "Unknown CIH"],
      ["SIM", siteConfig?.sim || "Unknown SIM"],
      ["O&M Partner", "Vertiv Energy Pvt Ltd"],
      ["Panel AMC Partner", "Alexis Telecom Pvt Ltd"]
    ],

    network: [
      ["Core Team", "Mr. Parthasarathi Dey"],
      ["Transmission Team", "Mr. Pradip Moitra"],
      ["OPS Head", "Mr. Sujit Panday"],
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

  "UPS BB Preventive Maintenance(OEM)": {
    header: {
      title: "UPS BB Preventive Maintenance(OEM) activity MOP",
      docNo: "Nxtra/MOP/BB Maintenance/DOC No. 4.11/Rev.00",
      releaseDate: "01-01-2026"
    },

    siteInfo: {
      city: userData?.site || "Unknown City",
      location: `${userData?.site} MSC` || "Unknown MSC",
      floor: row?.floor || "Unknown Floor",
      tier: siteConfig?.siteCategory === "Super Critical" ? "T1/T2" : "T2/T2",
    },

    activityInfo: {
      nature: row?.notes ? row?.notes : "OEM PM of Battery Bank System",
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
      ["Check the all approvals and CR available on before starting the activity", "Tick (Yes/No/NA)", "N/A"],
      ["Check the check list availability of the OEM PM on before starting the activity", "Tick (Yes/No/NA)", "N/A"],
      ["Check the Spare Battery on before starting the activity, if any cell faulty immediately to be replaced", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure required resources and tools & PPE are available and Healthiness to be ensured at site prior to start of the activity.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure emergency spares for Battery Bank are available at site.", "Tick (Yes/No/NA)", "N/A"],
      ["Check the redundent Battery should have 15-30 munites back up with compare to the site load", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure Panel Automation status is working fine", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure No open observations from recent PM of Battery Bank & BB", "Tick (Yes/No/NA)", "N/A"],
      ["Site will be on DG, So Health checkup of DG sets and availability of Diesel Stock to be ensured", "Tick (Yes/No/NA)", "N/A"],
      ["LOTO must be done after denergizing the feeders during the activity", "Tick (Yes/No/NA)", "N/A"],
      ["After disconnection of the power cables, end terminations must be properly insulated before pulling out of the glands/Battery Bank/Panel.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure All Stake holders are informed/Approval is inplace/CRQ is approved", "Tick (Yes/No/NA)", "N/A"]
    ],

    loadDetails: [
      ["Battery Bank-1", "64AH 400V", row?.floor, "15.6%"],
      ["Battery Bank-2", "65AH 400V", row?.floor, "15.5%"],
      ["Battery Bank-3", "65AH 400V", row?.floor, "15.5%"],
      ["Battery Bank-4", "65AH 400V", row?.floor, "15.5%"]
    ],

    risk: [
      "Risk Level 1 - PM of Battery Bank-1",
      "Risk Level 2 – PM of Battery Bank 2",
      "Risk Level 3 – PM of Battery Bank 3",
      "Risk Level 4 – PM of Battery Bank 4",
    ],

    mitigation: [
      "1. Transfer of load from Battery Bank-1 to Battery Bank-2 and power will be shifted on DG Source.",
      "2. Transfer of load from Battery Bank-2 to Battery Bank-1 and power will be shifted on DG Source.",
    ],

    activitySteps: [
      "Switch ON DG Set and transfer input source of both Battery Bank to DG power.",
      "Physical inspection any damages, health, hygiene etc of Battery Bank.",
      "Make the set point of Battery Bank test mode and of voltage set of discharge should be fix 47.5 VDC/15 munites discharge and start doing the discharge test with existing IT load",
      "Check Input voltage/other parameters of Battery Bank-1 physically (through multimeters) and check all parameters such as Input voltage, each cell voltage in the PM format.",
      "Check and keep recod of discharging Voltage and every 5 minutes and keep discharge till 1.97 (47.5/24 cells)",
      "Check all the cells voltage stable or >1.75V volts then consider all Cells or Ok, if any cells falls <1.75VDC, then cell to be replaced on immediate basis",
      "All observaions to be recorded and timely report to Circle Incharge for immediate support of cell faulty cases for replacement",
      "Verify all parameters of Battery Bank-1 and documentation done."
    ],

    rollback: [
      "The first step, if there is some abnormality observed during the maintenance would be to stop the maintenance.",
      "(1) Interrupt the maintenance and check the Battery Bank alarm.",
      "(2) Escalate and inform all the stake holders.",
      "(3) Re-schedule the maintenance if required."
    ],

    infra: [
      ["Nxtra CIH", siteConfig?.authorizedBy || "Unknown CIH"],
      ["SIM", siteConfig?.sim || "Unknown SIM"],
      ["O&M Partner", "Vertiv Energy Pvt Ltd"],
      ["Panel AMC Partner", "Alexis Telecom Pvt Ltd"]
    ],

    network: [
      ["Core Team", "Mr. Parthasarathi Dey"],
      ["Transmission Team", "Mr. Pradip Moitra"],
      ["OPS Head", "Mr. Sujit Panday"],
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

  "UPS BB Preventive Maintenance(In-House)": {
    header: {
      title: "UPS BB Preventive Maintenance(In-House) activity MOP",
      docNo: "Nxtra/MOP/BB Maintenance/DOC No. 4.11/Rev.00",
      releaseDate: "01-01-2026"
    },

    siteInfo: {
      city: userData?.site || "Unknown City",
      location: `${userData?.site} MSC` || "Unknown MSC",
      floor: row?.floor || "Unknown Floor",
      tier: siteConfig?.siteCategory === "Super Critical" ? "T1/T2" : "T2/T2",
    },

    activityInfo: {
      nature: row?.notes ? row?.notes : "In-House PM of Battery Bank System",
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
      ["Check the all approvals and CR available on before starting the activity", "Tick (Yes/No/NA)", "N/A"],
      ["Check the check list availability of the OEM PM on before starting the activity", "Tick (Yes/No/NA)", "N/A"],
      ["Check the Spare Battery on before starting the activity, if any cell faulty immediately to be replaced", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure required resources and tools & PPE are available and Healthiness to be ensured at site prior to start of the activity.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure emergency spares for Battery Bank are available at site.", "Tick (Yes/No/NA)", "N/A"],
      ["Check the redundent Battery should have 15-30 munites back up with compare to the site load", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure Panel Automation status is working fine", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure No open observations from recent PM of Battery Bank & BB", "Tick (Yes/No/NA)", "N/A"],
      ["Site will be on DG, So Health checkup of DG sets and availability of Diesel Stock to be ensured", "Tick (Yes/No/NA)", "N/A"],
      ["LOTO must be done after denergizing the feeders during the activity", "Tick (Yes/No/NA)", "N/A"],
      ["After disconnection of the power cables, end terminations must be properly insulated before pulling out of the glands/Battery Bank/Panel.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure All Stake holders are informed/Approval is inplace/CRQ is approved", "Tick (Yes/No/NA)", "N/A"]
    ],

    loadDetails: [
      ["Battery Bank-1", "64AH 400V", row?.floor, "15.6%"],
      ["Battery Bank-2", "65AH 400V", row?.floor, "15.5%"],
      ["Battery Bank-3", "65AH 400V", row?.floor, "15.5%"],
      ["Battery Bank-4", "65AH 400V", row?.floor, "15.5%"]
    ],

    risk: [
      "Risk Level 1 - PM of Battery Bank-1",
      "Risk Level 2 – PM of Battery Bank 2",
      "Risk Level 3 – PM of Battery Bank 3",
      "Risk Level 4 – PM of Battery Bank 4",
    ],

    mitigation: [
      "1. Transfer of load from Battery Bank-1 to Battery Bank-2 and power will be shifted on DG Source.",
      "2. Transfer of load from Battery Bank-2 to Battery Bank-1 and power will be shifted on DG Source.",
    ],

    activitySteps: [
      "Switch ON DG Set and transfer input source of both Battery Bank to DG power.",
      "Physical inspection any damages, health, hygiene etc of Battery Bank.",
      "Make the set point of Battery Bank test mode and of voltage set of discharge should be fix 47.5 VDC/15 munites discharge and start doing the discharge test with existing IT load",
      "Check Input voltage/other parameters of Battery Bank-1 physically (through multimeters) and check all parameters such as Input voltage, each cell voltage in the PM format.",
      "Check and keep recod of discharging Voltage and every 5 minutes and keep discharge till 1.97 (47.5/24 cells)",
      "Check all the cells voltage stable or >1.75V volts then consider all Cells or Ok, if any cells falls <1.75VDC, then cell to be replaced on immediate basis",
      "All observaions to be recorded and timely report to Circle Incharge for immediate support of cell faulty cases for replacement",
      "Verify all parameters of Battery Bank-1 and documentation done."
    ],

    rollback: [
      "The first step, if there is some abnormality observed during the maintenance would be to stop the maintenance.",
      "(1) Interrupt the maintenance and check the Battery Bank alarm.",
      "(2) Escalate and inform all the stake holders.",
      "(3) Re-schedule the maintenance if required."
    ],

    infra: [
      ["Nxtra CIH", siteConfig?.authorizedBy || "Unknown CIH"],
      ["SIM", siteConfig?.sim || "Unknown SIM"],
      ["O&M Partner", "Vertiv Energy Pvt Ltd"],
      ["Panel AMC Partner", "Alexis Telecom Pvt Ltd"]
    ],

    network: [
      ["Core Team", "Mr. Parthasarathi Dey"],
      ["Transmission Team", "Mr. Pradip Moitra"],
      ["OPS Head", "Mr. Sujit Panday"],
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

  "UPS BB Cell Replacement": {
    header: {
      title: "UPS BB Cell Replacement activity MOP",
      docNo: "Nxtra/MOP/BB Replacement/DOC No. 4.13/Rev.00",
      releaseDate: "01-01-2026"
    },

    siteInfo: {
      city: userData?.site || "Unknown City",
      location: `${userData?.site} MSC` || "Unknown MSC",
      floor: row?.floor || "Unknown Floor",
      tier: siteConfig?.siteCategory === "Super Critical" ? "T1/T2" : "T2/T2",
    },

    activityInfo: {
      nature: row?.notes ? row?.notes : "Replacement/Upgradation of Battery Bank System",
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
      ["Check the all approvals and CR available on before starting the activity", "Tick (Yes/No/NA)", "N/A"],
      ["Site Survey report has to be submitted along with GA drawing and SLD layouts (Space , Fesibility )", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure New Battery Bank System and other Accessories are delivered at site.", "Tick (Yes/No/NA)", "N/A"],
      ["Is new Battery Bank compatible with existing Battery Bank setup (Eg. Compatible with Design & Space for installation", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure Pre check of Battery Bank is performed by OEM at Site.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure required resources and tools & PPE are available and Healthiness to be ensured at site prior to start of the activity.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure emergency spares for Battery Bank are available at site.", "Tick (Yes/No/NA)", "N/A"],
      ["Check the New Battery defective if any found", "Tick (Yes/No/NA)", "N/A"],
      ["Release gas through the vent plug and get ready for the activity", "Tick (Yes/No/NA)", "N/A"],
      ["Site will be on DG, So Health checkup of DG sets and availability of Diesel Stock to be ensured", "Tick (Yes/No/NA)", "N/A"],
      ["LOTO must be done after denergizing the SMPS/UPS Battery supply during the activity", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure All Stake holders are informed/Approval is inplace/CRQ is approved", "Tick (Yes/No/NA)", "N/A"]
    ],

    loadDetails: [
      ["Battery Bank-1", "64AH 400V", row?.floor, "15.6%"],
      ["Battery Bank-2", "65AH 400V", row?.floor, "15.5%"],
      ["Battery Bank-3", "65AH 400V", row?.floor, "15.5%"],
      ["Battery Bank-4", "65AH 400V", row?.floor, "15.5%"]
    ],

    risk: [
      "Risk Level 1 - PM of Battery Bank-1",
      "Risk Level 2 – PM of Battery Bank 2",
      "Risk Level 3 – PM of Battery Bank 3",
      "Risk Level 4 – PM of Battery Bank 4",
    ],

    mitigation: [
      "1. Transfer of load from Battery Bank-1 to Battery Bank-2 and power will be shifted on DG Source.",
      "2. Transfer of load from Battery Bank-2 to Battery Bank-1 and power will be shifted on DG Source.",
    ],

    activitySteps: [
      "Switch ON DG Set and transfer site load on DG power.",
      "Ensure NO alarm on any infra equipments ( Battery Bank /SMPS/PAC etc)",
      "After shifting all load power Now check Battery Bank-2 O/P Current at zero level and ensure that No load are connected on Battery Bank -2",
      "Switch OFF outgoing breakers in Battery Bank 2 in the SMPS/UPS one by one.",
      "Ensure the entire MSC load is transferred on Battery Bank 1 and check all parameters.",
      "Shut down Battery Bank-2.",
      "Switch OFF the input source to Battery Bank-2 and apply LOTO",
      "Disconnect the cable terminations in Battery Bank-2 and remove the cables.",
      "Dismantle and remove old Battery Bank-2",
      "Carry out required modifications in the base frame to suit new Battery Bank.",
      "Positioning of new Battery Bank on the base frame and complete the installation.",
      "Double Cross check bolt nut tightness & Connect the input, output and Battery Bank cables in the new Battery Bank.",
      "Release LOTO and Switch ON the input power to new Battery Bank-2 and check all parameters Ex Correct Polarity,voltage.",
      "Testing and commissioning of the new Battery Bank. Check all setting of parameters in SMPS/UPS charging voltage/current.",
      "Verify all parameters in the new Battery Bank current & if any Abnormalities.",
      "Switch on the Battery Breaker/Fuse in the SMPS/UPS system, Test the Battery Bank shifting load on battery mode.",
      "Take post activity services confirmation from all active equipment stake holders and close the activity."
    ],

    rollback: [
      "The first step, if there is some abnormality observed during the maintenance would be to stop the maintenance.",
      "(1) Interrupt the maintenance and check the Battery Bank alarm.",
      "(2) Escalate and inform all the stake holders.",
      "(3) Re-schedule the maintenance if required."
    ],

    infra: [
      ["Nxtra CIH", siteConfig?.authorizedBy || "Unknown CIH"],
      ["SIM", siteConfig?.sim || "Unknown SIM"],
      ["O&M Partner", "Vertiv Energy Pvt Ltd"],
      ["Panel AMC Partner", "Alexis Telecom Pvt Ltd"]
    ],

    network: [
      ["Core Team", "Mr. Parthasarathi Dey"],
      ["Transmission Team", "Mr. Pradip Moitra"],
      ["OPS Head", "Mr. Sujit Panday"],
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

  "SMPS EOL replacement/upgradation": {
    header: {
      title: "SMPS EOL replacement/upgradation activity MOP",
      docNo: "Nxtra/MOP/SMPS Replacement/DOC No. 2.10/Rev.00",
      releaseDate: "01-01-2026"
    },

    siteInfo: {
      city: userData?.site || "Unknown City",
      location: `${userData?.site} MSC` || "Unknown MSC",
      floor: row?.floor || "Unknown Floor",
      tier: siteConfig?.siteCategory === "Super Critical" ? "T1/T2" : "T2/T2",
    },

    activityInfo: {
      nature: row?.notes ? row?.notes : "Replacement/Upgradation of SMPS",
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
      ["MOP discussion/Finalization/Approval obtained/Available.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure New SMPS/DC Power Plant and other Accessories are delivered at site.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure emergency spares for SMPS/DC Power Plant are available at site.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure Pre energization & testing of SMPS is performed by OEM at Site.", "Tick (Yes/No/NA)", "N/A"],
      ["If in case, old SMPS/DC power plant is considered for reinstallation, then ensure testing is performed by OEM before reinstallation & lowest rating of SMPS capacity among the pair to be considered as N capacity", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure required resources and insulated tools & PPE are available and Healthiness to be ensured at site prior to start of the activity.", "Tick (Yes/No/NA)", "N/A"],
      ["Is new SMPS compatible with existing SMPS setup (Eg. Top Cable Entry/Bottom Entry, No of fuses required/ 3P 4 Wire or 3P 3 Wire System/ Dimensions)", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure +Ve & -Ve Bus bars having sufficient no of holes to accommodate all load, BB & Earthing cables", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure Sufficient No of load & BB Fuses with required Rating are available in the new SMPS/DC Power plant", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure both Source-1 & Source-2 SMPS/DC power plant is having sufficient number of rectifier modules installed to accommodate load of both sources in case of one source down (35% Actual Load+10% Battery Charging Current for One Source)", "Tick (Yes/No/NA)", "N/A"],
      ["All Input& Output (Till Rack Level) Circuit Breaker (ACB/MCCB/MCB) & Fuse Rating vs loading comparison done (Any breaker loading must not exceed 70% of rated load considering load of both sources)", "Tick (Yes/No/NA)", "N/A"],
      ["All Input & Output Breaker trip setting to be ensured to be at 100%", "Tick (Yes/No/NA)", "N/A"],
      ["All Input & Output cables Rating vs Loading comparison to be done (Loading must not exceed 75% considering load of both sources )", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure recent DR Test has been performed for all the Racks/Nodes (30 Days)", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure All Stake holders are informed/Approval is in place/CRQ/work permit is approved", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure approval for all Single Source Nodes is in place", "Tick (Yes/No/NA)", "N/A"],
      ["Site will be on DG, So Health checkup of DG sets and availability of Diesel Stock to be ensured", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure No open observations from recent PM of SMPS & BB", "Tick (Yes/No/NA)", "N/A"],
      ["LOTO must be done after deenergizing the feeders during the activity", "Tick (Yes/No/NA)", "N/A"],
      ["After disconnection of the power cables, end terminations must be properly insulated before pulling out of the glands/SMPS/Panel.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure installation of B class SPD in the input supply of SMPS in case of new system or should be B+C SPD available inside the SMPS", "Tick (Yes/No/NA)", "N/A"],
      ["Earthing testing of body and +positive", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure Panel Automation testing performed within a quarter of performing the activity", "Tick (Yes/No/NA)", "N/A"]
    ],

    loadDetails: [
      ["SMPS-1", "40 KVA", row?.floor, "25.6%"],
      ["SMPS-2", "40 KVA", row?.floor, "25.5%"]
    ],

    risk: [
      "Risk Level 1 - Transfer of load from SMPS-2 to SMPS-1.",
      "Risk Level 2 – Transfer of MSC Source A load from SMPS-2 to SMPS-1 while replacement of existing SMPS-2 with new SMPS.",
      "Risk Level 3 – Re-transfer of MSC Source A load on new SMPS-2 from SMPS-1 after completion of replacement work and testing."
    ],

    mitigation: [
      "1. Transfer of load from SMPS-2 to SMPS-1 will be done gradually to ensure seamless transfer from one source to other source. Also prior to start of the activity, input source of SMPS-1 will be shifted on DG Source.",
      "2.  After shifting of Source A load from SMPS-2 to SMPS-1, the total load on SMPS-1 will be 70%. of its capacity. ",
      "3. Re-transfer of MSC Source A from SMPS-1 to SMPS-2 will be done gradually to ensure seamless transfer."
    ],

    activitySteps: [
      "Initially reduce the float Voltage of SMPS-2 by 0.5 Volts and gradually up to 1 Volt and wait for the load to switch to Source-1",
      "Observe the load of Source-2 fully transferred on Source-1 or not of SMPS System",
      "After all parameters observed within range, team will proceed removing the load fuses of SMPS-2 one by one",
      "After complete off-loading the old SMPS-2, take services confirmation from all stake holders and observing the system for 15 minutes, disconnect the mains input cable, Battery Cables one by one and insulate the termination lugs properly before pulling out from SMPS-2",
      "Remove the old SMPS-2 and put the new SMPS at the same place and insert all new rectifier modules",
      "Then connect input power cable and Battery Bank Cables",
      "OEM will do the commissioning work, change setting and related parameter as per requirement if required",
      "Ensure earthing connectivity of body, +positive busbar and also size of the cable of positive grounding should equal to 35% loading capacity of SMPS",
      "After commissioning connect the Load Cables one by one",
      "Monitor Load current and voltage on new SMPS-2 and rectifier module sharing current properly",
      "Check and monitor voltage and load all related DB",
      "Take the round with Active team to all switch rooms for Racks equipment operation",
      "After confirmation from Active team, inform NOC and take post services confirmation",
      "Ensure BMS connectivity of new/replaced SMPS"
    ],

    rollback: [
      " If in case of any issues observed in SMPS-1 while shifting MSC load from SMPS-2 to SMPS-1, activity will be stopped immediately, and load will be restored back on old SMPS.",
    ],

    infra: [
      ["Nxtra CIH", siteConfig?.authorizedBy || "Unknown CIH"],
      ["SIM", siteConfig?.sim || "Unknown SIM"],
      ["O&M Partner", "Vertiv Energy Pvt Ltd"],
      ["Panel AMC Partner", "Alexis Telecom Pvt Ltd"]
    ],

    network: [
      ["Core Team", "Mr. Parthasarathi Dey"],
      ["Transmission Team", "Mr. Pradip Moitra"],
      ["OPS Head", "Mr. Sujit Panday"],
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

  "SMPS Preventive maintenance (OEM)": {
    header: {
      title: "SMPS Preventive maintenance (OEM) activity MOP",
      docNo: "Nxtra/MOP/SMPS Maintenance/DOC No. 2.11/Rev.00",
      releaseDate: "01-01-2026"
    },

    siteInfo: {
      city: userData?.site || "Unknown City",
      location: `${userData?.site} MSC` || "Unknown MSC",
      floor: row?.floor || "Unknown Floor",
      tier: siteConfig?.siteCategory === "Super Critical" ? "T1/T2" : "T2/T2",
    },

    activityInfo: {
      nature: row?.notes ? row?.notes : "OEM PM of SMPS System",
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
      ["Ensure required resources and tools & PPE are available and Healthiness to be ensured at site prior to start of the activity.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure emergency spares for SMPS are available at site.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure no other activity is planned along with PM activity on the same equipment, if any other activity is planned MOP has to be prepared accordingly", "Tick (Yes/No/NA)", "N/A"],
      ["All Input & Output Breaker trip setting & Fuse rating from source to racks level to be ensured to be at 100%. Attach additional Checklist.", "Tick (Yes/No/NA)", "N/A"],
      ["All Input& Output (Till Rack Level) Circuit Breaker (ACB/MCCB/MCB/Fuse) Rating vs loading comparision done (Any breaker loading must not exceed 70% of rated load). Attach additional Checklist.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure to note down temperature of the cable as well by the use of thermal gun and check for any abnormal temperature and Note down all room temperatures of all concerned locations", "Tick (Yes/No/NA)", "N/A"],
      ["All Input & Output cables Rating vs Loading comparision to be done (Loading must not be more than 50% of ots rated Current) Attach additional Checklist.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure Panel Automation status is working fine", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure No open observations from recent PM of UPS & BB, if any these must not impact the uptime in PM activity.", "Tick (Yes/No/NA)", "N/A"],
      ["Site will be on DG, So Health checkup of DG sets and availability of Diesel Stock to be ensured", "Tick (Yes/No/NA)", "N/A"],
      ["LOTO must be done after denergizing the feeders during the activity", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure SA approval for all Single Source Nodes is inplace.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure All Stake holders are informed/Approval is inplace/CRQ is approved", "Tick (Yes/No/NA)", "N/A"]
    ],

    loadDetails: [
      ["SMPS-1", "5000A", row?.floor, "25.6%"],
      ["SMPS-2", "5000A", row?.floor, "25.5%"]
    ],

    risk: [
      "Risk Level 1 - PM of SMPS-1.",
      "Risk Level 1 - PM of SMPS-2.",
    ],

    mitigation: [
      "1. Online PM activity will be carried out along with online discharge test of Battery banks for 1 hour, while carrying out module cleaning, availability of sufficient no of working modules in the SMPS-1 will be ensured.",
      "1. Online PM activity will be carried out along with online discharge test of Battery banks for 1 hour, while carrying out module cleaning, availability of sufficient no of working modules in the SMPS-2 will be ensured.",
    ],

    activitySteps: [
      "Switch ON DG Set and transfer input source of both SMPS to DG power.",
      "Physical inspection any damages, heating, health, hygiene etc of SMPS, Input, Output panel, DCDBs, earth connection and Battery Banks cells etc for both sources.",
      "Check Input voltage/other parameters of SMPS-1 & 2 from display. Check all UPS parameters setting as per golden parameters and as per OEM PM checklist.",
      "Check Input voltage/other parameters of SMPS-1 & 2 physically (through multimeters) and check all parameters such as L-L, L-N, L-E, N-E Voltage & DC Output Voltage.",
      "Check and keep record of load balancing of all three phases. L1: ….Amp, L2: ….Amp and L3: ….Amp.",
      "Check all SMPS display and ensure there should not be any alarms.",
      "Check Input voltage/other parameters of SMPS-1 & 2 from display. Check all SMPS parameters setting as per golden parameters and as per OEM PM checklist.",
      "Clean the SMPS-1 & 2 system externally (online PM).",
      "Inspect all rectifier modules for any kind of abnormality, alarm or indication.",
      "To carry out cleaning of rectifier modules, carefully switch off the respective MCB, pull out RM, perform the cleaning outside the power room, re-insert and switch on again. Repeat the activity for each RM one by one.",
      "Carefully inspect condition of SMPS back plane and note down if any observations found.",
      "Check BMS connectivity and alarm standardization and testing date.",
      "Check SMPS display time and date are in sync with real time.",
      "Put SMPS-1 & 2 on battery mode for doing battery discharge test for at least 1 hour and keep record of battery cells voltage.",
      "Take all cells voltage reading after every 30 minutes and highlight if any cell voltage drops below the average voltage.",
      "After completion of discharge test, put SMPS into normal mode and monitor & note down charging current.",
      "Verify all parameters in the PM FSR of SMPS-1 & 2, battery discharge reports and documentation done."
    ],

    rollback: [
      " If The first step, if there is some abnormality observed during the maintenance would be to stop the maintenance. ",
      "(1) Interrupt the maintenance and check the SMPS alarm.",
      "(2) Escalate and inform all the stake holders.",
      "(3) Re-schedule the maintenance if required.in case of any issues observed in SMPS-1 while shifting MSC load from SMPS-2 to SMPS-1, activity will be stopped immediately, and load will be restored back on old SMPS.",
    ],

    infra: [
      ["Nxtra CIH", siteConfig?.authorizedBy || "Unknown CIH"],
      ["SIM", siteConfig?.sim || "Unknown SIM"],
      ["O&M Partner", "Vertiv Energy Pvt Ltd"],
      ["Panel AMC Partner", "Alexis Telecom Pvt Ltd"]
    ],

    network: [
      ["Core Team", "Mr. Parthasarathi Dey"],
      ["Transmission Team", "Mr. Pradip Moitra"],
      ["OPS Head", "Mr. Sujit Panday"],
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

  "SMPS Preventive maintenance (In House)": {
    header: {
      title: "SMPS Preventive maintenance (In House) activity MOP",
      docNo: "Nxtra/MOP/SMPS Maintenance/DOC No. 2.12/Rev.00",
      releaseDate: "01-01-2026"
    },

    siteInfo: {
      city: userData?.site || "Unknown City",
      location: `${userData?.site} MSC` || "Unknown MSC",
      floor: row?.floor || "Unknown Floor",
      tier: siteConfig?.siteCategory === "Super Critical" ? "T1/T2" : "T2/T2",
    },

    activityInfo: {
      nature: row?.notes ? row?.notes : "In House PM of SMPS System",
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
      ["Ensure required resources and tools & PPE are available and Healthiness to be ensured at site prior to start of the activity.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure emergency spares for SMPS are available at site.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure no other activity is planned along with PM activity on the same equipment, if any other activity is planned MOP has to be prepared accordingly", "Tick (Yes/No/NA)", "N/A"],
      ["All Input & Output Breaker trip setting & Fuse rating from source to racks level to be ensured to be at 100%. Attach additional Checklist.", "Tick (Yes/No/NA)", "N/A"],
      ["All Input& Output (Till Rack Level) Circuit Breaker (ACB/MCCB/MCB/Fuse) Rating vs loading comparision done (Any breaker loading must not exceed 70% of rated load). Attach additional Checklist.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure to note down temperature of the cable as well by the use of thermal gun and check for any abnormal temperature and Note down all room temperatures of all concerned locations", "Tick (Yes/No/NA)", "N/A"],
      ["All Input & Output cables Rating vs Loading comparision to be done (Loading must not be more than 50% of ots rated Current) Attach additional Checklist.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure Panel Automation status is working fine", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure No open observations from recent PM of UPS & BB, if any these must not impact the uptime in PM activity.", "Tick (Yes/No/NA)", "N/A"],
      ["Site will be on DG, So Health checkup of DG sets and availability of Diesel Stock to be ensured", "Tick (Yes/No/NA)", "N/A"],
      ["LOTO must be done after denergizing the feeders during the activity", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure SA approval for all Single Source Nodes is inplace.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure All Stake holders are informed/Approval is inplace/CRQ is approved", "Tick (Yes/No/NA)", "N/A"]
    ],

    loadDetails: [
      ["SMPS-1", "5000A", row?.floor, "25.6%"],
      ["SMPS-2", "5000A", row?.floor, "25.5%"]
    ],

    risk: [
      "Risk Level 1 - PM of SMPS-1.",
      "Risk Level 1 - PM of SMPS-2.",
    ],

    mitigation: [
      "1. Online PM activity will be carried out along with online discharge test of Battery banks for 1 hour, while carrying out module cleaning, availability of sufficient no of working modules in the SMPS-1 will be ensured.",
      "1. Online PM activity will be carried out along with online discharge test of Battery banks for 1 hour, while carrying out module cleaning, availability of sufficient no of working modules in the SMPS-2 will be ensured.",
    ],

    activitySteps: [
      "Switch ON DG Set and transfer input source of both SMPS to DG power.",
      "Physical inspection any damages, heating, health, hygiene etc of SMPS, Input, Output panel, DCDBs, earth connection and Battery Banks cells etc for both sources.",
      "Check Input voltage/other parameters of SMPS-1 & 2 from display. Check all UPS parameters setting as per golden parameters and as per OEM PM checklist.",
      "Check Input voltage/other parameters of SMPS-1 & 2 physically (through multimeters) and check all parameters such as L-L, L-N, L-E, N-E Voltage & DC Output Voltage.",
      "Check and keep record of load balancing of all three phases. L1: ….Amp, L2: ….Amp and L3: ….Amp.",
      "Check all SMPS display and ensure there should not be any alarms.",
      "Check Input voltage/other parameters of SMPS-1 & 2 from display. Check all SMPS parameters setting as per golden parameters and as per OEM PM checklist.",
      "Clean the SMPS-1 & 2 system externally (online PM).",
      "Inspect all rectifier modules for any kind of abnormality, alarm or indication.",
      "To carry out cleaning of rectifier modules, carefully switch off the respective MCB, pull out RM, perform the cleaning outside the power room, re-insert and switch on again. Repeat the activity for each RM one by one.",
      "Carefully inspect condition of SMPS back plane and note down if any observations found.",
      "Check BMS connectivity and alarm standardization and testing date.",
      "Check SMPS display time and date are in sync with real time.",
      "Put SMPS-1 & 2 on battery mode for doing battery discharge test for at least 1 hour and keep record of battery cells voltage.",
      "Take all cells voltage reading after every 30 minutes and highlight if any cell voltage drops below the average voltage.",
      "After completion of discharge test, put SMPS into normal mode and monitor & note down charging current.",
      "Verify all parameters in the PM FSR of SMPS-1 & 2, battery discharge reports and documentation done."
    ],

    rollback: [
      " If The first step, if there is some abnormality observed during the maintenance would be to stop the maintenance. ",
      "(1) Interrupt the maintenance and check the SMPS alarm.",
      "(2) Escalate and inform all the stake holders.",
      "(3) Re-schedule the maintenance if required.in case of any issues observed in SMPS-1 while shifting MSC load from SMPS-2 to SMPS-1, activity will be stopped immediately, and load will be restored back on old SMPS.",
    ],

    infra: [
      ["Nxtra CIH", siteConfig?.authorizedBy || "Unknown CIH"],
      ["SIM", siteConfig?.sim || "Unknown SIM"],
      ["O&M Partner", "Vertiv Energy Pvt Ltd"],
      ["Panel AMC Partner", "Alexis Telecom Pvt Ltd"]
    ],

    network: [
      ["Core Team", "Mr. Parthasarathi Dey"],
      ["Transmission Team", "Mr. Pradip Moitra"],
      ["OPS Head", "Mr. Sujit Panday"],
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

  "Fault / Alarm / Break Down - SMPS": {
    header: {
      title: "Fault / Alarm / Break Down - SMPS activity MOP",
      docNo: "Nxtra/MOP/SMPS Maintenance/DOC No. 1.13/Rev.00",
      releaseDate: "01-01-2026"
    },

    siteInfo: {
      city: userData?.site || "Unknown City",
      location: `${userData?.site} MSC` || "Unknown MSC",
      floor: row?.floor || "Unknown Floor",
      tier: siteConfig?.siteCategory === "Super Critical" ? "T1/T2" : "T2/T2",
    },

    activityInfo: {
      nature: row?.notes ? row?.notes : "Fault / Alarm / Break Down - SMPS",
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
      ["Site Survey report has to be submitted along with GA drawing and SLD layouts ( Power Connection , Fesibility )", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure New UPS System and other Accessories are delivered at site.", "Tick (Yes/No/NA)", "N/A"],
      ["Is new UPS compatible with existing UPS setup (Eg. Compatible with Iso. Transformer/ 3P 4 Wire or 3P 3 Wire System)", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure Pre energization & testing of UPS is performed by OEM at Sites.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure required resources and tools & PPE are available and Healthiness to be ensured at site prior to start of the activity.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure emergency spares for UPS are available at site.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure recent DR Test has been performed for all the Racks/Nodes  (30 Days)", "Tick (Yes/No/NA)", "N/A"],
      ["All Input & Output Breaker trip setting from source to racks level to be ensured to be at 100%. Attach additional Checklist.", "Tick (Yes/No/NA)", "N/A"],
      ["All Input& Output (Till Rack Level) Circuit Breaker (ACB/MCCB/MCB)Rating vs loading comparision done (Any breaker loading must not exceed 70% of rated load) .Attach additional Checklist.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure to note down temperature of the cable as well by the use of thermal gun and check for any abnormal temperature and Note down all room temperatures of all concerned locations", "Tick (Yes/No/NA)", "N/A"],
      ["All Input & Output cables Rating vs Loading comparision to be done (Loading must not be more than 50% of ots rated Current) Attach additional Checklist.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure online battery discharge/backup test should be carried out before one days for 5 minutes and check all cells voltage. Attach additional Checklist.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure Panel Automation status is working fine", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure No open observations from recent PM of UPS & BB", "Tick (Yes/No/NA)", "N/A"],
      ["Thorough inspection of Isolation Transformers (If applicable) to be done, Rated capacity of Isolation transformer/Check input,output cables ratings, winding and cables temrature.", "Tick (Yes/No/NA)", "N/A"],
      ["Site will be on DG, So Health checkup of DG sets and availability of Diesel Stock to be ensured", "Tick (Yes/No/NA)", "N/A"],
      ["LOTO must be done after denergizing the feeders during the activity", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure SA approval for all Single Source Nodes is inplace", "Tick (Yes/No/NA)", "N/A"],
      ["After disconnection of the power cables, end terminations must be properly insulated before pulling out of the glands/UPS/Panel.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure All Stake holders are informed/Approval is inplace/CRQ is approved", "Tick (Yes/No/NA)", "N/A"]
    ],

    loadDetails: [
      ["SMPS-1", "40 KVA", row?.floor, "25.6%"],
      ["SMPS-2", "40 KVA", row?.floor, "25.5%"]
    ],

    risk: [
      "Risk Level 1 - PM of SMPS-1",
      "Risk Level 2 - PM of SMPS-2"
    ],

    mitigation: [
      "Transfer load of SMPS-1 to maintenance bypass and DG source",
      "Transfer load of SMPS-2 to maintenance bypass and DG source"
    ],

    activitySteps: [
      "Switch ON DG Set and transfer site load on DG power.",
      "Ensure NO alarm on any infra equipments ( UPS /SMPS/PAC etc).",
      "Ensure all the loads are transferred to DG and check the UPS display status.",
      "Ensure all the loads are transferred to DG and inform all concerned users.",
      "Check all ACDBs connected with UPS-1.",
      "Remove faulty Static/Inverter/Charger module from UPS (OEM authorised engineer will do rectification work only).",
      "Insert new module in UPS and do configuration by OEM engineer.",
      "OEM engineer will confirm the UPS normal status.",
      "Then transfer the Data Centre load from DG to EB.",
      "Verify all parameters of UPS-2 and documentation done."
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

    network: [
      ["Core Team", "Mr. Parthasarathi Dey"],
      ["Transmission Team", "Mr. Pradip Moitra"],
      ["OPS Head", "Mr. Sujit Panday"],
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

  "Battery Bank Online Discharge Test(In-House)": {
    header: {
      title: "Battery Bank Online Discharge Test(In-House) activity MOP",
      docNo: "Nxtra/MOP/BB Maintenance/DOC No. 4.11/Rev.00",
      releaseDate: "01-01-2026"
    },

    siteInfo: {
      city: userData?.site || "Unknown City",
      location: `${userData?.site} MSC` || "Unknown MSC",
      floor: row?.floor || "Unknown Floor",
      tier: siteConfig?.siteCategory === "Super Critical" ? "T1/T2" : "T2/T2",
    },

    activityInfo: {
      nature: row?.notes ? row?.notes : "In House PM of SMPS Battery Bank Online Discharge Test",
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
      ["Check the all approvals and CR available on before starting the activity", "Tick (Yes/No/NA)", "Yes"],
      ["Check the check list availability of the OEM PM on before starting the activity", "Tick (Yes/No/NA)", "Yes"],
      ["Check the Spare Battery on before starting the activity, if any cell faulty immediately to be replaced", "Tick (Yes/No/NA)", "No"],
      ["Ensure required resources and tools & PPE are available and Healthiness to be ensured at site prior to start of the activity.", "Tick (Yes/No/NA)", "Yes"],
      ["Ensure emergency spares for Battery Bank are available at site.", "Tick (Yes/No/NA)", "No"],
      ["Check the redundent Battery should have 15-30 munites back up with compare to the site load", "Tick (Yes/No/NA)", "No"],
      ["Ensure Panel Automation status is working fine", "Tick (Yes/No/NA)", "Yes"],
      ["Ensure No open observations from recent PM of Battery Bank & BB", "Tick (Yes/No/NA)", "Yes"],
      ["Site will be on DG, So Health checkup of DG sets and availability of Diesel Stock to be ensured", "Tick (Yes/No/NA)", "Yes"],
      ["LOTO must be done after denergizing the feeders during the activity", "Tick (Yes/No/NA)", "Yes"],
      ["After disconnection of the power cables, end terminations must be properly insulated before pulling out of the glands/Battery Bank/Panel.", "Tick (Yes/No/NA)", "Yes"],
      ["Ensure All Stake holders are informed/Approval is inplace/CRQ is approved", "Tick (Yes/No/NA)", "Yes"]
    ],

    loadDetails: [
      ["SMPS-1", "5000A", row?.floor, "25.6%"],
      ["SMPS-2", "5000A", row?.floor, "25.5%"]
    ],

    risk: [
      "Risk Level 1 - PM of SMPS-1.",
      "Risk Level 1 - PM of SMPS-2.",
    ],

    mitigation: [
      "1. Online PM activity will be carried out along with online discharge test of Battery banks for 1 hour, while carrying out module cleaning, availability of sufficient no of working modules in the SMPS-1 will be ensured.",
      "1. Online PM activity will be carried out along with online discharge test of Battery banks for 1 hour, while carrying out module cleaning, availability of sufficient no of working modules in the SMPS-2 will be ensured.",
    ],

    activitySteps: [
      "Switch ON DG Set and transfer input source of both Battery Bank to DG power.",
      "Physical inspection for any damages, health, hygiene etc of Battery Bank.",
      "Make the set point of Battery Bank test mode and set discharge voltage to 47.5 VDC / 15 minutes and start doing the discharge test with existing IT load.",
      "Check input voltage/other parameters of Battery Bank-1 physically (through multimeters) and check all parameters such as input voltage and each cell voltage in the PM format.",
      "Check and keep record of discharging voltage every 5 minutes and keep discharge till 1.97 (47.5/24 cells).",
      "Check all the cells voltage; if stable or >1.75V then consider all cells OK, if any cell falls <1.75VDC, then cell to be replaced on immediate basis.",
      "Record all observations and report timely to Circle Incharge for immediate support of cell faulty cases for replacement.",
      "Verify all parameters of Battery Bank-1 and ensure documentation is done."
    ],

    rollback: [
      " If The first step, if there is some abnormality observed during the maintenance would be to stop the maintenance. ",
      "(1) Interrupt the maintenance and check the SMPS alarm.",
      "(2) Escalate and inform all the stake holders.",
      "(3) Re-schedule the maintenance if required.in case of any issues observed in SMPS-1 while shifting MSC load from SMPS-2 to SMPS-1, activity will be stopped immediately, and load will be restored back on old SMPS.",
    ],

    infra: [
      ["Nxtra CIH", siteConfig?.authorizedBy || "Unknown CIH"],
      ["SIM", siteConfig?.sim || "Unknown SIM"],
      ["O&M Partner", "Vertiv Energy Pvt Ltd"],
      ["Panel AMC Partner", "Alexis Telecom Pvt Ltd"]
    ],

    network: [
      ["Core Team", "Mr. Parthasarathi Dey"],
      ["Transmission Team", "Mr. Pradip Moitra"],
      ["OPS Head", "Mr. Sujit Panday"],
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

  "SMPS BB EOL Replacement/Upgradation": {
    header: {
      title: "SMPS BB EOL Replacement/Upgradation activity MOP",
      docNo: "Nxtra/MOP/BB Replacement/DOC No. 4.10/Rev.00",
      releaseDate: "01-01-2026"
    },

    siteInfo: {
      city: userData?.site || "Unknown City",
      location: `${userData?.site} MSC` || "Unknown MSC",
      floor: row?.floor || "Unknown Floor",
      tier: siteConfig?.siteCategory === "Super Critical" ? "T1/T2" : "T2/T2",
    },

    activityInfo: {
      nature: row?.notes ? row?.notes : "Replacement/Upgradation of Battery Bank System",
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
      ["Check the all approvals and CR available on before starting the activity", "Tick(Yes/No/NA)", "N/A"],
      ["Site Survey report has to be submitted along with GA drawing and SLD layouts (Space , Feasibility )", "Tick(Yes/No/NA)", "N/A"],
      ["Ensure New Battery Bank System and other Accessories are delivered at site.", "Tick(Yes/No/NA)", "N/A"],
      ["Is new Battery Bank compatible with existing Battery Bank setup (Eg. Compatible with Design & Space for installation", "Tick(Yes/No/NA)", "N/A"],
      ["Ensure Pre check of Battery Bank is performed by OEM at Site.", "Tick(Yes/No/NA)", "N/A"],
      ["Ensure required resources and insulated tools & PPE are available and Healthiness to be ensured at site prior to start of the activity.", "Tick(Yes/No/NA)", "Yes"],
      ["Ensure emergency spares for Battery Bank are available at site.", "Tick(Yes/No/NA)", "N/A"],
      ["Check the New Battery defective if any found", "Tick(Yes/No/NA)", "No"],
      ["Backup analysis to be done and ensure BB connected should be capable of taking load in case load shifts on battery during activity", "Tick(Yes/No/NA)", "Yes"],
      ["All Input& Output (Till Rack Level) Circuit Breaker (ACB/MCCB/MCB)Rating vs loading comparision done (Any breaker loading must not exceed 70% of rated load) .Attach additional Checklist.", "Tick(Yes/No/NA)", "Yes"],
      ["All Input & Output Breaker trip setting from source to racks level to be ensured to be at 100%. Attach additional Checklist.", "Tick(Yes/No/NA)", "Yes"],
      ["All Input & Output cables Rating vs Loading comparision to be done (Loading must not be more than 50% of ots rated Current) Attach additional Checklist.", "Tick(Yes/No/NA)", "Yes"],
      ["Ensure to check health of battery banks which will remain connected with SMPS during activity", "Tick(Yes/No/NA)", "Yes"],
      ["Release gas through the vent plug and get ready for the activity", "Tick(Yes/No/NA)", "Yes"],
      ["Ensure Panel Automation status is working fine", "Tick(Yes/No/NA)", "Yes"],
      ["Ensure No open observations from recent PM of SMPS & BB", "Tick(Yes/No/NA)", "Yes"],
      ["Thorough inspection of Isolation Transformers (If applicable) to be done, Rated capacity of Isolation transformer/Check input,output cables ratings, winding and cables temrature. ", "Tick(Yes/No/NA)", "Yes"],
      ["Site will be on DG, So Health checkup of DG sets and availability of Diesel Stock to be ensured", "Tick(Yes/No/NA)", "Yes"],
      ["LOTO must be done after denergizing the feeders during the activity", "Tick(Yes/No/NA)", "Yes"],
      ["Ensure SA approval for all Single Source Nodes is inplace ", "Tick(Yes/No/NA)", "Yes"],
      ["After disconnection of the power cables, end terminations must be properly insulated before pulling out of the glands/UPS/Panel.", "Tick(Yes/No/NA)", "N/A"],
      ["Ensure All Stake holders are informed/Approval is inplace/CRQ is approvedStakeholder approval & CRQ done", "Tick(Yes/No/NA)", "Yes"]
    ],

    loadDetails: [
      ["Battery Bank-1", "64AH 400V", row?.floor, "15.6%"],
      ["Battery Bank-2", "65AH 400V", row?.floor, "15.5%"],
      ["Battery Bank-3", "65AH 400V", row?.floor, "15.5%"],
      ["Battery Bank-4", "65AH 400V", row?.floor, "15.5%"]
    ],

    risk: [
      "Risk Level 1 - SMPS will be connected with single battery bank",
      "Risk Level 2 – Transfer of MSC load from Battery Bank-2 to Battery Bank-1 while replacement of existing Battery Bank-2 with new Battery Bank work will be carried out.",
      "Risk Level 3 –  Re-transfer of MSC load on new Battery Bank-2 from Battery Bank 1 after completion of replacement work and testing."
    ],

    mitigation: [
      "1. Transfer of load from Battery Bank-2 to Battery Bank-1 will be done gradually to ensure seamless transfer from one source to other source. Also prior change Battery on DG mode only for UPS or SMPS system.",
      "2. After shifting of MSC load from Battery Bank-2 to Battery Bank-1, Entire the total load Will be run on Battery Bank-1 should be below 70% capacity",
      "3. Retransfer of MSC Source A from Battery Bank-1 to Battery Bank-2 will be done gradually to ensure seamless transfer."
    ],

    activitySteps: [
      "Switch ON DG Set and transfer site load on DG power.",
      "Ensure NO alarm on any infra equipment's ( Battery Bank /SMPS/PAC etc)",
      "After shifting all load power Now check Battery Bank-2 O/P Current at zero level and ensure that No load are connected on Battery Bank -2",
      "Switch OFF outgoing breakers in Battery Bank 2 in the SMPS one by one.",
      "Ensure the entire MSC load is transferred on Battery Bank 1 and check all parameters.",
      "Shut down Battery Bank-2.",
      "Switch OFF the input source to Battery Bank-2and apply LOTO",
      "Disconnect the cable terminations in Battery Bank-2 and remove the cables.",
      "Dismantle and remove old Battery Bank-2",
      "Carry out required modifications in the base frame to suit new Battery Bank.",
      "Positioning of new Battery Bank on the base frame and complete the installation.",
      "Double Cross check bolt nut tightness & Connect the input, output and Battery Bank cables in the new Battery Bank.",
      "Release LOTO and Switch ON the input power to new Battery Bank-2.and check all parameters Ex Correct Polarity, voltage.",
      "Testing and commissioning of the new Battery Bank. Check all setting of parameters in SMPS  charging voltage/current.",
      "Verify all parameters in the new Battery Bank current & if any Abnormalities.",
      "Switch on the Battery Breaker/Fuse in the SMPS system, Test the Battery Bank shifting load on battery mode.",
      "Take post activity services confirmation from all active equipment stake holders and close the activity."
    ],

    rollback: [
      "If in case of any issues observed in any of the Battery Bank while shifting  load from Battery Bank-2 to Battery Bank-1, activity will be stopped immediately, and load will be restored back on old Battery Bank.",
    ],

    infra: [
      ["Nxtra CIH", siteConfig?.authorizedBy || "Unknown CIH"],
      ["SIM", siteConfig?.sim || "Unknown SIM"],
      ["O&M Partner", "Vertiv Energy Pvt Ltd"],
      ["Panel AMC Partner", "Alexis Telecom Pvt Ltd"]
    ],

    network: [
      ["Core Team", "Mr. Parthasarathi Dey"],
      ["Transmission Team", "Mr. Pradip Moitra"],
      ["OPS Head", "Mr. Sujit Panday"],
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
      ["SMPS spares (fuse, fan)", "XX", "YY", "NA"],
      ["Any other …...", "XX", "YY", "NA"]
    ],

    approval: {
      createdBy: siteConfig?.omName || "Unknown Creator",
      reviewer: `${siteConfig?.preparedBy || "Unknown Review By"} / Mr. Amit Kumar Mondal`,
      approver: siteConfig?.authorizedBy || "Unknown Approver",
      crNumber: row?.crqNo || "To Be Raised"
    }
  },

  "SMPS BB Preventive Maintenance(OEM)": {
    header: {
      title: "SMPS BB Preventive Maintenance(OEM) activity MOP",
      docNo: "Nxtra/MOP/BB Maintenance/DOC No. 4.11/Rev.00",
      releaseDate: "01-01-2026"
    },

    siteInfo: {
      city: userData?.site || "Unknown City",
      location: `${userData?.site} MSC` || "Unknown MSC",
      floor: row?.floor || "Unknown Floor",
      tier: siteConfig?.siteCategory === "Super Critical" ? "T1/T2" : "T2/T2",
    },

    activityInfo: {
      nature: row?.notes ? row?.notes : "OEM PM of Battery Bank System",
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
      ["Check the all approvals and CR available on before starting the activity", "Tick (Yes/No/NA)", "N/A"],
      ["Check the check list availability of the OEM PM on before starting the activity", "Tick (Yes/No/NA)", "N/A"],
      ["Check the Spare Battery on before starting the activity, if any cell faulty immediately to be replaced", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure required resources and tools & PPE are available and Healthiness to be ensured at site prior to start of the activity.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure emergency spares for Battery Bank are available at site.", "Tick (Yes/No/NA)", "N/A"],
      ["Check the redundent Battery should have 15-30 munites back up with compare to the site load", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure Panel Automation status is working fine", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure No open observations from recent PM of Battery Bank & BB", "Tick (Yes/No/NA)", "N/A"],
      ["Site will be on DG, So Health checkup of DG sets and availability of Diesel Stock to be ensured", "Tick (Yes/No/NA)", "N/A"],
      ["LOTO must be done after denergizing the feeders during the activity", "Tick (Yes/No/NA)", "N/A"],
      ["After disconnection of the power cables, end terminations must be properly insulated before pulling out of the glands/Battery Bank/Panel.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure All Stake holders are informed/Approval is inplace/CRQ is approved", "Tick (Yes/No/NA)", "N/A"]
    ],

    loadDetails: [
      ["Battery Bank-1", "64AH 400V", row?.floor, "15.6%"],
      ["Battery Bank-2", "65AH 400V", row?.floor, "15.5%"],
      ["Battery Bank-3", "65AH 400V", row?.floor, "15.5%"],
      ["Battery Bank-4", "65AH 400V", row?.floor, "15.5%"]
    ],

    risk: [
      "Risk Level 1 - PM of Battery Bank-1",
      "Risk Level 2 – PM of Battery Bank 2",
      "Risk Level 3 – PM of Battery Bank 3",
      "Risk Level 4 – PM of Battery Bank 4",
    ],

    mitigation: [
      "1. Transfer of load from Battery Bank-1 to Battery Bank-2 and power will be shifted on DG Source.",
      "2. Transfer of load from Battery Bank-2 to Battery Bank-1 and power will be shifted on DG Source.",
    ],

    activitySteps: [
      "Switch ON DG Set and transfer input source of both Battery Bank to DG power.",
      "Physical inspection any damages, health, hygiene etc of Battery Bank.",
      "Make the set point of Battery Bank test mode and of voltage set of discharge should be fix 47.5 VDC/15 munites discharge and start doing the discharge test with existing IT load",
      "Check Input voltage/other parameters of Battery Bank-1 physically (through multimeters) and check all parameters such as Input voltage, each cell voltage in the PM format.",
      "Check and keep recod of discharging Voltage and every 5 minutes and keep discharge till 1.97 (47.5/24 cells)",
      "Check all the cells voltage stable or >1.75V volts then consider all Cells or Ok, if any cells falls <1.75VDC, then cell to be replaced on immediate basis",
      "All observaions to be recorded and timely report to Circle Incharge for immediate support of cell faulty cases for replacement",
      "Verify all parameters of Battery Bank-1 and documentation done."
    ],

    rollback: [
      "The first step, if there is some abnormality observed during the maintenance would be to stop the maintenance.",
      "(1) Interrupt the maintenance and check the Battery Bank alarm.",
      "(2) Escalate and inform all the stake holders.",
      "(3) Re-schedule the maintenance if required."
    ],

    infra: [
      ["Nxtra CIH", siteConfig?.authorizedBy || "Unknown CIH"],
      ["SIM", siteConfig?.sim || "Unknown SIM"],
      ["O&M Partner", "Vertiv Energy Pvt Ltd"],
      ["Panel AMC Partner", "Alexis Telecom Pvt Ltd"]
    ],

    network: [
      ["Core Team", "Mr. Parthasarathi Dey"],
      ["Transmission Team", "Mr. Pradip Moitra"],
      ["OPS Head", "Mr. Sujit Panday"],
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
      ["SMPS spares (fuse, fan)", "XX", "YY", "NA"],
      ["Any other …...", "XX", "YY", "NA"]
    ],

    approval: {
      createdBy: siteConfig?.omName || "Unknown Creator",
      reviewer: `${siteConfig?.preparedBy || "Unknown Review By"} / Mr. Amit Kumar Mondal`,
      approver: siteConfig?.authorizedBy || "Unknown Approver",
      crNumber: row?.crqNo || "To Be Raised"
    }
  },

  "SMPS BB Preventive Maintenance(In-House)": {
    header: {
      title: "SMPS BB Preventive Maintenance(In-House) activity MOP",
      docNo: "Nxtra/MOP/BB Maintenance/DOC No. 4.11/Rev.00",
      releaseDate: "01-01-2026"
    },

    siteInfo: {
      city: userData?.site || "Unknown City",
      location: `${userData?.site} MSC` || "Unknown MSC",
      floor: row?.floor || "Unknown Floor",
      tier: siteConfig?.siteCategory === "Super Critical" ? "T1/T2" : "T2/T2",
    },

    activityInfo: {
      nature: row?.notes ? row?.notes : "In-House PM of Battery Bank System",
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
      ["Check the all approvals and CR available on before starting the activity", "Tick (Yes/No/NA)", "N/A"],
      ["Check the check list availability of the OEM PM on before starting the activity", "Tick (Yes/No/NA)", "N/A"],
      ["Check the Spare Battery on before starting the activity, if any cell faulty immediately to be replaced", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure required resources and tools & PPE are available and Healthiness to be ensured at site prior to start of the activity.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure emergency spares for Battery Bank are available at site.", "Tick (Yes/No/NA)", "N/A"],
      ["Check the redundent Battery should have 15-30 munites back up with compare to the site load", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure Panel Automation status is working fine", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure No open observations from recent PM of Battery Bank & BB", "Tick (Yes/No/NA)", "N/A"],
      ["Site will be on DG, So Health checkup of DG sets and availability of Diesel Stock to be ensured", "Tick (Yes/No/NA)", "N/A"],
      ["LOTO must be done after denergizing the feeders during the activity", "Tick (Yes/No/NA)", "N/A"],
      ["After disconnection of the power cables, end terminations must be properly insulated before pulling out of the glands/Battery Bank/Panel.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure All Stake holders are informed/Approval is inplace/CRQ is approved", "Tick (Yes/No/NA)", "N/A"]
    ],

    loadDetails: [
      ["Battery Bank-1", "64AH 400V", row?.floor, "15.6%"],
      ["Battery Bank-2", "65AH 400V", row?.floor, "15.5%"],
      ["Battery Bank-3", "65AH 400V", row?.floor, "15.5%"],
      ["Battery Bank-4", "65AH 400V", row?.floor, "15.5%"]
    ],

    risk: [
      "Risk Level 1 - PM of Battery Bank-1",
      "Risk Level 2 – PM of Battery Bank 2",
      "Risk Level 3 – PM of Battery Bank 3",
      "Risk Level 4 – PM of Battery Bank 4",
    ],

    mitigation: [
      "1. Transfer of load from Battery Bank-1 to Battery Bank-2 and power will be shifted on DG Source.",
      "2. Transfer of load from Battery Bank-2 to Battery Bank-1 and power will be shifted on DG Source.",
    ],

    activitySteps: [
      "Switch ON DG Set and transfer input source of both Battery Bank to DG power.",
      "Physical inspection any damages, health, hygiene etc of Battery Bank.",
      "Make the set point of Battery Bank test mode and of voltage set of discharge should be fix 47.5 VDC/15 munites discharge and start doing the discharge test with existing IT load",
      "Check Input voltage/other parameters of Battery Bank-1 physically (through multimeters) and check all parameters such as Input voltage, each cell voltage in the PM format.",
      "Check and keep recod of discharging Voltage and every 5 minutes and keep discharge till 1.97 (47.5/24 cells)",
      "Check all the cells voltage stable or >1.75V volts then consider all Cells or Ok, if any cells falls <1.75VDC, then cell to be replaced on immediate basis",
      "All observaions to be recorded and timely report to Circle Incharge for immediate support of cell faulty cases for replacement",
      "Verify all parameters of Battery Bank-1 and documentation done."
    ],

    rollback: [
      "The first step, if there is some abnormality observed during the maintenance would be to stop the maintenance.",
      "(1) Interrupt the maintenance and check the Battery Bank alarm.",
      "(2) Escalate and inform all the stake holders.",
      "(3) Re-schedule the maintenance if required."
    ],

    infra: [
      ["Nxtra CIH", siteConfig?.authorizedBy || "Unknown CIH"],
      ["SIM", siteConfig?.sim || "Unknown SIM"],
      ["O&M Partner", "Vertiv Energy Pvt Ltd"],
      ["Panel AMC Partner", "Alexis Telecom Pvt Ltd"]
    ],

    network: [
      ["Core Team", "Mr. Parthasarathi Dey"],
      ["Transmission Team", "Mr. Pradip Moitra"],
      ["OPS Head", "Mr. Sujit Panday"],
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
      ["SMPS spares (fuse, fan)", "XX", "YY", "NA"],
      ["Any other …...", "XX", "YY", "NA"]
    ],

    approval: {
      createdBy: siteConfig?.omName || "Unknown Creator",
      reviewer: `${siteConfig?.preparedBy || "Unknown Review By"} / Mr. Amit Kumar Mondal`,
      approver: siteConfig?.authorizedBy || "Unknown Approver",
      crNumber: row?.crqNo || "To Be Raised"
    }
  },

  "SMPS BB Cell Replacement": {
    header: {
      title: "SMPS BB Cell Replacement activity MOP",
      docNo: "Nxtra/MOP/BB Replacement/DOC No. 4.13/Rev.00",
      releaseDate: "01-01-2026"
    },

    siteInfo: {
      city: userData?.site || "Unknown City",
      location: `${userData?.site} MSC` || "Unknown MSC",
      floor: row?.floor || "Unknown Floor",
      tier: siteConfig?.siteCategory === "Super Critical" ? "T1/T2" : "T2/T2",
    },

    activityInfo: {
      nature: row?.notes ? row?.notes : "Replacement/Upgradation of Battery Bank System",
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
      ["Check the all approvals and CR available on before starting the activity", "Tick (Yes/No/NA)", "N/A"],
      ["Site Survey report has to be submitted along with GA drawing and SLD layouts (Space , Fesibility )", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure New Battery Bank System and other Accessories are delivered at site.", "Tick (Yes/No/NA)", "N/A"],
      ["Is new Battery Bank compatible with existing Battery Bank setup (Eg. Compatible with Design & Space for installation", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure Pre check of Battery Bank is performed by OEM at Site.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure required resources and tools & PPE are available and Healthiness to be ensured at site prior to start of the activity.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure emergency spares for Battery Bank are available at site.", "Tick (Yes/No/NA)", "N/A"],
      ["Check the New Battery defective if any found", "Tick (Yes/No/NA)", "N/A"],
      ["Release gas through the vent plug and get ready for the activity", "Tick (Yes/No/NA)", "N/A"],
      ["Site will be on DG, So Health checkup of DG sets and availability of Diesel Stock to be ensured", "Tick (Yes/No/NA)", "N/A"],
      ["LOTO must be done after denergizing the SMPS Battery supply during the activity", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure All Stake holders are informed/Approval is inplace/CRQ is approved", "Tick (Yes/No/NA)", "N/A"]
    ],

    loadDetails: [
      ["Battery Bank-1", "64AH 400V", row?.floor, "15.6%"],
      ["Battery Bank-2", "65AH 400V", row?.floor, "15.5%"],
      ["Battery Bank-3", "65AH 400V", row?.floor, "15.5%"],
      ["Battery Bank-4", "65AH 400V", row?.floor, "15.5%"]
    ],

    risk: [
      "Risk Level 1 - PM of Battery Bank-1",
      "Risk Level 2 – PM of Battery Bank 2",
      "Risk Level 3 – PM of Battery Bank 3",
      "Risk Level 4 – PM of Battery Bank 4",
    ],

    mitigation: [
      "1. Transfer of load from Battery Bank-1 to Battery Bank-2 and power will be shifted on DG Source.",
      "2. Transfer of load from Battery Bank-2 to Battery Bank-1 and power will be shifted on DG Source.",
    ],

    activitySteps: [
      "Switch ON DG Set and transfer site load on DG power.",
      "Ensure NO alarm on any infra equipments ( Battery Bank /SMPS/PAC etc)",
      "After shifting all load power Now check Battery Bank-2 O/P Current at zero level and ensure that No load are connected on Battery Bank -2",
      "Switch OFF outgoing breakers in Battery Bank 2 in the SMPS one by one.",
      "Ensure the entire MSC load is transferred on Battery Bank 1 and check all parameters.",
      "Shut down Battery Bank-2.",
      "Switch OFF the input source to Battery Bank-2 and apply LOTO",
      "Disconnect the cable terminations in Battery Bank-2 and remove the cables.",
      "Dismantle and remove old Battery Bank-2",
      "Carry out required modifications in the base frame to suit new Battery Bank.",
      "Positioning of new Battery Bank on the base frame and complete the installation.",
      "Double Cross check bolt nut tightness & Connect the input, output and Battery Bank cables in the new Battery Bank.",
      "Release LOTO and Switch ON the input power to new Battery Bank-2 and check all parameters Ex Correct Polarity,voltage.",
      "Testing and commissioning of the new Battery Bank. Check all setting of parameters in SMPS charging voltage/current.",
      "Verify all parameters in the new Battery Bank current & if any Abnormalities.",
      "Switch on the Battery Breaker/Fuse in the SMPS system, Test the Battery Bank shifting load on battery mode.",
      "Take post activity services confirmation from all active equipment stake holders and close the activity."
    ],

    rollback: [
      "The first step, if there is some abnormality observed during the maintenance would be to stop the maintenance.",
      "(1) Interrupt the maintenance and check the Battery Bank alarm.",
      "(2) Escalate and inform all the stake holders.",
      "(3) Re-schedule the maintenance if required."
    ],

    infra: [
      ["Nxtra CIH", siteConfig?.authorizedBy || "Unknown CIH"],
      ["SIM", siteConfig?.sim || "Unknown SIM"],
      ["O&M Partner", "Vertiv Energy Pvt Ltd"],
      ["Panel AMC Partner", "Alexis Telecom Pvt Ltd"]
    ],

    network: [
      ["Core Team", "Mr. Parthasarathi Dey"],
      ["Transmission Team", "Mr. Pradip Moitra"],
      ["OPS Head", "Mr. Sujit Panday"],
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
      ["SMPS spares (fuse, fan)", "XX", "YY", "NA"],
      ["Any other …...", "XX", "YY", "NA"]
    ],

    approval: {
      createdBy: siteConfig?.omName || "Unknown Creator",
      reviewer: `${siteConfig?.preparedBy || "Unknown Review By"} / Mr. Amit Kumar Mondal`,
      approver: siteConfig?.authorizedBy || "Unknown Approver",
      crNumber: row?.crqNo || "To Be Raised"
    }
  },

  "Battery Bank Discharge test C-10(In-House)": {
    header: {
      title: "SMPS Battery Bank Discharge test C-10(In-House) activity MOP",
      docNo: "Nxtra/MOP/BB Maintenance/DOC No. 4.11/Rev.00",
      releaseDate: "01-01-2026"
    },

    siteInfo: {
      city: userData?.site || "Unknown City",
      location: `${userData?.site} MSC` || "Unknown MSC",
      floor: row?.floor || "Unknown Floor",
      tier: siteConfig?.siteCategory === "Super Critical" ? "T1/T2" : "T2/T2",
    },

    activityInfo: {
      nature: row?.notes ? row?.notes : "Discharge test C-10(In-House) of Battery Bank System",
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
      ["Check the all approvals and CR available on before starting the activity", "Tick (Yes/No/NA)", "N/A"],
      ["Check the check list availability of the OEM PM on before starting the activity", "Tick (Yes/No/NA)", "N/A"],
      ["Check the Spare Battery on before starting the activity, if any cell faulty immediately to be replaced", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure required resources and tools & PPE are available and Healthiness to be ensured at site prior to start of the activity.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure emergency spares for Battery Bank are available at site.", "Tick (Yes/No/NA)", "N/A"],
      ["Check the redundent Battery should have 15-30 munites back up with compare to the site load", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure Panel Automation status is working fine", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure No open observations from recent PM of Battery Bank & BB", "Tick (Yes/No/NA)", "N/A"],
      ["Site will be on DG, So Health checkup of DG sets and availability of Diesel Stock to be ensured", "Tick (Yes/No/NA)", "N/A"],
      ["LOTO must be done after denergizing the feeders during the activity", "Tick (Yes/No/NA)", "N/A"],
      ["After disconnection of the power cables, end terminations must be properly insulated before pulling out of the glands/Battery Bank/Panel.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure All Stake holders are informed/Approval is inplace/CRQ is approved", "Tick (Yes/No/NA)", "N/A"]
    ],

    loadDetails: [
      ["Battery Bank-1", "64AH 400V", row?.floor, "15.6%"],
      ["Battery Bank-2", "65AH 400V", row?.floor, "15.5%"],
      ["Battery Bank-3", "65AH 400V", row?.floor, "15.5%"],
      ["Battery Bank-4", "65AH 400V", row?.floor, "15.5%"]
    ],

    risk: [
      "Risk Level 1 - PM of Battery Bank-1",
      "Risk Level 2 – PM of Battery Bank 2",
      "Risk Level 3 – PM of Battery Bank 3",
      "Risk Level 4 – PM of Battery Bank 4",
    ],

    mitigation: [
      "1. Transfer of load from Battery Bank-1 to Battery Bank-2 and power will be shifted on DG Source.",
      "2. Transfer of load from Battery Bank-2 to Battery Bank-1 and power will be shifted on DG Source.",
    ],

    activitySteps: [
      "Switch ON DG Set and transfer input source of both Battery Bank to DG power.",
      "Physical inspection any damages, health, hygiene etc of Battery Bank.",
      "Make the set point of Battery Bank test mode and of voltage set of discharge should be fix 47.5 VDC/15 munites discharge and start doing the discharge test with existing IT load",
      "Check Input voltage/other parameters of Battery Bank-1 physically (through multimeters) and check all parameters such as Input voltage, each cell voltage in the PM format.",
      "Check and keep recod of discharging Voltage and every 5 minutes and keep discharge till 1.97 (47.5/24 cells)",
      "Check all the cells voltage stable or >1.75V volts then consider all Cells or Ok, if any cells falls <1.75VDC, then cell to be replaced on immediate basis",
      "All observaions to be recorded and timely report to Circle Incharge for immediate support of cell faulty cases for replacement",
      "Verify all parameters of Battery Bank-1 and documentation done."
    ],

    rollback: [
      "The first step, if there is some abnormality observed during the maintenance would be to stop the maintenance.",
      "(1) Interrupt the maintenance and check the Battery Bank alarm.",
      "(2) Escalate and inform all the stake holders.",
      "(3) Re-schedule the maintenance if required."
    ],

    infra: [
      ["Nxtra CIH", siteConfig?.authorizedBy || "Unknown CIH"],
      ["SIM", siteConfig?.sim || "Unknown SIM"],
      ["O&M Partner", "Vertiv Energy Pvt Ltd"],
      ["Panel AMC Partner", "Alexis Telecom Pvt Ltd"]
    ],

    network: [
      ["Core Team", "Mr. Parthasarathi Dey"],
      ["Transmission Team", "Mr. Pradip Moitra"],
      ["OPS Head", "Mr. Sujit Panday"],
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
      ["SMPS spares (fuse, fan)", "XX", "YY", "NA"],
      ["Any other …...", "XX", "YY", "NA"]
    ],

    approval: {
      createdBy: siteConfig?.omName || "Unknown Creator",
      reviewer: `${siteConfig?.preparedBy || "Unknown Review By"} / Mr. Amit Kumar Mondal`,
      approver: siteConfig?.authorizedBy || "Unknown Approver",
      crNumber: row?.crqNo || "To Be Raised"
    }
  },

  "DG Set Replacement activity": {
    header: {
      title: "DG Set Replacement activity MOP",
      docNo: "Nxtra/MOP/DG Replacement/DOC No. 6.1/Rev.00",
      releaseDate: "01-01-2026"
    },

    siteInfo: {
      city: userData?.site || "Unknown City",
      location: `${userData?.site} MSC` || "Unknown MSC",
      floor: row?.floor || "Unknown Floor",
      tier: siteConfig?.siteCategory === "Super Critical" ? "T1/T2" : "T2/T2",
    },

    activityInfo: {
      nature: row?.notes ? row?.notes : "EOL Replacement/Upgradation of DG (Diesel Generator)",
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
      ["Site Survey report has to be submitted along with GA drawing and SLD layouts ( Rating, specifications, Design, Footprint area, fuel type, Power Connection , Feasibility )", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure new DG set to be planned in compliance with latest CPCB/NGT norms. Dual Fuel operated/RECD fitted/CPCB-4 complaint DG sets to be considered.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure New DG Sets and other Accessories are delivered at site.", "Tick (Yes/No/NA)", "N/A"],
      ["Is new DG Set compatible with existing DG setup (E.g. installation space requirements, fresh air inlet and hot air exhaust, fuel piping, exhaust pipe connections, power and control cables connectivity etc)", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure DG set is dispatched from factory after pre inspection, factory testing and along with relevant test certificates.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure complete scope of low side works has been prepared according to the project requirements (installation at new location/replacement at same location/connectivity with existing setup or complete new setup installation.)", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure required resources and tools & PPE are available and Healthiness to be ensured at site prior to start of the activity.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure emergency spares for DG sets are available at site.", "Tick (Yes/No/NA)", "N/A"],
      ["All Input & Output Breaker trip setting including Mains Incomers, DG incomers, Tie/Bus coupler breakers to be ensured to be at 100%. Attach additional Checklist.", "Tick (Yes/No/NA)", "N/A"],
      ["All Input & Output Breaker rating vs loading comparison including Mains Incomers, DG incomers, Tie/Bus coupler breakers has been done. Loading must not exceed 70%. Attach additional Checklist.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure complete thermography of the all DG Sync panels, changeover panels, isolator panels, LT panels has been done including cables, terminals, breakers etc and check for any abnormal temperature and rectify prior to the main activity.", "Tick (Yes/No/NA)", "N/A"],
      ["All Input & Output cables Rating vs Loading comparison to be done (Loading must not be more than 50% of o/p rated Current) Attach additional Checklist.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure Panel Automation status is working fine", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure Panel operation logic chart available as per site infra", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure tie breaker rating, settings, electrical interlocking & loading", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure No open observations from recent PM of LT panel", "Tick (Yes/No/NA)", "N/A"],
      ["Conduct EHS risk assessment to Identify potential risks associated with the replacement process and develop contingency plans to mitigate risks and minimize downtime.", "Tick (Yes/No/NA)", "N/A"],
      ["Site will run on mains and DG supply , So Health checkup of transformers ,DG sets and availability of Diesel Stock to be ensured", "Tick (Yes/No/NA)", "N/A"],
      ["LOTO must be done after deenergizing the feeders during the activity", "Tick (Yes/No/NA)", "N/A"],
      ["After disconnection of the power cables, end terminations must be properly insulated before pulling out of the glands/LT panel/Panel.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure All Stake holders are informed/Approval is in place/CRQ is approved", "Tick (Yes/No/NA)", "N/A"]
    ],

    loadDetails: [
      ["DG-1", siteConfig?.dgCapacity?.["DG-1"], row?.floor, "15.6%"],
      ["DG-2", siteConfig?.dgCapacity?.["DG-2"], row?.floor, "15.5%"],
      ["DG-3", siteConfig?.dgCapacity?.["DG-3"], row?.floor, "15.5%"],
      ["DG-4", siteConfig?.dgCapacity?.["DG-4"], row?.floor, "15.5%"]
    ],

    risk: [
      "Risk Level 1 - Transfer of load from LT panel-2 to LT panel-1.",
      "Risk Level 2 – Transfer of MSC load from LT panel-2 to LT panel-1 while replacement of existing LT panel-2 with new LT panel work will be carry out.",
      "Risk Level 3 – Transfer of all PAC industrial socket from one source to other source (Manually) and ensure server room temperature.",
      "Risk Level 4 –  Re-transfer of  MSC load on new LT panel-2 from LT panel 1",
      "Risk Level 5 –  Re-transfer of  All PAC industrial sockets as per previous."
    ],

    mitigation: [
      "1. Transfer of load from LT panel-2 to LT panel-1 will be done gradually to ensure seamless transfer from one source to other source. Also prior to start of the activity.",
      "2. After shifting of MSC load from LT panel-2 to LT panel-1, Entire the total load Will be run on LT panel-1 should be below 70% capacity",
      "3. Retransfer of MSC Source A from LT panel-1 to LT panel-2 will be done gradually to ensure seamless transfer.",
    ],

    activitySteps: [
      "Space evacuation and dismantling will be done to free up space for new DG sets installation.",
      `Preparation of raised foundation for 3 × ${siteConfig?.dgCapacity?.["DG-1"] || "Unknown"} KVA new DG sets will be done at the designated area while the old DG setup will be kept intact.`,
      "New exhaust stack fabrication as per approved layout will be completed.",
      `Upon delivery, all 3 × ${siteConfig?.dgCapacity?.["DG-1"] || "Unknown"} KVA DG sets will be placed and commissioned on the new platform without any disturbance to existing system.`,
      "Installation of new cable trays on new route as per approved plan and layout will be done by project partner.",
      "New cables laying will be done via new route up to the DG incomers in existing LT panels for all 3 DG sets.",
      "New DG-2 will be connected temporarily on mobile DG incomer of MLTP-1 & 2 and on-load testing will be conducted for sufficient time on both panels in manual mode.",
      "Old DG-1 disconnection and new DG-1 connection activity will be planned; meanwhile Old DG-2 and new DG-2 will be available on MLTP-1 and panel can be tied with MLTP-2 having DG-3 in worst case scenario.",
      "After successful changeover and on-load testing of new DG-1, simultaneously changeover activity will be planned for DG-3; during this, Old DG-2 and new DG-2 will be available on MLTP-2 and panel can be tied with MLTP-1 having new DG-1 in worst case scenario.",
      `New DG-2 will be disconnected and Old DG-1 will be connected on the mobile DG incomers sections of MLT panels 1 & 2, while new DG-1 on MLTP-1 and new DG-3 on MLTP-2 and Old DG-2 will be switchable to both MLTP.`,
      `DG-2 changeover activity will be done; in the meantime, new DG-1 on MLTP-1, new DG-3 on MLTP-2 and Old DG-1 will be connected on the mobile DG incomers sections of MLT panels 1 & 2.`,
      "After successful changeover of all 3 DG sets, dismantling of old DG sets will be carried out."
    ],

    rollback: [
      "The first step, if there is some abnormality observed during the maintenance would be to stop the maintenance.",
      "(1) Interrupt the maintenance and check the Battery Bank alarm.",
      "(2) Escalate and inform all the stake holders.",
      "(3) Re-schedule the maintenance if required."
    ],

    infra: [
      ["Nxtra CIH", siteConfig?.authorizedBy || "Unknown CIH"],
      ["SIM", siteConfig?.sim || "Unknown SIM"],
      ["O&M Partner", "Vertiv Energy Pvt Ltd"],
      ["Panel AMC Partner", "Alexis Telecom Pvt Ltd"]
    ],

    network: [
      ["Core Team", "Mr. Parthasarathi Dey"],
      ["Transmission Team", "Mr. Pradip Moitra"],
      ["OPS Head", "Mr. Sujit Panday"],
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
      ["SMPS spares (fuse, fan)", "XX", "YY", "NA"],
      ["Any other …...", "XX", "YY", "NA"]
    ],

    approval: {
      createdBy: siteConfig?.omName || "Unknown Creator",
      reviewer: `${siteConfig?.preparedBy || "Unknown Review By"} / Mr. Amit Kumar Mondal`,
      approver: siteConfig?.authorizedBy || "Unknown Approver",
      crNumber: row?.crqNo || "To Be Raised"
    }
  },

  "DG Set Preventive maintenance(OEM)": {
    header: {
      title: "DG Set Preventive maintenance(OEM) activity MOP",
      docNo: "Nxtra/MOP/DG Replacement/DOC No. 6.2/Rev.00",
      releaseDate: "01-01-2026"
    },

    siteInfo: {
      city: userData?.site || "Unknown City",
      location: `${userData?.site} MSC` || "Unknown MSC",
      floor: row?.floor || "Unknown Floor",
      tier: siteConfig?.siteCategory === "Super Critical" ? "T1/T2" : "T2/T2",
    },

    activityInfo: {
      nature: row?.notes ? row?.notes : "OEM PM of DGs A check activity MOP",
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
      ["Ensure PM check list for the activity with OEM/In House", "Tick (Yes/No/NA)", "N/A"],
      ["Check the load Parameters with redundant level Load % should not exceed >80% A+B", "Tick (Yes/No/NA)", "N/A"],
      ["Check all the cables and Fuses/MCB's should not have any Hotspot", "Tick (Yes/No/NA)", "N/A"],
      ["All Input & Output cables Rating vs Loading comparison to be done (Loading must not be more than 50% of o/p rated Current) Attach additional Checklist.", "Tick (Yes/No/NA)", "N/A"],
      ["Conduct EHS risk assessment to Identify potential risks associated with the replacement process and develop contingency plans to mitigate risks and minimize downtime.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure Panel Automation status is working fine", "Tick (Yes/No/NA)", "N/A"],
      ["Check all Electricity / LT panel are working Normal", "Tick (Yes/No/NA)", "N/A"],
      ["Check all PAC / SMPS / UPS are working Normal condition", "Tick (Yes/No/NA)", "N/A"],
      ["Check all Server / Power room temperature are normal", "Tick (Yes/No/NA)", "N/A"],
      ["LOTO must be done after deenergizing the feeders during the activity", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure All Stake holders are informed/Approval is in place/CRQ is approved", "Tick (Yes/No/NA)", "N/A"]
    ],

    loadDetails: [
      ["DG-1", siteConfig?.dgCapacity?.["DG-1"], row?.floor, "15.6%"],
      ["DG-2", siteConfig?.dgCapacity?.["DG-2"], row?.floor, "15.5%"],
      ["DG-3", siteConfig?.dgCapacity?.["DG-3"], row?.floor, "15.5%"],
      ["DG-4", siteConfig?.dgCapacity?.["DG-4"], row?.floor, "15.5%"]
    ],

    risk: [
      "Risk Level 1)- During this activity DG-2 will not run if EB source failure, only DG-1 will have for critical operations ( Activity planned on DG-2 A-Check)",
      "Risk Level 2) Tie breaker fail during mains failure will impact on Source 2 Power supply availability",
    ],

    mitigation: [
      "1. DG-1 will be available, EB Second source will be available and can extend DG supply from DC-1",
      "2. After shifting of MSC load from LT panel-2 to LT panel-1, Entire the total load Will be run on LT panel-1 should be below 70% capacity",
      "3. Retransfer of MSC Source A from LT panel-1 to LT panel-2 will be done gradually to ensure seamless transfer.",
    ],

    activitySteps: [
      "Communication to all stakeholders and Vertiv team and ensure NO alarm on any infra equipment (UPS/SMPS/PAC/panel/DG etc).",
      "Team 2 will start the daily routine check activity as mentioned below.",
      "Check the cleanliness of the DG.",
      "Check coolant water level of radiator/heat exchanger.",
      "Check the lubricating oil level in engine sump and top it up if required; engine oil level should be between medium and high level mark and before startup oil level to be near to H mark.",
      "Check the electrolyte level in the battery and top it up with distilled water if required.",
      "Check the battery terminals for any corrosion and apply a thin layer of petroleum jelly.",
      "Check the diesel tank level and fill diesel if required; maintain minimum 30% diesel level.",
      "Ensure all diesel tank valves are in open position.",
      "Check the governor oil level, if applicable.",
      "Check the belt condition; it must be free from any damage.",
      "Check the start selection in auto/manual/test mode.",
      "Check for any active alarms in control panel.",
      "Ensure coolant water temperature is between 40 to 85 Degree Centigrade.",
      "Ensure lube oil pressure is within 3.5 to 6.5 kg/cm2.",
      "Ensure voltage is between 400V–415V and frequency 49.5–50.5 Hz.",
      "Ensure engine emission smoke is not dark black or dense white under load condition.",
      "Ensure engine speed is between 1485–1515 rpm.",
      "Check for any abnormal sound and any oil, coolant water or smoke leakage in engine.",
      "While DG is running on load, monitor the DG running load current and ensure it does not cross the permissible limit.",
      "After transferring the load from DG to mains, run the DG in idle condition for 3 to 5 minutes.",
      "After completion of activity, communicate status to all stakeholders."
    ],

    rollback: [
      "The first step, if there is some abnormality observed during the maintenance would be to stop the maintenance.",
      "(1) Interrupt the maintenance and check the Battery Bank alarm.",
      "(2) Escalate and inform all the stake holders.",
      "(3) Re-schedule the maintenance if required."
    ],

    infra: [
      ["Nxtra CIH", siteConfig?.authorizedBy || "Unknown CIH"],
      ["SIM", siteConfig?.sim || "Unknown SIM"],
      ["O&M Partner", "Vertiv Energy Pvt Ltd"],
      ["Panel AMC Partner", "Alexis Telecom Pvt Ltd"]
    ],

    network: [
      ["Core Team", "Mr. Parthasarathi Dey"],
      ["Transmission Team", "Mr. Pradip Moitra"],
      ["OPS Head", "Mr. Sujit Panday"],
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
      ["SMPS spares (fuse, fan)", "XX", "YY", "NA"],
      ["Any other …...", "XX", "YY", "NA"]
    ],

    approval: {
      createdBy: siteConfig?.omName || "Unknown Creator",
      reviewer: `${siteConfig?.preparedBy || "Unknown Review By"} / Mr. Amit Kumar Mondal`,
      approver: siteConfig?.authorizedBy || "Unknown Approver",
      crNumber: row?.crqNo || "To Be Raised"
    }
  },

  "DG Set Preventive maintenance(In-House)": {
    header: {
      title: "DG Set Preventive maintenance(In-House) activity MOP",
      docNo: "Nxtra/MOP/DG Replacement/DOC No. 6.2/Rev.00",
      releaseDate: "01-01-2026"
    },

    siteInfo: {
      city: userData?.site || "Unknown City",
      location: `${userData?.site} MSC` || "Unknown MSC",
      floor: row?.floor || "Unknown Floor",
      tier: siteConfig?.siteCategory === "Super Critical" ? "T1/T2" : "T2/T2",
    },

    activityInfo: {
      nature: row?.notes ? row?.notes : "In-House PM of DGs A check activity MOP",
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
      ["Ensure PM check list for the activity with OEM/In House", "Tick (Yes/No/NA)", "N/A"],
      ["Check the load Parameters with redundant level Load % should not exceed >80% A+B", "Tick (Yes/No/NA)", "N/A"],
      ["Check all the cables and Fuses/MCB's should not have any Hotspot", "Tick (Yes/No/NA)", "N/A"],
      ["All Input & Output cables Rating vs Loading comparison to be done (Loading must not be more than 50% of o/p rated Current) Attach additional Checklist.", "Tick (Yes/No/NA)", "N/A"],
      ["Conduct EHS risk assessment to Identify potential risks associated with the replacement process and develop contingency plans to mitigate risks and minimize downtime.", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure Panel Automation status is working fine", "Tick (Yes/No/NA)", "N/A"],
      ["Check all Electricity / LT panel are working Normal", "Tick (Yes/No/NA)", "N/A"],
      ["Check all PAC / SMPS / UPS are working Normal condition", "Tick (Yes/No/NA)", "N/A"],
      ["Check all Server / Power room temperature are normal", "Tick (Yes/No/NA)", "N/A"],
      ["LOTO must be done after deenergizing the feeders during the activity", "Tick (Yes/No/NA)", "N/A"],
      ["Ensure All Stake holders are informed/Approval is in place/CRQ is approved", "Tick (Yes/No/NA)", "N/A"]
    ],

    loadDetails: [
      ["DG-1", siteConfig?.dgCapacity?.["DG-1"], row?.floor, "15.6%"],
      ["DG-2", siteConfig?.dgCapacity?.["DG-2"], row?.floor, "15.5%"],
      ["DG-3", siteConfig?.dgCapacity?.["DG-3"], row?.floor, "15.5%"],
      ["DG-4", siteConfig?.dgCapacity?.["DG-4"], row?.floor, "15.5%"]
    ],

    risk: [
      "Risk Level 1)- During this activity DG-2 will not run if EB source failure, only DG-1 will have for critical operations ( Activity planned on DG-2 A-Check)",
      "Risk Level 2) Tie breaker fail during mains failure will impact on Source 2 Power supply availability",
    ],

    mitigation: [
      "1. DG-1 will be available, EB Second source will be available and can extend DG supply from DC-1",
      "2. After shifting of MSC load from LT panel-2 to LT panel-1, Entire the total load Will be run on LT panel-1 should be below 70% capacity",
      "3. Retransfer of MSC Source A from LT panel-1 to LT panel-2 will be done gradually to ensure seamless transfer.",
    ],

    activitySteps: [
      "Communication to all stakeholders and Vertiv team and ensure NO alarm on any infra equipment (UPS/SMPS/PAC/panel/DG etc).",
      "Team 2 will start the daily routine check activity as mentioned below.",
      "Check the cleanliness of the DG.",
      "Check coolant water level of radiator/heat exchanger.",
      "Check the lubricating oil level in engine sump and top it up if required; engine oil level should be between medium and high level mark and before startup oil level to be near to H mark.",
      "Check the electrolyte level in the battery and top it up with distilled water if required.",
      "Check the battery terminals for any corrosion and apply a thin layer of petroleum jelly.",
      "Check the diesel tank level and fill diesel if required; maintain minimum 30% diesel level.",
      "Ensure all diesel tank valves are in open position.",
      "Check the governor oil level, if applicable.",
      "Check the belt condition; it must be free from any damage.",
      "Check the start selection in auto/manual/test mode.",
      "Check for any active alarms in control panel.",
      "Ensure coolant water temperature is between 40 to 85 Degree Centigrade.",
      "Ensure lube oil pressure is within 3.5 to 6.5 kg/cm2.",
      "Ensure voltage is between 400V–415V and frequency 49.5–50.5 Hz.",
      "Ensure engine emission smoke is not dark black or dense white under load condition.",
      "Ensure engine speed is between 1485–1515 rpm.",
      "Check for any abnormal sound and any oil, coolant water or smoke leakage in engine.",
      "While DG is running on load, monitor the DG running load current and ensure it does not cross the permissible limit.",
      "After transferring the load from DG to mains, run the DG in idle condition for 3 to 5 minutes.",
      "After completion of activity, communicate status to all stakeholders."
    ],

    rollback: [
      "The first step, if there is some abnormality observed during the maintenance would be to stop the maintenance.",
      "(1) Interrupt the maintenance and check the Battery Bank alarm.",
      "(2) Escalate and inform all the stake holders.",
      "(3) Re-schedule the maintenance if required."
    ],

    infra: [
      ["Nxtra CIH", siteConfig?.authorizedBy || "Unknown CIH"],
      ["SIM", siteConfig?.sim || "Unknown SIM"],
      ["O&M Partner", "Vertiv Energy Pvt Ltd"],
      ["Panel AMC Partner", "Alexis Telecom Pvt Ltd"]
    ],

    network: [
      ["Core Team", "Mr. Parthasarathi Dey"],
      ["Transmission Team", "Mr. Pradip Moitra"],
      ["OPS Head", "Mr. Sujit Panday"],
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
      ["SMPS spares (fuse, fan)", "XX", "YY", "NA"],
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