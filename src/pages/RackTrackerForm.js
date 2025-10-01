// src/pages/EquipmentAudit.js
import React, { useState } from "react";

const EquipmentAudit = () => {
  const [formData, setFormData] = useState({
    circle: "",
    siteName: "",
    location: "",
    // Source A
    smpsRatingA: "",
    smpsNameA: "",
    dbNumberA: "",
    incomerRatingA: "",
    cableSizeA: "",
    cableRunA: "",
    runningLoadA: "",
    // Source B
    smpsRatingB: "",
    smpsNameB: "",
    dbNumberB: "",
    incomerRatingB: "",
    cableSizeB: "",
    cableRunB: "",
    runningLoadB: "",
    // Analysis
    remarks: ""
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Submitted Data:", formData);
    // TODO: Save to DB (Firebase/Postgres API)
  };

  return (
    <div className="daily-log-container">
      <h1 className="text-xl font-bold mb-4">
        WB-Airtel MSCS – UPS/SMPS Equipment Audit
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* General Details */}
        <div className="border p-4 rounded-lg shadow">
          <h2 className="font-semibold mb-2">General Details</h2>
          <div className="grid grid-cols-3 gap-4">
            <input
              name="circle"
              placeholder="Circle"
              value={formData.circle}
              onChange={handleChange}
              className="border p-2 rounded"
            />
            <input
              name="siteName"
              placeholder="Site Name"
              value={formData.siteName}
              onChange={handleChange}
              className="border p-2 rounded"
            />
            <input
              name="location"
              placeholder="Equipment Location"
              value={formData.location}
              onChange={handleChange}
              className="border p-2 rounded"
            />
          </div>
        </div>

        {/* Source A */}
        <div className="border p-4 rounded-lg shadow">
          <h2 className="font-semibold mb-2">Source – A</h2>
          <div className="grid grid-cols-3 gap-4">
            <input
              name="smpsRatingA"
              placeholder="SMPS Rating (A)"
              value={formData.smpsRatingA}
              onChange={handleChange}
              className="border p-2 rounded"
            />
            <input
              name="smpsNameA"
              placeholder="SMPS Name"
              value={formData.smpsNameA}
              onChange={handleChange}
              className="border p-2 rounded"
            />
            <input
              name="dbNumberA"
              placeholder="DB Number"
              value={formData.dbNumberA}
              onChange={handleChange}
              className="border p-2 rounded"
            />
            <input
              name="incomerRatingA"
              placeholder="Incomer Rating (Amps)"
              value={formData.incomerRatingA}
              onChange={handleChange}
              className="border p-2 rounded"
            />
            <input
              name="cableSizeA"
              placeholder="DB Cable Size (Sq mm)"
              value={formData.cableSizeA}
              onChange={handleChange}
              className="border p-2 rounded"
            />
            <input
              name="runningLoadA"
              placeholder="Running Load (A)"
              value={formData.runningLoadA}
              onChange={handleChange}
              className="border p-2 rounded"
            />
          </div>
        </div>

        {/* Source B */}
        <div className="border p-4 rounded-lg shadow">
          <h2 className="font-semibold mb-2">Source – B</h2>
          <div className="grid grid-cols-3 gap-4">
            <input
              name="smpsRatingB"
              placeholder="SMPS Rating (A)"
              value={formData.smpsRatingB}
              onChange={handleChange}
              className="border p-2 rounded"
            />
            <input
              name="smpsNameB"
              placeholder="SMPS Name"
              value={formData.smpsNameB}
              onChange={handleChange}
              className="border p-2 rounded"
            />
            <input
              name="dbNumberB"
              placeholder="DB Number"
              value={formData.dbNumberB}
              onChange={handleChange}
              className="border p-2 rounded"
            />
            <input
              name="incomerRatingB"
              placeholder="Incomer Rating (Amps)"
              value={formData.incomerRatingB}
              onChange={handleChange}
              className="border p-2 rounded"
            />
            <input
              name="cableSizeB"
              placeholder="DB Cable Size (Sq mm)"
              value={formData.cableSizeB}
              onChange={handleChange}
              className="border p-2 rounded"
            />
            <input
              name="runningLoadB"
              placeholder="Running Load (A)"
              value={formData.runningLoadB}
              onChange={handleChange}
              className="border p-2 rounded"
            />
          </div>
        </div>

        {/* Analysis */}
        <div className="border p-4 rounded-lg shadow">
          <h2 className="font-semibold mb-2">Capacity Gap Analysis</h2>
          <textarea
            name="remarks"
            placeholder="Remarks / Observations"
            value={formData.remarks}
            onChange={handleChange}
            className="border p-2 rounded w-full"
          />
        </div>

        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded shadow"
        >
          Save Data
        </button>
      </form>
    </div>
  );
};

export default EquipmentAudit;
