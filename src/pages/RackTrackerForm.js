// src/pages/RackTrackerForm.js
import React, { useState } from "react";
import { db } from "../firebase"; // ✅ make sure firebase.js is configured
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { useNavigate, useLocation } from "react-router-dom";
import { XAxis, YAxis, ZAxis } from "recharts";


// ✅ Helper function for safe numeric conversion
function toNumber(v) {
  if (v === null || v === undefined) return 0;
  const s = String(v).trim().replace(/,/g, "");
  if (s === "") return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

// ✅ Capacity calculation function
function computeCapacityAnalysis(form) {
  const A = toNumber(form.runningLoadA);
  const A1 = toNumber(form.rackIncomingCableSizeA);
  const A2 = toNumber(form.rackCableRunA);
  const AA1 = toNumber(form.dbMcbRatingA);
  const x = toNumber(form.rackEndRunningLoadA);
  const xx1 = toNumber(form.rackEndMcbRatingA);

  const B = toNumber(form.runningLoadB);
  const B1 = toNumber(form.rackIncomingCableSizeB);
  const B2 = toNumber(form.rackCableRunB);
  const BB1 = toNumber(form.dbMcbRatingB);
  const y = toNumber(form.rackEndRunningLoadB);
  const yy1 = toNumber(form.rackEndMcbRatingB);

  const cableCapacityA = A1 * A2 * 2;
  const cableCapacityB = B1 * B2 * 2;

  const pctLoadOnCableA = cableCapacityA > 0 ? (A / cableCapacityA) * 100 : 0;
  const pctLoadOnMcbA = AA1 > 0 ? (A / AA1) * 100 : 0;

  const pctLoadOnCableB = cableCapacityB > 0 ? (B / cableCapacityB) * 100 : 0;
  const pctLoadOnMcbB = BB1 > 0 ? (B / BB1) * 100 : 0;

  const rackEndPctLoadMcbA = xx1 > 0 ? (x / xx1) * 100 : 0;
  const rackEndPctLoadMcbB = yy1 > 0 ? (y / yy1) * 100 : 0;

  const totalLoadBoth = A + B;
  const bothCableCapacity = Math.min(cableCapacityA || Infinity, cableCapacityB || Infinity);
  const bothMcbCapacity = Math.min(AA1 || Infinity, BB1 || Infinity);

  const pctLoadBothOnCable = bothCableCapacity > 0 ? (totalLoadBoth / bothCableCapacity) * 100 : 0;
  const pctLoadBothOnMcb = bothMcbCapacity > 0 ? (totalLoadBoth / bothMcbCapacity) * 100 : 0;

  const equipmentRackNoA = form.equipmentRackNo || "A0";
  const rackNameA = form.rackName || "UNKNOWN RACK";

  const equipmentRackNoB = form.equipmentRackNo || "A0";
  const rackNameB = form.rackName || "UNKNOWN RACK";

  const rackEndRunningLoadA = A;
  const rackEndRunningLoadB = B;

  const pctRackOccupied = (toNumber(form.usedRackUSpace) > 0 && toNumber(form.totalRackUSpace) > 0)
    ? (toNumber(form.usedRackUSpace) / toNumber(form.totalRackUSpace)) * 100
    : 0;

  return {
    cableCapacityA,
    pctLoadCableA: pctLoadOnCableA.toFixed(1),
    pctLoadMcbA: pctLoadOnMcbA.toFixed(1),

    cableCapacityB,
    pctLoadCableB: pctLoadOnCableB.toFixed(1),
    pctLoadMcbB: pctLoadOnMcbB.toFixed(1),

    rackEndPctLoadMcbA: rackEndPctLoadMcbA.toFixed(1),
    rackEndPctLoadMcbB: rackEndPctLoadMcbB.toFixed(1),

    totalLoadBoth,
    bothCableCapacity,
    bothPctLoadCable: pctLoadBothOnCable.toFixed(1),
    bothPctLoadMcb: pctLoadBothOnMcb.toFixed(1),
    isBothMcbSame: AA1 > 0 && BB1 > 0 && AA1 === BB1 ? "Yes" : "No",

    equipmentRackNoA,
    rackNameA,
    equipmentRackNoB,
    rackNameB,

    rackEndRunningLoadA,
    rackEndRunningLoadB,

    sourceType: A > 0 && B > 0 ? "Dual Source" : "Single Source",
    freeRackUSpace: toNumber(form.totalRackUSpace) - toNumber(form.usedRackUSpace),
    pctRackOccupied: pctRackOccupied.toFixed(1),
  };
}

const RackTrackerForm = ({ userData }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const editData = location.state?.editData || null;
  const powerType = ["AC", "DC", "AC+DC"];
  const rackType = ["Active", "Passive"];
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(
    editData
      ? { ...editData } // Prefill all fields from the record
      : {
        // General default empty form for new entries
        slNo: "",
        circle: userData?.circle,
        siteName: userData?.site,
        equipmentLocation: "",
        equipmentRackNo: "",
        rackName: "",
        rfaiNo: "",
        rackType: rackType[0],
        powerType: "",
        rackSize: "",
        rackHeight: editData?.rackDimensions?.height || "",
        rackWidth: editData?.rackDimensions?.width || "",
        rackDepth: editData?.rackDimensions?.depth || "",
        frontTopTemp: "",
        frontMiddleTemp: "",
        frontBottomTemp: "",
        backTopTemp: "",
        backMiddleTemp: "",
        backBottomTemp: "",
        rackDescription: "",
        totalRackUSpace: "",
        usedRackUSpace: "",
        freeRackUSpace: "",
        rackOwnerName: "",

        // Source A
        smpsRatingA: "",
        smpsNameA: "",
        dbNumberA: "",
        incomerRatingA: "",
        cableSizeA: "",
        cableRunA: "",
        equipmentRackNoA: "",
        rackNameA: "",
        rackIncomingCableSizeA: "",
        rackCableRunA: "",
        dbMcbNumberA: "",
        dbMcbRatingA: "",
        tempOnMcbA: "",
        runningLoadA: "",
        cableCapacityA: "",
        pctLoadCableA: "",
        pctLoadMcbA: "",
        rackEndNoDbA: "",
        rackEndDcdbNameA: "",
        rackEndRunningLoadA: "",
        rackEndMcbRatingA: "",
        rackEndPctLoadMcbA: "",

        // Source B
        smpsRatingB: "",
        smpsNameB: "",
        dbNumberB: "",
        incomerRatingB: "",
        cableSizeB: "",
        cableRunB: "",
        equipmentRackNoB: "",
        rackNameB: "",
        rackIncomingCableSizeB: "",
        rackCableRunB: "",
        dbMcbNumberB: "",
        dbMcbRatingB: "",
        tempOnMcbB: "",
        runningLoadB: "",
        cableCapacityB: "",
        pctLoadCableB: "",
        pctLoadMcbB: "",
        rackEndNoDbB: "",
        rackEndDcdbNameB: "",
        rackEndRunningLoadB: "",
        rackEndMcbRatingB: "",
        rackEndPctLoadMcbB: "",

        // Capacity Gap Analysis
        totalLoadBoth: "",
        bothCableCapacity: "",
        bothPctLoadCable: "",
        bothPctLoadMcb: "",
        isBothMcbSame: "",
        pctRackOccupied: "",
        remarksA: "",
        remarksB: "",
        sourceType: "",
      });

  const [status, setStatus] = useState("");
  const floorList = ["Ground Floor", "1st Floor", "2nd Floor", "3rd Floor", "4th Floor", "5th Floor"]
  // U-by-U equipment map for SLD-style rack view
  const [rackUSlots, setRackUSlots] = useState(() => {
    const totalU = Number(formData.totalRackUSpace) || 42; // default 42U
    // Each slot: { uNo, label, occupied }
    return Array.from({ length: totalU }, (_, i) => ({
      uNo: totalU - i,      // 42 at top, 1 at bottom
      label: "",
      occupied: false,
    }));
  });

  const [rackEquipments, setRackEquipments] = useState(
    (editData && editData.rackEquipments) || [
      { id: Date.now().toString(), name: "", startU: "", endU: "", sizeU: 0, remarks: "" },
    ]
  );

  const recomputeUSpaceFromEquipments = (equipments, totalRackUSpace) => {
    const used = equipments.reduce((sum, e) => sum + (Number(e.sizeU) || 0), 0);
    const total = Number(totalRackUSpace) || 0;
    const free = total - used;
    return {
      usedRackUSpace: used,
      freeRackUSpace: free,
      pctRackOccupied: total > 0 ? ((used / total) * 100).toFixed(1) : "0.0",
    };
  };



  // ✅ Update input + auto-calc
  const handleChange = (e) => {
    const { name, value } = e.target;
    let updated = { ...formData, [name]: value };

    if (name === "rackType" && value === "Passive") {
      updated.powerType = "None";
    }
    if (name === "rackType" && value === "Active") {
      updated.powerType = "";
    }

    // When totalRackUSpace changes, recalc from equipments
    if (name === "totalRackUSpace") {
      const uCalc = recomputeUSpaceFromEquipments(rackEquipments, value);
      updated = { ...updated, ...uCalc };
    }

    if (name === "rackHeight" || name === "rackWidth" || name === "rackDepth") {
      updated[name] = value.replace(/[^0-9]/g, ""); // numeric only
    }

    const calc = computeCapacityAnalysis(updated);
    setFormData({ ...updated, ...calc });
  };

  function sanitizeRackEquipments(list) {
    return list
      .map(eq => {
        const start = Number(eq.startU) || 0;
        const end = Number(eq.endU) || 0;
        const sizeU = start >= end && end > 0 ? start - end + 1 : 0;

        return {
          id: eq.id,
          name: eq.name || "",
          startU: start,
          endU: end,
          sizeU,
          remarks: eq.remarks || "",
        };
      })
      .filter(eq => eq.sizeU > 0);     // remove invalid entries
  }


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.siteName) {
      setStatus("❌ Please enter Site Name before saving");
      return;
    }
    setSaving(true);
    try {
      const isEditMode = !!editData;
      const siteKey = formData.siteName.trim().toUpperCase().replace(/[\/\s]+/g, "_");
      const rackKey = `${formData.equipmentLocation || "#UNKNOWN FLOOR"}_${formData.equipmentRackNo || "#A0"
        }-${formData.rackName || "#UNKNOWN RACK NAME"}`.replace(/[\/\s]+/g, "_");
      const siteRef = doc(db, "acDcRackDetails", siteKey);

      const payload = {
        ...formData,
        rackDimensions: {
          height: Number(formData.rackHeight) || 0,
          width: Number(formData.rackWidth) || 0,
          depth: Number(formData.rackDepth) || 0,
        },
        rackEquipments: sanitizeRackEquipments(rackEquipments),
        updatedAt: new Date().toISOString(),
      };

      if (isEditMode) {
        const rackRef = doc(siteRef, "racks", rackKey);
        await updateDoc(rackRef, payload);
      } else {
        await setDoc(siteRef, { createdAt: new Date().toISOString() }, { merge: true });
        await setDoc(doc(siteRef, "racks", rackKey), payload, { merge: true });
      }

      setStatus(
        isEditMode
          ? `✅ Updated record for ${formData.rackName}`
          : `✅ Data saved for site: ${formData.siteName}`
      );
      setSaving(false);
    } catch (err) {
      console.error("Error saving to Firestore:", err);
      setStatus("❌ Error saving data");
    }

    setTimeout(() => navigate("/acdc-rack-details"), 800);
  };


  return (
    <div className="daily-log-container">
      <h1 style={{ color: "white", textAlign: "center", paddingBottom: "20px" }}>
        <strong>🗄️UPS / SMPS Equipment Details</strong>
      </h1>

      <form onSubmit={handleSubmit}>
        <div className="child-container" style={{ border: "2px solid #2083a1ff", padding: "10px", marginBottom: "20px" }}>
          <h2 style={{ borderBottom: "2px solid #2083a1ff", padding: "5px" }}><strong>General Information</strong></h2>
          {/* General Info */}
          <div className="form-section">
            <label>Site Name:</label>
            <input type="text" name="siteName" value={formData.siteName} onChange={handleChange} disabled />
          </div>
          <div className="form-section">
            <label>Equipment Switch Room Location:</label>
            <select name="equipmentLocation" onChange={handleChange}>

              <option value={formData.equipmentLocation} >{formData.equipmentLocation || "Select Location"}</option>
              {floorList.map(q => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </div>

          <div className="form-section">
            <label>Rack/Equipment Number:</label>
            <input type="text" name="equipmentRackNo" value={formData.equipmentRackNo} onChange={handleChange} disabled={!!editData} />
            <label>Rack Name/Equipment Name:</label>
            <input type="text" name="rackName" value={formData.rackName} onChange={handleChange} disabled={!!editData} />
            <label>RFAI Number:</label>
            <input type="text" name="rfaiNo" value={formData.rfaiNo} onChange={handleChange} disabled={!!editData} />
          </div>
          <div className="form-section">
            <label>Rack Type:</label>
            <select type="text" name="rackType" value={formData.rackType} onChange={handleChange}>
              <option value={formData.rackType} >{formData.rackType || "Select Rack Type"}</option>
              {rackType.map(q => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
            <label>Power Type:</label>
            <select
              name="powerType"
              value={formData.rackType === "Passive" ? "None" : formData.powerType}
              onChange={handleChange}
              disabled={formData.rackType === "Passive"}   // 🔒 disable if Passive
            >
              {formData.rackType === "Passive" ? (
                <option value="None">None</option>
              ) : (
                <>
                  <option value="">Select Source Type</option>
                  {powerType.map((q) => (
                    <option key={q} value={q}>{q}</option>
                  ))}
                </>
              )}
            </select>
          </div>
          <div className="form-section">
            <label>Rack Dimentions:</label>
            <div style={{ display: "flex", flexDirection: "row" }}>
              <input
                type="number"
                name="rackHeight"
                placeholder="Rack Height (2200mm):"
                value={formData.rackHeight}
                onChange={handleChange}
                style={{ height: "fit-content", fontSize: "10px" }}
              />
              X
              <input
                type="number"
                name="rackWidth"
                placeholder="Rack Width (600mm):"
                value={formData.rackWidth}
                onChange={handleChange}
                style={{ height: "fit-content", fontSize: "10px" }}
              />
              X
              <input
                type="number"
                name="rackDepth"
                placeholder="Rack Depth (600mm):"
                value={formData.rackDepth}
                onChange={handleChange}
                style={{ height: "fit-content", fontSize: "10px" }}
              />
            </div>
            <label>Rack Size:</label>
            <input type="text" name="rackSize"
              disabled
              value={`${formData.rackHeight}x${formData.rackWidth}x${formData.rackDepth}`} onChange={handleChange} />
            <label>Rack Description:</label>
            <textarea type="text" name="rackDescription" value={formData.rackDescription} onChange={handleChange} />
            <label>Total Rack U Space:</label>
            <input type="number" name="totalRackUSpace" value={formData.totalRackUSpace} onChange={handleChange} />
            <h2>Rack Equipments (U by U)</h2>
            <div style={{
              marginTop: '1.5rem',
              border: '1px solid #e5e7eb',
              padding: '1rem',
              borderRadius: '0.375rem',
              backgroundColor: '#f9fafb65',
              overflowY: "auto",
              maxHeight: "350px",
              marginBottom: "10px"
            }}>
              {rackEquipments.map((eq, idx) => (
                <div
                  key={eq.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "50px repeat(5, minmax(0, 1fr)) auto",
                    gap: "0.5rem",
                    marginBottom: "0.5rem",
                    alignItems: "center",
                    border: "1px solid rgba(0, 0, 0, 0.37)",
                    borderRadius: "10px"
                  }}
                >
                  {/* SL No */}
                  <div
                    style={{
                      fontWeight: "bold",
                      textAlign: "center",
                      padding: "6px 0",
                      background: "#4b7496d2",
                    }}
                  >
                    {idx + 1}
                  </div>

                  {/* Equipment Name */}
                  <input
                    className="border rounded px-2 py-1"
                    placeholder="Equipment name"
                    value={eq.name}
                    onChange={(e) => {
                      const list = [...rackEquipments];
                      list[idx] = { ...list[idx], name: e.target.value };
                      setRackEquipments(list);

                      const uCalc = recomputeUSpaceFromEquipments(list, formData.totalRackUSpace);
                      const updated = { ...formData, ...uCalc };
                      const calc = computeCapacityAnalysis(updated);
                      setFormData({ ...updated, ...calc });
                    }}
                  />

                  {/* Start U */}
                  <input
                    type="number"
                    placeholder="Start U"
                    value={eq.startU}
                    onChange={(e) => {
                      const list = [...rackEquipments];
                      const startU = Number(e.target.value) || 0;
                      const endU = Number(list[idx].endU) || 0;
                      const sizeU = startU && endU && startU >= endU ? startU - endU + 1 : 0;

                      list[idx] = { ...list[idx], startU, sizeU };
                      setRackEquipments(list);

                      const uCalc = recomputeUSpaceFromEquipments(list, formData.totalRackUSpace);
                      const updated = { ...formData, ...uCalc };
                      const calc = computeCapacityAnalysis(updated);
                      setFormData({ ...updated, ...calc });
                    }}
                  />

                  {/* End U */}
                  <input
                    type="number"
                    placeholder="End U"
                    value={eq.endU}
                    onChange={(e) => {
                      const list = [...rackEquipments];
                      const endU = Number(e.target.value) || 0;
                      const startU = Number(list[idx].startU) || 0;
                      const sizeU = startU && endU && startU >= endU ? startU - endU + 1 : 0;

                      list[idx] = { ...list[idx], endU, sizeU };
                      setRackEquipments(list);

                      const uCalc = recomputeUSpaceFromEquipments(list, formData.totalRackUSpace);
                      const updated = { ...formData, ...uCalc };
                      const calc = computeCapacityAnalysis(updated);
                      setFormData({ ...updated, ...calc });
                    }}
                  />

                  {/* Size U */}
                  <input type="number" value={eq.sizeU || 0} readOnly className="bg-gray-100" />

                  {/* Remarks */}
                  <textarea
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: "0.375rem",
                      paddingLeft: "0.5rem",
                      paddingRight: "0.5rem",
                      paddingTop: "0.25rem",
                      paddingBottom: "0.25rem"
                    }}
                    placeholder="Remarks"
                    value={eq.remarks}
                    onChange={(e) => {
                      const list = [...rackEquipments];
                      list[idx] = { ...list[idx], remarks: e.target.value };
                      setRackEquipments(list);

                      const uCalc = recomputeUSpaceFromEquipments(list, formData.totalRackUSpace);
                      const updated = { ...formData, ...uCalc };
                      const calc = computeCapacityAnalysis(updated);
                      setFormData({ ...updated, ...calc });
                    }}
                  />

                  {/* Delete Button */}
                  <p
                    type="button"
                    style={{ color: "#dc2626", fontSize: "0.875rem", width: "fit-content", cursor: "pointer" }}
                    onClick={() => {
                      const list = rackEquipments.filter((_, i) => i !== idx);
                      setRackEquipments(
                        list.length
                          ? list
                          : [{ id: Date.now().toString(), name: "", startU: "", sizeU: "", remarks: "" }]
                      );
                    }}
                  >
                    ❌
                  </p>
                </div>
              ))}


              <button
                type="button"
                style={{
                  marginTop: '0.5rem',
                  color: '#2563eb',
                  fontSize: '0.875rem'
                }}
                onClick={() =>
                  setRackEquipments([
                    ...rackEquipments,
                    { id: Date.now().toString(), name: "", startU: "", sizeU: "", remarks: "" },
                  ])
                }
              >
                + Add Equipment
              </button>
            </div>
            <label>Used Rack U Space:</label>
            <input type="number" name="usedRackUSpace" value={formData.usedRackUSpace} onChange={handleChange} />
            <label>Free Rack U Space:</label>
            <input type="number" name="freeRackUSpace" value={formData.freeRackUSpace} onChange={handleChange} disabled />
          </div>
          <h2 style={{ marginTop: "15px", borderBottom: "2px solid #2083a1ff", padding: "5px" }}>
            <strong>Rack Temperature (Front / Back)</strong>
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>

            {/* FRONT */}
            <div>
              <label style={{ fontWeight: "bold", color: "#0077b6" }}>Front - Top (°C):</label>
              <input type="number" name="frontTopTemp" value={formData.frontTopTemp} onChange={handleChange} />
            </div>

            <div>
              <label style={{ fontWeight: "bold", color: "#0077b6" }}>Front - Middle (°C):</label>
              <input type="number" name="frontMiddleTemp" value={formData.frontMiddleTemp} onChange={handleChange} />
            </div>

            <div>
              <label style={{ fontWeight: "bold", color: "#0077b6" }}>Front - Bottom (°C):</label>
              <input type="number" name="frontBottomTemp" value={formData.frontBottomTemp} onChange={handleChange} />
            </div>

            {/* BACK */}
            <div>
              <label style={{ fontWeight: "bold", color: "#8a2be2" }}>Back - Top (°C):</label>
              <input type="number" name="backTopTemp" value={formData.backTopTemp} onChange={handleChange} />
            </div>

            <div>
              <label style={{ fontWeight: "bold", color: "#8a2be2" }}>Back - Middle (°C):</label>
              <input type="number" name="backMiddleTemp" value={formData.backMiddleTemp} onChange={handleChange} />
            </div>

            <div>
              <label style={{ fontWeight: "bold", color: "#8a2be2" }}>Back - Bottom (°C):</label>
              <input type="number" name="backBottomTemp" value={formData.backBottomTemp} onChange={handleChange} />
            </div>

          </div>

          <div className="form-section">
            <label>Rack Owner Details (Name-Ph.):</label>
            <input type="text" name="rackOwnerName" value={formData.rackOwnerName} onChange={handleChange} />
          </div>
        </div>

        {/* Source A */}
        <div className="form-section" style={{ display: "flex", gap: "2px", justifyContent: "space-between" }}>
          <div className="chart-container" style={{ paddingBottom: "10px", display: "normal", border: "2px solid #2083a1ff", marginTop: "20px" }}>
            <h2 style={{ borderBottom: "2px solid #2083a1ff", padding: "5px" }}><strong>Source A</strong></h2>
            <div>
              <label style={{ color: "#2083a1ff", fontWeight: "bold" }}>{formData.powerType === "AC" ? "UPS Rating (kVA):" : formData.powerType === "DC" ? "SMPS Rating (kW/Amps):" : "SMPS/UPS Rating (Amps/kVA):"}</label>
              <input type="number" name="smpsRatingA" value={formData.smpsRatingA} onChange={handleChange} />
              <label style={{ color: "#2083a1ff", fontWeight: "bold" }}>{formData.powerType === "AC" ? "UPS Name:" : formData.powerType === "DC" ? "SMPS Name:" : "SMPS/UPS Name:"}</label>
              <input type="text" name="smpsNameA" value={formData.smpsNameA} onChange={handleChange} />
              <label style={{ color: "#2083a1ff", fontWeight: "bold" }}>A Source DB Number:</label>
              <input type="text" name="dbNumberA" value={formData.dbNumberA} onChange={handleChange} />
              <label style={{ color: "#2083a1ff", fontWeight: "bold" }}>Incomer DB Rating (Amps):</label>
              <input type="number" name="incomerRatingA" value={formData.incomerRatingA} onChange={handleChange} />
              <label style={{ color: "#2083a1ff", fontWeight: "bold" }}>Incomer DB Cable Size (Sq mm):</label>
              <input type="any" name="cableSizeA" value={formData.cableSizeA} onChange={handleChange} />
              <label style={{ color: "#2083a1ff", fontWeight: "bold" }}>PP - DB Cable Runs (Nos):</label>
              <input type="any" name="cableRunA" value={formData.cableRunA} onChange={handleChange} />
            </div>

            <div style={{ borderTop: "2px solid #4b8b25f3", padding: "5px" }}>
              <label style={{ color: "#4b8b25f3", fontWeight: "bold" }}>Equipment Rack No:</label>
              <input type="text" name="equipmentRackNoA" value={formData.equipmentRackNo} onChange={handleChange} />

              <label style={{ color: "#4b8b25f3", fontWeight: "bold" }}>Rack Name/Equipment Name:</label>
              <input type="text" name="rackNameA" value={formData.rackName} onChange={handleChange} />
            </div>

            <div style={{ borderTop: "2px solid #888013ff", padding: "5px" }}>
              <label style={{ color: "#888013ff", fontWeight: "bold" }}>Rack/Node Incoming Power Cable Size (Sq mm):</label>
              <input type="number" name="rackIncomingCableSizeA" value={formData.rackIncomingCableSizeA} onChange={handleChange} />
              <label style={{ color: "#888013ff", fontWeight: "bold" }}>DB - RackDB Cable Run (Nos):</label>
              <input type="number" name="rackCableRunA" value={formData.rackCableRunA} onChange={handleChange} />
              <label style={{ color: "#888013ff", fontWeight: "bold" }}>DB MCB Number:</label>
              <input type="text" name="dbMcbNumberA" value={formData.dbMcbNumberA} onChange={handleChange} />
              <label style={{ color: "#888013ff", fontWeight: "bold" }}>DB MCB Rating (Amps):</label>
              <input type="number" name="dbMcbRatingA" value={formData.dbMcbRatingA} onChange={handleChange} />
              <label style={{ color: "#888013ff", fontWeight: "bold" }}>Temp On Mcb/Fuse (°C):</label>
              <input type="text" name="tempOnMcbA" value={formData.tempOnMcbA} onChange={handleChange} />
              <label style={{ color: "#888013ff", fontWeight: "bold" }}>A Source Running Load (Amps):</label>
              <input type="number" name="runningLoadA" value={formData.runningLoadA} onChange={handleChange} />
            </div>

            <div style={{ borderTop: "2px solid #fffffff3", padding: "5px" }}>
              <label>Cable Load Capacity:</label>
              <input type="number" name="cableCapacityA" value={formData.cableCapacityA} onChange={handleChange} disabled />
              <label>% Load on O/P Cable:</label>
              <input type="number" name="pctLoadCableA" value={formData.pctLoadCableA} onChange={handleChange} disabled />
              <label>% Load on O/P MCB:</label>
              <input type="number" name="pctLoadMcbA" value={formData.pctLoadMcbA} onChange={handleChange} disabled />
              <label>Rack End No of DB / Power Strip No.:</label>
              <input type="number" name="rackEndNoDbA" value={formData.rackEndNoDbA} onChange={handleChange} />
              <label>Rack End DCDB / Power Strip Name:</label>
              <input type="text" name="rackEndDcdbNameA" value={formData.rackEndDcdbNameA} onChange={handleChange} />
              <label>Rack End DB Running Load (Amps):</label>
              <input type="number" name="rackEndRunningLoadA" value={formData.rackEndRunningLoadA} onChange={handleChange} />
              <label>Rack End DB MCB Rating (Amps):</label>
              <input type="number" name="rackEndMcbRatingA" value={formData.rackEndMcbRatingA} onChange={handleChange} />
              <label>% Load on I/P MCB:</label>
              <input type="number" name="rackEndPctLoadMcbA" value={formData.rackEndPctLoadMcbA} onChange={handleChange} disabled />
              <label>Remarks A:</label>
              <input type="text" name="remarksA" value={formData.remarksA} onChange={handleChange} />
            </div>
          </div>


          {/* Source B */}

          <div className="chart-container" style={{ paddingBottom: "10px", display: "normal", border: "2px solid #2083a1ff", marginTop: "20px" }}>
            <h2 style={{ borderBottom: "2px solid #2083a1ff", padding: "5px" }}><strong>Source B</strong></h2>

            <div>
              <label style={{ color: "#2083a1ff", fontWeight: "bold" }}>{formData.powerType === "AC" ? "UPS Rating (kVA):" : formData.powerType === "DC" ? "SMPS Rating (kW/Amps):" : "SMPS/UPS Rating (Amps/kVA):"}</label>
              <input type="number" name="smpsRatingB" value={formData.smpsRatingB} onChange={handleChange} />
              <label style={{ color: "#2083a1ff", fontWeight: "bold" }}>{formData.powerType === "AC" ? "UPS Name:" : formData.powerType === "DC" ? "SMPS Name:" : "SMPS/UPS Name:"}</label>
              <input type="text" name="smpsNameB" value={formData.smpsNameB} onChange={handleChange} />
              <label style={{ color: "#2083a1ff", fontWeight: "bold" }}>B Source DB Number:</label>
              <input type="text" name="dbNumberB" value={formData.dbNumberB} onChange={handleChange} />
              <label style={{ color: "#2083a1ff", fontWeight: "bold" }}>Incomer DB Rating (Amps):</label>
              <input type="number" name="incomerRatingB" value={formData.incomerRatingB} onChange={handleChange} />
              <label style={{ color: "#2083a1ff", fontWeight: "bold" }}>Incomer DB Cable Size (Sq mm):</label>
              <input type="any" name="cableSizeB" value={formData.cableSizeB} onChange={handleChange} />
              <label style={{ color: "#2083a1ff", fontWeight: "bold" }}>PP - DB Cable Runs (Nos):</label>
              <input type="any" name="cableRunB" value={formData.cableRunB} onChange={handleChange} />
            </div>

            <div style={{ borderTop: "2px solid #4b8b25f3", padding: "5px" }}>
              <label style={{ color: "#4b8b25f3", fontWeight: "bold" }}>Equipment Rack No:</label>
              <input type="text" name="equipmentRackNoB" value={formData.equipmentRackNo} onChange={handleChange} />
              <label style={{ color: "#4b8b25f3", fontWeight: "bold" }}>Rack Name/Equipment Name:</label>
              <input type="text" name="rackNameB" value={formData.rackName} onChange={handleChange} />
            </div>

            <div style={{ borderTop: "2px solid #888013ff", padding: "5px" }}>
              <label style={{ color: "#888013ff", fontWeight: "bold" }}>Rack Incoming Power Cable Size (Sq mm):</label>
              <input type="number" name="rackIncomingCableSizeB" value={formData.rackIncomingCableSizeB} onChange={handleChange} />
              <label style={{ color: "#888013ff", fontWeight: "bold" }}>DB - RackDB Cable Run (Nos):</label>
              <input type="number" name="rackCableRunB" value={formData.rackCableRunB} onChange={handleChange} />
              <label style={{ color: "#888013ff", fontWeight: "bold" }}>DB MCB Number:</label>
              <input type="text" name="dbMcbNumberB" value={formData.dbMcbNumberB} onChange={handleChange} />
              <label style={{ color: "#888013ff", fontWeight: "bold" }}>DB MCB Rating (Amps):</label>
              <input type="number" name="dbMcbRatingB" value={formData.dbMcbRatingB} onChange={handleChange} />
              <label style={{ color: "#888013ff", fontWeight: "bold" }}>Temp On Mcb/Fuse (°C):</label>
              <input type="text" name="tempOnMcbB" value={formData.tempOnMcbB} onChange={handleChange} />
              <label style={{ color: "#888013ff", fontWeight: "bold" }}>B Source Running Load (Amps):</label>
              <input type="number" name="runningLoadB" value={formData.runningLoadB} onChange={handleChange} />
            </div>

            <div style={{ borderTop: "2px solid #fffffff3", padding: "5px" }}>
              <label>Cable Load Capacity:</label>
              <input type="number" name="cableCapacityB" value={formData.cableCapacityB} onChange={handleChange} disabled />
              <label>% Load on O/P Cable:</label>
              <input type="number" name="pctLoadCableB" value={formData.pctLoadCableB} onChange={handleChange} disabled />
              <label>% Load on O/P MCB:</label>
              <input type="number" name="pctLoadMcbB" value={formData.pctLoadMcbB} onChange={handleChange} disabled />
              <label>Rack End No of DB / Power Strip No.:</label>
              <input type="number" name="rackEndNoDbB" value={formData.rackEndNoDbB} onChange={handleChange} />
              <label>Rack End DCDB / Power Strip Name:</label>
              <input type="text" name="rackEndDcdbNameB" value={formData.rackEndDcdbNameB} onChange={handleChange} />
              <label>Rack End DB Running Load (Amps):</label>
              <input type="number" name="rackEndRunningLoadB" value={formData.rackEndRunningLoadB} onChange={handleChange} />
              <label>Rack End DB MCB Rating (Amps):</label>
              <input type="number" name="rackEndMcbRatingB" value={formData.rackEndMcbRatingB} onChange={handleChange} />
              <label>% Load I/P MCB:</label>
              <input type="number" name="rackEndPctLoadMcbB" value={formData.rackEndPctLoadMcbB} onChange={handleChange} disabled />
              <label>Remarks B:</label>
              <input type="text" name="remarksB" value={formData.remarksB} onChange={handleChange} />
            </div>
          </div>
        </div>

        {/* Capacity Analysis (auto) */}
        <div className="chart-container" style={{ marginTop: "20px", padding: "10px", border: "2px solid #2083a1ff" }}>
          <h2 style={{ borderBottom: "2px solid #2083a1ff", padding: "5px" }}><strong>Capacity Gap Analysis</strong></h2>
          <p><strong>Total Load on Both Sources:</strong> {formData.totalLoadBoth} A</p>
          <p><strong>Both Source Cable Load Capacity:</strong> {formData.bothCableCapacity} </p>
          <p><strong>Both Source % Load Single O/P Cable:</strong> {formData.bothPctLoadCable}%</p>
          <p><strong>Both Source% Load Single O/P MCB:</strong> {formData.bothPctLoadMcb}%</p>
          <p><strong>Is Both Source MCB Rating Same?:</strong> {formData.isBothMcbSame}</p>
          <p><strong>Source Type:</strong> {formData.sourceType}</p>
          <p><strong>% Rack Occupied:</strong> {formData.pctRackOccupied}</p>
        </div>

        {/* Submit */}
        <button type="submit" className="submit-btn">{saving ? "Saving..." : "💾 Save"}</button>
      </form>

      {status && <p>{status}</p>}
    </div>
  );
};

export default RackTrackerForm;
