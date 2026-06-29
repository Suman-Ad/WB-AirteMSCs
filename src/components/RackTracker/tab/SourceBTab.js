import React from "react";

const SourceBTab = ({ formData, handleChange, isAdmin, editData, siteConfig,  }) => {
    return (
        <div>
<div className="form-section" style={{ flex: 1 }}>
              <div className="chart-container" style={{ paddingBottom: "10px", display: "normal", border: "2px solid #2083a1ff", marginTop: "20px" }}>
                <h2 style={{ borderBottom: "2px solid #2083a1ff", padding: "5px" }}><strong>Source B</strong></h2>

                <div>
                  <label style={{ color: "#2083a1ff", fontWeight: "bold" }}>{formData.powerType === "AC" ? "UPS Rating (kVA):" : formData.powerType === "DC" ? "SMPS Rating (kW/Amps):" : "SMPS/UPS Rating (Amps/kVA):"}</label>
                  <input type="number" name="smpsRatingB" value={formData.smpsRatingB || (formData.powerType === "DC" ? siteConfig?.smpsConfigs?.[formData.smpsNameB]?.capacityAmp : siteConfig?.upsConfigs?.[formData.smpsNameB]?.capacityKva)} onChange={handleChange} />
                  <label style={{ color: "#2083a1ff", fontWeight: "bold" }}>{formData.powerType === "AC" ? "UPS Name:" : formData.powerType === "DC" ? "SMPS Name:" : "SMPS/UPS Name:"}</label>
                  <select type="text" name="smpsNameB" value={formData.smpsNameB} onChange={handleChange} >
                    <option value="">Select</option>
                    {(siteConfig?.smpsCount > 0 && formData.powerType === "DC") ? (
                      Array.from({ length: siteConfig.smpsCount }, (_, i) => (
                        <option key={i + 1} value={`SMPS-${i + 1}`}>
                          SMPS-{i + 1}
                        </option>
                      ))
                    ) : (siteConfig?.upsCount > 0 && formData.powerType === "AC") ? (
                      Array.from({ length: siteConfig.upsCount }, (_, i) => (
                        <option key={i + 1} value={`UPS-${i + 1}`}>
                          UPS-{i + 1}
                        </option>
                      ))
                    ) : null}
                  </select>
                  <label style={{ color: "#2083a1ff", fontWeight: "bold" }}>B Source DB Number:</label>
                  <input type="text" name="dbNumberB" value={formData.dbNumberB} onChange={handleChange} />
                  <label style={{ color: "#2083a1ff", fontWeight: "bold" }}>B Source DB Voltage (V):</label>
                  <input type="number" name="dbVoltageB" value={formData.dbVoltageB} onChange={handleChange} />
                  <label style={{ color: "#2083a1ff", fontWeight: "bold" }}>Incomer DB Rating (Amps):</label>
                  <input type="number" name="incomerRatingB" value={formData.incomerRatingB} onChange={handleChange} />
                  <label style={{ color: "#2083a1ff", fontWeight: "bold" }}>Incomer DB Cable Size (Sq mm):</label>
                  <input type="any" name="cableSizeB" value={formData.cableSizeB} onChange={handleChange} />
                  <label style={{ color: "#2083a1ff", fontWeight: "bold" }}>Incomer DB Cable Length (mtr):</label>
                  <input type="any" name="cableLengthB" value={formData.cableLengthB} onChange={handleChange} />
                  <label style={{ color: "#2083a1ff", fontWeight: "bold" }}>PP - DB Cable Runs (Nos):</label>
                  <input type="any" name="cableRunB" value={formData.cableRunB} onChange={handleChange} />
                  <label style={{ color: "#2083a1ff", fontWeight: "bold" }}>Rack/Node Cable Tagging:</label>
                  <select type="text" name="rackCableTaggingB" value={formData.rackCableTaggingB} onChange={handleChange} >
                    <option value="">Select</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
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
                  <label style={{ color: "#888013ff", fontWeight: "bold" }}>Rack/Node Incoming Power Cable Length (mtr):</label>
                  <input type="number" name="rackCableLengthB" value={formData.rackCableLengthB} onChange={handleChange} />
                  <label style={{ color: "#888013ff", fontWeight: "bold" }}>DB - RackDB Cable Run (Nos):</label>
                  <input type="number" name="rackCableRunB" value={formData.rackCableRunB} onChange={handleChange} />
                  <label style={{ color: "#888013ff", fontWeight: "bold" }}>DB MCB Number:</label>
                  <input type="text" name="dbMcbNumberB" value={formData.dbMcbNumberB} onChange={handleChange} />
                  <label style={{ color: "#888013ff", fontWeight: "bold" }}>DB MCB Label:</label>
                  <select type="text" name="dbMcbLabelB" value={formData.dbMcbLabelB} onChange={handleChange} >
                    <option value="">Select</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
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
                </div>

                <div style={{ borderTop: "2px solid #fffffff3", padding: "5px" }}>
                  <label style={{ color: "#888013ff", fontWeight: "bold" }}>Rack End Voltage (V):</label>
                  <input type="number" name="rackEndVoltageB" value={formData.rackEndVoltageB} onChange={handleChange} />
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
        </div>
    );
}; 

export default SourceBTab;