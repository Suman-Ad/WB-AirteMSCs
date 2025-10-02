// src/components/DGLogTableWithDHR.js
import React, { useState, useEffect } from "react";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

// You should add these styles to your main CSS file (e.g., App.css or a new Modal.css)
/*
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background-color: white;
  padding: 25px;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 5px 15px rgba(0,0,0,0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
  margin-bottom: 20px;
}

.modal-close-btn {
  background: transparent;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
}

.dhr-form-group {
  margin-bottom: 15px;
}

.dhr-form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
  text-transform: capitalize;
}

.dhr-form-group input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}
*/

const DGLogTableWithDHR = ({ userData }) => {
  // State from DGLogTable
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState({ DG1_OnLoad: 0, DG1_NoLoad: 0, DG2_OnLoad: 0, DG2_NoLoad: 0 });
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const navigate = useNavigate();
  const siteName = userData?.site;

  // State from CreateDHR (for the modal)
  const [isDhrModalOpen, setIsDhrModalOpen] = useState(false);
  const emptyDhrForm = {
    date: "",
    region: userData?.region || "",
    circle: userData?.circle || "",
    siteName: userData?.site || "",
    dieselAvailable: "",
    dgRunHrsYesterday: "", // Note: We will use this to store DG run hours for the selected date
    ebRunHrsYesterday: "",
    ebStatus: "", dgStatus: "", smpsStatus: "", upsStatus: "", pacStatus: "", crvStatus: "",
    majorActivity: "", inhousePM: "", faultDetails: "",
    isoDate: "", lastEditor: "", lastEditTime: "",
  };
  const [dhrForm, setDhrForm] = useState(emptyDhrForm);
  const [dhrSaving, setDhrSaving] = useState(false);
  const [dhrMessage, setDhrMessage] = useState("");
  const [selectedDhrRecord, setSelectedDhrRecord] = useState(null);

  const dhrFieldOrder = [
    "date", "region", "circle", "siteName", "dieselAvailable", "dgRunHrsYesterday", "ebRunHrsYesterday",
    "ebStatus", "dgStatus", "smpsStatus", "upsStatus", "pacStatus", "crvStatus",
    "majorActivity", "inhousePM", "faultDetails",
  ];

  // Fetch DG logs and monthly summary
  useEffect(() => {
    if (siteName && selectedDate) {
      fetchLogs();
      fetchMonthlySummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteName, selectedDate]);

  const fetchLogs = async () => {
    try {
      const dateObj = new Date(selectedDate);
      const monthKey = dateObj.toLocaleString("en-US", { month: "short" }) + "-" + dateObj.getFullYear();
      const runsCollectionRef = collection(db, "dgLogs", siteName, monthKey, selectedDate, "runs");
      const snapshot = await getDocs(runsCollectionRef);
      const data = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      setLogs(data);
    } catch (err) {
      console.error("Error fetching logs:", err);
      setLogs([]);
    }
  };

  const fetchMonthlySummary = async () => { /* ... Function remains the same ... */ };
  const handleEdit = (log) => { setEditingId(log.id); setEditForm(log); };
  const handleSave = async () => { /* ... Function remains the same ... */ };

  // --- DHR Modal Functions ---

  const handleDhrChange = (e) => {
    const { name, value } = e.target;
    setDhrForm((prev) => ({ ...prev, [name]: value }));
  };

  const openDhrModal = async () => {
    if (!siteName) {
      alert("Site information is not available.");
      return;
    }

    const formattedDate = format(new Date(selectedDate), "dd.MM.yyyy");
    const docId = `${siteName}_${formattedDate}`;
    const docRef = doc(db, "dhr_reports", docId);

    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setDhrForm(data);
        setSelectedDhrRecord({ id: docSnap.id, ...data });
        setDhrMessage(`Loaded existing DHR for ${formattedDate}.`);
      } else {
        // Pre-populate new DHR with calculated DG run hours
        const totalDgRunHours = logs.reduce((sum, log) => sum + (Number(log.totalRunHours) || 0), 0);
        
        const newForm = {
          ...emptyDhrForm,
          date: formattedDate,
          siteName: siteName,
          dgRunHrsYesterday: totalDgRunHours.toFixed(2), // Populated from logs
        };
        setDhrForm(newForm);
        setSelectedDhrRecord(null);
        setDhrMessage(`No DHR found. Created a new one for ${formattedDate}.`);
      }
    } catch (error) {
      console.error("Error fetching DHR:", error);
      setDhrMessage("❌ Error fetching DHR data.");
    }

    setIsDhrModalOpen(true);
  };

  const handleDhrSave = async () => {
    setDhrSaving(true);
    try {
      const docId = `${siteName}_${dhrForm.date}`;
      const isoDate = new Date(selectedDate + "T00:00:00").toISOString();
      const lastEditTime = new Date().toISOString();

      const dataToSave = {
        ...dhrForm,
        circle: userData?.circle || "",
        siteName: siteName,
        lastEditor: userData?.name || userData?.email || "Unknown",
        isoDate,
        lastEditTime,
      };

      await setDoc(doc(db, "dhr_reports", docId), dataToSave);
      setDhrMessage("✅ DHR saved successfully!");
      setSelectedDhrRecord({ id: docId, ...dataToSave });
    } catch (error) {
      console.error("Error saving DHR:", error);
      setDhrMessage("❌ Error saving DHR.");
    }
    setDhrSaving(false);
  };

  const handleDhrDelete = async () => {
    if (!selectedDhrRecord || !window.confirm(`Delete DHR for ${selectedDhrRecord.date}?`)) {
        return;
    }
    setDhrSaving(true);
    try {
        await deleteDoc(doc(db, "dhr_reports", selectedDhrRecord.id));
        setDhrMessage(`✅ DHR for ${selectedDhrRecord.date} deleted.`);
        setSelectedDhrRecord(null);
        setIsDhrModalOpen(false); // Close modal after deletion
    } catch (error) {
        console.error("Error deleting DHR:", error);
        setDhrMessage("❌ Error deleting DHR.");
    }
    setDhrSaving(false);
  };
  
  const generateShareText = (record) => {
    return `DHR Report for ${record.siteName} on ${record.date}
    Region: ${record.region}
    Circle: ${record.circle}
    Site Name: ${record.siteName}
    Diesel Available: ${record.dieselAvailable}
    DG Run Hrs: ${record.dgRunHrsYesterday}
    EB Run Hrs: ${record.ebRunHrsYesterday}
    EB Status: ${record.ebStatus}
    DG Status: ${record.dgStatus}
    SMPS Status: ${record.smpsStatus}
    UPS Status: ${record.upsStatus}
    PAC Status: ${record.pacStatus}
    CRV Status: ${record.crvStatus}
    Major Activity: ${record.majorActivity}
    Inhouse PM: ${record.inhousePM}
    Fault Details: ${record.faultDetails}`;
  };

  const shareWhatsApp = (record) => window.open(`https://wa.me/?text=${encodeURIComponent(generateShareText(record))}`, "_blank");
  const shareTelegram = (record) => window.open(`https://t.me/share/url?url=${encodeURIComponent(generateShareText(record))}`, "_blank");

  return (
    <div className="daily-log-container">
      <h2 className="dashboard-header"><strong>🎯 DG Run Logs – {siteName}</strong></h2>
      <button className="segr-manage-btn warning" onClick={() => navigate("/dg-log-entry")}>
        ✎ DG Run Log Entry
      </button>

      {/* Summary table ... */}

      {/* Date selector & DHR Button */}
      <div style={{ margin: "1rem 0", display: "flex", alignItems: "center", gap: "15px" }}>
        <div>
          <label>Select Date: </label>
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
        </div>
        <button onClick={openDhrModal} className="segr-manage-btn">
          📝 View/Edit DHR
        </button>
      </div>

      {logs.length === 0 ? <p>No logs found for {selectedDate}.</p> : (
        <div className="table-container">
          {/* ... DG Logs table JSX remains the same ... */}
        </div>
      )}

      {/* DHR Modal */}
      {isDhrModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3>DHR for {siteName} - {dhrForm.date}</h3>
              <button onClick={() => setIsDhrModalOpen(false)} className="modal-close-btn">&times;</button>
            </div>
            
            {dhrMessage && <p className="message">{dhrMessage}</p>}

            {dhrFieldOrder.map((key) => (
              <div key={key} className="dhr-form-group">
                <label>{key.replace(/([A-Z])/g, " $1")}</label>
                <input
                  type="text"
                  name={key}
                  value={dhrForm[key] || ""}
                  onChange={handleDhrChange}
                  disabled={["date", "region", "circle", "siteName"].includes(key)}
                  placeholder={`Enter ${key.replace(/([A-Z])/g, " $1")}`}
                />
              </div>
            ))}

            {dhrForm.lastEditor && (
                <p style={{fontSize: '0.8rem', color: '#555'}}>
                    <strong>Last edited by:</strong> {dhrForm.lastEditor} at {dhrForm.lastEditTime ? format(new Date(dhrForm.lastEditTime), "dd.MM.yyyy HH:mm") : "N/A"}
                </p>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "20px" }}>
              <button onClick={handleDhrSave} disabled={dhrSaving}>{dhrSaving ? "Saving..." : "Save DHR"}</button>
              <button onClick={handleDhrDelete} disabled={dhrSaving || !selectedDhrRecord} style={{ backgroundColor: "red", color: "white" }}>Delete DHR</button>
              {selectedDhrRecord && (
                <>
                  <button onClick={() => shareWhatsApp(selectedDhrRecord)}>Share WhatsApp</button>
                  <button onClick={() => shareTelegram(selectedDhrRecord)}>Share Telegram</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DGLogTableWithDHR;