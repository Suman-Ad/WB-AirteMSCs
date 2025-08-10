// src/pages/CreateDHR.js
import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  limit,
  getDoc,
} from "firebase/firestore";
import { format } from "date-fns";
import "../assets/DHRStyle.css";

export default function CreateDHR({ userData }) {
  const todayISO = new Date().toISOString().slice(0, 10);

  const emptyForm = {
    date: format(new Date(), "dd.MM.yyyy"),
    region: userData?.region || "",
    circle: userData?.circle || "",
    siteName: userData?.site || "",
    dieselAvailable: "",
    dgRunHrsYesterday: "",
    ebRunHrsYesterday: "",
    ebStatus: "",
    dgStatus: "",
    smpsStatus: "",
    upsStatus: "",
    pacStatus: "",
    crvStatus: "",
    majorActivity: "",
    inhousePM: "",
    faultDetails: "",
    isoDate: new Date().toISOString(),
    lastEditor: "",
    lastEditTime: "",
  };

  const fieldOrder = [
    "date",
    "region",
    "circle",
    "siteName",
    "dieselAvailable",
    "dgRunHrsYesterday",
    "ebRunHrsYesterday",
    "ebStatus",
    "dgStatus",
    "smpsStatus",
    "upsStatus",
    "pacStatus",
    "crvStatus",
    "majorActivity",
    "inhousePM",
    "faultDetails",
  ];

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [instructionText, setInstructionText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");

  useEffect(() => {
    const fetchInstruction = async () => {
      const docRef = doc(db, "config", "create_dhr_instruction");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setInstructionText(docSnap.data().text || "");
        setEditText(docSnap.data().text || "");
      }
    };
    fetchInstruction();
  }, []);

  useEffect(() => {
    if (!emptyForm.circle || !emptyForm.siteName) return;

    const dhrRef = collection(db, "dhr_reports");
    const q = query(
      dhrRef,
      where("circle", "==", emptyForm.circle),
      where("siteName", "==", emptyForm.siteName),
      orderBy("isoDate", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let data = [];
        snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
        setHistory(data);

        if (data.length > 0) {
          setForm(data[0]);
          setSelectedRecord(data[0]);
        } else {
          setForm(emptyForm);
          setSelectedRecord(null);
        }
      },
      (error) => {
        console.error("Error fetching real-time DHR data:", error);
        setMessage("❌ Error fetching DHR data.");
      }
    );

    return () => unsubscribe();
  }, [emptyForm.circle, emptyForm.siteName]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleDateChange = async (e) => {
    const isoDateStr = e.target.value;
    const parts = isoDateStr.split("-");
    const formattedDate =
      parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : "";

    setForm((prev) => ({ ...prev, date: formattedDate }));

    if (!emptyForm.circle || !emptyForm.siteName) {
      setMessage("⚠ Circle or Site Name missing.");
      return;
    }

    try {
      const dhrRef = collection(db, "dhr_reports");
      const q = query(
        dhrRef,
        where("circle", "==", emptyForm.circle),
        where("siteName", "==", emptyForm.siteName),
        where("date", "==", formattedDate),
        limit(1)
      );

      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const docData = snapshot.docs[0].data();
        setForm(docData);
        setSelectedRecord({ id: snapshot.docs[0].id, ...docData });
        setMessage(`Loaded DHR for ${formattedDate}`);
      } else {
        setForm({
          ...emptyForm,
          date: formattedDate,
          circle: emptyForm.circle,
          siteName: emptyForm.siteName,
          region: emptyForm.region,
        });
        setSelectedRecord(null);
        setMessage(`No DHR found for ${formattedDate}, starting new.`);
      }
    } catch (error) {
      console.error("Error fetching DHR for selected date:", error);
      setMessage("❌ Error fetching data for selected date.");
    }
  };

  const handleSave = async () => {
    if (!form.circle || !form.siteName) {
      setMessage("⚠ Please ensure Circle and Site Name are filled.");
      return;
    }
    if (!form.date) {
      setMessage("⚠ Please enter a Date.");
      return;
    }

    setSaving(true);
    try {
      const docId = `${form.circle}_${form.siteName}_${form.date}`;
      const isoDate = new Date(
        form.date.split(".").reverse().join("-") + "T00:00:00"
      ).toISOString();
      const lastEditTime = new Date().toISOString();

      await setDoc(doc(collection(db, "dhr_reports"), docId), {
        ...form,
        circle: form.circle,
        siteName: form.siteName,
        lastEditor: userData?.name || userData?.email || "Unknown",
        isoDate,
        lastEditTime,
      });
      setMessage("✅ DHR saved successfully!");
      setSelectedRecord({
        id: docId,
        ...form,
        lastEditor: userData?.name || userData?.email || "Unknown",
        isoDate,
        lastEditTime,
      });
    } catch (error) {
      console.error("Error saving DHR:", error);
      setMessage("❌ Error saving DHR.");
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!selectedRecord) {
      setMessage("⚠ No record selected to delete.");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete DHR for ${selectedRecord.date}?`)) {
      return;
    }
    setSaving(true);
    try {
      await deleteDoc(doc(db, "dhr_reports", selectedRecord.id));
      setMessage(`✅ DHR for ${selectedRecord.date} deleted successfully.`);
      setSelectedRecord(null);
      setForm({
        ...emptyForm,
        date: format(new Date(), "dd.MM.yyyy"),
        circle: emptyForm.circle,
        siteName: emptyForm.siteName,
        region: emptyForm.region,
      });
    } catch (error) {
      console.error("Error deleting DHR:", error);
      setMessage("❌ Error deleting DHR.");
    }
    setSaving(false);
  };

  const handleSelectRecord = (record) => {
    setSelectedRecord(record);
    setForm({ ...record });
    setMessage("");
  };

  const handleCopy = () => {
    if (!selectedRecord) return;
    const text = Object.entries(selectedRecord)
      .filter(([key]) => key !== "id")
      .map(([key, val]) => `${key}: ${val}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    setMessage("✅ DHR data copied to clipboard!");
  };

  const handleDownload = () => {
    if (!selectedRecord) return;
    const text = Object.entries(selectedRecord)
      .filter(([key]) => key !== "id")
      .map(([key, val]) => `${key}: ${val}`)
      .join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DHR_${selectedRecord.siteName}_${selectedRecord.date}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateShareText = (record) => {
    return `DHR Report for ${record.siteName} on ${record.date}

    Region : ${record.region}
    Circle : ${record.circle}
    Site Name: ${record.siteName}

    Diesel Available: ${record.dieselAvailable}
    DG Run Hrs Yesterday: ${record.dgRunHrs}
    EB Run Hrs Yesterday: ${record.ebRunHrs}
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

  const shareWhatsApp = (txt) => {
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
  };
  

  const shareTelegram = (txt) => {
    window.open(`https://t.me/share/url?url=${encodeURIComponent(txt)}`, "_blank");
  };

  return (
    <div className="create-dhr-container">
      
      {/* Notice Board */}
      <div className="instruction-tab">
        <h2 className="dashboard-header">📌 Notice Board </h2>
        {/* <h3 className="dashboard-header">📘 App Overview </h3> */}
        {isEditing ? (
          <>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={5}
              className="dashboard-instruction-panel"
            />
            <div className="flex gap-2">
              <button
                className="bg-blue-600 text-white px-3 py-1 rounded"
                onClick={async () => {
                  const docRef = doc(db, "config", "create_dhr_instruction");
                  await setDoc(docRef, { text: editText });
                  setInstructionText(editText);
                  setIsEditing(false);
                }}
              >
                Save
              </button>
              <button
                className="bg-gray-400 text-white px-3 py-1 rounded"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="dashboard-instruction-panel">
              {instructionText || "No instructions available."}
            </p>
            {["Admin", "Super Admin"].includes(userData?.role) && (
              <button
                className="text-blue-600 underline"
                onClick={() => setIsEditing(true)}
              >
                Edit Instruction
              </button>
            )}
          </>
        )}
        <h6 style={{ marginLeft: "90%" }}>Thanks & Regards @Suman Adhikari</h6>
      </div>

      <h2>Create / Edit {userData.site} Daily DHR </h2>
      {message && <p className="message">No DHR found {message}</p>}

      {/* Form Inputs in fixed order */}
      {fieldOrder.map((key) => (
        <div key={key} className="form-group">
          <label>{key.replace(/([A-Z])/g, " $1")}</label>
          {key === "date" ? (
            <input
              type="date"
              name="date"
              value={form.date ? form.date.split(".").reverse().join("-") : ""}
              onChange={handleDateChange}
              max={todayISO}
            />
          ) : (
            <input
              type="text"
              name={key}
              value={form[key]}
              onChange={handleChange}
              disabled={["region", "circle", "siteName"].includes(key)}
              placeholder={`Enter ${key}`}
            />
          )}
        </div>
      ))}

      {/* Show last editor info and time */}
      {form.lastEditor && (
        <p>
          <strong>Last edited by:</strong> {form.lastEditor} <br />
          <strong>Last edit time:</strong>{" "}
          {form.lastEditTime
            ? format(new Date(form.lastEditTime), "dd.MM.yyyy HH:mm")
            : "N/A"}
        </p>
      )}

      <button onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : "Save DHR"}
      </button>
      <button
        onClick={handleDelete}
        disabled={saving || !selectedRecord}
        style={{ marginLeft: "10px", backgroundColor: "red", color: "white" }}
        title="Delete selected DHR"
      >
        Delete DHR
      </button>

      {/* History Section */}
      <div className="dhr-history-section">
        <h3>Your Site DHR History</h3>
        {history.length === 0 && <p>No DHR records found for your site.</p>}

        <ul className="dhr-history-list">
          {history.map((record) => (
            <li
              key={record.id}
              className={selectedRecord?.id === record.id ? "selected" : ""}
              onClick={() => handleSelectRecord(record)}
            >
              {record.date} - Last edited by {record.lastEditor || "Unknown"} at{" "}
              {record.lastEditTime ? format(new Date(record.lastEditTime), "HH:mm") : "N/A"}
            </li>
          ))}
        </ul>

        {selectedRecord && (
          <div className="dhr-selected-record">
            <h4>DHR Details for {selectedRecord.date}</h4>
            <pre>
              {Object.entries(selectedRecord)
                .filter(([key]) => key !== "id")
                .map(([key, val]) => `${key}: ${val}`)
                .join("\n")}
            </pre>
            <button onClick={handleCopy}>Copy to Clipboard</button>
            <button onClick={handleDownload}>Download as TXT</button>
            <button onClick={() => shareWhatsApp(generateShareText(selectedRecord))}>
              Share WhatsApp
            </button>
            <button onClick={() => shareTelegram(generateShareText(selectedRecord))}>
              Share Telegram
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
