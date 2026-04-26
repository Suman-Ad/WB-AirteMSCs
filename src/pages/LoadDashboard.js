import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import { Link, useNavigate } from "react-router-dom";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer
} from "recharts";


const isAdminAssignmentValid = (userData) => {
  if (!userData?.isAdminAssigned) return false;
  if (!userData?.adminAssignFrom || !userData?.adminAssignTo) return false;

  const getISTNow = () => {
    return new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );
  };

  const today = getISTNow();
  const from = new Date(userData.adminAssignFrom);
  const to = new Date(userData.adminAssignTo);

  return today >= from && today <= to;
};

const LoadDashboard = ({ userData }) => {
  const isAdmin =
    userData?.role === "Super Admin" ||
    userData?.role === "Admin" ||
    userData.isAdminAssigned ||
    isAdminAssignmentValid(userData) ||
    userData?.designation === "Vertiv CIH" ||
    userData?.designation === "Vertiv ZM";
  const [data, setData] = useState([]);
  const [totalLoad, setTotalLoad] = useState(0);
  const getISTDate = () => {
    return new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Kolkata",
    });
  };
  const today = getISTDate();
  const formatIST = (date) => {
    return new Date(date).toLocaleDateString("en-CA", {
      timeZone: "Asia/Kolkata",
    });
  };

  const [selectedDate, setSelectedDate] = useState(today);
  const navigate = useNavigate();
  const [trendData, setTrendData] = useState([]);
  const [trendRawData, setTrendRawData] = useState([]);
  const [rangeType, setRangeType] = useState("daily"); // daily | monthly | yearly
  const [selectedEquipment, setSelectedEquipment] = useState("ALL");
  const [selectedType, setSelectedType] = useState("ALL");
  const REQUIRED_SLOTS = ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00"];
  const SMPS_REQUIRED_SLOTS = ["02:00", "08:00", "14:00", "20:00"];
  const getMissingSlots = (data) => {
    let equipmentSlots = {};

    data.forEach((row) => {
      const eqId = row.equipmentId || "UNKNOWN";

      if (!equipmentSlots[eqId]) {
        equipmentSlots[eqId] = new Set();
      }

      if (row.time) {
        equipmentSlots[eqId].add(row.time);
      }
    });

    let missingReport = {};

    Object.entries(equipmentSlots).forEach(([eqId, slots]) => {
      const missing = eqId.includes("SMPS") ? SMPS_REQUIRED_SLOTS.filter(s => !slots.has(s)) : REQUIRED_SLOTS.filter(s => !slots.has(s));

      if (missing.length > 0) {
        missingReport[eqId] = missing;
      }
    });

    return missingReport;
  };

  const missingSlots = getMissingSlots(data);

  const siteKey = userData?.siteId;

  useEffect(() => {
    if (!siteKey || !selectedDate) return;

    try {
      const colRef = collection(
        db,
        "loadData",
        siteKey,
        "dailyData",
        selectedDate,
        "entries"
      );

      const unsubscribe = onSnapshot(
        colRef,
        (snapshot) => {
          let equipmentMap = {};
          let list = [];

          snapshot.forEach((doc) => {
            const d = doc.data();

            let loadKW = 0;

            if (d.equipmentType === "SMPS") {
              const dcV = Number(d.dcVoltage || 0);
              const dcI = Number(d.dcCurrent || 0);
              loadKW = (dcV * dcI) / 1000;
            } else if (d.equipmentType === "UPS") {
              loadKW =
                Number(d.runningKWR || 0) +
                Number(d.runningKWY || 0) +
                Number(d.runningKWB || 0);
            } else {
              const voltage = (Number(d.voltageRY || 0) + Number(d.voltageYB || 0) + Number(d.voltageBR || 0)) / 3;
              const avgCurrent =
                (Number(d.currentR || 0) +
                  Number(d.currentY || 0) +
                  Number(d.currentB || 0)) / 3;

              const pf = Number(d.powerFactor || 0.9);

              loadKW = (1.732 * voltage * avgCurrent * pf) / 1000;
            }

            const eqId = d.equipmentId || "UNKNOWN";
            // 👉 group by equipment
            if (!equipmentMap[eqId]) {
              equipmentMap[eqId] = { sum: 0, count: 0, type: d.equipmentType };
            }

            equipmentMap[eqId].sum += loadKW;
            equipmentMap[eqId].count += 1;

            list.push({
              id: doc.id,
              ...d,
              loadKW: loadKW || 0,
            });
          });

          // Sort by Time → Equipment ID
          list.sort((a, b) => {
            // Convert time like "02:00 PM" → comparable value
            const parseTime = (t) => {
              if (!t) return 0;

              // Handle 24-hour format (e.g., "14:00")
              if (!t.includes("AM") && !t.includes("PM")) {
                const [h, m] = t.split(":").map(Number);
                return h * 60 + m;
              }

              // Handle 12-hour format
              const [time, modifier] = t.split(" ");
              let [hours, minutes] = time.split(":").map(Number);

              if (modifier === "PM" && hours !== 12) hours += 12;
              if (modifier === "AM" && hours === 12) hours = 0;

              return hours * 60 + minutes;
            };

            const timeDiff = parseTime(a.time) - parseTime(b.time);

            if (timeDiff !== 0) return timeDiff;

            // Secondary sort → Equipment ID
            return (a.equipmentId || "").localeCompare(b.equipmentId || "");
          });

          // ✅ Calculate total as sum of equipment-wise averages
          let total = 0;

          Object.values(equipmentMap).forEach((eq) => {
            if (eq.type === "LT") {
              total += eq.sum / eq.count;
            }
          });

          setData(list);
          setTotalLoad(total);
        },
        (error) => {
          console.error("Realtime error:", error);
          setData([]);
          setTotalLoad(0);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error("Setup error:", err);
    }
  }, [siteKey, selectedDate]);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure to delete?")) return;

    try {
      await deleteDoc(
        doc(db, "loadData", siteKey, "dailyData", selectedDate, "entries", id)
      );

      alert("Deleted successfully");
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const handleEdit = (row) => {
    navigate("/load-entry", {
      state: {
        editData: row,
        docId: row.id,
      },
    });
  };

  // Configuration for different equipment types
  const tableConfig = {
    SMPS: {
      headers: [
        "Date", "Time", "Equipment",
        "R-N (V)", "Y-N (V)", "B-N (V)",
        "R (A)", "Y (A)", "B (A)",
        "R Temp", "Y Temp", "B Temp",
        "SPD Status",
        "DC Voltage", "DC Current",
        "Faulty Modules", "System Status",
        "Load (kW)", "Technician", "Uploaded By"
      ],

      renderRow: (row) => (
        <>
          <td>{row.date || "-"}</td>
          <td>{row.time || "-"}</td>
          <td>{row.equipmentId || "-"}</td>
          <td>{row.voltageRN || "-"}</td>
          <td>{row.voltageYN || "-"}</td>
          <td>{row.voltageBN || "-"}</td>
          <td>{row.currentR || "-"}</td>
          <td>{row.currentY || "-"}</td>
          <td>{row.currentB || "-"}</td>
          <td>{row.tempR || "-"}</td>
          <td>{row.tempY || "-"}</td>
          <td>{row.tempB || "-"}</td>
          <td>{row.spdStatus || "-"}</td>
          <td>{row.dcVoltage || "-"}</td>
          <td>{row.dcCurrent || "-"}</td>
          <td>{row.faultyModules || "-"}</td>
          <td>{row.systemStatus || "-"}</td>
          <td>{(row.loadKW || 0).toFixed(2)}</td>
          <td>{row.technicianName || "-"}</td>
          <td>
            <p>{row.uploadedBy?.name || "-"}</p>
            <p>{row.uploadedBy?.empId || "-"}</p>
          </td>
        </>
      ),
    },

    UPS: {
      headers: [
        "Date", "Time", "Equipment",
        "Input R-Y (V)", "Input  Y-B (V)", "Input  B-R (V)",
        "Input R-N (V)", "Input Y-N (V)", "Input B-N (V)",
        "Input  R (A)", "Input  Y (A)", "Input B (A)", "Input N (A)",
        "R Temp", "Y Temp", "B Temp",
        "Output R-Y (V)", "Output  Y-B (V)", "Output  B-R (V)",
        "Output R-N (V)", "Output Y-N (V)", "Output B-N (V)",
        "Output  R (A)", "Output  Y (A)", "Output B (A)", "Output N (A)",
        "Power Factor R", "Power Factor Y", "Power Factor B",
        "Running Load (kW) R", "Running Load (kW) Y", "Running Load (kW) B",
        "Load (kW)", "Technician", "Uploaded By"
      ],
      renderRow: (row) => (
        <>
          <td>{row.date || "-"}</td>
          <td>{row.time || "-"}</td>
          <td>{row.equipmentId || "-"}</td>
          <td>{row.voltageRY || "-"}</td>
          <td>{row.voltageYB || "-"}</td>
          <td>{row.voltageBR || "-"}</td>
          <td>{row.voltageRN || "-"}</td>
          <td>{row.voltageYN || "-"}</td>
          <td>{row.voltageBN || "-"}</td>
          <td>{row.currentR || "-"}</td>
          <td>{row.currentY || "-"}</td>
          <td>{row.currentB || "-"}</td>
          <td>{row.currentN || "-"}</td>
          <td>{row.tempR || "-"}</td>
          <td>{row.tempY || "-"}</td>
          <td>{row.tempB || "-"}</td>
          <td>{row.outVoltageRY || "-"}</td>
          <td>{row.outVoltageYB || "-"}</td>
          <td>{row.outVoltageBR || "-"}</td>
          <td>{row.outVoltageRN || "-"}</td>
          <td>{row.outVoltageYN || "-"}</td>
          <td>{row.outVoltageBN || "-"}</td>
          <td>{row.outCurrentR || "-"}</td>
          <td>{row.outCurrentY || "-"}</td>
          <td>{row.outCurrentB || "-"}</td>
          <td>{row.outCurrentN || "-"}</td>
          <td>{row.powerFactorR || "-"}</td>
          <td>{row.powerFactorY || "-"}</td>
          <td>{row.powerFactorB || "-"}</td>
          <td>{row.runningKWR || "-"}</td>
          <td>{row.runningKWY || "-"}</td>
          <td>{row.runningKWB || "-"}</td>
          <td>{(row.loadKW || 0).toFixed(2)}</td>
          <td>{row.technicianName || "-"}</td>
          <td>
            <p>{row.uploadedBy?.name || "-"}</p>
            <p>{row.uploadedBy?.empId || "-"}</p>
          </td>
        </>
      ),
    },

    LT: {
      headers: [
        "Date", "Time", "Equipment",
        "Input R-Y (V)", "Input  Y-B (V)", "Input  B-R (V)",
        "Input R-N (V)", "Input Y-N (V)", "Input B-N (V)",
        "Input  R (A)", "Input  Y (A)", "Input B (A)",
        "R Temp", "Y Temp", "B Temp",
        "Power Factor",
        "Running Load (kWH) Reading",
        "Load (kW)", "Technician", "Uploaded By"
      ],
      renderRow: (row) => (
        <>
          <td>{row.date || "-"}</td>
          <td>{row.time || "-"}</td>
          <td>{row.equipmentId || "-"}</td>
          <td>{row.voltageRY || "-"}</td>
          <td>{row.voltageYB || "-"}</td>
          <td>{row.voltageBR || "-"}</td>
          <td>{row.voltageRN || "-"}</td>
          <td>{row.voltageYN || "-"}</td>
          <td>{row.voltageBN || "-"}</td>
          <td>{row.currentR || "-"}</td>
          <td>{row.currentY || "-"}</td>
          <td>{row.currentB || "-"}</td>
          <td>{row.tempR || "-"}</td>
          <td>{row.tempY || "-"}</td>
          <td>{row.tempB || "-"}</td>
          <td>{row.powerFactor || "-"}</td>
          <td>{row.kwh || "-"}</td>
          <td>{(row.loadKW || 0).toFixed(2)}</td>
          <td>{row.technicianName || "-"}</td>
          <td>
            <p>{row.uploadedBy?.name || "-"}</p>
            <p>{row.uploadedBy?.empId || "-"}</p>
          </td>
        </>
      ),
    },
  };

  const groupedData = data.reduce((acc, item) => {
    const type = item.equipmentType || "Others";
    if (!acc[type]) acc[type] = [];
    acc[type].push(item);
    return acc;
  }, {});

  const equipmentTypes = [
    "ALL",
    ...new Set(trendRawData.map(d => d.equipmentType))
  ];

  const equipmentIds = [
    "ALL",
    ...new Set(
      trendRawData
        .filter(d => selectedType === "ALL" || d.equipmentType === selectedType)
        .map(d => d.equipmentId)
    )
  ];

  useEffect(() => {
    setSelectedEquipment("ALL");
  }, [selectedType]);

  useEffect(() => {
    setSelectedType("ALL");
    setSelectedEquipment("ALL");
  }, [rangeType]);

  useEffect(() => {
    if (!siteKey) return;

    let unsubscribeList = [];
    let dataMap = {}; // ✅ store per date

    const fetchTrendData = async () => {
      let datesToFetch = [];

      if (rangeType === "daily") {
        datesToFetch = [selectedDate];
      }

      else if (rangeType === "monthly") {
        const selected = new Date(selectedDate);
        const year = selected.getFullYear();
        const month = selected.getMonth();

        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let d = 1; d <= daysInMonth; d++) {
          const dateStr = formatIST(new Date(year, month, d));
          datesToFetch.push(dateStr);
        }
      }

      else if (rangeType === "yearly") {
        const year = new Date(selectedDate).getFullYear();

        for (let m = 0; m < 12; m++) {
          const daysInMonth = new Date(year, m + 1, 0).getDate();

          for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = formatIST(new Date(year, m, d));
            datesToFetch.push(dateStr);
          }
        }
      }

      datesToFetch.forEach((date) => {
        const colRef = collection(
          db,
          "loadData",
          siteKey,
          "dailyData",
          date,
          "entries"
        );

        const unsub = onSnapshot(colRef, (snapshot) => {

          let dayData = [];

          snapshot.forEach((doc) => {
            const d = doc.data();

            let loadKW = 0;

            if (d.equipmentType === "SMPS") {
              loadKW = (Number(d.dcVoltage || 0) * Number(d.dcCurrent || 0)) / 1000;
            } else if (d.equipmentType === "UPS") {
              loadKW =
                Number(d.runningKWR || 0) +
                Number(d.runningKWY || 0) +
                Number(d.runningKWB || 0);
            } else {
              const voltage =
                (Number(d.voltageRY || 0) +
                  Number(d.voltageYB || 0) +
                  Number(d.voltageBR || 0)) / 3;

              const current =
                (Number(d.currentR || 0) +
                  Number(d.currentY || 0) +
                  Number(d.currentB || 0)) / 3;

              const pf = Number(d.powerFactor || 0.9);

              loadKW = (1.732 * voltage * current * pf) / 1000;
            }

            dayData.push({
              id: doc.id,
              date,
              ...d,
              loadKW,
            });
          });

          // ✅ store per date (replace only that date)
          dataMap[date] = dayData;

          // ✅ merge all dates safely
          const merged = Object.values(dataMap).flat();

          setTrendRawData(merged);
        });

        unsubscribeList.push(unsub);
      });
    };

    fetchTrendData();

    return () => unsubscribeList.forEach((u) => u && u());
  }, [siteKey, selectedDate, rangeType]);

  // Whenever raw data or filters change, regroup and prepare for chart
  useEffect(() => {
    if (!trendRawData.length) return;

    let filtered = trendRawData;

    if (selectedType !== "ALL") {
      filtered = filtered.filter(d => d.equipmentType === selectedType);
    }

    if (selectedEquipment !== "ALL") {
      filtered = filtered.filter(d => d.equipmentId === selectedEquipment);
    }

    let grouped = {};

    filtered.forEach((d) => {
      let key;

      if (rangeType === "daily") key = d.time;
      else if (rangeType === "monthly") key = d.date;
      else key = d.date?.slice(0, 7);

      if (!grouped[key]) grouped[key] = {};

      const type = d.equipmentType;
      const eqId = d.equipmentId;

      const dataKey =
        selectedType === "ALL"
          ? type
          : eqId;

      if (!grouped[key][dataKey]) {
        grouped[key][dataKey] = {};
      }

      // 🔥 IMPORTANT: group per equipment first
      if (!grouped[key][dataKey][eqId]) {
        grouped[key][dataKey][eqId] = { sum: 0, count: 0 };
      }

      grouped[key][dataKey][eqId].sum += Number(d.loadKW || 0);
      grouped[key][dataKey][eqId].count += 1;
    });

    const result = Object.keys(grouped).map((k) => {
      let obj = { label: k };

      Object.keys(grouped[k]).forEach((key) => {
        let total = 0;

        Object.values(grouped[k][key]).forEach((eq) => {
          total += eq.sum / eq.count;
        });

        obj[key] = Number(total.toFixed(2));
      });

      return obj;
    });

    // ✅ IMPORTANT: normalize all keys
    let allKeys = new Set();

    result.forEach(d => {
      Object.keys(d).forEach(k => {
        if (k !== "label") allKeys.add(k);
      });
    });

    const normalized = result.map(d => {
      let newObj = { label: d.label };

      allKeys.forEach(k => {
        newObj[k] = d[k] ?? 0; // 🔥 fill missing with 0
      });

      return newObj;
    });

    normalized.sort((a, b) => a.label.localeCompare(b.label));

    setTrendData(normalized);

  }, [trendRawData, rangeType, selectedType, selectedEquipment]);

  // Check if any important field is missing or zero (customize fields as needed)
  const hasMissingData = (row, type) => {
    // define important fields (customize if needed)
    let fields = [];

    if (type === "SMPS") {
      fields = [
        row.voltageRN, row.voltageYN, row.voltageBN,
        row.currentR, row.currentY, row.currentB,
        row.tempR, row.tempY, row.tempB,
        row.dcVoltage, row.dcCurrent,
        row.systemStatus, row.spdStatus, row.faultyModules, row.loadKW, row.technicianName
      ];
    }

    else if (type === "UPS") {
      fields = [
        row.voltageRY, row.voltageYB, row.voltageBR,
        row.voltageRN, row.voltageYN, row.voltageBN,
        row.currentR, row.currentY, row.currentB, row.currentN,
        row.tempR, row.tempY, row.tempB,
        row.outVoltageRY, row.outVoltageYB, row.outVoltageBR,
        row.outVoltageRN, row.outVoltageYN, row.outVoltageBN,
        row.outCurrentR, row.outCurrentY, row.outCurrentB, row.outCurrentN,
        row.powerFactorR, row.powerFactorY, row.powerFactorB,
        row.runningKWR, row.runningKWY, row.runningKWB, row.loadKW, row.technicianName
      ];
    }

    else if (type === "LT") {
      fields = [
        row.voltageRY, row.voltageYB, row.voltageBR,
        row.voltageRN, row.voltageYN, row.voltageBN,
        row.currentR, row.currentY, row.currentB,
        row.tempR, row.tempY, row.tempB,
        row.powerFactor, row.kwh, row.loadKW, row.technicianName
      ];
    }

    // ✅ clean validation
    return fields.some(v =>
      v === undefined ||
      v === null ||
      v === "" ||
      (typeof v === "number" && isNaN(v))
    );
  };

  const getVisibleKeys = () => {
    if (!trendData.length) return [];

    return Object.keys(trendData[0]).filter(key => key !== "label");
  };

  const visibleKeys = getVisibleKeys();

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;

    const total = payload.reduce((sum, p) => sum + (p.value || 0), 0);

    return (
      <div style={{
        background: "#111",
        border: "1px solid #333",
        padding: "10px 12px",
        borderRadius: "8px",
        color: "#fff",
        fontSize: "12px"
      }}>
        <p style={{ marginBottom: "5px", color: "#00e6e6" }}>
          <b>{label}</b>
        </p>

        {payload.map((entry, i) => (
          <p key={i} style={{ margin: 0 }}>
            <span style={{ color: entry.color }}>●</span>{" "}
            {entry.name}: {entry.value?.toFixed(2)} kW
          </p>
        ))}

        <hr style={{ borderColor: "#333" }} />

        <p style={{ margin: 0 }}>
          <b>Total: {total.toFixed(2)} kW</b>
        </p>
      </div>
    );
  };

  // ✅ % Unbalance calculator
  const getUnbalancePercent = (a, b, c) => {
    const values = [Number(a || 0), Number(b || 0), Number(c || 0)];
    const avg = values.reduce((s, v) => s + v, 0) / 3;
    if (avg === 0) return 0;

    const maxDev = Math.max(...values.map(v => Math.abs(v - avg)));
    return (maxDev / avg) * 100;
  };

  // ✅ Voltage validation
  const isVoltageAbnormal = (v, type = "PN") => {
    if (!v) return false;

    if (type === "PN") return v < 180 || v > 260;   // Phase-Neutral
    if (type === "PP") return v < 380 || v > 480;   // Phase-Phase

    return false;
  };

  // ✅ Power factor validation
  const isPFInvalid = (pf) => {
    if (pf === undefined || pf === null) return false;
    return pf < 0.7 || pf > 1; // unrealistic
  };

  // ✅ Temperature validation
  const isTempHigh = (t) => {
    if (!t) return false;
    return t > 80; // adjustable
  };

  const getRowIssues = (row, type) => {
    let issues = [];

    // 🔥 Current Unbalance
    const currentUnbalance = getUnbalancePercent(
      row.currentR,
      row.currentY,
      row.currentB
    );
    if (currentUnbalance > 20) {
      issues.push("High Current Unbalance");
    }

    // 🔥 Voltage Unbalance (P-N)
    const voltageUnbalance = getUnbalancePercent(
      row.voltageRN,
      row.voltageYN,
      row.voltageBN
    );
    if (voltageUnbalance > 10) {
      issues.push("Voltage Unbalance");
    }

    // 🔥 Voltage Range Check
    if (
      isVoltageAbnormal(row.voltageRN, "PN") ||
      isVoltageAbnormal(row.voltageYN, "PN") ||
      isVoltageAbnormal(row.voltageBN, "PN")
    ) {
      issues.push("Abnormal P-N Voltage");
    }

    if (
      isVoltageAbnormal(row.voltageRY, "PP") ||
      isVoltageAbnormal(row.voltageYB, "PP") ||
      isVoltageAbnormal(row.voltageBR, "PP")
    ) {
      issues.push("Abnormal P-P Voltage");
    }

    // 🔥 Power Factor
    if (type === "LT" && isPFInvalid(row.powerFactor)) {
      issues.push("Bad PF");
    }

    if (type === "UPS") {
      if (
        isPFInvalid(row.powerFactorR) ||
        isPFInvalid(row.powerFactorY) ||
        isPFInvalid(row.powerFactorB)
      ) {
        issues.push("Bad PF");
      }
    }

    // 🔥 Temperature
    if (
      isTempHigh(row.tempR) ||
      isTempHigh(row.tempY) ||
      isTempHigh(row.tempB)
    ) {
      issues.push("High Temp");
    }

    return issues;
  };


  return (
    <div className="daily-log-container">
      <h2>⚡ Live Load Dashboard 🟢</h2>

      <div style={{ padding: "5px 5px", borderRadius: "8px", borderBottom: "2px solid #fff", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
        <Link to="/load-entry" style={{ textDecoration: "none", color: "#00e6e6", fontWeight: "bold", border: "1px solid #00e6e625", padding: "4px 8px", borderRadius: "4px", backgroundColor: "#1e647952", transition: "background-color 0.3s" }}
          onMouseMove={(e) => e.currentTarget.style.backgroundColor = "#1e6479bb"}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#1e647952"}
        >
          <p>➕ Add Load Entry</p>
        </Link>
        <input type="date" value={selectedDate || ""} onChange={(e) => setSelectedDate(e.target.value)} />
      </div>


      <div style={{ display: "flex", gap: "10px", margin: "10px 0" }}>

        <select value={rangeType} onChange={(e) => setRangeType(e.target.value)}>
          <option value="daily">Daily</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>

        <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
          {equipmentTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <select value={selectedEquipment} onChange={(e) => setSelectedEquipment(e.target.value)}>
          {equipmentIds.map((id) => (
            <option
              key={id}
              value={id}
              disabled={
                selectedType !== "ALL" &&
                id !== "ALL" &&
                !data.some(d => d.equipmentId === id && d.equipmentType === selectedType)
              }
            >
              {id}
            </option>
          ))}
        </select>

      </div>

      {data.length > 0 && (
        <div style={{ width: "100%", marginBottom: "20px", padding: "10px", borderRadius: "8px", backgroundColor: "#1e647952", border: "1px solid #00e6e625" }}>
          <h3 style={{ color: "#00e6e6" }}>📈 Load Trend Analysis</h3>
          <div style={{
            width: "100%",
            height: "320px",
            background: "#0f172a",
            padding: "10px",
            borderRadius: "10px",
            border: "1px solid #1e293b"
          }}>
            <ResponsiveContainer>
              <LineChart
                data={trendData}
                margin={{ top: 20, right: 30, left: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />

                <XAxis
                  dataKey="label"
                  stroke="#ccc"
                  tick={{ fontSize: 12 }}
                />

                <YAxis
                  stroke="#ccc"
                  tick={{ fontSize: 12 }}
                  domain={['auto', 'auto']}
                />

                <Tooltip content={<CustomTooltip />} />

                {/* Optional legend */}
                {/* <Legend /> */}

                {visibleKeys.map((key, index) => {
                  const colors = {
                    LT: "#00e6e6",
                    UPS: "#ffcc00",
                    SMPS: "#ff4d4d",
                    TOTAL: "#ffffff"
                  };

                  return (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      name={key}
                      stroke={colors[key] || "#8884d8"}
                      strokeWidth={key === selectedEquipment ? 4 : 2.5}
                      dot={false}                 // cleaner look
                      activeDot={{ r: 6 }}        // highlight hover
                      isAnimationActive={true}
                      animationDuration={800}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {data.length === 0 ? (
        <p style={{ color: "white" }}>No data available for selected date</p>
      ) : (
        <div>
          <h3>Total Load: {totalLoad.toFixed(2)} kW</h3>
          <h4 >⚠️ Note:- If show <b style={{ background: "red", color: "white" }}>"Red Row"</b>, Check & filled the unfield values</h4>
          <h4 >⚠️ Note:- If show <b style={{ background: "yellow", color: "white" }}>"Yellow Row"</b>, Check Unbalance values</h4>
          {Object.keys(missingSlots).length > 0 && (
            <div style={{
              background: "#ff4d4d22",
              border: "1px solid red",
              padding: "10px",
              borderRadius: "6px",
              marginBottom: "10px"
            }}>
              <h4 style={{ color: "red" }}>⚠️ Missing Time Slot Entries</h4>

              {Object.entries(missingSlots).map(([eqId, slots]) => (
                <p key={eqId}>
                  <strong>{eqId}</strong> → Missing: {slots.join(", ")}
                </p>
              ))}
            </div>
          )}

          {Object.keys(groupedData).map((type) => {
            const config = tableConfig[type] || tableConfig.DEFAULT;

            return (
              <div key={type} style={{ marginBottom: "10px", padding: "5px 10px", borderRadius: "8px", backgroundColor: "#1e647952", border: "1px solid #00e6e625" }}>
                <div style={{ display: "flex", flexDirection: "row", gap: "10px" }}>
                  {/* <h4 style={{ color: "#00e6e6" }}>🔹 {type} Load</h4> */}
                  <h4 style={{
                    color: Object.keys(missingSlots).some(id =>
                      groupedData[type].some(r => r.equipmentId === id)
                    ) ? "red" : "#00e6e6"
                  }}>
                    🔹 {type} Load
                  </h4>
                  <h4 style={{ color: "#00e6e6" }}>
                    🔹 {Object.values(
                      groupedData[type].reduce((acc, row) => {
                        const id = row.equipmentId || "UNKNOWN";

                        if (!acc[id]) acc[id] = { sum: 0, count: 0 };

                        acc[id].sum += row.loadKW;
                        acc[id].count += 1;

                        return acc;
                      }, {})
                    )
                      .reduce((total, eq) => total + (eq.sum / eq.count), 0)
                      .toFixed(2)} kWh
                  </h4>
                </div>

                <table border="1" cellPadding="6" style={{
                  borderCollapse: "collapse",
                  width: "100%",
                  fontSize: "12px",
                  overflowX: "auto",
                  display: "block",
                  whiteSpace: "nowrap",
                  borderRadius: "8px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                  scrollbarWidth: "thin",
                  scrollbarColor: "#888 #f1f1f1",
                  maxHeight: "400px"
                }}>
                  <thead>
                    <tr>
                      {config.headers.map((h, i) => (
                        <th key={i}>{h}</th>
                      ))}
                      {isAdmin && <th>Action</th>}
                    </tr>
                  </thead>

                  <tbody>
                    {groupedData[type].map((row) => {
                      const issues = getRowIssues(row, type);
                      return (
                        <tr
                          key={row.id}
                          title={getRowIssues(row, type).join(", ")}
                          style={{
                            backgroundColor:
                              hasMissingData(row, type)
                                ? "#f82121ab" // missing = red
                                : issues.length > 0
                                  ? "#ff9800a8" // abnormal = orange
                                  : "transparent",
                          }}
                        >
                          {config.renderRow(row)}

                          <td style={{ justifyContent: "space-around", flexWrap: "wrap", display: "flex", gap: "5px" }}>
                            <button style={{ padding: "2px 2px", background: "#24556b6e" }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#24556b"}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#24556b6e"}
                              onClick={() => handleEdit(row)}>✏️</button>
                            {isAdmin && (
                              <button style={{ padding: "2px 2px", background: "#6b26246e" }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#6b2624"}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#6b26246e"}
                                onClick={() => handleDelete(row.id)}>🗑️</button>
                            )}
                          </td>
                        </tr>)
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LoadDashboard;