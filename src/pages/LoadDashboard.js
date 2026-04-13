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

  return (
    <div className="daily-log-container">
      <h2>⚡ Live Load Dashboard 🟢</h2>

      <Link to="/load-entry" className="manage-btn">
        ➕ Add Load Entry
      </Link>

      <input type="date" value={selectedDate || ""} onChange={(e) => setSelectedDate(e.target.value)} />

      {data.length === 0 ? (
        <p style={{ color: "white" }}>No data available for selected date</p>
      ) : (
        <div>
          <h3>Total Load: {totalLoad.toFixed(2)} kW</h3>

          <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%", fontSize: "12px", overflowX: "auto", display: "block", maxWidth: "100%", whiteSpace: "nowrap", borderRadius: "10px", scrollbarWidth: "thin" }}>
            <thead>
              <tr>
                <th>Type</th>
                <th>Date</th>
                <th>Time</th>
                <th>Equipment</th>
                <th>R-N (V)</th>
                <th>Y-N (V)</th>
                <th>B-N (V)</th>
                <th>R (A)</th>
                <th>Y (A)</th>
                <th>B (A)</th>
                <th>R Temperature (°C)</th>
                <th>Y Temperature (°C)</th>
                <th>B Temperature (°C)</th>
                <th>SPD Status</th>
                <th>OutPut DC (V)</th>
                <th>OutPut DC Load (A)</th>
                <th>No Of Faulty Modules</th>
                <th>System Status</th>
                <th>Technician Name</th>
                <th>Load (kW)</th>
                <th>Upload By</th>
                {isAdmin && (
                  <th>Action</th>
                )}
              </tr>
            </thead>

            <tbody>
              {data.map((row) => (
                <tr key={row.id}>
                  <td>{row.equipmentType || "-"}</td>
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
                    <p>{row.uploadedBy?.designation || "-"}</p>
                  </td>
                  {isAdmin && (
                    <td>
                      <button onClick={() => handleEdit(row)}>✏️ Edit</button>
                      <button onClick={() => handleDelete(row.id)}>🗑️ Delete</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LoadDashboard;