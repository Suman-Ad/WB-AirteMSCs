// Fixed site-wise configs
const transformerRatingsInKVA = {
  "Asansol": "1X1000",
  "Berhampore": "1X750",
  "Kharagpur": "2X2000"
};

const ebSanctionLoadInKVA = {
  "Andaman": "177.70",
  "Asansol": "530.00",
  "Berhampore": "540.00",
  "Kharagpur": "1490.00",
  "Mira Tower": "500.00",
  "Globsyn": "650.00"
};

const dgInstalledCapacityInKVA = {
  "Andaman": "3x160",
  "Asansol": "2x1010",
  "Berhampore": "2x750",
  "Kharagpur": "2x2250",
  "Mira Tower": "2x500",
  "Globsyn": "2x600"
};

const dieselTankCapacityInLiter = {
  "Andaman": "1060.00",
  "Asansol": "1980.00",
  "Berhampore": "1980.00",
  "Globsyn": "1400.00",
  "Mira Tower": "1980.00",
  "New Alipore": "990.00"
};

const fieldConfig = [
  { name: "Transformer Rating in KVA", fixed: transformerRatingsInKVA },
  { name: "EB SANCTION LOAD KVA", fixed: ebSanctionLoadInKVA },
  { name: "SITE LOAD (MD) in KVA", formula: () => "0.00" },
  { name: "RUNNING P.F", fixed: { default: "0.98" } }, // default for all sites
  // { name: "EB1 READING OPENIN", type: "number" },
  // { name: "EB1 READING CLOSING", type: "number" },
  //   { name: "EB2 READING OPENIN", type: "number" },
  //   { name: "EB2 READING CLOSING", type: "number" },
  //   { name: "EB3 READING OPENIN", type: "number" },
  //   { name: "EB3 READING CLOSING", type: "number" },
  //   { name: "EB4 READING OPENIN", type: "number" },
  //   { name: "EB4 READING CLOSING", type: "number" },
  //   { name: "EB5 READING OPENIN", type: "number" },
  //   { name: "EB5 READING CLOSING", type: "number" },
  //   { name: "EB6 READING OPENIN", type: "number" },
  //   { name: "EB6 READING CLOSING", type: "number" },
  //   { name: "EB7 READING OPENIN", type: "number" },
  //   { name: "EB7 READING CLOSING", type: "number" },
  //   { name: "EB8 READING OPENIN", type: "number" },
  //   { name: "EB8 READING CLOSING", type: "number" },
  //   { name: "EB9 READING OPENIN", type: "number" },
  //   { name: "EB9 READING CLOSING", type: "number" },
  //   { name: "EB10 READING OPENIN", type: "number" },
  //   { name: "EB10 READING CLOSING", type: "number" },
  //   { name: "EB11 READING OPENIN", type: "number" },
  //   { name: "EB11 READING CLOSING", type: "number" },
  {
    name: "TOTAL UNIT CONSUMED",
    formula: (data) => {
      let total = 0;
      for (let i = 1; i <= 11; i++) {
        const open = parseFloat(data[`EB${i} READING OPENIN`] || 0);
        const close = parseFloat(data[`EB${i} READING CLOSING`] || 0);
        total += close - open;
      }
      return total.toFixed(2);
    }
  },
    { name: "EB Capacity utilization (%)", formula: (data) => {
        const totalUnits = parseFloat(data["TOTAL UNIT CONSUMED"] || 0);
        const sanctionLoad = parseFloat(data["EB SANCTION LOAD KVA"] || 1);
        return ((totalUnits / (sanctionLoad * 24)) * 100).toFixed(2);
        }
    },
    { name: "Facility Consumed Units", type: "number" },
    { name: "UPGRADATION REQUIRED", type: "select", options: ["Yes", "No"] },
    { name: "Power Failure Hrs/Mins", type: "time"},
    { name: "Office load KW", formula: () => "0.00" },
    { name: "Cooling Load KW", formula: () => "0.00" },
    { name: "IT Load KW", formula: () => "0.00" },
    { name: "Total Facility Load KW", formula: (data) => {
        const office = parseFloat(data["Office load KW"] || 0);
        const cooling = parseFloat(data["Cooling Load KW"] || 0);
        const itLoad = parseFloat(data["IT Load KW"] || 0);
        return (office + cooling + itLoad).toFixed(2);
        }
    },
    { name: "PUE", formula: (data) => {
        const totalLoad = parseFloat(data["Total Facility Load KW"] || 0);
        return totalLoad > 0 ? (totalLoad / (totalLoad - 0)).toFixed(2) : "0.00"; // Simplified for example
        }
    },
    { name: "DG Working status", type: "select", options: ["Working", "Not Working"] },
    { name: "DG Battery status", type: "select", options: ["Good", "Needs Replacement"] },
  { name: "DG - Installed Capacity in KVA", fixed: dgInstalledCapacityInKVA },
    { name: "DG Utilization in KVA", formula: () => "0.00" },
    { name: "DG Capacity Utilization (%)", formula: () => "0.00" },
    { name: "DG UP GRADATION REQUIRED", type: "select", options: ["Yes", "No"] },
    // { name: "DG 1 Run HRS -Opening Reading", type: "number" },
    // { name: "DG 1 Run HRS -Closing Reading", type: "number" },
    // { name: "DG 2 Run HRS -Opening Reading", type: "number" },
    // { name: "DG 2 Run HRS -Closing Reading", type: "number" },
    // { name: "DG 3 Run HRS -Opening Reading", type: "number" },
    // { name: "DG 3 Run HRS -Closing Reading", type: "number" },
    // { name: "DG 4 Run HRS -Opening Reading", type: "number" },
    // { name: "DG 4 Run HRS -Closing Reading", type: "number" },
    { name: "TOTAL DG RUN HRS", formula: (data) => {
        let total = 0;
        for (let i = 1; i <= 4; i++) {
            const open = parseFloat(data[`DG ${i} Run HRS -Opening Reading`] || 0);
            const close = parseFloat(data[`DG ${i} Run HRS -Closing Reading`] || 0);
            total += close - open;
        }
        return total.toFixed(2);
        }
    },
    { name: "Diesel Tank Capacity (L)", fixed: dieselTankCapacityInLiter },
    { name: "Diesel Available in Tank (L)", type: "number" },
    { name: "Diesel Available in Tank (%)", formula: (data) => {
        const available = parseFloat(data["Diesel Available in Tank (L)"] || 0);
        const capacity = parseFloat(dieselTankCapacityInLiter[data.site] || 1);
        return ((available / capacity) * 100).toFixed(2);
        }
    },
    // { name: "DG1 KWH OPENING READING", type: "number" },
    // { name: "DG1 KWH CLOSING READING", type: "number" },
    // { name: "DG2 KWH OPENING READING", type: "number" },
    // { name: "DG2 KWH CLOSING READING", type: "number" },
    // { name: "DG3 KWH OPENING READING", type: "number" },
    // { name: "DG3 KWH CLOSING READING", type: "number" },
    // { name: "DG4 KWH OPENING READING", type: "number" },
    // { name: "DG4 KWH CLOSING READING", type: "number" },
    { name: "TOTAL KWH CONSUMED", formula: (data) => {
        let total = 0;
        for (let i = 1; i <= 4; i++) {
            const open = parseFloat(data[`DG${i} KWH OPENING READING`] || 0);
            const close = parseFloat(data[`DG${i} KWH CLOSING READING`] || 0);
            total += close - open;
        }
        return total.toFixed(2);
        }
    },
    { name: "TOTAL DG KWH UNIT CONSUMPED", formula: (data) => {
        let total = 0;
        for (let i = 1; i <= 4; i++) {
            const open = parseFloat(data[`DG${i} KWH OPENING READING`] || 0);
            const close = parseFloat(data[`DG${i} KWH CLOSING READING`] || 0);
            total += close - open;
        }
        return total.toFixed(2);
        }
    },
    { name: "SOLAR", type: "select", options: ["Yes", "No"] },
    { name: "KWH OPENING READING", type: "number" },
    { name: "KWH CLOSING READING", type: "number" },
    { name: "TOTAL KWH GENERATED", formula: (data) => {
            const open = parseFloat(data["KWH OPENING READING"] || 0);
            const close = parseFloat(data["KWH CLOSING READING"] || 0);
            return (close - open).toFixed(2);
            }
        },
    { name: "UPS", type: "select", options: ["Yes", "No"] },
    { name: "Avg UPS load (%)", formula: () => "0.00" },
    { name: "UPS LOAD FOR SYSTEM IN KW", type: "number" },
    { name: "Status of Batteries", type: "select", options: ["Normal", "Needs Replacement"] },
    { name: "Status of all UPS", type: "select", options: ["Working", "Not Working"] },
    { name: "INSTALLED SMPS", type: "number" },
    { name: "RUNNING DC LOAD AMP.", type: "number" },
    { name: "RUUNNING DC LOAD IN KW", formula: (data) => {
            const amp = parseFloat(data["RUNNING DC LOAD AMP."] || 0);
            return (amp * 48 / 1000).toFixed(2); // Assuming 48V system
            }
        },
    { name: "INSTALLED BB AH", type: "number" },
    { name: "SMPS UPGRADATIONS REQURIED", type: "select", options: ["Yes", "No"] },
    { name: "HVAC - High Side", type: "select", options: ["Yes", "No"] },
    { name: "Status AHU / Split / PAC / Floor Mount / Window / Cassete", type: "text" },
    { name: "Average Room Temperature (Deg Cel)", type: "number" },
    { name: "OBSERVATIONS", type: "textarea" },
    { name: "Breakdown Minor", type: "number" },
    { name: "Breakdown Major", type: "number" },
    { name: "Incidents", type: "number" },
    { name: "Any activity to be carried Out to Improve the Performance", type: "textarea" },
    { name: "FAS & FIRE SUPRESSON SYSTEMS", type: "select", options:["Yes","No"]},
    { name: "Status of FAS", type:"select", options:["Working","Not Working"]},
    { name: 'VESDA',type:"select", options:["Yes","No"]},
    { name: "Status of Fire Suppression system", type: "select", options:["Working","Not Working"]},
    { name: "Fire Extinguisher", type: "number" },
    { name: "CCTV SYSTEMS", type: "select", options:["Yes","No"]},
    { name: "No. of camera installed", type: "number" },
    { name: "No. of camera in working condition", type: "number" },
    { name: "DVR / NVR Storage capacity TB", type: "number" },
    { name: "ACCESS CONTROL & BMS SYSTEMS", type: "select", options:["Yes","No"]},
    { name: "No. of Access Reader installed", type: "number" },
    { name: "No. of Access Reader in working condition", type: "number" },
    { name: "BMS available", type: "select", options:["Yes","No"]},
    { name: "BMS in working condition", type: "select", options:["Yes","No"]}
  // ... rest fields
];

export default fieldConfig;
