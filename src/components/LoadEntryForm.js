import React, { useState, useEffect, use } from "react";
import { db } from "../firebase";
import { collection, addDoc, query, where, getDocs, doc, updateDoc, getDoc} from "firebase/firestore";
import { useLocation } from "react-router-dom";


const LoadEntryForm = ({ userData }) => {

  const uploadedBy = {
    uid: userData?.uid | "",
    name: userData?.name || "",
    designation: userData?.designation || "",
    empId: userData?.empId || "",
  };

  const getCurrentDate = () => new Date().toISOString().split("T")[0];

  const getCurrentTime = () => {
    const now = new Date();
    return now.toTimeString().slice(0, 5); // HH:MM
  };
  const location = useLocation();
  const editData = location.state?.editData;
  const docId = location.state?.docId;
  const siteId = userData?.siteId;
  const siteName = userData?.site;
  const [siteConfig, setSiteConfig] = useState({});
  const [formData, setFormData] = useState({
    equipmentType: "",
    equipmentId: "",

    // Common
    date: getCurrentDate(),   // ✅ default today
    time: getCurrentTime(),   // ✅ current time,

    // SMPS Input Voltage
    voltageRN: "",
    voltageYN: "",
    voltageBN: "",

    // SMPS Input Current
    currentR: "",
    currentY: "",
    currentB: "",

    // Temperature
    tempR: "",
    tempY: "",
    tempB: "",

    // Protection
    spdStatus: "",

    // Output
    dcVoltage: "",
    dcCurrent: "",

    // Fault
    faultyModules: "",

    // Status
    systemStatus: "",

    // User
    technicianName: "",

    // UPS
    outputVoltagePP: "",
    outputVoltagePN: "",
    outputCurrent: "",
    runningKW: "",

    // DG
    dgRunHours: "",
    fuelConsumption: "",
  });

  // Fetch Site Configs from Firestore
  const fetchConfig = async () => {
    if (!siteName) return;
    const siteKey = siteName.toUpperCase();
    const snap = await getDoc(doc(db, "siteConfigs", siteKey));
    if (snap.exists()) {
      setSiteConfig(snap.data());
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [siteName]);

  const fetchExistingData = async (date, time, equipmentId, type) => {
    try {
      if (!date || !equipmentId || !type) return;

      const q = query(
        collection(db, "loadData", siteId, "dailyData", date, "entries"),
        where("equipmentType", "==", type),
        where("equipmentId", "==", equipmentId),
        where("time", "==", time || "") // ✅ match time also
      );

      const snapshot = await getDocs(q);

      if (!snapshot.empty && !docId) {
        const docSnap = snapshot.docs[0];
        const existingData = docSnap.data();

        alert("Existing entry found for this equipment at the same date & time. Loading data for editing.");

        setFormData((prev) => ({
          ...prev,
          ...existingData,
        }));

        console.log("Existing data loaded");
      } else {
        console.log("No existing data found");
      }
    } catch (err) {
      console.error("Fetch error:", err);
    }
  };

  let loadKW = 0;

  if (formData.equipmentType === "SMPS") {
    const dcV = Number(formData.dcVoltage || 0);
    const dcI = Number(formData.dcCurrent || 0);

    loadKW = (dcV * dcI) / 1000;
  }


  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
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

    // const cleanData = Object.fromEntries(
    //   Object.entries({
    //     ...formData,
    //     siteId,
    //     siteName: siteName || "Unknown",
    //     loadKW,
    //     date: formData.date || today,
    //     timestamp: new Date(),
    //     uploadedBy,
    //   }).filter(([_, v]) => v !== "" && v !== undefined)
    // );

    const cleanData = {
      ...formData,
      siteId,
      siteName: siteName || "Unknown",
      loadKW,
      timestamp: new Date(),
      uploadedBy,
    };

    // await addDoc(
    //   collection(db, "loadData", siteId, "dailyData", today, "entries"),
    //   cleanData
    // );

    try {
      if (docId) {
        // ✏️ UPDATE
        await updateDoc(
          doc(
            db,
            "loadData",
            siteId,
            "dailyData",
            formData.date,
            "entries",
            docId
          ),
          cleanData
        );

        alert("Data Updated");
      } else {
        // ➕ ADD
        await addDoc(
          collection(
            db,
            "loadData",
            siteId,
            "dailyData",
            formData.date,
            "entries"
          ),
          cleanData
        );

        alert("Data Saved");
      }
    } catch (err) {
      console.error("Save error:", err);
    }
  };

  useEffect(() => {
    if (!editData) {
      fetchExistingData(
        formData.date,
        formData.time,
        formData.equipmentId,
        formData.equipmentType
      );
    }
  }, [
    formData.date,
    formData.time,
    formData.equipmentId,
    formData.equipmentType,
  ]);

  useEffect(() => {
    if (editData) {
      setFormData((prev) => ({
        ...prev,
        ...editData,
      }));
    }
  }, [editData]);

  return (
    <div className="daily-log-container">
      <h3>{docId ? "Edit Load Entry" : "New Load Entry"}</h3>

      <input
        type="date"
        name="date"
        value={formData.date}
        onChange={handleChange}
        disabled={!!editData}
      />

      <input
        type="time"
        name="time"
        value={formData.time}
        onChange={handleChange}
        disabled={!!editData}
      />

      <select name="equipmentType" value={formData.equipmentType} onChange={handleChange}>
        <option value="">Select Equipment</option>
        <option value="SMPS">SMPS</option>
        <option value="LT">LT Panel</option>
        <option value="UPS">UPS</option>
        <option value="DG">DG</option>
      </select>

      {/* <input name="equipmentId" placeholder="Equipment ID" onChange={handleChange} />
      <input name="voltagePP" placeholder="P-P Voltage" onChange={handleChange} />
      <input name="voltagePN" placeholder="P-N Voltage" onChange={handleChange} />

      <input name="currentR" placeholder="R Phase Current" onChange={handleChange} />
      <input name="currentY" placeholder="Y Phase Current" onChange={handleChange} />
      <input name="currentB" placeholder="B Phase Current" onChange={handleChange} /> */}

      {formData.equipmentType === "SMPS" && (
        <>
          <h4>SMPS Details</h4>

          <select name="equipmentId" value={formData.equipmentId} onChange={handleChange}>
            <option value="">Select SMPS</option>
            {Array.from({ length: siteConfig.smpsCount }, (_, i) => (
              <option key={i + 1} value={`SMPS-${i + 1}`}>
                {`SMPS-${i + 1}`}
              </option>
            ))}
          </select>

          <h5>Input Voltage (V)</h5>
          <input name="voltageRN" value={formData.voltageRN} placeholder="R-N Voltage" onChange={handleChange} />
          <input name="voltageYN" value={formData.voltageYN} placeholder="Y-N Voltage" onChange={handleChange} />
          <input name="voltageBN" value={formData.voltageBN} placeholder="B-N Voltage" onChange={handleChange} />

          <h5>Input Current (A)</h5>
          <input name="currentR" value={formData.currentR} placeholder="R Phase Current" onChange={handleChange} />
          <input name="currentY" value={formData.currentY} placeholder="Y Phase Current" onChange={handleChange} />
          <input name="currentB" value={formData.currentB} placeholder="B Phase Current" onChange={handleChange} />

          <h5>Input Temperature (°C)</h5>
          <input name="tempR" value={formData.tempR} placeholder="R Temp" onChange={handleChange} />
          <input name="tempY" value={formData.tempY} placeholder="Y Temp" onChange={handleChange} />
          <input name="tempB" value={formData.tempB} placeholder="B Temp" onChange={handleChange} />

          <h5>SPD Status</h5>
          <select name="spdStatus" value={formData.spdStatus} onChange={handleChange}>
            <option value="">Select</option>
            <option value="OK">OK</option>
            <option value="Not OK">Not OK</option>
          </select>

          <h5>Output</h5>
          <input name="dcVoltage" value={formData.dcVoltage} placeholder="DC Voltage" onChange={handleChange} />
          <input name="dcCurrent" value={formData.dcCurrent} placeholder="DC Current (A)" onChange={handleChange} />

          <h5>Fault</h5>
          <input name="faultyModules" value={formData.faultyModules} placeholder="No of Faulty Modules" onChange={handleChange} />

          <h5>Status</h5>
          <input name="systemStatus" value={formData.systemStatus} placeholder="System Status" onChange={handleChange} />

          <h5>Technician</h5>
          <input name="technicianName" value={formData.technicianName} placeholder={userData.name || ""} onChange={handleChange} />
        </>
      )}

      {formData.equipmentType === "LT" && (
        <>
          <input name="powerFactor" value={formData.powerFactor} placeholder="Power Factor" onChange={handleChange} />
          <input name="kwh" value={formData.kwh} placeholder="kWh Meter Reading" onChange={handleChange} />
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

      <button onClick={handleSubmit}>
        {docId ? "Update" : "Save"}
      </button>
    </div>
  );
};

export default LoadEntryForm;