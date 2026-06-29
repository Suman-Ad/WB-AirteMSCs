import React from "react";

const SourceTab = ({ formData, handleChange, isAdmin, editData, siteConfig, source }) => {
    const suffix = source;

    const get = (field) => formData[`${field}${suffix}`] ?? "";

    const field = (name) => `${name}${suffix}`;

    const sourceTitle = `Source ${suffix}`;

    return (
        <div>
            <div className="form-section" style={{ flex: 1 }}>
                <div className="chart-container" style={{ paddingBottom: "10px", display: "normal", border: "2px solid #2083a1ff", marginTop: "20px" }}>
                    <h2 style={{ borderBottom: "2px solid #2083a1ff", padding: "5px" }}><strong>{sourceTitle}</strong></h2>
                    <div>
                        <label style={{ color: "#2083a1ff", fontWeight: "bold" }}>{formData.powerType === "AC" ? "UPS Rating (kVA):" : formData.powerType === "DC" ? "SMPS Rating (kW/Amps):" : "SMPS/UPS Rating (Amps/kVA):"}</label>
                        <input type="number" name={field("smpsRating")} value={get("smpsRating")} onChange={handleChange} />
                        <label style={{ color: "#2083a1ff", fontWeight: "bold" }}>{formData.powerType === "AC" ? "UPS Name:" : formData.powerType === "DC" ? "SMPS Name:" : "SMPS/UPS Name:"}</label>
                        <select type="text" name={field("smpsName")} value={get("smpsName")} onChange={handleChange} >
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
                            ) : (formData.powerType === "AC+DC") ? (
                                Array.from({ length: siteConfig.upsCount }, (_, i) => (
                                    <option key={i + 1} value={`UPS-${i + 1}`}>
                                        UPS-{i + 1}
                                    </option>
                                ))
                            ) : null}
                        </select>
                        <label style={{ color: "#2083a1ff", fontWeight: "bold" }}>{sourceTitle} DB Number:</label>
                        <input type="text" name={field("dbNumber")} value={get("dbNumber")} onChange={handleChange} />
                        <label style={{ color: "#2083a1ff", fontWeight: "bold" }}>{sourceTitle} DB Voltage (V):</label>
                        <input type="number" name={field("dbVoltage")} value={get("dbVoltage")} onChange={handleChange} />
                        <label style={{ color: "#2083a1ff", fontWeight: "bold" }}>{sourceTitle} Incomer DB Rating (Amps):</label>
                        <input type="number" name={field("incomerRating")} value={get("incomerRating")} onChange={handleChange} />
                        <label style={{ color: "#2083a1ff", fontWeight: "bold" }}>{sourceTitle} Incomer DB Cable Size (Sq mm):</label>
                        <input type="any" name={field("cableSize")} value={get("cableSize")} onChange={handleChange} />
                        <label style={{ color: "#2083a1ff", fontWeight: "bold" }}>{sourceTitle} Incomer DB Cable Length (mtr):</label>
                        <input type="any" name={field("cableLength")} value={get("cableLength")} onChange={handleChange} />
                        <label style={{ color: "#2083a1ff", fontWeight: "bold" }}>{sourceTitle} PP - DB Cable Runs (Nos):</label>
                        <input type="any" name={field("cableRun")} value={get("cableRun")} onChange={handleChange} />
                        <label style={{ color: "#2083a1ff", fontWeight: "bold" }}>{sourceTitle} Rack/Node Cable Tagging:</label>
                        <select type="text" name={field("rackCableTagging")} value={get("rackCableTagging")} onChange={handleChange} >
                            <option value="">Select</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                        </select>
                    </div>

                    <div style={{ borderTop: "2px solid #4b8b25f3", padding: "5px" }}>
                        <label style={{ color: "#4b8b25f3", fontWeight: "bold" }}>{sourceTitle} Equipment Rack No:</label>
                        <input type="text" name={field("equipmentRackNo")} value={get("equipmentRackNo")} onChange={handleChange} />

                        <label style={{ color: "#4b8b25f3", fontWeight: "bold" }}>{sourceTitle}Rack Name/Equipment Name:</label>
                        <input type="text" name={field("rackName")} value={get("rackName")} onChange={handleChange} />
                    </div>

                    <div style={{ borderTop: "2px solid #888013ff", padding: "5px" }}>
                        <label style={{ color: "#888013ff", fontWeight: "bold" }}>{sourceTitle} Rack/Node Incoming Power Cable Size (Sq mm):</label>
                        <input type="number" name={field("rackIncomingCableSize")} value={get("rackIncomingCableSize")} onChange={handleChange} />
                        <label style={{ color: "#888013ff", fontWeight: "bold" }}>{sourceTitle} Rack/Node Incoming Power Cable Length (mtr):</label>
                        <input type="number" name={field("rackCableLength")} value={get("rackCableLength")} onChange={handleChange} />
                        <label style={{ color: "#888013ff", fontWeight: "bold" }}>{sourceTitle}DB - RackDB Cable Run (Nos):</label>
                        <input type="number" name={field("rackCableRun")} value={get("rackCableRun")} onChange={handleChange} />
                        <label style={{ color: "#888013ff", fontWeight: "bold" }}>{sourceTitle} DB MCB Number:</label>
                        <input type="text" name={field("dbMcbNumber")} value={get("dbMcbNumber")} onChange={handleChange} />
                        <label style={{ color: "#888013ff", fontWeight: "bold" }}>{sourceTitle}DB MCB Label:</label>
                        <select type="text" name={field("dbMcbLabel")} value={get("dbMcbLabel")} onChange={handleChange} >
                            <option value="">Select</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                        </select>
                        <label style={{ color: "#888013ff", fontWeight: "bold" }}>{sourceTitle} DB MCB Rating (Amps):</label>
                        <input type="number" name={field("dbMcbRating")} value={get("dbMcbRating")} onChange={handleChange} />
                        <label style={{ color: "#888013ff", fontWeight: "bold" }}>{sourceTitle} Temp On Mcb/Fuse (°C):</label>
                        <input type="text" name={field("tempOnMcb")} value={get("tempOnMcb")} onChange={handleChange} />
                        <label style={{ color: "#888013ff", fontWeight: "bold" }}>{sourceTitle} Running Load (Amps):</label>
                        <input type="number" name={field("runningLoad")} value={get("runningLoad")} onChange={handleChange} />
                    </div>

                    <div style={{ borderTop: "2px solid #fffffff3", padding: "5px" }}>
                        <label>{sourceTitle} Cable Load Capacity:</label>
                        <input type="number" name={field("cableCapacity")} value={get("cableCapacity")} onChange={handleChange} disabled />
                        <label>{sourceTitle} % Load on O/P Cable:</label>
                        <input type="number" name={field("pctLoadCable")} value={get("pctLoadCable")} onChange={handleChange} disabled />
                        <label>{sourceTitle}% Load on O/P MCB:</label>
                        <input type="number" name={field("pctLoadMcb")} value={get("pctLoadMcb")} onChange={handleChange} disabled />
                    </div>

                    <div style={{ borderTop: "2px solid #fffffff3", padding: "5px" }}>
                        <label style={{ color: "#888013ff", fontWeight: "bold" }}>{sourceTitle}Rack End Voltage (V):</label>
                        <input type="number" name={field("rackEndVoltage")} value={get("rackEndVoltage")} onChange={handleChange} />
                        <label>{sourceTitle} Rack End No of DB / Power Strip No.:</label>
                        <input type="number" name={field("rackEndNoDb")} value={get("rackEndNoDb")} onChange={handleChange} />
                        <label>{sourceTitle} Rack End DCDB / Power Strip Name:</label>
                        <input type="text" name={field("rackEndDcdbName")} value={get("rackEndDcdbName")} onChange={handleChange} />
                        <label>{sourceTitle} Rack End DB Running Load (Amps):</label>
                        <input type="number" name={field("rackEndRunningLoad")} value={get("rackEndRunningLoad")} onChange={handleChange} />
                        <label>{sourceTitle} Rack End DB MCB Rating (Amps):</label>
                        <input type="number" name={field("rackEndMcbRating")} value={get("rackEndMcbRating")} onChange={handleChange} />
                        <label>{sourceTitle} % Load on I/P MCB:</label>
                        <input type="number" name={field("rackEndPctLoadMcb")} value={get("rackEndPctLoadMcb")} onChange={handleChange} disabled />
                        <label>{sourceTitle} Remarks:</label>
                        <input type="text" name={field("remarks")} value={get("remarks")} onChange={handleChange} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SourceTab;