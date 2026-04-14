import React, { useState, useEffect, use } from "react";
import { db } from "../firebase";
import { collection, addDoc, query, where, getDocs, doc, updateDoc, getDoc } from "firebase/firestore";
import { useLocation } from "react-router-dom";

const isAdminAssignmentValid = (userData) => {
  if (!userData?.isAdminAssigned) return false;
  if (!userData?.adminAssignFrom || !userData?.adminAssignTo) return false;

  const today = new Date();
  const from = new Date(userData.adminAssignFrom);
  const to = new Date(userData.adminAssignTo);

  return today >= from && today <= to;
};

const LoadEntryForm = ({ userData }) => {
  const isAdmin =
    userData?.role === "Super Admin" ||
    userData?.role === "Admin" ||
    userData.isAdminAssigned ||
    isAdminAssignmentValid(userData) ||
    userData?.designation === "Vertiv Site Infra Engineer" ||
    userData?.designation === "Vertiv Site Supervisor" ||
    userData?.designation === "Vertiv CIH" ||
    userData?.designation === "Vertiv ZM";

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

  const TIME_SLOTS = [
    { label: "12:00 AM", value: "00:00" },
    { label: "04:00 AM", value: "04:00" },
    { label: "08:00 AM", value: "08:00" },
    { label: "12:00 PM", value: "12:00" },
    { label: "04:00 PM", value: "16:00" },
    { label: "08:00 PM", value: "20:00" },
  ];

  const SMPS_TIME_SLOTS = [
    { label: "02:00 AM", value: "02:00" },
    { label: "08:00 AM", value: "08:00" },
    { label: "02:00 PM", value: "14:00" },
    { label: "08:00 PM", value: "20:00" },
  ];

  const getDefaultSlot = () => {
    const hour = new Date().getHours();

    if (hour < 5) return "02:00";
    if (hour < 11) return "08:00";
    if (hour < 17) return "14:00";
    return "20:00";
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
    time: getDefaultSlot(),   // ✅ current time,

    voltageRY: "",
    voltageYB: "",
    voltageBR: "",

    currentR: "",
    currentY: "",
    currentB: "",
    currentN: "",

    // SMPS Input Voltage
    voltageRN: "",
    voltageYN: "",
    voltageBN: "",

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

    // UPS
    outCurrentN: "",
    outVoltageRN: "",
    outVoltageYN: "",
    outVoltageBN: "",
    outVoltageRY: "",
    outVoltageYB: "",
    outVoltageBR: "",
    outCurrentR: "",
    outCurrentY: "",
    outCurrentB: "",
    powerFactorR: "",
    powerFactorY: "",
    powerFactorB: "",
    runningKWR: "",
    runningKWY: "",
    runningKWB: "",

    // LT
    powerFactor: "",
    kwh: "",

    // DG
    dgRunHours: "",
    fuelConsumption: "",

    // User
    technicianName: "",
  });

  const resetFormFields = () => {
    setFormData((prev) => ({
      ...prev,

      // SMPS
      voltageRN: "",
      voltageYN: "",
      voltageBN: "",

      currentR: "",
      currentY: "",
      currentB: "",
      currentN: "",

      tempR: "",
      tempY: "",
      tempB: "",

      spdStatus: "",

      dcVoltage: "",
      dcCurrent: "",

      faultyModules: "",
      systemStatus: "",
      technicianName: "",

      // UPS
      outCurrentN: "",
      outVoltageRN: "",
      outVoltageYN: "",
      outVoltageBN: "",
      outVoltageRY: "",
      outVoltageYB: "",
      outVoltageBR: "",
      outCurrentR: "",
      outCurrentY: "",
      outCurrentB: "",
      powerFactorR: "",
      powerFactorY: "",
      powerFactorB: "",
      runningKWR: "",
      runningKWY: "",
      runningKWB: "",

      // LT
      voltageRY: "",
      voltageYB: "",
      voltageBR: "",
      powerFactor: "",
      kwh: "",

      // DG
      dgRunHours: "",
      fuelConsumption: "",
    }));
  };

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
      } else if (!snapshot.empty === false && !docId) {
        console.log("No existing data found");
        resetFormFields();
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
        resetFormFields();
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
      <h2>Load Entry Form</h2>

      <h3>{docId ? "Edit Load Entry" : "New Load Entry"}</h3>
      <input
        type="date"
        name="date"
        value={formData.date}
        onChange={handleChange}
        disabled={!!editData && !isAdmin}
      />

      <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
        <select name="equipmentType" value={formData.equipmentType} onChange={handleChange}>
          <option value="">Select Equipment</option>
          <option value="SMPS">SMPS</option>
          <option value="LT">LT Panel</option>
          <option value="UPS">UPS</option>
          {/* <option value="DG">DG</option> */}
        </select>

        <button
          style={{ padding: "10px 20px", backgroundColor: "#7eb6f1", color: "#fff", border: "none", borderRadius: "5px", cursor: "pointer" }}
          onClick={handleSubmit}
          onMouseMove={(e) => e.currentTarget.style.backgroundColor = "#0056b3"}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#7eb6f1"}
          disabled={!formData.equipmentType || !formData.time || !formData.equipmentId}>
          {docId ? "Update" : "Save"}
        </button>
      </div>
      {formData.equipmentType && (
        <div className="equipment-details" style={{ borderRadius: "10px", width: "100%", height: window.innerHeight - 300, overflowY: "auto", padding: "20px", backgroundColor: "#f9f9f9" }}>
          {formData.equipmentType === "SMPS" && (
            <>
              <h4>SMPS Details</h4>

              <select
                name="time"
                value={formData.time}
                onChange={handleChange}
                disabled={!!editData && !isAdmin}
              >
                <option value="">Select Time Slot</option>
                {SMPS_TIME_SLOTS.map((slot) => (
                  <option key={slot.value} value={slot.value}>
                    {slot.label}
                  </option>
                ))}
              </select>

              <select name="equipmentId" value={formData.equipmentId} onChange={handleChange}>
                <option value="">Select SMPS</option>
                {Array.from({ length: siteConfig.smpsCount }, (_, i) => (
                  <option key={i + 1} value={`SMPS-${i + 1}`}>
                    {`SMPS-${i + 1}`}
                  </option>
                ))}
              </select>

              <h5>Input Voltage (V)</h5>
              <input type="number" name="voltageRN" value={formData.voltageRN} placeholder="R-N Voltage" onChange={handleChange} />
              <input type="number" name="voltageYN" value={formData.voltageYN} placeholder="Y-N Voltage" onChange={handleChange} />
              <input type="number" name="voltageBN" value={formData.voltageBN} placeholder="B-N Voltage" onChange={handleChange} />

              <h5>Input Current (A)</h5>
              <input type="number" name="currentR" value={formData.currentR} placeholder="R Phase Current" onChange={handleChange} />
              <input type="number" name="currentY" value={formData.currentY} placeholder="Y Phase Current" onChange={handleChange} />
              <input type="number" name="currentB" value={formData.currentB} placeholder="B Phase Current" onChange={handleChange} />

              <h5>Input Temperature (°C)</h5>
              <input type="number" name="tempR" value={formData.tempR} placeholder="R Temp °C" onChange={handleChange} />
              <input type="number" name="tempY" value={formData.tempY} placeholder="Y Temp °C" onChange={handleChange} />
              <input type="number" name="tempB" value={formData.tempB} placeholder="B Temp °C" onChange={handleChange} />

              <h5>SPD Status</h5>
              <select name="spdStatus" value={formData.spdStatus} onChange={handleChange}>
                <option value="">Select</option>
                <option value="OK">OK</option>
                <option value="Not OK">Not OK</option>
              </select>

              <h5>Output</h5>
              <input type="number" name="dcVoltage" value={formData.dcVoltage} placeholder="DC Voltage" onChange={handleChange} />
              <input type="number" name="dcCurrent" value={formData.dcCurrent} placeholder="DC Current (A)" onChange={handleChange} />

              <h5>Fault</h5>
              <input type="number" name="faultyModules" value={formData.faultyModules} placeholder="No of Faulty Modules" onChange={handleChange} />

              <h5>Status</h5>
              <input type="text" name="systemStatus" value={formData.systemStatus} placeholder="System Status" onChange={handleChange} />

              <h5>Technician</h5>
              <input type="text" name="technicianName" value={formData.technicianName} placeholder={userData.name || ""} onFocus={(e) => { if (!formData.technicianName) { e.target.value = userData.name || ""; } }} onChange={handleChange} />
            </>
          )}

          {formData.equipmentType === "LT" && (
            <>
              <h4>LT Panel Details</h4>

              <select
                name="time"
                value={formData.time}
                onChange={handleChange}
                disabled={!!editData && !isAdmin}
              >
                <option value="">Select Time Slot</option>
                {TIME_SLOTS.map((slot) => (
                  <option key={slot.value} value={slot.value}>
                    {slot.label}
                  </option>
                ))}
              </select>

              <select name="equipmentId" value={formData.equipmentId} onChange={handleChange}>
                <option value="">Select LT Panel</option>
                {Array.from({ length: siteConfig.ebCount }, (_, i) => (
                  <option key={i + 1} value={`LT Panel-${i + 1}`}>
                    {`LT Panel-${i + 1}`}
                  </option>
                ))}
              </select>

              <h5>Voltage P-P</h5>
              <input type="number" name="voltageRY" value={formData.voltageRY} placeholder="R-Y Voltage" onChange={handleChange} />
              <input type="number" name="voltageYB" value={formData.voltageYB} placeholder="Y-B Voltage" onChange={handleChange} />
              <input type="number" name="voltageBR" value={formData.voltageBR} placeholder="B-R Voltage" onChange={handleChange} />
              <input type="number" name="voltageRN" value={formData.voltageRN} placeholder="R-N Voltage" onChange={handleChange} />
              <input type="number" name="voltageYN" value={formData.voltageYN} placeholder="Y-N Voltage" onChange={handleChange} />
              <input type="number" name="voltageBN" value={formData.voltageBN} placeholder="B-N Voltage" onChange={handleChange} />

              <h5>Current (A)</h5>
              <input type="number" name="currentR" value={formData.currentR} placeholder="R Phase Current" onChange={handleChange} />
              <input type="number" name="currentY" value={formData.currentY} placeholder="Y Phase Current" onChange={handleChange} />
              <input type="number" name="currentB" value={formData.currentB} placeholder="B Phase Current" onChange={handleChange} />

              <h5>Temperature °C</h5>
              <input type="number" name="tempR" value={formData.tempR} placeholder="R Phase Temp" onChange={handleChange} />
              <input type="number" name="tempY" value={formData.tempY} placeholder="Y Phase Temp" onChange={handleChange} />
              <input type="number" name="tempB" value={formData.tempB} placeholder="B Phase Temp" onChange={handleChange} />

              <h5>Power Factor</h5>
              <input type="number" name="powerFactor" value={formData.powerFactor} placeholder="Power Factor" onChange={handleChange} />

              <h5>kWh Meter Reading</h5>
              <input type="number" name="kwh" value={formData.kwh} placeholder="kWh Meter Reading" onChange={handleChange} />

              <h5>Technician</h5>
              <input type="text" name="technicianName" value={formData.technicianName} placeholder={userData.name || ""} onFocus={(e) => { if (!formData.technicianName) { e.target.value = userData.name || ""; } }} onChange={handleChange} />
            </>
          )}

          {formData.equipmentType === "UPS" && (
            <>
              <h4>UPS Details</h4>

              <select
                name="time"
                value={formData.time}
                onChange={handleChange}
                disabled={!!editData && !isAdmin}
              >
                <option value="">Select Time Slot</option>
                {TIME_SLOTS.map((slot) => (
                  <option key={slot.value} value={slot.value}>
                    {slot.label}
                  </option>
                ))}
              </select>

              <select name="equipmentId" value={formData.equipmentId} onChange={handleChange}>
                <option value="">Select UPS</option>
                {Array.from({ length: siteConfig.upsCount }, (_, i) => (
                  <option key={i + 1} value={`UPS-${i + 1}`}>
                    {`UPS-${i + 1}`}
                  </option>
                ))}
              </select>

              <h5>Voltage P-P (Input)</h5>
              <input type="number" name="voltageRY" value={formData.voltageRY} placeholder="R-Y Voltage" onChange={handleChange} />
              <input type="number" name="voltageYB" value={formData.voltageYB} placeholder="Y-B Voltage" onChange={handleChange} />
              <input type="number" name="voltageBR" value={formData.voltageBR} placeholder="B-R Voltage" onChange={handleChange} />
              <input type="number" name="voltageRN" value={formData.voltageRN} placeholder="R-N Voltage" onChange={handleChange} />
              <input type="number" name="voltageYN" value={formData.voltageYN} placeholder="Y-N Voltage" onChange={handleChange} />
              <input type="number" name="voltageBN" value={formData.voltageBN} placeholder="B-N Voltage" onChange={handleChange} />

              <h5>Current (A) (Input)</h5>
              <input type="number" name="currentR" value={formData.currentR} placeholder="R Phase Current" onChange={handleChange} />
              <input type="number" name="currentY" value={formData.currentY} placeholder="Y Phase Current" onChange={handleChange} />
              <input type="number" name="currentB" value={formData.currentB} placeholder="B Phase Current" onChange={handleChange} />
              <input type="number" name="currentN" value={formData.currentN} placeholder="N Phase Current" onChange={handleChange} />

              <h5>Temperature °C (Input)</h5>
              <input type="number" name="tempR" value={formData.tempR} placeholder="R Phase Temp °C" onChange={handleChange} />
              <input type="number" name="tempY" value={formData.tempY} placeholder="Y Phase Temp °C" onChange={handleChange} />
              <input type="number" name="tempB" value={formData.tempB} placeholder="B Phase Temp °C" onChange={handleChange} />

              <h5>Voltage P-P (Output)</h5>
              <input type="number" name="outVoltageRY" value={formData.outVoltageRY} placeholder="R-Y Voltage" onChange={handleChange} />
              <input type="number" name="outVoltageYB" value={formData.outVoltageYB} placeholder="Y-B Voltage" onChange={handleChange} />
              <input type="number" name="outVoltageBR" value={formData.outVoltageBR} placeholder="B-R Voltage" onChange={handleChange} />
              <input type="number" name="outVoltageRN" value={formData.outVoltageRN} placeholder="R-N Voltage" onChange={handleChange} />
              <input type="number" name="outVoltageYN" value={formData.outVoltageYN} placeholder="Y-N Voltage" onChange={handleChange} />
              <input type="number" name="outVoltageBN" value={formData.outVoltageBN} placeholder="B-N Voltage" onChange={handleChange} />

              <h5>Current (A) (Output)</h5>
              <input type="number" name="outCurrentR" value={formData.outCurrentR} placeholder="R Phase Current" onChange={handleChange} />
              <input type="number" name="outCurrentY" value={formData.outCurrentY} placeholder="Y Phase Current" onChange={handleChange} />
              <input type="number" name="outCurrentB" value={formData.outCurrentB} placeholder="B Phase Current" onChange={handleChange} />
              <input type="number" name="outCurrentN" value={formData.outCurrentN} placeholder="N Phase Current" onChange={handleChange} />

              <h5>Power Factor</h5>
              <input type="number" name="powerFactorR" value={formData.powerFactorR} placeholder="Power Factor 'R'" onChange={handleChange} />
              <input type="number" name="powerFactorY" value={formData.powerFactorY} placeholder="Power Factor 'Y'" onChange={handleChange} />
              <input type="number" name="powerFactorB" value={formData.powerFactorB} placeholder="Power Factor 'B'" onChange={handleChange} />

              <h5>kWh Meter Reading</h5>
              <input type="number" name="runningKWR" value={formData.runningKWR} placeholder="Running kW of 'R' Phase" onChange={handleChange} />
              <input type="number" name="runningKWY" value={formData.runningKWY} placeholder="Running kW of 'Y' Phase" onChange={handleChange} />
              <input type="number" name="runningKWB" value={formData.runningKWB} placeholder="Running kW of 'B' Phase" onChange={handleChange} />

              <h5>Technician</h5>
              <input type="text" name="technicianName" value={formData.technicianName} placeholder={userData.name || ""} onFocus={(e) => { if (!formData.technicianName) { e.target.value = userData.name || ""; } }} onChange={handleChange} />
            </>
          )}

          {/* {formData.equipmentType === "DG" && (
        <>
          <input name="dgRunHours" placeholder="DG Run Hours" onChange={handleChange} />
          <input name="fuelConsumption" placeholder="Fuel Consumption (Ltr)" onChange={handleChange} />
        </>
      )} */}
        </div>
      )}
    </div>
  );
};

export default LoadEntryForm;