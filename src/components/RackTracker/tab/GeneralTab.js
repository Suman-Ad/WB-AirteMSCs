import React from "react";

const GeneralTab = ({
    formData,
    handleChange,
    editData,
    siteConfig,
    userRole,
    floorList,
    rackType,
    powerType,
    rackStatus
}) => {
    return (
        <>
            <div className="form-section">
                <h2 style={{ borderBottom: "2px solid #2083a1ff", padding: "5px" }}><strong>General Information</strong></h2>
                {/* General Info */}
                <div className="form-section">
                    <label>Site Name:</label>
                    <input type="text" name="siteName" value={formData.siteName} onChange={handleChange} disabled />
                </div>
                <div className="form-section">
                    <label>Equipment Switch Room Location:</label>
                    <select name="equipmentLocation" onChange={handleChange} disabled={!!editData}>

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
                    <input type="text" name="rfaiNo" value={formData.rfaiNo} onChange={handleChange} />
                    <label>Rack Power On Date:</label>
                    <input type="date" name="rackPowerOnDate" value={formData.rackPowerOnDate} onChange={handleChange} />
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
                                <option value="">Select Power Type</option>
                                {powerType.map((q) => (
                                    <option key={q} value={q}>{q}</option>
                                ))}
                            </>
                        )}
                    </select>

                    <label>Rack Status:</label>
                    <select
                        name="rackStatus"
                        value={formData.rackStatus}
                        onChange={handleChange}
                    >
                        <option value="">Select Rack Status</option>
                        {rackStatus.map((q) => (
                            <option key={q} value={q}>{q}</option>
                        ))}
                    </select>

                    {formData.rackStatus === "Switched-OFF" && (
                        <div className="form-section">
                            <label>Switched-OFF Date:</label>
                            <input type="date" name="switchedOffDate" value={formData.switchedOffDate} onChange={handleChange} />
                        </div>
                    )}
                </div>
                <label>Rack Description:</label>
                <textarea type="text" name="rackDescription" value={formData.rackDescription} onChange={handleChange} />

            </div>
        </>
    );
};

export default GeneralTab;