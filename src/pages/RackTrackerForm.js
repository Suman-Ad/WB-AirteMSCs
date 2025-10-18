// src/pages/RackTrackerForm.js
import React, { useState } from "react";
import { db } from "../firebase"; // ✅ make sure firebase.js is configured
import { doc, setDoc } from "firebase/firestore";


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
  const A1 = toNumber(form.cableSizeA);
  const A2 = toNumber(form.cableRunA);
  const AA1 = toNumber(form.dbMcbRatingA);

  const B = toNumber(form.runningLoadB);
  const B1 = toNumber(form.cableSizeB);
  const B2 = toNumber(form.cableRunB);
  const BB1 = toNumber(form.dbMcbRatingB);

  const cableCapacityA = A1 * A2 * 2;
  const cableCapacityB = B1 * B2 * 2;

  const pctLoadOnCableA = cableCapacityA > 0 ? (A / cableCapacityA) * 100 : 0;
  const pctLoadOnMcbA = AA1 > 0 ? (A / AA1) * 100 : 0;

  const pctLoadOnCableB = cableCapacityB > 0 ? (B / cableCapacityB) * 100 : 0;
  const pctLoadOnMcbB = BB1 > 0 ? (B / BB1) * 100 : 0;

  const totalLoadBoth = A + B;
  const bothCableCapacity = Math.min(cableCapacityA || Infinity, cableCapacityB || Infinity);
  const bothMcbCapacity = Math.min(AA1 || Infinity, BB1 || Infinity);

  const pctLoadBothOnCable = bothCableCapacity > 0 ? (totalLoadBoth / bothCableCapacity) * 100 : 0;
  const pctLoadBothOnMcb = bothMcbCapacity > 0 ? (totalLoadBoth / bothMcbCapacity) * 100 : 0;

  return {
    cableCapacityA,
    pctLoadOnCableA: pctLoadOnCableA.toFixed(1),
    pctLoadOnMcbA: pctLoadOnMcbA.toFixed(1),

    cableCapacityB,
    pctLoadOnCableB: pctLoadOnCableB.toFixed(1),
    pctLoadOnMcbB: pctLoadOnMcbB.toFixed(1),

    totalLoadBoth,
    bothCableCapacity,
    bothPctLoadCable: pctLoadBothOnCable.toFixed(1),
    bothPctLoadMcb: pctLoadBothOnMcb.toFixed(1),
    isBothMcbSame: AA1 > 0 && BB1 > 0 && AA1 === BB1 ? "Yes" : "No",
  };
}

