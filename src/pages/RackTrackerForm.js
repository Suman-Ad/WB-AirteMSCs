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
        rackType: rackType[0],
        powerType: powerType[0],
        rackSize: "",
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

  // ✅ Update input + auto-calc
  const handleChange = (e) => {
    const updated = { ...formData, [e.target.name]: e.target.value };
    const calc = computeCapacityAnalysis(updated);
    setFormData({ ...updated, ...calc });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.siteName) {
      setStatus("❌ Please enter Site Name before saving");
      return;
    }

    try {
      // 🔹 Site-wise storage: rackTracker/{siteName}
      const isEditMode = !!editData;
      const siteKey = formData.siteName.trim().toUpperCase().replace(/[\/\s]+/g, "_");
      const rackKey = `${formData.equipmentLocation || "#UNKNOWN FLOOR"}_${formData.equipmentRackNo || "#A0"}-${formData.rackName || "#UNKNOWN RACK NAME"}`.replace(/[\/\s]+/g, "_");
      const siteRef = doc(db, "acDcRackDetails", siteKey);
      if (isEditMode) {
        // Update existing record
        const rackRef = doc(siteRef, "racks", rackKey);
        await updateDoc(rackRef, { ...formData, updatedAt: new Date().toISOString() });
      } else {
        // New record
        await setDoc(siteRef, { createdAt: new Date().toISOString() }, { merge: true });
        await setDoc(
          doc(siteRef, "racks", rackKey),
          { ...formData, updatedAt: new Date().toISOString() },
          { merge: true }
        );
      }

      setStatus(isEditMode ? `✅ Updated record for ${formData.rackName}` : `✅ Data saved for site: ${formData.siteName}`);
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
            <input type="text" name="rackName" value={formData.rackName} onChange={handleChange} disabled={!!editData}/>
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
            <select type="text" name="powerType" value={formData.powerType} onChange={handleChange}>
              <option value={formData.powerType} >{formData.rackType === "Passive" ? "None" : (formData.powerType || "Select Source Type")}</option>
              {powerType.map(q => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </div>
          <div className="form-section">
            <label>Rack Size (HxWxD in mm):</label>
            <input type="text" name="rackSize" value={formData.rackSize} onChange={handleChange} placeholder="e.g., 2000x600x800" />
            <label>Rack Description:</label>
            <textarea type="text" name="rackDescription" value={formData.rackDescription} onChange={handleChange} />
            <label>Total Rack U Space:</label>
            <input type="number" name="totalRackUSpace" value={formData.totalRackUSpace} onChange={handleChange} />
            <label>Used Rack U Space:</label>
            <input type="number" name="usedRackUSpace" value={formData.usedRackUSpace} onChange={handleChange} />
            <label>Free Rack U Space:</label>
            <input type="number" name="freeRackUSpace" value={formData.freeRackUSpace} onChange={handleChange} disabled />
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
        <button type="submit" className="submit-btn">💾 Save</button>
      </form>

      {status && <p>{status}</p>}
    </div>
  );
};

export default RackTrackerForm;
