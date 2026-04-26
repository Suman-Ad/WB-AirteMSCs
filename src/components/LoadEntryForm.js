import React, { useState, useEffect, use } from "react";
import { db } from "../firebase";
import { collection, addDoc, query, where, getDocs, doc, updateDoc, getDoc } from "firebase/firestore";
import { useLocation, useNavigate } from "react-router-dom";

const isAdminAssignmentValid = (userData) => {
  if (!userData?.isAdminAssigned) return false;
  if (!userData?.adminAssignFrom || !userData?.adminAssignTo) return false;

  const today = getISTNow();
  const from = new Date(userData.adminAssignFrom);
  const to = new Date(userData.adminAssignTo);

  return today >= from && today <= to;
};

const getISTDate = () => {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });
};

const getISTNow = () => {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
};

const getISTHour = () => {
  const now = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Kolkata",
  });

  return new Date(now).getHours();
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
    uid: userData?.uid || "",
    name: userData?.name || "",
    designation: userData?.designation || "",
    empId: userData?.empId || "",
  };

  const navigate = useNavigate();

  const getCurrentDate = () => getISTDate();

  const getCurrentTime = () => {
    const now = getISTNow();
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

  const [usedSlots, setUsedSlots] = useState([]);

  const fetchUsedSlots = async (date, equipmentId, type) => {
    try {
      if (!date || !equipmentId || !type) return;

      const q = query(
        collection(db, "loadData", siteId, "dailyData", date, "entries"),
        where("equipmentType", "==", type),
        where("equipmentId", "==", equipmentId)
      );

      const snapshot = await getDocs(q);

      const slots = snapshot.docs.map(doc => doc.data().time);

      setUsedSlots(slots);
    } catch (err) {
      console.error("Slot fetch error:", err);
    }
  };

  const getDefaultSlot = (type) => {
    const hour = getISTHour();

    if (type === "SMPS") {
      if (hour < 5) return "02:00";
      if (hour < 11) return "08:00";
      if (hour < 17) return "14:00";
      return "20:00";
    } else {
      if (hour < 2) return "00:00";
      if (hour < 6) return "04:00";
      if (hour < 10) return "08:00";
      if (hour < 14) return "12:00";
      if (hour < 18) return "16:00";
      return "20:00";
    }
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

    // Common Fields
    voltageRY: "",
    voltageYB: "",
    voltageBR: "",

    currentR: "",
    currentY: "",
    currentB: "",

    voltageRN: "",
    voltageYN: "",
    voltageBN: "",

    // Temperature
    tempR: "",
    tempY: "",
    tempB: "",

    // SMPS Input Voltage
    // Output
    dcVoltage: "",
    dcCurrent: "",
    // Fault
    faultyModules: "",
    // Protection
    spdStatus: "",
    // Status
    systemStatus: "",

    // UPS
    currentN: "",
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

  const validateForm = () => {
    const errors = [];

    // ✅ Common Required
    if (!formData.date) errors.push("Date");
    if (!formData.time) errors.push("Time Slot");
    if (!formData.equipmentType) errors.push("Equipment Type");
    if (!formData.equipmentId) errors.push("Equipment ID");

    // =========================
    // 🔴 SMPS Validation
    // =========================
    if (formData.equipmentType === "SMPS") {
      // Input Voltage
      if (!formData.voltageRN) errors.push("R-N Voltage");
      if (!formData.voltageYN) errors.push("Y-N Voltage");
      if (!formData.voltageBN) errors.push("B-N Voltage");

      // Input Current
      if (!formData.currentR) errors.push("R Current");
      if (!formData.currentY) errors.push("Y Current");
      if (!formData.currentB) errors.push("B Current");

      // Temperature
      if (!formData.tempR) errors.push("R Temperature");
      if (!formData.tempY) errors.push("Y Temperature");
      if (!formData.tempB) errors.push("B Temperature");

      // Output
      if (!formData.dcVoltage) errors.push("DC Voltage");
      if (!formData.dcCurrent) errors.push("DC Current");

      // Protection & Status
      if (!formData.spdStatus) errors.push("SPD Status");
      if (!formData.systemStatus) errors.push("System Status");
      if (!formData.faultyModules) errors.push("No of Faulty Modules");
    }

    // =========================
    // 🟡 LT Panel Validation
    // =========================
    if (formData.equipmentType === "LT") {
      // Line Voltage
      if (!formData.voltageRY) errors.push("R-Y Voltage");
      if (!formData.voltageYB) errors.push("Y-B Voltage");
      if (!formData.voltageBR) errors.push("B-R Voltage");
      if (!formData.voltageRN) errors.push("R-N Voltage");
      if (!formData.voltageYN) errors.push("Y-N Voltage");
      if (!formData.voltageBN) errors.push("B-N Voltage");

      // Phase Current
      if (!formData.currentR) errors.push("R Current");
      if (!formData.currentY) errors.push("Y Current");
      if (!formData.currentB) errors.push("B Current");

      // Temperature
      if (!formData.tempR) errors.push("R Temperature");
      if (!formData.tempY) errors.push("Y Temperature");
      if (!formData.tempB) errors.push("B Temperature");

      if (!formData.powerFactor) errors.push("Power Factor");
      if (formData.powerFactor > 1 || formData.powerFactor < 0) errors.push("Power Factor" + " (must be between 0 and 1)");
      if (!formData.kwh) errors.push("kWh Reading");
    }

    // =========================
    // 🔵 UPS Validation
    // =========================
    if (formData.equipmentType === "UPS") {
      // Input Voltage
      if (!formData.voltageRY) errors.push("Input R-Y Voltage");
      if (!formData.voltageYB) errors.push("Input Y-B Voltage");
      if (!formData.voltageBR) errors.push("Input B-R Voltage");
      if (!formData.voltageRN) errors.push("Input R-N Voltage");
      if (!formData.voltageYN) errors.push("Input Y-N Voltage");
      if (!formData.voltageBN) errors.push("Input B-N Voltage");

      // Input Current
      if (!formData.currentR) errors.push("Input R Current");
      if (!formData.currentY) errors.push("Input Y Current");
      if (!formData.currentB) errors.push("Input B Current");
      if (!formData.currentN) errors.push("Input Neutral Current");

      // Temperature
      if (!formData.tempR) errors.push("R Temperature");
      if (!formData.tempY) errors.push("Y Temperature");
      if (!formData.tempB) errors.push("B Temperature");

      // Output Voltage
      if (!formData.outVoltageRY) errors.push("Output R-Y Voltage");
      if (!formData.outVoltageYB) errors.push("Output Y-B Voltage");
      if (!formData.outVoltageBR) errors.push("Output B-R Voltage");
      if (!formData.outVoltageRN) errors.push("Output R-N Voltage");
      if (!formData.outVoltageYN) errors.push("Output Y-N Voltage");
      if (!formData.outVoltageBN) errors.push("Output B-N Voltage");

      // Output Current
      if (!formData.outCurrentR) errors.push("Output R Current");
      if (!formData.outCurrentY) errors.push("Output Y Current");
      if (!formData.outCurrentB) errors.push("Output B Current");
      if (!formData.outCurrentN) errors.push("Output Neutral Current");

      // Power Factor
      if (!formData.powerFactorR) errors.push("Power Factor `R` Phase");
      if (!formData.powerFactorY) errors.push("Power Factor `Y` Phase");
      if (!formData.powerFactorB) errors.push("Power Factor `B` Phase");
      if (formData.powerFactorR > 1 || formData.powerFactorR < 0) errors.push("Power Factor `R` Phase" + " (must be between 0 and 1)");
      if (formData.powerFactorY > 1 || formData.powerFactorY < 0) errors.push("Power Factor `Y` Phase" + " (must be between 0 and 1)");
      if (formData.powerFactorB > 1 || formData.powerFactorB < 0) errors.push("Power Factor `B` Phase" + " (must be between 0 and 1)");

      // Running Load
      if (!formData.runningKWR) errors.push("Running kW (R)");
      if (!formData.runningKWY) errors.push("Running kW (Y)");
      if (!formData.runningKWB) errors.push("Running kW (B)");
    }

    // =========================
    // ⚫ DG Validation
    // =========================
    if (formData.equipmentType === "DG") {
      if (!formData.dgRunHours) errors.push("DG Run Hours");
      if (!formData.fuelConsumption) errors.push("Fuel Consumption");
    }

    // =========================
    // 👤 Technician
    // =========================
    if (!formData.technicianName) errors.push("Technician Name");

    return errors;
  };

  const checkDuplicate = async () => {
    const q = query(
      collection(db, "loadData", siteId, "dailyData", formData.date, "entries"),
      where("equipmentType", "==", formData.equipmentType),
      where("equipmentId", "==", formData.equipmentId),
      where("time", "==", formData.time)
    );

    const snapshot = await getDocs(q);

    // If editing, ignore current doc
    if (docId) {
      return snapshot.docs.some(doc => doc.id !== docId);
    }

    return !snapshot.empty;
  };

  const handleSubmit = async () => {
    if (!siteId) {
      alert("Site not found");
      return;
    }

    const errors = validateForm();
    if (errors.length > 0) {
      alert("❌ Please fill required fields:\n\n" + errors.join("\n"));
      return;
    }

    // ✅ CHECK DUPLICATE
    const isDuplicate = await checkDuplicate();

    if (isDuplicate) {
      alert("❌ Duplicate Entry! Already exists for same Date + Time + Equipment.");
      return;
    }

    const cleanData = {
      ...formData,
      siteId,
      siteName: siteName || "Unknown",
      loadKW,
      timestamp: new Date(),
      timestampIST: new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
      }),
      uploadedBy,
    };

    try {
      if (docId) {
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

      navigate("/load-dashboard");
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
    if (!editData) {
      fetchUsedSlots(
        formData.date,
        formData.equipmentId,
        formData.equipmentType
      );
    }
  }, [
    formData.date,
    formData.equipmentId,
    formData.equipmentType
  ]);

  useEffect(() => {
    if (editData) {
      setFormData((prev) => ({
        ...prev,
        ...editData,
      }));
    }
  }, [editData]);

  useEffect(() => {
    if (!docId && formData.equipmentType) {
      setFormData(prev => ({
        ...prev,
        time: getDefaultSlot(formData.equipmentType)
      }));
    }
  }, [formData.equipmentType, docId]);

  return (
    <div className="daily-log-container">
      <h2>Load Entry Form</h2>

      <h3>{docId ? "Edit Load Entry" : "New Load Entry"}</h3>
      <input
        type="date"
        name="date"
        value={formData.date}
        onChange={(e) => {
          const selected = new Date(e.target.value);

          const istDate = selected.toLocaleDateString("en-CA", {
            timeZone: "Asia/Kolkata",
          });

          setFormData(prev => ({
            ...prev,
            date: istDate
          }));
        }}
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
        <div className="equipment-details" style={{ borderRadius: "10px", width: "100%", height: window.innerHeight - 350, overflowY: "auto", padding: "20px", backgroundColor: "#f9f9f9" }}>
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

              <select
                name="time"
                value={formData.time}
                onChange={handleChange}
                disabled={(!!editData && !isAdmin) || !formData.equipmentId}
              >
                <option value="">Select Time Slot</option>
                {SMPS_TIME_SLOTS.map((slot) => (
                  <option
                    key={slot.value}
                    value={slot.value}
                    disabled={usedSlots.includes(slot.value) && !docId} // allow in edit mode
                  >
                    {slot.label} {usedSlots.includes(slot.value) ? " (Already Filled)" : ""}
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
              <input
                type="text"
                name="technicianName"
                value={formData.technicianName}
                placeholder={userData.name || ""}
                onFocus={() => {
                  if (!formData.technicianName) {
                    setFormData(prev => ({
                      ...prev,
                      technicianName: userData.name || ""
                    }));
                  }
                }}
                onChange={handleChange}
                disabled={docId && !isAdmin && !formData.technicianName}
              />
            </>
          )}

          {formData.equipmentType === "LT" && (
            <>
              <h4>LT Panel Details</h4>

              <select name="equipmentId" value={formData.equipmentId} onChange={handleChange}>
                <option value="">Select LT Panel</option>
                {Array.from({ length: siteConfig.ebCount }, (_, i) => (
                  <option key={i + 1} value={`LT Panel-${i + 1}`}>
                    {`LT Panel-${i + 1}`}
                  </option>
                ))}
              </select>

              <select
                name="time"
                value={formData.time}
                onChange={handleChange}
                disabled={(!!editData && !isAdmin) || !formData.equipmentId}
              >
                <option value="">Select Time Slot</option>
                {TIME_SLOTS.map((slot) => (
                  <option
                    key={slot.value}
                    value={slot.value}
                    disabled={usedSlots.includes(slot.value) && !docId}
                  >
                    {slot.label} {usedSlots.includes(slot.value) ? " (Already Filled)" : ""}
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
              <input
                type="text"
                name="technicianName"
                value={formData.technicianName}
                placeholder={userData.name || ""}
                onFocus={() => {
                  if (!formData.technicianName) {
                    setFormData(prev => ({
                      ...prev,
                      technicianName: userData.name || ""
                    }));
                  }
                }}
                disabled={docId && !isAdmin && !formData.technicianName}
                onChange={handleChange}
              />
            </>
          )}

          {formData.equipmentType === "UPS" && (
            <>
              <h4>UPS Details</h4>

              <select name="equipmentId" value={formData.equipmentId} onChange={handleChange}>
                <option value="">Select UPS</option>
                {Array.from({ length: siteConfig.upsCount }, (_, i) => (
                  <option key={i + 1} value={`UPS-${i + 1}`}>
                    {`UPS-${i + 1}`}
                  </option>
                ))}
              </select>

              <select
                name="time"
                value={formData.time}
                onChange={handleChange}
                disabled={(!!editData && !isAdmin) || !formData.equipmentId}
              >
                <option value="">Select Time Slot</option>
                {TIME_SLOTS.map((slot) => (
                  <option
                    key={slot.value}
                    value={slot.value}
                    disabled={usedSlots.includes(slot.value) && !docId}
                  >
                    {slot.label} {usedSlots.includes(slot.value) ? " (Already Filled)" : ""}
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
              <input
                type="text"
                name="technicianName"
                value={formData.technicianName}
                placeholder={userData.name || ""}
                onFocus={() => {
                  if (!formData.technicianName) {
                    setFormData(prev => ({
                      ...prev,
                      technicianName: userData.name || ""
                    }));
                  }
                }}
                onChange={handleChange}
                disabled={docId && !isAdmin && !formData.technicianName}
              />
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