const RackTrackerForm = ({ userData }) => {
  const [formData, setFormData] = useState({
    // General
    slNo: "",
    circle: userData?.circle,
    siteName: userData?.site,
    equipmentLocation: "",
    equipmentRackNo: "",
    rackName: "",

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
    remarksA: "",
    remarksB: "",
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
      const siteKey = formData.siteName.trim().toUpperCase().replace(/\s+/g, "_");
      const rackKey = `${formData.equipmentRackNo || "A0"}-${formData.rackName || "UNKNOWN RACK"}`.replace(/\s+/g, "_");
      await setDoc(
        doc(db, "acDcRackDetails", siteKey, "racks", rackKey),
        {
          ...formData,
          updatedAt: new Date().toISOString(),
        },
        { merge: true } // ✅ merge so we don’t overwrite completely
      );

      setStatus(`✅ Data saved for site: ${formData.siteName}`);
    } catch (err) {
      console.error("Error saving to Firestore:", err);
      setStatus("❌ Error saving data");
    }
  };

  return (
    <div className="daily-log-container">
      <h2>UPS / SMPS Equipment Details</h2>

      <form onSubmit={handleSubmit}>
        {/* General Info */}
        <div className="form-section">
          <label>Site Name:</label>
          <input type="text" name="siteName" value={formData.siteName} onChange={handleChange} />
        </div>
        <div className="form-section">
          <label>Equipment Location:</label>
          <select name="equipmentLocation" onChange={handleChange}>
            
            <option value="" > Select Location </option>
            {floorList.map(q => (
              <option key={q} value={q}>{q}</option>
            ))}
          </select>
        </div>

        <div>
              <label>Rack/Equipment Number</label>
              <input type="text" name="equipmentRackNo" value={formData.equipmentRackNo} onChange={handleChange} />
              <label>Rack Name/Equipment Name</label>
              <input type="text" name="rackName" value={formData.rackName} onChange={handleChange} />
            </div>

        {/* Source A */}
        <h3>Source A</h3>
        <div className="form-section">
          <div className="child-container" style={{ display: "normal" }}>
            <div style={{borderColor:"black", borderWidth:"5px"}}>
              <label>SMPS Rating (Amps):</label>
              <input type="number" name="smpsRatingA" value={formData.smpsRatingA} onChange={handleChange} />
            </div>
            <div>
              <label>SMPS Name:</label>
              <input type="text" name="smpsNameA" value={formData.smpsNameA} onChange={handleChange} />
            </div>
            <div>
              <label>A Source DB Number:</label>
              <input type="text" name="dbNumberA" value={formData.dbNumberA} onChange={handleChange} />
            </div>
            <div>
              <label>Incomer DB Rating (Amps):</label>
              <input type="number" name="incomerRatingA" value={formData.incomerRatingA} onChange={handleChange} />
            </div>
            <div>
              <label>Incomer DB Cable Size (Sq mm):</label>
              <input type="number" name="cableSizeA" value={formData.cableSizeA} onChange={handleChange} />
            </div>

            <div>
              <label>PP - DB Cable Runs (Nos):</label>
              <input type="number" name="cableRunA" value={formData.cableRunA} onChange={handleChange} />
            </div>

            <div>
              <label>Equipment Rack No</label>
              <input type="text" name="equipmentRackNoA" value={formData.equipmentRackNo} onChange={handleChange} />
            </div>

            <div>
              <label>Rack Name/Equipment Name</label>
              <input type="text" name="rackNameA" value={formData.rackName} onChange={handleChange} />
            </div>

            <div>
              <label>Rack Incoming Power Cable Size (Sq mm)</label>
              <input type="text" name="rackIncomingCableSizeA" value={formData.rackIncomingCableSizeA} onChange={handleChange} />
            </div>

            <div>
              <label>DB - RackDB Cable Run (Nos)</label>
              <input type="text" name="rackCableRunA" value={formData.rackCableRunA} onChange={handleChange} />
            </div>

            <div>
              <label>DB MCB Number:</label>
              <input type="text" name="dbMcbNumberA" value={formData.dbMcbNumberA} onChange={handleChange} />
            </div>

            <div>
              <label>DB MCB Rating (Amps):</label>
              <input type="number" name="dbMcbRatingA" value={formData.dbMcbRatingA} onChange={handleChange} />
            </div>

            <div>
              <label>Temp On Mcb/Fuse (°C)</label>
              <input type="text" name="tempOnMcbA" value={formData.tempOnMcbA} onChange={handleChange} />
            </div>

            <div>
              <label>A Source Running Load (Amps):</label>
              <input type="number" name="runningLoadA" value={formData.runningLoadA} onChange={handleChange} />
            </div>

            <div>
              <label>Cable Capacity (Amps)</label>
              <input type="number" name="cableCapacityA" value={formData.cableCapacityA} onChange={handleChange} />
            </div>

            <div>
              <label><strong>%</strong> Load Cable</label>
              <input type="number" name="pctLoadCableA" value={formData.pctLoadCableA} onChange={handleChange} />
            </div>

            <div>
              <label><strong>%</strong> PCT Load MCB (Amps)</label>
              <input type="number" name="pctLoadMcbA" value={formData.pctLoadMcbA} onChange={handleChange} />
            </div>

            <div>
              <label>Rack End No of DB / Power Strip (nos.)</label>
              <input type="number" name="rackEndNoDbA" value={formData.rackEndNoDbA} onChange={handleChange} />
            </div>

            <div>
              <label>Rack End DCDB / Power Strip Name</label>
              <input type="number" name="rackEndDcdbNameA" value={formData.rackEndDcdbNameA} onChange={handleChange} />
            </div>

            <div>
              <label>Rack End DB Running Load (Amps)</label>
              <input type="number" name="rackEndRunningLoadA" value={formData.rackEndRunningLoadA} onChange={handleChange} />
            </div>

            <div>
              <label>Rack End DB MCB Rating (Amps)</label>
              <input type="number" name="rackEndMcbRatingA" value={formData.rackEndMcbRatingA} onChange={handleChange} />
            </div>

            <div>
              <label>Rack End <strong>%</strong> Load MCB</label>
              <input type="number" name="rackEndPctLoadMcbA" value={formData.rackEndPctLoadMcbA} onChange={handleChange} />
            </div>
          </div>
        </div>

        {/* Source B */}
        <h3>Source B</h3>
        <div className="form-section">
          <div className="child-container" style={{ display: "normal" }}>
            <div style={{borderColor:"black", borderWidth:"5px"}}>
              <label>SMPS Rating (Amps):</label>
              <input type="number" name="smpsRatingB" value={formData.smpsRatingB} onChange={handleChange} />
            </div>
            <div>
              <label>SMPS Name:</label>
              <input type="text" name="smpsNameB" value={formData.smpsNameB} onChange={handleChange} />
            </div>
            <div>
              <label>B Source DB Number:</label>
              <input type="text" name="dbNumberB" value={formData.dbNumberB} onChange={handleChange} />
            </div>
            <div>
              <label>Incomer DB Rating (Amps):</label>
              <input type="number" name="incomerRatingB" value={formData.incomerRatingB} onChange={handleChange} />
            </div>
            <div>
              <label>Incomer DB Cable Size (Sq mm):</label>
              <input type="number" name="cableSizeB" value={formData.cableSizeB} onChange={handleChange} />
            </div>

            <div>
              <label>PP - DB Cable Runs (Nos):</label>
              <input type="number" name="cableRunB" value={formData.cableRunB} onChange={handleChange} />
            </div>

            <div>
              <label>Equipment Rack No</label>
              <input type="text" name="equipmentRackNoB" value={formData.equipmentRackNo} onChange={handleChange} />
            </div>

            <div>
              <label>Rack Name/Equipment Name</label>
              <input type="text" name="rackNameB" value={formData.rackName} onChange={handleChange} />
            </div>

            <div>
              <label>Rack Incoming Power Cable Size (Sq mm)</label>
              <input type="text" name="rackIncomingCableSizeB" value={formData.rackIncomingCableSizeB} onChange={handleChange} />
            </div>

            <div>
              <label>DB - RackDB Cable Run (Nos)</label>
              <input type="text" name="rackCableRunB" value={formData.rackCableRunB} onChange={handleChange} />
            </div>

            <div>
              <label>DB MCB Number:</label>
              <input type="text" name="dbMcbNumberB" value={formData.dbMcbNumberB} onChange={handleChange} />
            </div>

            <div>
              <label>DB MCB Rating (Amps):</label>
              <input type="number" name="dbMcbRatingB" value={formData.dbMcbRatingB} onChange={handleChange} />
            </div>

            <div>
              <label>Temp On Mcb/Fuse (°C)</label>
              <input type="text" name="tempOnMcbB" value={formData.tempOnMcbB} onChange={handleChange} />
            </div>

            <div>
              <label>B Source Running Load (Amps):</label>
              <input type="number" name="runningLoadB" value={formData.runningLoadB} onChange={handleChange} />
            </div>

            <div>
              <label>Cable Capacity (Amps)</label>
              <input type="number" name="cableCapacityB" value={formData.cableCapacityB} onChange={handleChange} />
            </div>

            <div>
              <label><strong>%</strong> Load Cable</label>
              <input type="number" name="pctLoadCableB" value={formData.pctLoadCableB} onChange={handleChange} />
            </div>

            <div>
              <label><strong>%</strong> PCT Load MCB (Amps)</label>
              <input type="number" name="pctLoadMcbB" value={formData.pctLoadMcbB} onChange={handleChange} />
            </div>

            <div>
              <label>Rack End No of DB / Power Strip (nos.)</label>
              <input type="number" name="rackEndNoDbB" value={formData.rackEndNoDbB} onChange={handleChange} />
            </div>

            <div>
              <label>Rack End DCDB / Power Strip Name</label>
              <input type="number" name="rackEndDcdbNameB" value={formData.rackEndDcdbNameB} onChange={handleChange} />
            </div>

            <div>
              <label>Rack End DB Running Load (Amps)</label>
              <input type="number" name="rackEndRunningLoadB" value={formData.rackEndRunningLoadB} onChange={handleChange} />
            </div>

            <div>
              <label>Rack End DB MCB Rating (Amps)</label>
              <input type="number" name="rackEndMcbRatingB" value={formData.rackEndMcbRatingB} onChange={handleChange} />
            </div>

            <div>
              <label>Rack End <strong>%</strong> Load MCB</label>
              <input type="number" name="rackEndPctLoadMcbB" value={formData.rackEndPctLoadMcbB} onChange={handleChange} />
            </div>
          </div>
        </div>

        {/* Capacity Analysis (auto) */}
        <h3>Capacity Gap Analysis</h3>
        <p>Total Load Both Sources: {formData.totalLoadBoth} A</p>
        <p>Both Cable Capacity: {formData.bothCableCapacity} </p>
        <p>% Load on Cable: {formData.bothPctLoadCable}%</p>
        <p>% Load on MCB: {formData.bothPctLoadMcb}%</p>
        <p>Both MCB Same?: {formData.isBothMcbSame}</p>

        {/* Submit */}
        <button type="submit">💾 Save</button>
      </form>

      {status && <p>{status}</p>}
    </div>
  );
};

export default RackTrackerForm;
