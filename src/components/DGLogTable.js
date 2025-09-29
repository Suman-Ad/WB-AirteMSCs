// src/components/DGLogTable.js
import React, { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";

const DGLogTable = ({ userData }) => {
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState({
    DG1_OnLoad: 0,
    DG1_NoLoad: 0,
    DG2_OnLoad: 0,
    DG2_NoLoad: 0,
  });
  const Navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10) // default today
  );
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const siteName = userData?.site;

  useEffect(() => {
    if (siteName && selectedDate) {
      fetchLogs();
      fetchMonthlySummary();
    }
    // eslint-disable-next-line
  }, [siteName, selectedDate]);

  const fetchLogs = async () => {
    try {
      const dateObj = new Date(selectedDate);
      const monthKey =
        dateObj.toLocaleString("en-US", { month: "short" }) +
        "-" +
        dateObj.getFullYear();

      const runsCollectionRef = collection(
        db,
        "dgLogs",
        siteName,
        monthKey,
        selectedDate,
        "runs"
      );
      const snapshot = await getDocs(runsCollectionRef);
      const data = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setLogs(data);
    } catch (err) {
      console.error("Error fetching logs:", err);
    }
  };

  const fetchMonthlySummary = async () => {
    try {
      const dateObj = new Date(selectedDate);
      const monthKey =
        dateObj.toLocaleString("en-US", { month: "short" }) +
        "-" +
        dateObj.getFullYear();

      // 🔹 Get all date docs under the month
      const monthRef = collection(db, "dgLogs", siteName, monthKey);
      const monthSnapshot = await getDocs(monthRef);

      let counts = {
        DG1_OnLoad: 0,
        DG1_NoLoad: 0,
        DG2_OnLoad: 0,
        DG2_NoLoad: 0,
      };

      // 🔹 Loop each date (2025-09-01, 2025-09-02, …)
      for (const dateDoc of monthSnapshot.docs) {
        const runsRef = collection(
          db,
          "dgLogs",
          siteName,
          monthKey,
          dateDoc.id,
          "runs"
        );
        const runsSnap = await getDocs(runsRef);

        runsSnap.forEach((r) => {
          const data = r.data();
          if (data.dgNumber === "DG-1" && data.remarks === "On Load") counts.DG1_OnLoad++;
          if (data.dgNumber === "DG-1" && data.remarks === "No Load") counts.DG1_NoLoad++;
          if (data.dgNumber === "DG-2" && data.remarks === "On Load") counts.DG2_OnLoad++;
          if (data.dgNumber === "DG-2" && data.remarks === "No Load") counts.DG2_NoLoad++;
        });
      }

      setSummary(counts);
      localStorage.setItem("summary", JSON.stringify(counts));

    } catch (err) {
      console.error("Error fetching monthly summary:", err);
    }
  };

  const handleEdit = (log) => {
    setEditingId(log.id);
    setEditForm(log);
  };

  useEffect(() => {
  const cached = localStorage.getItem("summary");
  if (cached) {
    setSummary(JSON.parse(cached));
  }
}, []);


  const handleSave = async () => {
    try {
      const dateObj = new Date(selectedDate);
      const monthKey =
        dateObj.toLocaleString("en-US", { month: "short" }) +
        "-" +
        dateObj.getFullYear();

      const logRef = doc(
        db,
        "dgLogs",
        siteName,
        monthKey,
        selectedDate,
        "runs",
        editingId
      );

      await updateDoc(logRef, {
        ...editForm,
        totalRunHours:
          parseFloat(editForm.hrMeterEnd || 0) -
          parseFloat(editForm.hrMeterStart || 0),
      });

      alert("Run log Updated ✅");
      setEditingId(null);
      fetchLogs();
      fetchMonthlySummary();
    } catch (err) {
      console.error("Error saving log:", err);
    }
  };

  return (
    <div className="daily-log-container">
      <h2 className="dashboard-header">
        <strong>🎯 DG Run Logs – {siteName}</strong>
      </h2>
      <button
        className="segr-manage-btn warning"
        onClick={() => Navigate("/dg-log-entry")}
      >
        ✎ DG Run Log Entry
      </button>

      {/* Summary table */}
      <div style={{ marginTop: "2rem" }}>
        <h1><strong>📊 Monthly Summary ({selectedDate.slice(0, 7)})</strong></h1>
        {(summary.DG1_OnLoad > 0 || summary.DG1_NoLoad > 0 || summary.DG2_OnLoad > 0 || summary.DG2_NoLoad > 0) ? (
          <table border="1" cellPadding="8" style={{ width: "60%" }}>
            <thead>
              <tr>
                <th>DG No</th>
                <th>On Load Count</th>
                <th>No Load Count</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>DG-1</td>
                <td>{summary.DG1_OnLoad}</td>
                <td>{summary.DG1_NoLoad}</td>
              </tr>
              <tr>
                <td>DG-2</td>
                <td>{summary.DG2_OnLoad}</td>
                <td>{summary.DG2_NoLoad}</td>
              </tr>
            </tbody>
          </table>
         ) : (
          <h3><strong>Loading.......</strong></h3>
        )}
      </div>

      {/* Date selector */}
      <div style={{ marginBottom: "1rem" }}>
        <label>Select Date: </label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>

      {logs.length === 0 ? (
        <p>No logs found for {selectedDate}.</p>
      ) : (
        <div className="table-container">
          <table border="1" cellPadding="8" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>DG No</th>
                <th>Start Time</th>
                <th>Stop Time</th>
                <th>Hr Meter Start</th>
                <th>Hr Meter End</th>
                <th>Total Run Hours</th>
                <th>Fuel Consumption</th>
                <th>kWH Reading</th>
                <th>Remarks</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  {editingId === log.id ? (
                    <>
                      <td>
                        <input
                          value={editForm.dgNumber}
                          onChange={(e) =>
                            setEditForm({ ...editForm, dgNumber: e.target.value })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="time"
                          value={editForm.startTime}
                          onChange={(e) =>
                            setEditForm({ ...editForm, startTime: e.target.value })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="time"
                          value={editForm.stopTime}
                          onChange={(e) =>
                            setEditForm({ ...editForm, stopTime: e.target.value })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={editForm.hrMeterStart}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              hrMeterStart: e.target.value,
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={editForm.hrMeterEnd}
                          onChange={(e) =>
                            setEditForm({ ...editForm, hrMeterEnd: e.target.value })
                          }
                        />
                      </td>
                      <td>
                        {editForm.hrMeterEnd - editForm.hrMeterStart}
                      </td>
                      <td>
                        <input
                          type="number"
                          value={editForm.fuelConsumption}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              fuelConsumption: e.target.value,
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={editForm.kWHReading}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              kWHReading: e.target.value,
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          value={editForm.remarks}
                          onChange={(e) =>
                            setEditForm({ ...editForm, remarks: e.target.value })
                          }
                        />
                      </td>
                      <td>
                        <button onClick={handleSave}>Save</button>
                        <button onClick={() => setEditingId(null)}>
                          Cancel
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{log.dgNumber}</td>
                      <td>{log.startTime}</td>
                      <td>{log.stopTime}</td>
                      <td>{log.hrMeterStart}</td>
                      <td>{log.hrMeterEnd}</td>
                      <td>{log.totalRunHours?.toFixed(1)}</td>
                      <td>{log.fuelConsumption || 0}</td>
                      <td>{log.kWHReading || 0}</td>
                      <td>{log.remarks}</td>
                      <td>
                        <button onClick={() => handleEdit(log)}>Edit</button>
                      </td>
                    </>
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

export default DGLogTable;
