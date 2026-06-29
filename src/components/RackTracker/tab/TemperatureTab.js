import React from "react";

const TemperatureTab = ({
    formData,
    handleChange,
    rackTemperatures,
    setRackTemperatures,
    recomputeUSpaceFromTemperatures,
    computeCapacityAnalysis,
    setFormData,
}) => {
    return (
        <>
            <div className="form-section">
                <h2 style={{ marginTop: "15px", borderBottom: "2px solid #2083a1ff", padding: "5px" }}>
                    <strong>Temperature Monitoring (Front / Back)</strong>
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
            </div>
        </>
    );
}

export default TemperatureTab;