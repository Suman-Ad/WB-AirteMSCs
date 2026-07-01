import React from "react";

const RackTable = ({
    data,
    currentPage,
    rowsPerPage,
    getHeaderStyle,
    getMissingFields,
    onPreview,
}) => {

    return (
        <div className="table-container" style={{ maxHeight: "600px" }}>
            <table border="1" cellPadding="6" style={{ width: "100%", borderCollapse: "collapse" }}>

                {/* Paste THEAD */}

                <thead style={{ background: "#e8e8e8" }}>
                    <tr>
                        <th style={getHeaderStyle(`gen`)}>Sl. No</th>
                        <th style={getHeaderStyle(`gen`)}>Region</th>
                        <th style={getHeaderStyle(`gen`)}>Circle</th>
                        <th style={getHeaderStyle(`gen`)}>Site Name</th>
                        <th style={getHeaderStyle(`gen`)}>Equipment Location(Switch Room)</th>
                        <th style={{ ...getHeaderStyle(`gen`), position: "sticky", left: 0, zIndex: 5 }}>Rack No</th>
                        <th style={{ ...getHeaderStyle(`gen`), position: "sticky", left: 0, zIndex: 4 }}>Rack Name</th>
                        <th style={getHeaderStyle(`gen`)}>RFAI No.</th>
                        <th style={getHeaderStyle(`gen`)}>Rack On Date.</th>
                        <th style={getHeaderStyle(`gen`)}>Power Type</th>
                        <th style={getHeaderStyle(`gen`)}>Rack Type</th>
                        <th style={getHeaderStyle(`gen`)}>Rack Status</th>
                        <th style={getHeaderStyle(`gen`)}>Rack Switched Off Date</th>
                        <th style={getHeaderStyle(`gen`)}>Rack Size (HxWxD in mm)</th>
                        <th style={getHeaderStyle(`gen`)}>Rack Temperature (T-M-B)</th>
                        <th style={getHeaderStyle(`gen`)}>Rack Description</th>
                        <th style={getHeaderStyle(`gen`)}>Rack Domain Type</th>
                        <th style={getHeaderStyle(`gen`)}>Rack Owner Details</th>
                        <th style={getHeaderStyle(`DR Test`)}>DR Test Status</th>
                        <th style={getHeaderStyle(`DR Test`)}>DR Test Date</th>
                        <th style={getHeaderStyle(`(A)`)}>(A) SMPS/UPS Rating (Amps/kVA)</th>
                        <th style={getHeaderStyle(`(A)`)}>(A) SMPS/UPS Name</th>
                        <th style={getHeaderStyle(`(A)`)}>(A) Source DB Number</th>
                        <th style={getHeaderStyle(`(A)`)}>(A) DB Voltage (V)</th>
                        <th style={getHeaderStyle(`(A)`)}>(A) Incomer rating of DB (Amps):</th>
                        <th style={getHeaderStyle(`(A)`)}>(A) Incomer DB Cable Size (Sq mm)</th>
                        <th style={getHeaderStyle(`(A)`)}>(A) Cable Length (Mtr)</th>
                        <th style={getHeaderStyle(`(A)`)}>(A) Cable Runs (Nos)</th>
                        <th style={getHeaderStyle(`(A)`)}>(A) Equipment Rack No</th>
                        <th style={getHeaderStyle(`(A)`)} >(A) Rack Name/Equipment Name</th>
                        <th style={getHeaderStyle(`(A)`)}>(A) Rack/Node Incoming Power Cable Size (Sq mm)</th>
                        <th style={getHeaderStyle(`(A)`)}>(A) DB - RackDB Cable Length (Mtr)</th>
                        <th style={getHeaderStyle(`(A)`)}>(A) DB - RackDB Cable Run (Nos)</th>
                        <th style={getHeaderStyle(`(A)`)}>(A) Cable Tagging</th>
                        <th style={getHeaderStyle(`(A)`)}>(A) DB MCB Number</th>
                        <th style={getHeaderStyle(`(A)`)}>(A) Rack End Voltage (V)</th>
                        <th style={getHeaderStyle(`(A)`)}>(A) DB MCB Rating (Amps)</th>
                        <th style={getHeaderStyle(`(A)`)}>(A) Temp On Mcb/Fuse (°C)</th>
                        <th style={getHeaderStyle(`(A)`)}>(A) MCB Label</th>
                        <th style={getHeaderStyle(`(A)`)}>(A) Source Running Load (Amps):</th>
                        <th style={getHeaderStyle(`Cable Load Capacity`)}>(A) Cable Load Capacity</th>
                        <th style={getHeaderStyle(`%`)}>(A) % Load Cable</th>
                        <th style={getHeaderStyle(`%`)}>(A) % PCT Load MCB (Amps)</th>
                        <th style={getHeaderStyle(`Rack End`)}>(A) Rack End No of DB / Power Strip (nos.)</th>
                        <th style={getHeaderStyle(`Rack End`)}>(A) Rack End DCDB / Power Strip Name</th>
                        <th style={getHeaderStyle(`Rack End`)}>(A) Rack End DB Running Load (Amps)</th>
                        <th style={getHeaderStyle(`Rack End`)}>(A) Rack End DB MCB Rating (Amps)</th>
                        <th style={getHeaderStyle(`%`)}>(A) Rack End % Load MCB</th>
                        <th style={getHeaderStyle(`(A)`)}>(A) Remarks</th>
                        <th style={getHeaderStyle(`(B)`)}>(B) SMPS/UPS Rating (Amps/kVA)</th>
                        <th style={getHeaderStyle(`(B)`)}>(B) SMPS/UPS Name</th>
                        <th style={getHeaderStyle(`(B)`)}>(B) DB Number</th>
                        <th style={getHeaderStyle(`(B)`)}>(B) DB Voltage (V)</th>
                        <th style={getHeaderStyle(`(B)`)}>(B) Incomer DB Rating (Amps):</th>
                        <th style={getHeaderStyle(`(B)`)}>(B) Incomer DB Cable Size (Sq mm)</th>
                        <th style={getHeaderStyle(`(B)`)}>(B) Cable Length (Mtr)</th>
                        <th style={getHeaderStyle(`(B)`)}>(B) Cable Runs (Nos)</th>
                        <th style={getHeaderStyle(`(B)`)}>(B) Equipment Rack No</th>
                        <th style={getHeaderStyle(`(B)`)}>(B) Rack Name A</th>
                        <th style={getHeaderStyle(`(B)`)}>(B) Rack/Node Incoming Power Cable Size (Sq mm)</th>
                        <th style={getHeaderStyle(`(B)`)}>(B) DB - RackDB Cable Length (Mtr)</th>
                        <th style={getHeaderStyle(`(B)`)}>(B) DB - RackDB Cable Run (Nos)</th>
                        <th style={getHeaderStyle(`(B)`)}>(B) Cable Tagging</th>
                        <th style={getHeaderStyle(`(B)`)}>(B) DB MCB Number</th>
                        <th style={getHeaderStyle(`(B)`)}>(B) Rack End Voltage (V)</th>
                        <th style={getHeaderStyle(`(B)`)}>(B) DB MCB Rating (Amps)</th>
                        <th style={getHeaderStyle(`(B)`)}>(B) Temp On Mcb/Fuse (°C)</th>
                        <th style={getHeaderStyle(`(B)`)}>(B) MCB Label</th>
                        <th style={getHeaderStyle(`(B)`)}>(B) Running Load (Amps):</th>
                        <th style={getHeaderStyle(`Cable Load Capacity`)}>(B) Cable Load Capacity</th>
                        <th style={getHeaderStyle(`%`)}>(B) % Load Cable</th>
                        <th style={getHeaderStyle(`%`)}>(B) % PCT Load MCB (Amps)</th>
                        <th style={getHeaderStyle(`Rack End`)}>(B) Rack End No of DB / Power Strip (nos.)</th>
                        <th style={getHeaderStyle(`Rack End`)}>(B) Rack End DCDB / Power Strip Name</th>
                        <th style={getHeaderStyle(`Rack End`)}>(B) Rack End DB Running Load (Amps)</th>
                        <th style={getHeaderStyle(`Rack End`)}>(B) Rack End DB MCB Rating (Amps)</th>
                        <th style={getHeaderStyle(`%`)}>(B) Rack End % Load MCB</th>
                        <th style={getHeaderStyle(`(B)`)}>(B) Remarks</th>
                        <th style={getHeaderStyle(`Total`)}>Total Load Both Sources: A & B</th>
                        <th style={getHeaderStyle(`Total`)}>Both Cable Capacity</th>
                        <th style={getHeaderStyle(`Total`)}>% Load on Cable</th>
                        <th style={getHeaderStyle(`Total`)}>% Load on MCB</th>
                        <th style={getHeaderStyle(`Total`)}>Both MCB Same</th>
                        <th style={getHeaderStyle(`Total`)}>Source Type</th>
                        <th style={getHeaderStyle(`Total`)}>Uploaded By</th>
                        <th
                            style={{ ...getHeaderStyle(`missing`), position: "sticky", right: 0, zIndex: 5, whiteSpace: "nowrap", width: "200px" }}
                        >
                            Missing Fields
                        </th>
                    </tr>
                </thead>

                {/* Paste TBODY */}

                <tbody>
                    {data.length === 0 && (
                        <tr>
                            <td colSpan="9" style={{ textAlign: "center" }}>
                                No data found
                            </td>
                        </tr>
                    )}

                    {data.map((item, index) => (
                        <tr
                            key={item.id}
                            onClick={() => {
                                onPreview(item);

                            }
                            }
                            style={{ cursor: "pointer", transition: "background 0.2s" }}
                        // onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f6")}
                        // onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >

                            <td>
                                {(currentPage - 1) * rowsPerPage + index + 1}
                            </td>
                            <td>{item.region}</td>
                            <td>{item.circle}</td>
                            <td>{item.siteName}</td>
                            <td>{item.equipmentLocation}</td>
                            <td className="sticky-col" style={{ position: "sticky", left: 0, zIndex: 3 }}>{item.equipmentRackNo}</td>
                            <td className="sticky-col">{item.rackName}</td>
                            <td>{item.rfaiNo ? item.rfaiNo : "---"}</td>
                            <td>{item.rackPowerOnDate ? item.rackPowerOnDate : "---"}</td>
                            <td>{item.powerType}</td>
                            <td>{item.rackType}</td>
                            <td>{item.rackStatus}</td>
                            <td>{item.switchedOffDate}</td>
                            <td>{item.rackSize}</td>
                            <td style={{ display: "flex", flex: "1" }}>
                                <p>FT:{item.frontTopTemp}°C FM:{item.frontMiddleTemp}°C FB:{item.frontBottomTemp}°C</p>
                                <p>BT:{item.backTopTemp}°C BM:{item.backMiddleTemp}°C BB:{item.backBottomTemp}°C</p>
                            </td>
                            <td>{item.rackDescription}</td>
                            <td>{item.rackDomainType}</td>
                            <td>{item.rackOwnerName}</td>
                            <td>{item.drTestStatus}</td>
                            <td>{item.drTestDate}</td>

                            {/* A Source */}
                            <td>{item.smpsRatingA}</td>
                            <td>{item.smpsNameA}</td>
                            <td>{item.dbNumberA}</td>
                            <td>{item.dbVoltageA}</td>
                            <td>{item.incomerRatingA}</td>
                            <td>{item.cableSizeA}</td>
                            <td>{item.cableLengthA}</td>
                            <td>{item.cableRunA}</td>
                            <td>{item.equipmentRackNoA}</td>
                            <td>{item.rackNameA}</td>
                            <td>{item.rackIncomingCableSizeA}</td>
                            <td>{item.rackCableLengthA}</td>
                            <td>{item.rackCableRunA}</td>
                            <td>{item.cableTaggingA}</td>
                            <td>{item.dbMcbNumberA}</td>
                            <td>{item.rackEndVoltageA}</td>
                            <td>{item.dbMcbRatingA}</td>
                            <td>{item.tempOnMcbA}</td>
                            <td>{item.dbMcbLabelA}</td>
                            <td>{item.runningLoadA}</td>
                            <td>{item.cableCapacityA}</td>
                            <td>{item.pctLoadCableA}</td>
                            <td>{item.pctLoadMcbA}</td>
                            <td>{item.rackEndNoDbA}</td>
                            <td>{item.rackEndDcdbNameA}</td>
                            <td>{item.rackEndRunningLoadA}</td>
                            <td>{item.rackEndMcbRatingA}</td>
                            <td>{item.rackEndPctLoadMcbA}</td>
                            <td>{item.remarksA}</td>

                            {/* B Source */}
                            <td>{item.smpsRatingB}</td>
                            <td>{item.smpsNameB}</td>
                            <td>{item.dbNumberB}</td>
                            <td>{item.dbVoltageB}</td>
                            <td>{item.incomerRatingB}</td>
                            <td>{item.cableSizeB}</td>
                            <td>{item.cableLengthB}</td>
                            <td>{item.cableRunB}</td>
                            <td>{item.equipmentRackNoB}</td>
                            <td>{item.rackNameB}</td>
                            <td>{item.rackIncomingCableSizeB}</td>
                            <td>{item.rackCableLengthB}</td>
                            <td>{item.rackCableRunB}</td>
                            <td>{item.cableTaggingB}</td>
                            <td>{item.dbMcbNumberB}</td>
                            <td>{item.rackEndVoltageB}</td>
                            <td>{item.dbMcbRatingB}</td>
                            <td>{item.tempOnMcbB}</td>
                            <td>{item.dbMcbLabelB}</td>
                            <td>{item.runningLoadB}</td>
                            <td>{item.cableCapacityB}</td>
                            <td>{item.pctLoadCableB}</td>
                            <td>{item.pctLoadMcbB}</td>
                            <td>{item.rackEndNoDbB}</td>
                            <td>{item.rackEndDcdbNameB}</td>
                            <td>{item.rackEndRunningLoadB}</td>
                            <td>{item.rackEndMcbRatingB}</td>
                            <td>{item.rackEndPctLoadMcbB}</td>
                            <td>{item.remarksB}</td>
                            <td>{Number(item.totalLoadBoth || 0).toFixed(2)}</td>
                            <td>{item.bothCableCapacity}</td>
                            <td>{item.bothPctLoadCable}</td>
                            <td>{item.bothPctLoadMcb}</td>
                            <td>{item.isBothMcbSame}</td>
                            <td>{item.sourceType}</td>
                            <td
                                style={{ fontSize: "11px" }}
                            >
                                {item.updatedBy.name}<br />
                                {item.updatedBy.empId}<br />
                                {item.updatedAt}
                            </td>
                            <td
                                className="sticky-col"
                                style={{
                                    position: "sticky",
                                    right: 0,
                                    zIndex: 3,
                                    fontSize: "11px",
                                    color:
                                        getMissingFields(item).length > 0 ? "#ef4444" : "#10b981",
                                    fontWeight: "bold",
                                }}
                            >
                                <div style={{ overflowY: "auto", maxHeight: "100px" }}>
                                    {getMissingFields(item).length > 0 ? (
                                        <>
                                            <div style={{ marginBottom: "5px", fontWeight: "bold" }}>
                                                Total Missing: {getMissingFields(item).length}
                                            </div>

                                            {getMissingFields(item).map((field, index) => (
                                                <div key={index}>
                                                    {index + 1}. {field}
                                                </div>
                                            ))}
                                        </>
                                    ) : (
                                        <span style={{ color: "#10b981" }}>✓ Complete</span>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>


            </table>
        </div>
    );
};

export default RackTable;