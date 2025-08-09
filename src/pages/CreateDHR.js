// src/pages/CreateDHR.js
import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, doc, setDoc } from "firebase/firestore";
import { format } from "date-fns";
import "../assets/CreateDHR.css";

export default function CreateDHR({ userData }) {
  const [form, setForm] = useState({
    date: format(new Date(), "dd.MM.yyyy"),
    region: userData?.region || "",
    circle: userData?.circle || "",
    siteName: userData?.site || "",
    dieselAvailable: "",
    dgRunHrs: "",
    ebRunHrs: "",
    ebStatus: "",
    dgStatus: "",
    smpsStatus: "",
    upsStatus: "",
    pacStatus: "",
    crvStatus: "",
    majorActivity: "",
    inhousePM: "",
    faultDetails: ""
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!form.circle || !form.siteName) {
      setMessage("⚠ Please ensure Circle and Site Name are filled.");
      return;
    }

    setSaving(true);
    try {
      const docId = `${form.circle}_${form.siteName}_${form.date}`;
      await setDoc(doc(collection(db, "dhr_reports"), docId), form);
      setMessage("✅ DHR saved successfully!");
    } catch (error) {
      console.error("Error saving DHR:", error);
      setMessage("❌ Error saving DHR.");
    }
    setSaving(false);
  };

  return (
    <div className="create-dhr-container">
      <h2>Create Daily DHR</h2>
      {message && <p className="message">{message}</p>}

      {Object.keys(form).map((key) => (
        <div key={key} className="form-group">
          <label>{key.replace(/([A-Z])/g, " $1")}</label>
          <input
            type="text"
            name={key}
            value={form[key]}
            onChange={handleChange}
            disabled={["date", "region", "circle", "siteName"].includes(key)}
          />
        </div>
      ))}

      <button onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : "Save DHR"}
      </button>
    </div>
  );
}
