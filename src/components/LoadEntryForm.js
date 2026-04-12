import React, { useState } from "react";
import { db } from "../firebase";
import { collection, addDoc } from "firebase/firestore";

const LoadEntryForm = ({ userData }) => {

  const siteId = userData?.siteId;
  const siteName = userData?.site;
  const [formData, setFormData] = useState({
    equipmentType: "",
    equipmentId: "",

    // Common
    voltagePP: "",
    voltagePN: "",
    currentR: "",
    currentY: "",
    currentB: "",
    powerFactor: "",
    kwh: "",

    // SMPS
    dcVoltage: "",
    dcCurrent: "",

    // UPS
    outputVoltagePP: "",
    outputVoltagePN: "",
    outputCurrent: "",
    runningKW: "",

    // DG
    dgRunHours: "",
    fuelConsumption: "",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    if (!siteId) {
      alert("Site not found");
      return;
    }

    if (!formData.equipmentType) {
      alert("Select Equipment Type");
      return;
    }

    const today = new Date().toISOString().split("T")[0];

    const cleanData = Object.fromEntries(
      Object.entries({
        ...formData,
        siteId,
        siteName: siteName || "Unknown",
        date: today,
        timestamp: new Date(),
      }).filter(([_, v]) => v !== "" && v !== undefined)
    );

    await addDoc(
      collection(db, "loadData", siteId, "dailyData", today, "entries"),
      cleanData
    );

    alert("Data Saved");
  };

  const voltage = Number(formData.voltagePP);
  const current = (
    Number(formData.currentR) +
    Number(formData.currentY) +
    Number(formData.currentB)
  ) / 3;

  const pf = Number(formData.powerFactor || 0.9);

  const loadKW = (1.732 * voltage * current * pf) / 1000;

  return (
    <div className="daily-log-container">
      <h3>Load Entry</h3>

      <select name="equipmentType" onChange={handleChange}>
        <option value="">Select Equipment</option>
        <option value="SMPS">SMPS</option>
        <option value="LT">LT Panel</option>
        <option value="UPS">UPS</option>
        <option value="DG">DG</option>
      </select>

      <input name="equipmentId" placeholder="Equipment ID" onChange={handleChange} />
      <input name="voltagePP" placeholder="P-P Voltage" onChange={handleChange} />
      <input name="voltagePN" placeholder="P-N Voltage" onChange={handleChange} />

      <input name="currentR" placeholder="R Phase Current" onChange={handleChange} />
      <input name="currentY" placeholder="Y Phase Current" onChange={handleChange} />
      <input name="currentB" placeholder="B Phase Current" onChange={handleChange} />

      {formData.equipmentType === "SMPS" && (
        <>
          <input name="dcVoltage" placeholder="DC Voltage (Output)" onChange={handleChange} />
          <input name="dcCurrent" placeholder="DC Load Current" onChange={handleChange} />
        </>
      )}

      {formData.equipmentType === "LT" && (
        <>
          <input name="powerFactor" placeholder="Power Factor" onChange={handleChange} />
          <input name="kwh" placeholder="kWh Meter Reading" onChange={handleChange} />
        </>
      )}

      {formData.equipmentType === "UPS" && (
        <>
          <input name="outputVoltagePP" placeholder="Output P-P Voltage" onChange={handleChange} />
          <input name="outputVoltagePN" placeholder="Output P-N Voltage" onChange={handleChange} />
          <input name="outputCurrent" placeholder="Output Current" onChange={handleChange} />
          <input name="runningKW" placeholder="Running kW per Phase" onChange={handleChange} />
        </>
      )}

      {formData.equipmentType === "DG" && (
        <>
          <input name="dgRunHours" placeholder="DG Run Hours" onChange={handleChange} />
          <input name="fuelConsumption" placeholder="Fuel Consumption (Ltr)" onChange={handleChange} />
        </>
      )}

      <button onClick={handleSubmit}>Save</button>
    </div>
  );
};

export default LoadEntryForm;