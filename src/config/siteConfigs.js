// src/config/siteConfig.js

// 1️⃣ Regions → Circles
export const regions = {
  East: ["BH & JH", "NESA", "OR", "WB"],
  West: ["GUJ", "MPCG", "ROM"],
  North: ["DEL", "HR", "PJ", "RJ", "UP", "UK"],
  South: ["AP", "KA", "KL", "TN", "TS"]
};

// 2️⃣ Region → Circle → Sites
export const siteList = {
  "East": {
    "BH & JH": ["Patliputra", "Bhaglpur", "Muzaffarpur New", "Muzaffarpur Old", "Ranchi", "Ranchi telenor", "Marwari Awas"],
    "WB": ["Andaman", "Asansol", "Berhampore", "DLF", "Globsyn", "Infinity-I", "Infinity-II", "Kharagpur", "Mira Tower", "New Alipore", "SDF", "Siliguri"],
    "NESA": ["Aizwal", "Guwahati", "Jorabat New", "Jorhat", "Shillong"],
    "OR": ["Cuttack", "Sambalpur"],

  },
  "West": {
    "GUJ": ["Astron Park", "Bharti House", "Changodar", "Rajkot Madhapar-New", "Rajkot Mavdi Old", "Surat", "Surat Telenor"],
    "MPCG": ["Bhopal Center 1st floor", "Bhopal Center 4th floor", "Gobindpura", "Gwalior", "Indore Geeta Bhawan", "Jabalpur", "Pardesipura", "Raipur"],
    "ROM": ["Nagpur-I", "Vega Center", "E-Space", "Kolhapur", "Nagpur-II", "Nagpur BTSOL"],
  },
  "North": {
    "DEL": ["DLF", "Mira Tower"],
    "HR": ["GLOBSYN"]
  },
  "South": {
    "KA": ["Infinity-I", "Infinity-II"],
    "TS": ["Siliguri"]
  }
};

// 3️⃣ Site → Site ID mapping
// Add this mapping near the top of the file (below siteList)
export const siteIdMap = {
  "Astron Park": "N24027A",
  "Bharti House": "N24028A",
  "Changodar": "N24024A",
  "Rajkot Madhapar-New": "N24025A",
  "Rajkot Mavdi Old": "N24026A",
  "Surat": "N24023A",
  "Surat Telenor": "Tel-Surat",
  "Cuttack": "N21062A",
  "Sambalpur": "N21061A",
  "Aizwal": "N15122A",
  "Guwahati": "N18060A",
  "Jorabat New": "N18059A",
  "Jorhat": "N17121A",
  "Shillong": "NET006263",
  "Patliputra": "N10009A",
  "Bhaglpur": "N10011A",
  "Muzaffarpur New": "N10010A",
  "Muzaffarpur Old": "N10012A",
  "Ranchi": "N20029A",
  "Ranchi telenor": "Tel-Ranchi",
  "Marwari Awas": "N10013A",
  "Bhopal Center 1st floor": "N23044A",
  "Bhopal Center 4th floor": "N23045B",
  "Gobindpura": "N23048A",
  "Gwalior": "N23046A",
  "Indore Geeta Bhawan": "N23042A",
  "Jabalpur": "N23043A",
  "Pardesipura": "N23047A",
  "Raipur": "N22014A",
  "Nagpur": "N27066A",
  "Vega Center": "N27064A",
  "E-Space": "N27065A",
  "Kolhapur": "N27067A",
  "Nagpur New": "N27068A",
  "Nagpur BTSOL": "N27069A",
  "Andaman": "N35113A",
  "Asansol": "N19106A",
  "Berhampore": "N19104A",
  "Globsyn": "N19114A",
  "Mira Tower": "N19108A",
  "New Alipore": "N19107A",
  "DLF": "N19112A",
  "Infinity-I": "N19111A",
  "Infinity-II": "Infinity2.0",
  "Kharagpur": "N19103A",
  "SDF": "N19109A",
  "Siliguri": "N19105A",
};