import { APPROVAL_LEVELS } from "./approvalLevels";

export const getApproversFromLevels = (levels = []) => {
  return [
    ...new Set(
      levels.flatMap(level => APPROVAL_LEVELS[level] || [])
    )
  ];
};

export const ACTIVITY_MASTER = {
  UPS: [
    {
      activityDescription: "UPS EOL replacement/upgradation",
      activityCategory: "Super Critical",
      activityCode: "RED",
      activityType: "Replacement/upgradation",
      avgMonthlyCount: 0,
      crRequired: true,
      crDaysBefore: 5,
      approvalLevel: "NLT",
      approvalLevels: ["Level-1", "Level-2", "Level-3", "Level-4", "Level-5", "Level-6", "Level-7"],
      information: "Mr. Deepak Sanghi"
    },
    {
      activityDescription: "UPS Preventive maintenance (OEM)",
      activityCategory: "Major",
      activityCode: "BLUE",
      activityType: "Preventive maintenance",
      avgMonthlyCount: 8,
      crRequired: true,
      crDaysBefore: 2,
      approvalLevel: "Circle",
      approvalLevels: ["Level-1", "Level-2", "Level-3", "Level-4", "Level-5"],
      information: ""
    },
    {
      activityDescription: "UPS Preventive maintenance (In House)",
      activityCategory: "Major",
      activityCode: "BLUE",
      activityType: "Preventive maintenance",
      avgMonthlyCount: 409,
      crRequired: true,
      crDaysBefore: 2,
      approvalLevel: "Circle",
      approvalLevels: ["Level-1", "Level-2", "Level-3"],
      information: ""
    },
    {
      activityDescription: "Fault / Alarm / Break Down - UPS",
      activityCategory: "Critical",
      activityCode: "RED",
      activityType: "Corrective maintenance",
      avgMonthlyCount: 127,
      crRequired: true,
      crDaysBefore: 0,
      approvalLevel: "NLT",
      approvalLevels: ["Level-1", "Level-2", "Level-3", "Level-4", "Level-5", "Level-6", "Level-7"],
      information: "Mr. Deepak Sanghi"
    }
  ],

  "UPS BB": [
    {
      activityDescription: "UPS BB EOL Replacement/Upgradation",
      activityCategory: "Super Critical",
      activityCode: "BLUE",
      activityType: "Replacement/Upgradation",
      avgMonthlyCount: 127,
      crRequired: true,
      crDaysBefore: 5,
      approvalLevel: "CIRCLE",
      approvalLevels: ["Level-1", "Level-2", "Level-3", "Level-4", "Level-5"],
      information: ""
    },
    {
      activityDescription: "UPS BB Preventive Maintenance(In-House)",
      performBy: "In-House",
      activityCategory: "Major",
      activityCode: "BLUE",
      activityType: "Preventive Maintenance",
      avgMonthlyCount: 127,
      crRequired: true,
      crDaysBefore: 2,
      approvalLevel: "CIRCLE",
      approvalLevels: ["Level-1", "Level-2", "Level-3"],
      information: ""
    },
    {
      activityDescription: "UPS BB Preventive Maintenance(OEM)",
      performBy: "OEM",
      activityCategory: "Major",
      activityCode: "BLUE",
      activityType: "Preventive Maintenance",
      avgMonthlyCount: 127,
      crRequired: true,
      crDaysBefore: 2,
      approvalLevel: "CIRCLE",
      approvalLevels: ["Level-1", "Level-2", "Level-3"],
      information: ""
    },
    {
      activityDescription: "UPS BB Cell Replacement",
      performBy: "Vendor",
      activityCategory: "Major",
      activityCode: "BLUE",
      activityType: "Replacement/Upgradation",
      avgMonthlyCount: 127,
      crRequired: true,
      crDaysBefore: 2,
      approvalLevel: "CIRCLE",
      approvalLevels: ["Level-1", "Level-2", "Level-3"],
      information: ""
    },
  ],

  SMPS: [
    {
      activityDescription: "SMPS EOL replacement/upgradation",
      activityCategory: "Super Critical",
      activityCode: "RED",
      activityType: "Replacement/upgradation",
      avgMonthlyCount: 99,
      crRequired: true,
      crDaysBefore: 5,
      approvalLevel: "NLT",
      approvalLevels: ["Level-1", "Level-2", "Level-3", "Level-4", "Level-5", "Level-6", "Level-7"],
      information: "Mr. Deepak Sanghi"
    },
    {
      activityDescription: "SMPS Preventive maintenance (OEM)",
      performBy: "OEM",
      activityCategory: "Major",
      activityCode: "BLUE",
      activityType: "Preventive maintenance",
      avgMonthlyCount: 0,
      crRequired: true,
      crDaysBefore: 2,
      approvalLevel: "Circle",
      approvalLevels: ["Level-1", "Level-2", "Level-3", "Level-4", "Level-5"],
      information: ""
    },
    {
      activityDescription: "SMPS Preventive maintenance (In House)",
      performBy: "In-House",
      activityCategory: "Major",
      activityCode: "BLUE",
      activityType: "Preventive maintenance",
      avgMonthlyCount: 346,
      crRequired: true,
      crDaysBefore: 2,
      approvalLevel: "Circle",
      approvalLevels: ["Level-1", "Level-2", "Level-3"],
      information: ""
    },
    {
      activityDescription: "Fault / Alarm / Break Down - SMPS",
      activityCategory: "Critical",
      activityCode: "RED",
      activityType: "Corrective maintenance",
      avgMonthlyCount: 189,
      crRequired: true,
      crDaysBefore: 0,
      approvalLevel: "NLT",
      approvalLevels: ["Level-1", "Level-2", "Level-3", "Level-4", "Level-5", "Level-6", "Level-7"],
      information: "Mr. Deepak Sanghi"
    }
  ],

  "SMPS BB": [
    {
      activityDescription: "SMPS BB EOL Replacement/Upgradation",
      activityCategory: "Super Critical",
      activityCode: "BLUE",
      activityType: "Replacement/Upgradation",
      avgMonthlyCount: 127,
      crRequired: true,
      crDaysBefore: 5,
      approvalLevel: "CIRCLE",
      approvalLevels: ["Level-1", "Level-2", "Level-3", "Level-4", "Level-5"],
      information: ""
    },
    {
      activityDescription: "SMPS BB Preventive Maintenance(In-House)",
      performBy: "In-House",
      activityCategory: "Major",
      activityCode: "BLUE",
      activityType: "Preventive Maintenance",
      avgMonthlyCount: 127,
      crRequired: true,
      crDaysBefore: 2,
      approvalLevel: "CIRCLE",
      approvalLevels: ["Level-1", "Level-2", "Level-3"],
      information: ""
    },
    {
      activityDescription: "SMPS BB Preventive Maintenance(OEM)",
      performBy: "OEM",
      activityCategory: "Major",
      activityCode: "BLUE",
      activityType: "Preventive Maintenance",
      avgMonthlyCount: 127,
      crRequired: true,
      crDaysBefore: 2,
      approvalLevel: "CIRCLE",
      approvalLevels: ["Level-1", "Level-2", "Level-3"],
      information: ""
    },
    {
      activityDescription: "SMPS BB Cell Replacement",
      performBy: "Vendor",
      activityCategory: "Major",
      activityCode: "BLUE",
      activityType: "Replacement/Upgradation",
      avgMonthlyCount: 127,
      crRequired: true,
      crDaysBefore: 2,
      approvalLevel: "CIRCLE",
      approvalLevels: ["Level-1", "Level-2", "Level-3"],
      information: ""
    },
  ],

  "Diesel Generator": [
    {
      activityDescription: "DG Set Replacement activity",
      activityCategory: "Super Critical",
      activityCode: "RED",
      activityType: "Replacement/upgradation",
      avgMonthlyCount: 42,
      crRequired: true,
      crDaysBefore: 5,
      approvalLevel: "NLT",
      approvalLevels: ["Level-1", "Level-2", "Level-3", "Level-4", "Level-5", "Level-6", "Level-7"],
      information: "Mr. Deepak Sanghi"
    },
    {
      activityDescription: "DG Set Preventive maintenance(OEM)",
      performBy: "OEM",
      activityCategory: "Major",
      activityCode: "BLUE",
      activityType: "Preventive maintenance",
      avgMonthlyCount: 16,
      crRequired: true,
      crDaysBefore: 2,
      approvalLevel: "Circle",
      approvalLevels: ["Level-1", "Level-2", "Level-3", "Level-4"],
      information: ""
    },
    {
      activityDescription: "DG Set Preventive maintenance(In-House)",
      performBy: "In-House",
      activityCategory: "Major",
      activityCode: "BLUE",
      activityType: "Preventive maintenance",
      avgMonthlyCount: 16,
      crRequired: true,
      crDaysBefore: 2,
      approvalLevel: "Circle",
      approvalLevels: ["Level-1", "Level-2", "Level-3"],
      information: ""
    },
    {
      activityDescription: "DG Set Radiator & Fuel tank cleaning activity",
      activityCategory: "Critical",
      activityCode: "AMBER",
      activityType: "Preventive maintenance",
      avgMonthlyCount: 63,
      crRequired: true,
      crDaysBefore: 2,
      approvalLevel: "Circle",
      approvalLevels: ["Level-1", "Level-2", "Level-3", "Level-4"],
      information: ""
    },
    {
      activityDescription: "Daily DG test run",
      activityCategory: "Critical",
      activityCode: "GREEN",
      activityType: "Preventive maintenance",
      avgMonthlyCount: 0,
      crRequired: false,
      crDaysBefore: 0,
      approvalLevel: "Circle",
      approvalLevels: ["Level-1", "Level-2"],
      information: ""
    }
  ],

  "Air Conditioner": [
    {
      activityDescription: "PAC EOL replacement/upgradation",
      performBy: "OEM",
      activityCategory: "Major",
      activityCode: "BLUE",
      activityType: "Replacement/upgradation",
      avgMonthlyCount: 92,
      crRequired: true,
      crDaysBefore: 2,
      approvalLevel: "CIRCLE",
      approvalLevels: ["Level-1", "Level-2", "Level-3", "Level-4"],
      information: ""
    },
    {
      activityDescription: "PAC Preventive maintenance (OEM)",
      performBy: "OEM",
      activityCategory: "Major",
      activityCode: "BLUE",
      activityType: "Preventive maintenance",
      avgMonthlyCount: 15,
      crRequired: true,
      crDaysBefore: 2,
      approvalLevel: "Circle",
      approvalLevels: ["Level-1", "Level-2", "Level-3"],
      information: ""
    },
    {
      activityDescription: "PAC Preventive maintenance (In House)",
      performBy: "In-House",
      activityCategory: "Major",
      activityCode: "BLUE",
      activityType: "Preventive maintenance",
      avgMonthlyCount: 108,
      crRequired: true,
      crDaysBefore: 2,
      approvalLevel: "Circle",
      approvalLevels: ["Level-1", "Level-2", "Level-3"],
      information: ""
    },
    {
      activityDescription: "PAC Compressor replacement",
      performBy: "Vendor",
      activityCategory: "Major",
      activityCode: "BLUE",
      activityType: "Corrective maintenance",
      avgMonthlyCount: 212,
      crRequired: true,
      crDaysBefore: 0,
      approvalLevel: "CIRCLE",
      approvalLevels: ["Level-1", "Level-2", "Level-3"],
      information: ""
    },
    {
      activityDescription: "PAC ODU replacement",
      performBy: "Vendor",
      activityCategory: "Major",
      activityCode: "BLUE",
      activityType: "Replacement/upgradation",
      avgMonthlyCount: 0,
      crRequired: true,
      crDaysBefore: 2,
      approvalLevel: "CIRCLE",
      approvalLevels: ["Level-1", "Level-2", "Level-3"],
      information: ""
    }
  ],

  "HT Panel" : [
    {
      activityDescription: "HT panel replacement/upgradation",
      performBy: "Vendor",
      activityCategory: "Super Critical",
      activityCode: "RED",
      activityType: "Replacement/upgradation",
      avgMonthlyCount: 24,
      crRequired: true,
      crDaysBefore: 5,
      approvalLevel: "NLT",
      approvalLevels: ["Level-1", "Level-2", "Level-3", "Level-4", "Level-5", "Level-6", "Level-7"],
      information: "Mr. Deepak Sanghi"
    },
    {
      activityDescription: "HT panel Preventive maintenance (OEM)",
      performBy: "Vendor",
      activityCategory: "Major",
      activityCode: "BLUE",
      activityType: "Preventive maintenance",
      avgMonthlyCount: 32,
      crRequired: true,
      crDaysBefore: 2,
      approvalLevel: "CIRCLE",
      approvalLevels: ["Level-1", "Level-2", "Level-3"],
      information: ""
    },
    {
      activityDescription: "HT panel Preventive maintenance (In-House)",
      performBy: "In-House",
      activityCategory: "Major",
      activityCode: "BLUE",
      activityType: "Preventive maintenance",
      avgMonthlyCount: 32,
      crRequired: true,
      crDaysBefore: 2,
      approvalLevel: "CIRCLE",
      approvalLevels: ["Level-1", "Level-2", "Level-3"],
      information: ""
    },
    {
      activityDescription: "Fault / Alarm / Break Down - HT Panel",
      performBy: "Vendor",
      activityCategory: "Critical",
      activityCode: "AMBER",
      activityType: "Corrective maintenance",
      avgMonthlyCount: 324,
      crRequired: true,
      crDaysBefore: 0,
      approvalLevel: "NLT",
      approvalLevels: ["Level-1", "Level-2", "Level-3", "Level-4"],
      information: ""
    }
   
  ],

  "LT Panel" : [
    {
      activityDescription: "LT panel replacement/upgradation",
      performBy: "Vendor",
      activityCategory: "Super Critical",
      activityCode: "RED",
      activityType: "Replacement/upgradation",
      avgMonthlyCount: 124,
      crRequired: true,
      crDaysBefore: 5,
      approvalLevel: "NLT",
      approvalLevels: ["Level-1", "Level-2", "Level-3", "Level-4", "Level-5", "Level-6", "Level-7"],
      information: "Mr. Deepak Sanghi"
    },
    {
      activityDescription: "LT panel Preventive maintenance (OEM)",
      performBy: "Vendor",
      activityCategory: "Major",
      activityCode: "BLUE",
      activityType: "Preventive maintenance",
      avgMonthlyCount: 32,
      crRequired: true,
      crDaysBefore: 2,
      approvalLevel: "CIRCLE",
      approvalLevels: ["Level-1", "Level-2", "Level-3"],
      information: ""
    },
    {
      activityDescription: "LT panel Preventive maintenance (In-House)",
      performBy: "In-House",
      activityCategory: "Major",
      activityCode: "BLUE",
      activityType: "Preventive maintenance",
      avgMonthlyCount: 32,
      crRequired: true,
      crDaysBefore: 2,
      approvalLevel: "CIRCLE",
      approvalLevels: ["Level-1", "Level-2", "Level-3"],
      information: ""
    },
    {
      activityDescription: "Fault / Alarm / Break Down - HT Panel",
      performBy: "Vendor",
      activityCategory: "Critical",
      activityCode: "AMBER",
      activityType: "Corrective maintenance",
      avgMonthlyCount: 324,
      crRequired: true,
      crDaysBefore: 0,
      approvalLevel: "NLT",
      approvalLevels: ["Level-1", "Level-2", "Level-3", "Level-4"],
      information: ""
    }
  ],

  Transformer: [
    {
      activityDescription: "Transformer Replacement OEM",
      performBy: "Vendor",
      activityCategory: "Super Critical",
      activityCode: "RED",
      activityType: "Replacement/upgradation",
      avgMonthlyCount: 12,
      crRequired: true,
      crDaysBefore: 5,
      approvalLevel: "NLT",
      approvalLevels: ["Level-1", "Level-2", "Level-3", "Level-4", "Level-5", "Level-6", "Level-7"],
      information: "Mr. Deepak Sanghi"
    },
    {
      activityDescription: "Transformer Preventive maintenance Oil filtration",
      performBy: "Vendor",
      activityCategory: "Critical",
      activityCode: "AMBER",
      activityType: "Preventive maintenance",
      avgMonthlyCount: 63,
      crRequired: true,
      crDaysBefore: 5,
      approvalLevel: "CIRCLE",
      approvalLevels: ["Level-1", "Level-2", "Level-3", "Level-4"],
      information: ""
    },

    {
      activityDescription: "Transformer In House PM",
      performBy: "In-House",
      activityCategory: "Critical",
      activityCode: "BLUE",
      activityType: "Preventive maintenance",
      avgMonthlyCount: 27,
      crRequired: true,
      crDaysBefore: 2,
      approvalLevel: "CIRCLE",
      approvalLevels: ["Level-1", "Level-2", "Level-3"],
      information: ""
    },
  ],

  Other: [
    {
      activityDescription: "Fire Panel / FSS replacement OEM",
      performBy: "In-House",
      activityCategory: "Super Critical",
      activityCode: "RED",
      activityType: "Replacement/upgradation",
      avgMonthlyCount: 32,
      crRequired: true,
      crDaysBefore: 5,
      approvalLevel: "NLT",
      approvalLevels: ["Level-1", "Level-2", "Level-3", "Level-4", "Level-5", "Level-6", "Level-7"],
      information: "Mr. Deepak Sanghi"
    },
    {
      activityDescription: "Fire Panel / FSS maintenance OEM",
      performBy: "OEM",
      activityCategory: "Major",
      activityCode: "BLUE",
      activityType: "Preventive maintenance",
      avgMonthlyCount: 24,
      crRequired: true,
      crDaysBefore: 2,
      approvalLevel: "CIRCLE",
      approvalLevels: ["Level-1", "Level-2", "Level-3"],
      information: ""
    },
    {
      activityDescription: "New Rack power tapping",
      performBy: "OEM",
      activityCategory: "Major",
      activityCode: "BLUE",
      activityType: "Replacement/upgradation",
      avgMonthlyCount: 0,
      crRequired: true,
      crDaysBefore: 0,
      approvalLevel: "CIRCLE",
      approvalLevels: ["Level-1", "Level-2", "Level-3"],
      information: ""
    },
    {
      activityDescription: "Checking Power Dual Redundancy Of Racks",
      performBy: "OEM",
      activityCategory: "Major",
      activityCode: "BLUE",
      activityType: "Preventive maintenance",
      avgMonthlyCount: 23,
      crRequired: true,
      crDaysBefore: 5,
      approvalLevel: "CIRCLE",
      approvalLevels: ["Level-1", "Level-2", "Level-3", "Level-4", "Level-5"],
      information: ""
    },
    {
      activityDescription: "MSC Floor cleaning activity",
      activityCategory: "Minor",
      activityCode: "GREEN",
      activityType: "Preventive maintenance",
      avgMonthlyCount: 0,
      crRequired: false,
      crDaysBefore: null,
      approvalLevel: "Circle",
      approvalLevels: ["Level-1", "Level-2"],
      information: ""
    },
    {
      activityDescription: "Pest Control activity",
      activityCategory: "Minor",
      activityCode: "GREEN",
      activityType: "Preventive maintenance",
      avgMonthlyCount: 0,
      crRequired: false,
      crDaysBefore: null,
      approvalLevel: "Circle",
      approvalLevels: ["Level-1", "Level-2"],
      information: ""
    }
  ]
};
