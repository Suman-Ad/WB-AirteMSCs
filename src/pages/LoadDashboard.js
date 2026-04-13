import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import { Link, useNavigate } from "react-router-dom";


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
              loadKW = Number(d.runningKW || 0);
            } else {
              const voltage = Number(d.voltagePP || 0);
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
        "Technician", "Load (kW)", "Uploaded By"
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
          <td>{row.technicianName || "-"}</td>
          <td>{(row.loadKW || 0).toFixed(2)}</td>
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
        "Running Load (kW)",
        "System Status", "Technician", "Load (kW)"
      ],
      renderRow: (row) => (
        <>
          <td>{row.date || "-"}</td>
          <td>{row.time || "-"}</td>
          <td>{row.equipmentId || "-"}</td>
          <td>{row.runningKW || "-"}</td>
          <td>{row.systemStatus || "-"}</td>
          <td>{row.technicianName || "-"}</td>
          <td>{(row.loadKW || 0).toFixed(2)}</td>
        </>
      ),
    },

    DEFAULT: {
      headers: [
        "Date", "Time", "Equipment",
        "R-N", "Y-N", "B-N",
        "R", "Y", "B",
        "PF", "Technician", "Load (kW)"
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
          <td>{row.powerFactor || "-"}</td>
          <td>{row.technicianName || "-"}</td>
          <td>{(row.loadKW || 0).toFixed(2)}</td>
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

  return (
    <div className="daily-log-container">
      <h2>⚡ Live Load Dashboard 🟢</h2>

      <div style={{ padding: "5px 5px", borderRadius: "8px", borderBottom: "2px solid #fff", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px"}}>
        <Link to="/load-entry" style={{ textDecoration: "none", color: "#00e6e6", fontWeight: "bold", border: "1px solid #00e6e625", padding: "4px 8px", borderRadius: "4px", backgroundColor: "#1e647952", transition: "background-color 0.3s" }}
        onMouseMove={(e) => e.currentTarget.style.backgroundColor= "#1e6479bb"}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor= "#1e647952"}
        >
          <p>➕ Add Load Entry</p>
        </Link>
        <input type="date" value={selectedDate || ""} onChange={(e) => setSelectedDate(e.target.value)} />
      </div>

      

      {data.length === 0 ? (
        <p style={{ color: "white" }}>No data available for selected date</p>
      ) : (
        <div>
          <h3>Total Load: {totalLoad.toFixed(2)} kW</h3>

          {Object.keys(groupedData).map((type) => {
            const config = tableConfig[type] || tableConfig.DEFAULT;

            return (
              <div key={type} style={{ marginBottom: "30px" }}>
                <h3 style={{ color: "#00e6e6" }}>🔹 {type} Load</h3>

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

                        {isAdmin && (
                          <td>
                            <button onClick={() => handleEdit(row)}>✏️</button>
                            <button onClick={() => handleDelete(row.id)}>🗑️</button>
                          </td>
                        )}
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