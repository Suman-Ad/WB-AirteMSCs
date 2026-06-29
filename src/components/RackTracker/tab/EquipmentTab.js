import React from "react";

const EquipmentTab = ({
    formData,
    handleChange,
    rackEquipments,
    setRackEquipments,
    recomputeUSpaceFromEquipments,
    computeCapacityAnalysis,
    setFormData,
    
}) => {
    return (
        <>
        <div className="form-section">
              <h2 style={{ borderBottom: "2px solid #2083a1ff", padding: "5px" }}><strong>Equipment Details</strong></h2>
              <div className="form-section">
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
                      <div style={{
                        border: "1px solid rgba(0, 0, 0, 0.37)",
                        borderRadius: "10px", marginBottom: "0.5rem",
                        alignItems: "center",
                        display: "flex",
                      }}>
                        {/* SL No */}
                        <div
                          style={{
                            fontWeight: "bold",
                            textAlign: "center",
                            padding: "6px 0",
                            background: "#4b7496d2",
                            height: "100px",
                            borderTopLeftRadius: "9px",
                            borderBottomLeftRadius: "9px",
                            alignContent: "center"
                          }}
                        >
                          {idx + 1}

                        </div>
                        <div>
                          <div
                            key={eq.id}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "2.5fr 1.5fr 1.5fr 1fr",
                              gap: "0.1rem",
                            }}
                          >
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

                          </div>

                          <div>
                            {/* Remarks */}
                            <textarea
                              style={{
                                border: "1px solid #e5e7eb",
                                borderRadius: "0.375rem",
                                paddingLeft: "0.5rem",
                                paddingRight: "0.5rem",
                                paddingTop: "0.25rem",
                                paddingBottom: "0.25rem",
                                resize: "none",
                              }}
                              placeholder="Enter equipment details"
                              value={eq.remarks}
                              onFocus={() => {
                                if (!eq.remarks) {
                                  const list = [...rackEquipments];
                                  list[idx] = {
                                    ...list[idx],
                                    remarks: "Make:- \nModel No:- \nSl. No:-"
                                  };
                                  setRackEquipments(list);
                                }
                              }}
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
                          </div>
                        </div>
                        <div>
                          {/* Delete Button */}
                          <p
                            type="button"
                            style={{ color: "#dc2626ff", fontSize: "0.875rem", width: "fit-content", cursor: "pointer", height: "100px", alignContent: "center", background: "rgba(224, 44, 44, 0.73)", borderTopRightRadius: "9px", borderBottomRightRadius: "9px" }}
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
              </div>
            </div>
        </>
    )
};

export default EquipmentTab;