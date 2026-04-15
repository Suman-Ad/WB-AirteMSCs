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

  const today = new Date();
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
  const today = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const navigate = useNavigate();
  const [trendData, setTrendData] = useState([]);
  const [rangeType, setRangeType] = useState("daily"); // daily | monthly | yearly
  const [selectedEquipment, setSelectedEquipment] = useState("ALL");
  const [selectedType, setSelectedType] = useState("ALL");

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
          let total = 0;
          let list = [];

          snapshot.forEach((doc) => {
            const d = doc.data();

            let loadKW = 0;

            if (d.equipmentType === "SMPS") {
              const dcV = Number(d.dcVoltage || 0);
              const dcI = Number(d.dcCurrent || 0);
              loadKW = (dcV * dcI) / 1000;
            } else if (d.equipmentType === "UPS") {
              loadKW = Number(d.runningKWR || 0) + Number(d.runningKWY || 0) + Number(d.runningKWB || 0);
            } else {
              const voltage = (Number(d.voltageRY || 0) + Number(d.voltageYB || 0) + Number(d.voltageBR || 0)) / 3;
              const avgCurrent =
                (Number(d.currentR || 0) +
                  Number(d.currentY || 0) +
                  Number(d.currentB || 0)) / 3;

              const pf = Number(d.powerFactor || 0.9);

              loadKW = (1.732 * voltage * avgCurrent * pf) / 1000;
            }

            total += loadKW;

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

  const equipmentTypes = ["ALL", ...new Set(data.map(d => d.equipmentType))];
  const equipmentIds = ["ALL", ...new Set(data.map(d => d.equipmentId))];

  useEffect(() => {
    if (!data.length) return;

    let filtered = data;

    if (selectedType !== "ALL") {
      filtered = filtered.filter(d => d.equipmentType === selectedType);
    }

    if (selectedEquipment !== "ALL") {
      filtered = filtered.filter(d => d.equipmentId === selectedEquipment);
    }

    let grouped = {};

    filtered.forEach((d) => {
      let key;

      if (rangeType === "daily") {
        key = d.time; // time-wise
      } else if (rangeType === "monthly") {
        key = d.date; // day-wise
      } else {
        key = d.date?.slice(0, 7); // month-wise
      }

      const value = Number(d.loadKW || 0);

      if (!grouped[key]) {
        grouped[key] = {
          sum: 0,
          count: 0,
        };
      }

      grouped[key].sum += value;
      grouped[key].count += 1;
    });

    const result = Object.keys(grouped).map((k) => {
      const { sum, count } = grouped[k];

      let finalValue;

      if (rangeType === "daily") {
        // keep actual (or you can also average if needed)
        finalValue = sum;
      } else {
        // average for monthly & yearly
        finalValue = sum / count;
      }

      return {
        label: k,
        load: Number(finalValue.toFixed(2)),
      };
    });

    // optional: sort properly (important for charts)
    result.sort((a, b) => a.label.localeCompare(b.label));

    setTrendData(result);

  }, [data, rangeType, selectedEquipment, selectedType]);


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
            <option key={id} value={id}>{id}</option>
          ))}
        </select>

      </div>

      {data.length > 0 && (
        <div style={{ width: "100%", marginBottom: "20px", padding: "10px", borderRadius: "8px", backgroundColor: "#1e647952", border: "1px solid #00e6e625" }}>
          <h3 style={{ color: "#00e6e6" }}>📈 Load Trend Analysis</h3>
          <div style={{ width: "100%", height: "300px" }}>
            <ResponsiveContainer>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="load" stroke="#00e6e6" />
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

          {Object.keys(groupedData).map((type) => {
            const config = tableConfig[type] || tableConfig.DEFAULT;

            return (
              <div key={type} style={{ marginBottom: "10px", padding: "5px 10px", borderRadius: "8px", backgroundColor: "#1e647952", border: "1px solid #00e6e625" }}>
                <div style={{ display: "flex", flexDirection: "row", gap: "10px" }}>
                  <h4 style={{ color: "#00e6e6" }}>🔹 {type} Load</h4>
                  <h4 style={{ color: "#00e6e6" }}>🔹 {groupedData[type].reduce((sum, row) => sum + row.loadKW, 0).toFixed(2)} kWh</h4>
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
                    {groupedData[type].map((row) => (
                      <tr key={row.id}>
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
                      </tr>
                    ))}
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