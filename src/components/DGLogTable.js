// src/components/DGLogTable.js
import React, { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { format, subDays } from "date-fns";

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

  // State for DHR Preview Modal
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [dhrDataForPreview, setDhrDataForPreview] = useState(null);
  const [dhrMessage, setDhrMessage] = useState("");

  useEffect(() => {
    if (siteName && selectedDate) {
      fetchLogs();
      fetchMonthlySummary();
      fetchLogsForSelectedDate();
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

  // Fetches logs for the main table view (for the selected date)
  const fetchLogsForSelectedDate = async () => {
    try {
      const dateObj = new Date(selectedDate);
      const monthKey = format(dateObj, "MMM-yyyy");
      const runsCollectionRef = collection(db, "dgLogs", siteName, monthKey, selectedDate, "runs");
      const snapshot = await getDocs(runsCollectionRef);
      const data = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      setLogs(data);
    } catch (err) {
      console.error("Error fetching logs:", err);
      setLogs([]); // Clear logs on error
    }
  };

  // --- DHR Preview Function (Modified) ---
  const openPreviewModal = async () => {
    if (!siteName) return;
    setIsPreviewModalOpen(true);
    setDhrMessage("Generating live preview...");
    setDhrDataForPreview(null);

    try {
      // 1. Determine yesterday's date based on the selected date in the UI
      const yesterday = subDays(new Date(selectedDate), 1);
      const monthKey = format(yesterday, "MMM-yyyy");
      const yesterdayStr = format(yesterday, "yyyy-MM-dd");

      // 2. Fetch DG Run Hours from Yesterday
      const runsRef = collection(db, "dgLogs", siteName, monthKey, yesterdayStr, "runs");
      const runsSnap = await getDocs(runsRef);
      const totalDgRunHours = runsSnap.docs.reduce((sum, doc) => sum + (Number(doc.data().totalRunHours) || 0), 0);
      const dgRunHrsYesterday = totalDgRunHours.toFixed(2);
      const ebRunHrsYesterday = (24 - totalDgRunHours > 0 ? 24 - totalDgRunHours : 0).toFixed(2);

      // 3. Fetch Default Statuses from siteConfig
      const configRef = doc(db, "siteConfigs", siteName?.toUpperCase());
      const configSnap = await getDoc(configRef);
      const defaultConfig = configSnap.exists() ? configSnap.data() : {};

      // 4. Construct the preview data object
      const previewData = {
        "DHR Date": format(new Date(selectedDate), "dd.MM.yyyy"),
        "🏙️Region": userData?.region,
        "🔄Circle": userData?.circle,
        "📍Site Name": siteName,
        "⛽Diesel Available": `${defaultConfig.fuelAvailable} Ltrs.` || "N/A",
        "🕑DG Run Hrs (Yesterday)": `${dgRunHrsYesterday} Hrs` || "N/A",
        "⚡EB Run Hrs (Yesterday)": `${ebRunHrsYesterday} Hrs` || "N/A",
        "🔌EB Status": defaultConfig.ebStatus || "N/A",
        "🔋DG Status": defaultConfig.dgStatus || "N/A",
        "⚙️SMPS Status": defaultConfig.smpsStatus || "N/A",
        "🔄UPS Status": defaultConfig.upsStatus || "N/A",
        "❄️PAC Status": defaultConfig.pacStatus || "N/A",
        "❄️CRV Status": defaultConfig.crvStatus || "N/A",
        "📝Major Activity": defaultConfig.majorActivity || "N",
        "🛠️Inhouse PM": defaultConfig.inHousePm || "N",
        "🚨Fault Details": defaultConfig.faultDetails || "N",
      };

      setDhrDataForPreview(previewData);
      setDhrMessage(""); // Clear loading message

    } catch (error) {
      console.error("Error generating DHR preview:", error);
      setDhrMessage("❌ Could not generate preview data.");
    }
  };

  const generateShareText = (record) => {
    if (!record) return "";
    // Creates a string from the preview data object for sharing
    return Object.entries(record)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
  };

  const shareWhatsApp = () => window.open(`https://wa.me/?text=${encodeURIComponent(generateShareText(dhrDataForPreview))}`, "_blank");
  const shareTelegram = () => window.open(`https://t.me/share/url?url=${encodeURIComponent(generateShareText(dhrDataForPreview))}`, "_blank");


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

      {/* Date selector & DHR Preview Button */}
      <div style={{ margin: "1rem 0", display: "flex", alignItems: "center", gap: "15px" }}>
        <div>
          <label>Select Date: </label>
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
        </div>
        <button onClick={openPreviewModal} className="segr-manage-btn">
          👁️ Preview & Share DHR
        </button>
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
                <th>Fuel Filling</th>
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
                        <input
                          value={editForm.fuelFill}
                          onChange={(e) =>
                            setEditForm({ ...editForm, fuelFill: e.target.value })
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
                      <td>{log.fuelFill}</td>
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

      {/* DHR Preview Modal */}
      {isPreviewModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="noticeboard-header" style={{display:"flex"}}>
              <h1 style={{whiteSpace: "nowrap"}}>Live DHR Preview</h1>
              <button onClick={() => setIsPreviewModalOpen(false)} className="modal-close-btn" style={{marginLeft:"80px"}}>&times;</button>
            </div>

            {dhrDataForPreview ? (
              <div>
                {Object.entries(dhrDataForPreview).map(([key, value]) => (
                  <div key={key} className="preview-item">
                    <strong>{key}:</strong> {value}
                  </div>
                ))}
                <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                  <button onClick={shareWhatsApp}>Share WhatsApp</button>
                  <button onClick={shareTelegram}>Share Telegram</button>
                </div>
              </div>
            ) : (
              <p>{dhrMessage}</p>
            )}
          </div>
        </div>
      )}


    </div>
  );
};

export default DGLogTable;
