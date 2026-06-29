import React from "react";

const CapacityAnalysisTab = ( { formData } ) => {
  return (
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
    );
};

export default CapacityAnalysisTab;