import { APPROVAL_LEVELS } from "./approvalLevels";

// activityMaster.js
export const getApproversFromLevels = (levels = []) => {
  return levels.flatMap(level =>
    (APPROVAL_LEVELS[level] || []).map(approver => ({
      level,
      approver
    }))
  );
};

export const ACTIVITY_MASTER = {
  UPS: [
    {
      activityDescription: "UPS EOL replacement/upgradation",
      activityCategory: "Super Critical",
      activityCode: "RED",
      activityType: "Replacement/upgradation",
      avgMonthlyCount: 0,
      mopRequired: true,
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
      mopRequired: true,

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
      mopRequired: true,

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
      mopRequired: true,

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
      mopRequired: true,

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
      mopRequired: true,

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
      mopRequired: true,
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
      mopRequired: true,
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
      mopRequired: true,
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
      mopRequired: true,
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
      mopRequired: true,
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
      mopRequired: true,
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
      mopRequired: true,
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
      mopRequired: true,
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
      mopRequired: true,
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
      mopRequired: true,
      crRequired: true,
      crDaysBefore: 2,
      approvalLevel: "CIRCLE",
      approvalLevels: ["Level-1", "Level-2", "Level-3"],
      information: ""
    },
    {
      activityDescription: "Battery Bank Discharge test C-10",
      performBy: "In-House",
      activityCategory: "Critical",
      activityCode: "AMBER",
      activityType: "Preventive maintenance",
      avgMonthlyCount: 56,
      mopRequired: true,
      crRequired: true,
      crDaysBefore: 2,
      approvalLevel: "CIRCLE",
      approvalLevels: ["Level-1", "Level-2", "Level-3", "Level-4"],
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
      mopRequired: true,
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
      mopRequired: true,
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
      mopRequired: true,
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
      mopRequired: true,
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
      mopRequired: false,
      crRequired: false,
      crDaysBefore: 0,
      approvalLevel: "Circle",
      approvalLevels: ["Level-1", "Level-2"],
      information: ""
    }
  ],

  "Air conditioner": [
    {
      activityDescription: "PAC EOL replacement/upgradation",
      performBy: "OEM",
      activityCategory: "Major",
      activityCode: "BLUE",
      activityType: "Replacement/upgradation",
      avgMonthlyCount: 92,
      mopRequired: true,
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
      mopRequired: true,
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
      mopRequired: true,
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
      mopRequired: true,
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
      mopRequired: true,
      crRequired: true,
      crDaysBefore: 2,
      approvalLevel: "CIRCLE",
      approvalLevels: ["Level-1", "Level-2", "Level-3"],
      information: ""
    }
  ],

  "HT Panel": [
    {
      activityDescription: "HT panel replacement/upgradation",
      performBy: "Vendor",
      activityCategory: "Super Critical",
      activityCode: "RED",
      activityType: "Replacement/upgradation",
      avgMonthlyCount: 24,
      mopRequired: true,
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
      mopRequired: true,
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
      mopRequired: true,
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
      mopRequired: true,
      mopRequired: true,
      crRequired: true,
      crDaysBefore: 0,
      approvalLevel: "NLT",
      approvalLevels: ["Level-1", "Level-2", "Level-3", "Level-4"],
      information: ""
    }

  ],

  "LT Panel": [
    {
      activityDescription: "LT panel replacement/upgradation",
      performBy: "Vendor",
      activityCategory: "Super Critical",
      activityCode: "RED",
      activityType: "Replacement/upgradation",
      avgMonthlyCount: 124,
      mopRequired: true,
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
      mopRequired: true,
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
      mopRequired: true,
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
      mopRequired: true,
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
      mopRequired: true,
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
      mopRequired: true,
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
      mopRequired: true,
      crRequired: true,
      crDaysBefore: 2,
      approvalLevel: "CIRCLE",
      approvalLevels: ["Level-1", "Level-2", "Level-3"],
      information: ""
    },
  ],

  CCTV: [
    {
      activityDescription: "CCTV Preventive maintenance (In-House) ",
      performBy: "In-House",
      activityCategory: "Minor",
      activityCode: "GREEN",
      activityType: "Preventive maintenance",
      avgMonthlyCount: 0,
      mopRequired: false,
      crRequired: false,
      crDaysBefore: 2,
      approvalLevel: "Circle",
      approvalLevels: ["Level-1", "Level-2"],
      information: ""
    }
  ],

  PFE: [
    {
      activityDescription: "Portable fire extinguisher preventive maintenance (In-House) ",
      performBy: "In-House",
      activityCategory: "Minor",
      activityCode: "GREEN",
      activityType: "Preventive maintenance",
      avgMonthlyCount: 0,
      mopRequired: false,
      crRequired: false,
      crDaysBefore: 2,
      approvalLevel: "Circle",
      approvalLevels: ["Level-1", "Level-2"],
      information: ""
    }
  ],

  PAS: [
    {
      activityDescription: "Public address system preventive maintenance (In-House) ",
      performBy: "In-House",
      activityCategory: "Minor",
      activityCode: "GREEN",
      activityType: "Preventive maintenance",
      avgMonthlyCount: 0,
      mopRequired: false,
      crRequired: false,
      crDaysBefore: 2,
      approvalLevel: "Circle",
      approvalLevels: ["Level-1", "Level-2"],
      information: ""
    }
  ],

  "Earth Pit": [
    {
      activityDescription: "Earth Pit Preventive maintenance (In-House) ",
      performBy: "In-House",
      activityCategory: "Minor",
      activityCode: "GREEN",
      activityType: "Preventive maintenance",
      avgMonthlyCount: 0,
      mopRequired: false,
      crRequired: false,
      crDaysBefore: 2,
      approvalLevel: "Circle",
      approvalLevels: ["Level-1", "Level-2"],
      information: ""
    }
  ],

  ACS: [
    {
      activityDescription: "Access Control System Preventive maintenance (In-House)",
      performBy: "In-House",
      activityCategory: "Minor",
      activityCode: "GREEN",
      activityType: "Preventive maintenance",
      avgMonthlyCount: 0,
      mopRequired: false,
      crRequired: false,
      crDaysBefore: 2,
      approvalLevel: "Circle",
      approvalLevels: ["Level-1", "Level-2"],
      information: ""
    },
    {
      activityDescription: "Access Control System Preventive maintenance (OEM)",
      performBy: "OEM",
      activityCategory: "Minor",
      activityCode: "GREEN",
      activityType: "Preventive maintenance",
      avgMonthlyCount: 0,
      mopRequired: false,
      crRequired: false,
      crDaysBefore: 2,
      approvalLevel: "Circle",
      approvalLevels: ["Level-1", "Level-2"],
      information: ""
    },
    {
      activityDescription: "Fault / Alarm / Break Down - Access Control System",
      performBy: "OEM",
      activityCategory: "Minor",
      activityCode: "GREEN",
      activityType: "Preventive maintenance",
      avgMonthlyCount: 0,
      mopRequired: false,
      crRequired: false,
      crDaysBefore: 2,
      approvalLevel: "Circle",
      approvalLevels: ["Level-1", "Level-2"],
      information: ""
    }
  ],

  FAS: [
    {
      activityDescription: "Fire Panel replacement OEM",
      performBy: "In-House",
      activityCategory: "Super Critical",
      activityCode: "RED",
      activityType: "Replacement/upgradation",
      avgMonthlyCount: 32,
      mopRequired: true,
      crRequired: true,
      crDaysBefore: 5,
      approvalLevel: "NLT",
      approvalLevels: ["Level-1", "Level-2", "Level-3", "Level-4", "Level-5", "Level-6", "Level-7"],
      information: "Mr. Deepak Sanghi"
    },
    {
      activityDescription: "Fire Panel maintenance OEM",
      performBy: "OEM",
      activityCategory: "Major",
      activityCode: "BLUE",
      activityType: "Preventive maintenance",
      avgMonthlyCount: 24,
      mopRequired: true,
      crRequired: true,
      crDaysBefore: 2,
      approvalLevel: "CIRCLE",
      approvalLevels: ["Level-1", "Level-2", "Level-3"],
      information: ""
    },
  ],

  FSS: [
    {
      activityDescription: "FSS replacement OEM",
      performBy: "In-House",
      activityCategory: "Super Critical",
      activityCode: "RED",
      activityType: "Replacement/upgradation",
      avgMonthlyCount: 32,
      mopRequired: true,
      crRequired: true,
      crDaysBefore: 5,
      approvalLevel: "NLT",
      approvalLevels: ["Level-1", "Level-2", "Level-3", "Level-4", "Level-5", "Level-6", "Level-7"],
      information: "Mr. Deepak Sanghi"
    },
    {
      activityDescription: "FSS maintenance OEM",
      performBy: "OEM",
      activityCategory: "Major",
      activityCode: "BLUE",
      activityType: "Preventive maintenance",
      avgMonthlyCount: 24,
      mopRequired: true,

      crRequired: true,
      crDaysBefore: 2,
      approvalLevel: "CIRCLE",
      approvalLevels: ["Level-1", "Level-2", "Level-3"],
      information: ""
    },
  ],

  Other: [

    {
      activityDescription: "New Rack power tapping",
      performBy: "OEM",
      activityCategory: "Major",
      activityCode: "BLUE",
      activityType: "Replacement/upgradation",
      avgMonthlyCount: 0,
      mopRequired: true,
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
      mopRequired: true,
      crRequired: true,
      crDaysBefore: 5,
      approvalLevel: "CIRCLE",
      approvalLevels: ["Level-1", "Level-2", "Level-3", "Level-4", "Level-5"],
      information: ""
    },
    {
      activityDescription: "MSC Floor cleaning activity",
      performBy: "In-House",
      activityCategory: "Minor",
      activityCode: "GREEN",
      activityType: "Preventive maintenance",
      avgMonthlyCount: 0,
      mopRequired: false,
      crRequired: false,
      crDaysBefore: 0,
      approvalLevel: "Circle",
      approvalLevels: ["Level-1", "Level-2"],
      information: ""
    },
    {
      activityDescription: "Pest Control activity",
      performBy: "Vendor",
      activityCategory: "Minor",
      activityCode: "GREEN",
      activityType: "Preventive maintenance",
      avgMonthlyCount: 0,
      mopRequired: false,
      crRequired: false,
      crDaysBefore: 1,
      approvalLevel: "Circle",
      approvalLevels: ["Level-1", "Level-2"],
      information: ""
    }
  ]
};
