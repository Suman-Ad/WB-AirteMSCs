// mopMaster.js

export const MOP_MASTER ={
  "UPS Preventive maintenance (In House)": {
    header: {
      title: "UPS Inhouse PM activity MOP",
      docNo: "Nxtra/MOP/UPS Maintenance/DOC No. 1.12/Rev.00",
      releaseDate: "26-02-2026"
    },

    siteInfo: {
      city: "Unknown City",
      location: "Asansol MSC",
      floor: "GND Floor",
      tier: "Core/TX",
      t2: "T2/T2"
    },

    activityInfo: {
      nature: "Inhouse PM of UPS System",
      startDate: "02 Mar 2026",
      endDate: "02 Mar 2026",
      startTime: "10:00 AM",
      endTime: "02:00 PM",
      duration: "04 Hrs",
      owner: "Mr. Suman Adhikari",
      oem: "UPS OEM - Vertiv",
      stakeholders: "Nxtra Data Operations Team",
      serviceImpact: "Non-Service-Affecting"
    },

    preChecks: [
      ["Site Survey report with GA drawing & SLD layouts", "Yes", "N/A"],
      ["Ensure New UPS System and Accessories delivered", "Yes", "N/A"],
      ["UPS compatible with existing setup", "Yes", "N/A"],
      ["Ensure Pre-energization testing by OEM", "Yes", "N/A"],
      ["Resources, tools & PPE availability", "Yes", "Yes"],
      ["Emergency spares available", "Yes", "N/A"],
      ["Recent DR Test completed", "Yes", "No"],
      ["Breaker trip settings verified", "Yes", "Yes"],
      ["Breaker loading <70%", "Yes", "Yes"],
      ["Thermal scanning done", "Yes", "Yes"],
      ["Cable rating vs load verified", "Yes", "Yes"],
      ["Battery discharge test done", "Yes", "Yes"],
      ["Panel automation OK", "Yes", "Yes"],
      ["No pending PM observations", "Yes", "Yes"],
      ["Isolation transformer inspection", "Yes", "Yes"],
      ["DG health & diesel ensured", "Yes", "Yes"],
      ["LOTO followed", "Yes", "Yes"],
      ["SA approval for SSN", "Yes", "Yes"],
      ["Cable end terminations insulated", "Yes", "N/A"],
      ["Stakeholder approval & CRQ done", "Yes", "Yes"]
    ],

    loadDetails: [
      ["UPS-1", "40 KVA", "GND Floor", "25.6%"],
      ["UPS-2", "40 KVA", "GND Floor", "25.5%"]
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
      "Check all UPS display alarms",
      "Physical inspection of UPS & panels",
      "Check input voltage and parameters",
      "Phase load balancing record",
      "IR testing of power & control cables",
      "Battery IR test",
      "Record all equipment current",
      "Check BMS connectivity",
      "Check UPS time sync",
      "Functional testing 30 mins",
      "Final parameter verification & documentation"
    ],

    rollback: [
      "Stop maintenance if abnormality observed",
      "Check alarms",
      "Escalate & inform stakeholders",
      "Reschedule if required"
    ],

    infra: [
      ["Nxtra CIH", "Mr. Kunal Mukhi"],
      ["SIM", "Mr. Suman Mondal"],
      ["O&M Partner", "Vertiv Energy Pvt Ltd"],
      ["Panel AMC Partner", "Alexis Telecom Pvt Ltd"]
    ],

    proactive: [
      "Activity under CCTV surveillance",
      "No impact to BMS/CCTV supply",
      "Continuous monitoring",
      "Only one critical activity at a time PAN India"
    ],

    spares: [
      ["Lugs – Ring Type", "xx Sqmm", "YY", "NA"],
      ["Lugs – Pin Type", "xx Sqmm", "YY", "NA"],
      ["Heat shrink sleeves", "XX", "YY", "NA"],
      ["PVC insulation tape", "XX", "YY", "NA"],
      ["Blower", "XX", "YY", "NA"],
      ["UPS spares (fuse, fan)", "XX", "YY", "NA"]
    ],

    approval: {
      createdBy: "Mr. Suman Adhikari",
      reviewer: "Mr. Aloke Kumar Dhara / Mr. Amit Kumar Mondal",
      approver: "Mr. Kunal Roy",
      crNumber: "To Be Raised"
    }
  },

  "UPS BB EOL Replacement/Upgradation": {
    header: {
      title: "UPS BB EOL Replacement/Upgradation activity MOP",
      docNo: "Nxtra/MOP/UPS Maintenance/DOC No. 1.13/Rev.00",
      releaseDate: "26-02-2026"
    },

    siteInfo: {
      city: "Unknown City",
      location: "Asansol MSC",
      floor: "GND Floor",
      tier: "Core/TX",
      t2: "T2/T2"
    },

    activityInfo: {
      nature: "Inhouse PM of UPS System",
      startDate: "02 Mar 2026",
      endDate: "02 Mar 2026",
      startTime: "10:00 AM",
      endTime: "02:00 PM",
      duration: "04 Hrs",
      owner: "Mr. Suman Adhikari",
      oem: "UPS OEM - Vertiv",
      stakeholders: "Nxtra Data Operations Team",
      serviceImpact: "Non-Service-Affecting"
    },

    preChecks: [
      ["Site Survey report with GA drawing & SLD layouts", "Yes", "N/A"],
      ["Ensure New UPS System and Accessories delivered", "Yes", "N/A"],
      ["UPS compatible with existing setup", "Yes", "N/A"],
      ["Ensure Pre-energization testing by OEM", "Yes", "N/A"],
      ["Resources, tools & PPE availability", "Yes", "Yes"],
      ["Emergency spares available", "Yes", "N/A"],
      ["Recent DR Test completed", "Yes", "No"],
      ["Breaker trip settings verified", "Yes", "Yes"],
      ["Breaker loading <70%", "Yes", "Yes"],
      ["Thermal scanning done", "Yes", "Yes"],
      ["Cable rating vs load verified", "Yes", "Yes"],
      ["Battery discharge test done", "Yes", "Yes"],
      ["Panel automation OK", "Yes", "Yes"],
      ["No pending PM observations", "Yes", "Yes"],
      ["Isolation transformer inspection", "Yes", "Yes"],
      ["DG health & diesel ensured", "Yes", "Yes"],
      ["LOTO followed", "Yes", "Yes"],
      ["SA approval for SSN", "Yes", "Yes"],
      ["Cable end terminations insulated", "Yes", "N/A"],
      ["Stakeholder approval & CRQ done", "Yes", "Yes"]
    ],

    loadDetails: [
      ["UPS-1", "40 KVA", "GND Floor", "25.6%"],
      ["UPS-2", "40 KVA", "GND Floor", "25.5%"]
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
      "Check all UPS display alarms",
      "Physical inspection of UPS & panels",
      "Check input voltage and parameters",
      "Phase load balancing record",
      "IR testing of power & control cables",
      "Battery IR test",
      "Record all equipment current",
      "Check BMS connectivity",
      "Check UPS time sync",
      "Functional testing 30 mins",
      "Final parameter verification & documentation"
    ],

    rollback: [
      "Stop maintenance if abnormality observed",
      "Check alarms",
      "Escalate & inform stakeholders",
      "Reschedule if required"
    ],

    infra: [
      ["Nxtra CIH", "Mr. Kunal Mukhi"],
      ["SIM", "Mr. Suman Mondal"],
      ["O&M Partner", "Vertiv Energy Pvt Ltd"],
      ["Panel AMC Partner", "Alexis Telecom Pvt Ltd"]
    ],

    proactive: [
      "Activity under CCTV surveillance",
      "No impact to BMS/CCTV supply",
      "Continuous monitoring",
      "Only one critical activity at a time PAN India"
    ],

    spares: [
      ["Lugs – Ring Type", "xx Sqmm", "YY", "NA"],
      ["Lugs – Pin Type", "xx Sqmm", "YY", "NA"],
      ["Heat shrink sleeves", "XX", "YY", "NA"],
      ["PVC insulation tape", "XX", "YY", "NA"],
      ["Blower", "XX", "YY", "NA"],
      ["UPS spares (fuse, fan)", "XX", "YY", "NA"]
    ],

    approval: {
      createdBy: "Mr. Suman Adhikari",
      reviewer: "Mr. Aloke Kumar Dhara / Mr. Amit Kumar Mondal",
      approver: "Mr. Kunal Roy",
      crNumber: "To Be Raised"
    }
  },

  "Fault / Alarm / Break Down - UPS": {
    header: {
      title: "UPS Fault / Alarm / Break Down activity MOP",
      docNo: "Nxtra/MOP/UPS Maintenance/DOC No. 1.12/Rev.00",
      releaseDate: "26-02-2026"
    },

    siteInfo: {
      city: "Unknown City",
      location: "Asansol MSC",
      floor: "GND Floor",
      tier: "Core/TX",
      t2: "T2/T2"
    },

    activityInfo: {
      nature: "Inhouse PM of UPS System",
      startDate: "02 Mar 2026",
      endDate: "02 Mar 2026",
      startTime: "10:00 AM",
      endTime: "02:00 PM",
      duration: "04 Hrs",
      owner: "Mr. Suman Adhikari",
      oem: "UPS OEM - Vertiv",
      stakeholders: "Nxtra Data Operations Team",
      serviceImpact: "Non-Service-Affecting"
    },

    preChecks: [
      ["Site Survey report with GA drawing & SLD layouts", "Yes", "N/A"],
      ["Ensure New UPS System and Accessories delivered", "Yes", "N/A"],
      ["UPS compatible with existing setup", "Yes", "N/A"],
      ["Ensure Pre-energization testing by OEM", "Yes", "N/A"],
      ["Resources, tools & PPE availability", "Yes", "Yes"],
      ["Emergency spares available", "Yes", "N/A"],
      ["Recent DR Test completed", "Yes", "No"],
      ["Breaker trip settings verified", "Yes", "Yes"],
      ["Breaker loading <70%", "Yes", "Yes"],
      ["Thermal scanning done", "Yes", "Yes"],
      ["Cable rating vs load verified", "Yes", "Yes"],
      ["Battery discharge test done", "Yes", "Yes"],
      ["Panel automation OK", "Yes", "Yes"],
      ["No pending PM observations", "Yes", "Yes"],
      ["Isolation transformer inspection", "Yes", "Yes"],
      ["DG health & diesel ensured", "Yes", "Yes"],
      ["LOTO followed", "Yes", "Yes"],
      ["SA approval for SSN", "Yes", "Yes"],
      ["Cable end terminations insulated", "Yes", "N/A"],
      ["Stakeholder approval & CRQ done", "Yes", "Yes"]
    ],

    loadDetails: [
      ["UPS-1", "40 KVA", "GND Floor", "25.6%"],
      ["UPS-2", "40 KVA", "GND Floor", "25.5%"]
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
      "Check all UPS display alarms",
      "Physical inspection of UPS & panels",
      "Check input voltage and parameters",
      "Phase load balancing record",
      "IR testing of power & control cables",
      "Battery IR test",
      "Record all equipment current",
      "Check BMS connectivity",
      "Check UPS time sync",
      "Functional testing 30 mins",
      "Final parameter verification & documentation"
    ],

    rollback: [
      "Stop maintenance if abnormality observed",
      "Check alarms",
      "Escalate & inform stakeholders",
      "Reschedule if required"
    ],

    infra: [
      ["Nxtra CIH", "Mr. Kunal Mukhi"],
      ["SIM", "Mr. Suman Mondal"],
      ["O&M Partner", "Vertiv Energy Pvt Ltd"],
      ["Panel AMC Partner", "Alexis Telecom Pvt Ltd"]
    ],

    proactive: [
      "Activity under CCTV surveillance",
      "No impact to BMS/CCTV supply",
      "Continuous monitoring",
      "Only one critical activity at a time PAN India"
    ],

    spares: [
      ["Lugs – Ring Type", "xx Sqmm", "YY", "NA"],
      ["Lugs – Pin Type", "xx Sqmm", "YY", "NA"],
      ["Heat shrink sleeves", "XX", "YY", "NA"],
      ["PVC insulation tape", "XX", "YY", "NA"],
      ["Blower", "XX", "YY", "NA"],
      ["UPS spares (fuse, fan)", "XX", "YY", "NA"]
    ],

    approval: {
      createdBy: "Mr. Suman Adhikari",
      reviewer: "Mr. Aloke Kumar Dhara / Mr. Amit Kumar Mondal",
      approver: "Mr. Kunal Roy",
      crNumber: "To Be Raised"
    }
  },

  "UPS Preventive maintenance (OEM)": {
    header: {
      title: "UPS OEM PM activity MOP",
      docNo: "Nxtra/MOP/UPS Maintenance/DOC No. 1.12/Rev.00",
      releaseDate: "26-02-2026"
    },

    siteInfo: {
      city: "Unknown City",
      location: "Asansol MSC",
      floor: "GND Floor",
      tier: "Core/TX",
      t2: "T2/T2"
    },

    activityInfo: {
      nature: "Inhouse PM of UPS System",
      startDate: "02 Mar 2026",
      endDate: "02 Mar 2026",
      startTime: "10:00 AM",
      endTime: "02:00 PM",
      duration: "04 Hrs",
      owner: "Mr. Suman Adhikari",
      oem: "UPS OEM - Vertiv",
      stakeholders: "Nxtra Data Operations Team",
      serviceImpact: "Non-Service-Affecting"
    },

    preChecks: [
      ["Site Survey report with GA drawing & SLD layouts", "Yes", "N/A"],
      ["Ensure New UPS System and Accessories delivered", "Yes", "N/A"],
      ["UPS compatible with existing setup", "Yes", "N/A"],
      ["Ensure Pre-energization testing by OEM", "Yes", "N/A"],
      ["Resources, tools & PPE availability", "Yes", "Yes"],
      ["Emergency spares available", "Yes", "N/A"],
      ["Recent DR Test completed", "Yes", "No"],
      ["Breaker trip settings verified", "Yes", "Yes"],
      ["Breaker loading <70%", "Yes", "Yes"],
      ["Thermal scanning done", "Yes", "Yes"],
      ["Cable rating vs load verified", "Yes", "Yes"],
      ["Battery discharge test done", "Yes", "Yes"],
      ["Panel automation OK", "Yes", "Yes"],
      ["No pending PM observations", "Yes", "Yes"],
      ["Isolation transformer inspection", "Yes", "Yes"],
      ["DG health & diesel ensured", "Yes", "Yes"],
      ["LOTO followed", "Yes", "Yes"],
      ["SA approval for SSN", "Yes", "Yes"],
      ["Cable end terminations insulated", "Yes", "N/A"],
      ["Stakeholder approval & CRQ done", "Yes", "Yes"]
    ],

    loadDetails: [
      ["UPS-1", "40 KVA", "GND Floor", "25.6%"],
      ["UPS-2", "40 KVA", "GND Floor", "25.5%"]
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
      "Check all UPS display alarms",
      "Physical inspection of UPS & panels",
      "Check input voltage and parameters",
      "Phase load balancing record",
      "IR testing of power & control cables",
      "Battery IR test",
      "Record all equipment current",
      "Check BMS connectivity",
      "Check UPS time sync",
      "Functional testing 30 mins",
      "Final parameter verification & documentation"
    ],

    rollback: [
      "Stop maintenance if abnormality observed",
      "Check alarms",
      "Escalate & inform stakeholders",
      "Reschedule if required"
    ],

    infra: [
      ["Nxtra CIH", "Mr. Kunal Mukhi"],
      ["SIM", "Mr. Suman Mondal"],
      ["O&M Partner", "Vertiv Energy Pvt Ltd"],
      ["Panel AMC Partner", "Alexis Telecom Pvt Ltd"]
    ],

    proactive: [
      "Activity under CCTV surveillance",
      "No impact to BMS/CCTV supply",
      "Continuous monitoring",
      "Only one critical activity at a time PAN India"
    ],

    spares: [
      ["Lugs – Ring Type", "xx Sqmm", "YY", "NA"],
      ["Lugs – Pin Type", "xx Sqmm", "YY", "NA"],
      ["Heat shrink sleeves", "XX", "YY", "NA"],
      ["PVC insulation tape", "XX", "YY", "NA"],
      ["Blower", "XX", "YY", "NA"],
      ["UPS spares (fuse, fan)", "XX", "YY", "NA"]
    ],

    approval: {
      createdBy: "Mr. Suman Adhikari",
      reviewer: "Mr. Aloke Kumar Dhara / Mr. Amit Kumar Mondal",
      approver: "Mr. Kunal Roy",
      crNumber: "To Be Raised"
    }
  },

  "UPS EOL replacement/upgradation": {
    header: {
      title: "UPS Replacement/Upgradation Activity MOP",
      docNo: "Nxtra/MOP/UPS Maintenance/DOC No. 1.12/Rev.00",
      releaseDate: "26-02-2026"
    },

    siteInfo: {
      city: "Unknown City",
      location: "Asansol MSC",
      floor: "GND Floor",
      tier: "Core/TX",
      t2: "T2/T2"
    },

    activityInfo: {
      nature: "Inhouse PM of UPS System",
      startDate: "02 Mar 2026",
      endDate: "02 Mar 2026",
      startTime: "10:00 AM",
      endTime: "02:00 PM",
      duration: "04 Hrs",
      owner: "Mr. Suman Adhikari",
      oem: "UPS OEM - Vertiv",
      stakeholders: "Nxtra Data Operations Team",
      serviceImpact: "Non-Service-Affecting"
    },

    preChecks: [
      ["Site Survey report with GA drawing & SLD layouts", "Yes", "N/A"],
      ["Ensure New UPS System and Accessories delivered", "Yes", "N/A"],
      ["UPS compatible with existing setup", "Yes", "N/A"],
      ["Ensure Pre-energization testing by OEM", "Yes", "N/A"],
      ["Resources, tools & PPE availability", "Yes", "Yes"],
      ["Emergency spares available", "Yes", "N/A"],
      ["Recent DR Test completed", "Yes", "No"],
      ["Breaker trip settings verified", "Yes", "Yes"],
      ["Breaker loading <70%", "Yes", "Yes"],
      ["Thermal scanning done", "Yes", "Yes"],
      ["Cable rating vs load verified", "Yes", "Yes"],
      ["Battery discharge test done", "Yes", "Yes"],
      ["Panel automation OK", "Yes", "Yes"],
      ["No pending PM observations", "Yes", "Yes"],
      ["Isolation transformer inspection", "Yes", "Yes"],
      ["DG health & diesel ensured", "Yes", "Yes"],
      ["LOTO followed", "Yes", "Yes"],
      ["SA approval for SSN", "Yes", "Yes"],
      ["Cable end terminations insulated", "Yes", "N/A"],
      ["Stakeholder approval & CRQ done", "Yes", "Yes"]
    ],

    loadDetails: [
      ["UPS-1", "40 KVA", "GND Floor", "25.6%"],
      ["UPS-2", "40 KVA", "GND Floor", "25.5%"]
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
      "Check all UPS display alarms",
      "Physical inspection of UPS & panels",
      "Check input voltage and parameters",
      "Phase load balancing record",
      "IR testing of power & control cables",
      "Battery IR test",
      "Record all equipment current",
      "Check BMS connectivity",
      "Check UPS time sync",
      "Functional testing 30 mins",
      "Final parameter verification & documentation"
    ],

    rollback: [
      "Stop maintenance if abnormality observed",
      "Check alarms",
      "Escalate & inform stakeholders",
      "Reschedule if required"
    ],

    infra: [
      ["Nxtra CIH", "Mr. Kunal Mukhi"],
      ["SIM", "Mr. Suman Mondal"],
      ["O&M Partner", "Vertiv Energy Pvt Ltd"],
      ["Panel AMC Partner", "Alexis Telecom Pvt Ltd"]
    ],

    proactive: [
      "Activity under CCTV surveillance",
      "No impact to BMS/CCTV supply",
      "Continuous monitoring",
      "Only one critical activity at a time PAN India"
    ],

    spares: [
      ["Lugs – Ring Type", "xx Sqmm", "YY", "NA"],
      ["Lugs – Pin Type", "xx Sqmm", "YY", "NA"],
      ["Heat shrink sleeves", "XX", "YY", "NA"],
      ["PVC insulation tape", "XX", "YY", "NA"],
      ["Blower", "XX", "YY", "NA"],
      ["UPS spares (fuse, fan)", "XX", "YY", "NA"]
    ],

    approval: {
      createdBy: "Mr. Suman Adhikari",
      reviewer: "Mr. Aloke Kumar Dhara / Mr. Amit Kumar Mondal",
      approver: "Mr. Kunal Roy",
      crNumber: "To Be Raised"
    }
  },

  "UPS BB Preventive Maintenance(In-House)": {
    header: {
      title: "UPS BB Preventive Maintenance Activity MOP",
      docNo: "Nxtra/MOP/UPS Maintenance/DOC No. 1.12/Rev.00",
      releaseDate: "26-02-2026"
    },

    siteInfo: {
      city: "Unknown City",
      location: "Asansol MSC",
      floor: "GND Floor",
      tier: "Core/TX",
      t2: "T2/T2"
    },

    activityInfo: {
      nature: "Inhouse PM of UPS System",
      startDate: "02 Mar 2026",
      endDate: "02 Mar 2026",
      startTime: "10:00 AM",
      endTime: "02:00 PM",
      duration: "04 Hrs",
      owner: "Mr. Suman Adhikari",
      oem: "UPS OEM - Vertiv",
      stakeholders: "Nxtra Data Operations Team",
      serviceImpact: "Non-Service-Affecting"
    },

    preChecks: [
      ["Check the all approvals and CR available on before starting the activity", "Yes", "N/A"],
      ["Check the check list availability of the OEM PM on before starting the activity", "Yes", "N/A"],
      ["Check the Spare Battery on before starting the activity, if any cell faulty immediately to be replaced", "Yes", "N/A"],
      ["Ensure required resources and tools & PPE are available and Healthiness to be ensured at site prior to start of the activity.", "Yes", "N/A"],
      ["Ensure emergency spares for Battery Bank are available at site.", "Yes", "Yes"],
      ["Check the redundent Battery should have 15-30 munites back up with compare to the site load", "Yes", "N/A"],
      ["Ensure Panel Automation status is working fine", "Yes", "No"],
      ["Ensure No open observations from recent PM of Battery Bank & BB", "Yes", "Yes"],
      ["Site will be on DG, So Health checkup of DG sets and availability of Diesel Stock to be ensured", "Yes", "Yes"],
      ["LOTO must be done after denergizing the feeders during the activity", "Yes", "Yes"],
      ["After disconnection of the power cables, end terminations must be properly insulated before pulling out of the glands/Battery Bank/Panel.", "Yes", "Yes"],
      ["Ensure All Stake holders are informed/Approval is inplace/CRQ is approved", "Yes", "Yes"],
    ],

    loadDetails: [
      ["UPS Battery Bank-1", "65 AH", "GND Floor", "25.6%"],
      ["UPS Battery Bank-2", "65 AH", "GND Floor", "25.5%"]
    ],

    risk: [
      "Risk Level 1 - PM of UPS Battery Bank-1",
      "Risk Level 2 - PM of UPS Battery Bank-2"
    ],

    mitigation: [
      "Transfer load of UPS Battery Bank-1 to maintenance bypass and DG source",
      "Transfer load of UPS Battery Bank-2 to maintenance bypass and DG source"
    ],

    activitySteps: [
      "Switch ON DG Set and transfer input source of both Battery Bank to DG power.  ",
      "Physical inspection any damages ,health ,hygiene etc of Battery Bank.",
      "Make the set point of Battery Bank test mode and of voltage set of discharge should be fix 47.5 VDC/15 munites discharge and start doing the discharge test with existing IT load",
      "Check Input voltage/other parameters of Battery Bank-1 physically (through multimeters) and check all parameters such as Input voltage, each cell voltage in the PM format.",
      "Check and keep recod of discharging Voltage and every 5 minutes and keep discharge till 1.97 (47.5/24 cells)",
      "Check all the cells voltage stable or >1.75V volts then consider all Cells or Ok, if any cells falls <1.75VDC, then cell to be replaced on immediate basis",
      "All observaions to be recorded and timely report to Circle Incharge for immediate support of cell faulty cases for replacement",
      "Verify all parameters of Battery Bank-1 and documentation done.",
    ],

    rollback: [
      "Stop maintenance if abnormality observed",
      "Check alarms",
      "Escalate & inform stakeholders",
      "Reschedule if required"
    ],

    infra: [
      ["Nxtra CIH", "Mr. Kunal Mukhi"],
      ["SIM", "Mr. Suman Mondal"],
      ["O&M Partner", "Vertiv Energy Pvt Ltd"],
      ["Panel AMC Partner", "Alexis Telecom Pvt Ltd"]
    ],

    proactive: [
      "Activity under CCTV surveillance",
      "No impact to BMS/CCTV supply",
      "Continuous monitoring",
      "Only one critical activity at a time PAN India"
    ],

    spares: [
      ["Lugs – Ring Type", "xx Sqmm", "YY", "NA"],
      ["Lugs – Pin Type", "xx Sqmm", "YY", "NA"],
      ["Heat shrink sleeves", "XX", "YY", "NA"],
      ["PVC insulation tape", "XX", "YY", "NA"],
      ["Blower", "XX", "YY", "NA"],
      ["UPS spares (fuse, fan)", "XX", "YY", "NA"]
    ],

    approval: {
      createdBy: "Mr. Suman Adhikari",
      reviewer: "Mr. Aloke Kumar Dhara / Mr. Amit Kumar Mondal",
      approver: "Mr. Kunal Roy",
      crNumber: "To Be Raised"
    }
  },

  "UPS BB Preventive Maintenance(OEM)": {
    header: {
      title: "UPS BB Preventive Maintenance Activity MOP",
      docNo: "Nxtra/MOP/UPS Maintenance/DOC No. 1.12/Rev.00",
      releaseDate: "26-02-2026"
    },

    siteInfo: {
      city: "Unknown City",
      location: "Asansol MSC",
      floor: "GND Floor",
      tier: "Core/TX",
      t2: "T2/T2"
    },

    activityInfo: {
      nature: "Inhouse PM of UPS System",
      startDate: "02 Mar 2026",
      endDate: "02 Mar 2026",
      startTime: "10:00 AM",
      endTime: "02:00 PM",
      duration: "04 Hrs",
      owner: "Mr. Suman Adhikari",
      oem: "UPS OEM - Vertiv",
      stakeholders: "Nxtra Data Operations Team",
      serviceImpact: "Non-Service-Affecting"
    },

    preChecks: [
      ["Site Survey report with GA drawing & SLD layouts", "Yes", "N/A"],
      ["Ensure New UPS System and Accessories delivered", "Yes", "N/A"],
      ["UPS compatible with existing setup", "Yes", "N/A"],
      ["Ensure Pre-energization testing by OEM", "Yes", "N/A"],
      ["Resources, tools & PPE availability", "Yes", "Yes"],
      ["Emergency spares available", "Yes", "N/A"],
      ["Recent DR Test completed", "Yes", "No"],
      ["Breaker trip settings verified", "Yes", "Yes"],
      ["Breaker loading <70%", "Yes", "Yes"],
      ["Thermal scanning done", "Yes", "Yes"],
      ["Cable rating vs load verified", "Yes", "Yes"],
      ["Battery discharge test done", "Yes", "Yes"],
      ["Panel automation OK", "Yes", "Yes"],
      ["No pending PM observations", "Yes", "Yes"],
      ["Isolation transformer inspection", "Yes", "Yes"],
      ["DG health & diesel ensured", "Yes", "Yes"],
      ["LOTO followed", "Yes", "Yes"],
      ["SA approval for SSN", "Yes", "Yes"],
      ["Cable end terminations insulated", "Yes", "N/A"],
      ["Stakeholder approval & CRQ done", "Yes", "Yes"]
    ],

    loadDetails: [
      ["UPS-1", "40 KVA", "GND Floor", "25.6%"],
      ["UPS-2", "40 KVA", "GND Floor", "25.5%"]
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
      "Check all UPS display alarms",
      "Physical inspection of UPS & panels",
      "Check input voltage and parameters",
      "Phase load balancing record",
      "IR testing of power & control cables",
      "Battery IR test",
      "Record all equipment current",
      "Check BMS connectivity",
      "Check UPS time sync",
      "Functional testing 30 mins",
      "Final parameter verification & documentation"
    ],

    rollback: [
      "Stop maintenance if abnormality observed",
      "Check alarms",
      "Escalate & inform stakeholders",
      "Reschedule if required"
    ],

    infra: [
      ["Nxtra CIH", "Mr. Kunal Mukhi"],
      ["SIM", "Mr. Suman Mondal"],
      ["O&M Partner", "Vertiv Energy Pvt Ltd"],
      ["Panel AMC Partner", "Alexis Telecom Pvt Ltd"]
    ],

    proactive: [
      "Activity under CCTV surveillance",
      "No impact to BMS/CCTV supply",
      "Continuous monitoring",
      "Only one critical activity at a time PAN India"
    ],

    spares: [
      ["Lugs – Ring Type", "xx Sqmm", "YY", "NA"],
      ["Lugs – Pin Type", "xx Sqmm", "YY", "NA"],
      ["Heat shrink sleeves", "XX", "YY", "NA"],
      ["PVC insulation tape", "XX", "YY", "NA"],
      ["Blower", "XX", "YY", "NA"],
      ["UPS spares (fuse, fan)", "XX", "YY", "NA"]
    ],

    approval: {
      createdBy: "Mr. Suman Adhikari",
      reviewer: "Mr. Aloke Kumar Dhara / Mr. Amit Kumar Mondal",
      approver: "Mr. Kunal Roy",
      crNumber: "To Be Raised"
    }
  },

  "UPS BB Cell Replacement": {
    header: {
      title: "UPS BB Preventive Maintenance Activity MOP",
      docNo: "Nxtra/MOP/UPS Maintenance/DOC No. 1.12/Rev.00",
      releaseDate: "26-02-2026"
    },

    siteInfo: {
      city: "Unknown City",
      location: "Asansol MSC",
      floor: "GND Floor",
      tier: "Core/TX",
      t2: "T2/T2"
    },

    activityInfo: {
      nature: "Inhouse PM of UPS System",
      startDate: "02 Mar 2026",
      endDate: "02 Mar 2026",
      startTime: "10:00 AM",
      endTime: "02:00 PM",
      duration: "04 Hrs",
      owner: "Mr. Suman Adhikari",
      oem: "UPS OEM - Vertiv",
      stakeholders: "Nxtra Data Operations Team",
      serviceImpact: "Non-Service-Affecting"
    },

    preChecks: [
      ["Site Survey report with GA drawing & SLD layouts", "Yes", "N/A"],
      ["Ensure New UPS System and Accessories delivered", "Yes", "N/A"],
      ["UPS compatible with existing setup", "Yes", "N/A"],
      ["Ensure Pre-energization testing by OEM", "Yes", "N/A"],
      ["Resources, tools & PPE availability", "Yes", "Yes"],
      ["Emergency spares available", "Yes", "N/A"],
      ["Recent DR Test completed", "Yes", "No"],
      ["Breaker trip settings verified", "Yes", "Yes"],
      ["Breaker loading <70%", "Yes", "Yes"],
      ["Thermal scanning done", "Yes", "Yes"],
      ["Cable rating vs load verified", "Yes", "Yes"],
      ["Battery discharge test done", "Yes", "Yes"],
      ["Panel automation OK", "Yes", "Yes"],
      ["No pending PM observations", "Yes", "Yes"],
      ["Isolation transformer inspection", "Yes", "Yes"],
      ["DG health & diesel ensured", "Yes", "Yes"],
      ["LOTO followed", "Yes", "Yes"],
      ["SA approval for SSN", "Yes", "Yes"],
      ["Cable end terminations insulated", "Yes", "N/A"],
      ["Stakeholder approval & CRQ done", "Yes", "Yes"]
    ],

    loadDetails: [
      ["UPS-1", "40 KVA", "GND Floor", "25.6%"],
      ["UPS-2", "40 KVA", "GND Floor", "25.5%"]
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
      "Check all UPS display alarms",
      "Physical inspection of UPS & panels",
      "Check input voltage and parameters",
      "Phase load balancing record",
      "IR testing of power & control cables",
      "Battery IR test",
      "Record all equipment current",
      "Check BMS connectivity",
      "Check UPS time sync",
      "Functional testing 30 mins",
      "Final parameter verification & documentation"
    ],

    rollback: [
      "Stop maintenance if abnormality observed",
      "Check alarms",
      "Escalate & inform stakeholders",
      "Reschedule if required"
    ],

    infra: [
      ["Nxtra CIH", "Mr. Kunal Mukhi"],
      ["SIM", "Mr. Suman Mondal"],
      ["O&M Partner", "Vertiv Energy Pvt Ltd"],
      ["Panel AMC Partner", "Alexis Telecom Pvt Ltd"]
    ],

    proactive: [
      "Activity under CCTV surveillance",
      "No impact to BMS/CCTV supply",
      "Continuous monitoring",
      "Only one critical activity at a time PAN India"
    ],

    spares: [
      ["Lugs – Ring Type", "xx Sqmm", "YY", "NA"],
      ["Lugs – Pin Type", "xx Sqmm", "YY", "NA"],
      ["Heat shrink sleeves", "XX", "YY", "NA"],
      ["PVC insulation tape", "XX", "YY", "NA"],
      ["Blower", "XX", "YY", "NA"],
      ["UPS spares (fuse, fan)", "XX", "YY", "NA"]
    ],

    approval: {
      createdBy: "Mr. Suman Adhikari",
      reviewer: "Mr. Aloke Kumar Dhara / Mr. Amit Kumar Mondal",
      approver: "Mr. Kunal Roy",
      crNumber: "To Be Raised"
    }
  },
};