import React from "react";

const DomainDRTab = ({ formData, handleChange }) => {
  return (
    <div>
        <div className="form-section">
            <div className="form-section">
              <h2 style={{ marginTop: "15px", borderBottom: "2px solid #2083a1ff", padding: "5px" }}>
                <strong>Rack Domain</strong>
              </h2>
              <label>Rack Domain Type:</label>
              <select
                name="rackDomainType"
                value={formData.rackDomainType}
                onChange={handleChange}
              >
                <option value="">Select Domain Type</option>
                <option value="TNG">TNG</option>
                <option value="Core">Core</option>
                <option value="Others">Others</option>
              </select>
              <label>Rack Owner Details (Name-Ph.):</label>
              <input type="text" name="rackOwnerName" value={formData.rackOwnerName} onChange={handleChange} />
            </div>

            <div>
              <h2 style={{ marginTop: "15px", borderBottom: "2px solid #2083a1ff", padding: "5px" }}>
                <strong>DR Test</strong>
              </h2>
              <label>DR Test Status:</label>
              <select
                name="drTestStatus"
                value={formData.drTestStatus}
                onChange={handleChange}
              >
                <option value="">Select Status</option>
                <option value="Pending">Pending</option>
                <option value="Completed">Completed</option>
                <option value="Failed">Failed</option>
              </select>
              <label>DR Test Date:</label>
              <input type="date" name="drTestDate" value={formData.drTestDate} onChange={handleChange} />
            </div>
          </div>
        </div>
  );
};

export default DomainDRTab;