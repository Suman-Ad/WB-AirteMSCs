// src/pages/AcDcRackDashboard.js
import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
    collection,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";


const AcDcRackDashboard = ({ userData }) => {
    const [rackData, setRackData] = useState([]);
    // 🔹 Filter popup states
    const [showFilterPopup, setShowFilterPopup] = useState(false);
    const [siteFilter, setSiteFilter] = useState("");
    const [locationFilter, setLocationFilter] = useState("");
    const [equipNoFilter, setEquipNoFilter] = useState("");
    const [rackNameFilter, setRackNameFilter] = useState("");
    const [powerTypeFilter, setPowerTypeFilter] = useState("");
    const [sourceTypeFilter, setSourceTypeFilter] = useState("");
    const [rackType, setRackType] = useState("");

    const [status, setStatus] = useState("");
    const navigate = useNavigate();
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [equipPopupOpen, setEquipPopupOpen] = useState(false);
    const [equipPopupData, setEquipPopupData] = useState(null);


    // 🔹 Fetch site data based on user role
    useEffect(() => {
        const fetchData = async () => {
            try {
                let allRacks = [];

                // ✅ Super Admin / Admin can see ALL sites
                if (userData?.role === "Admin" || userData?.role === "Super Admin" || userData?.designation === "Vertiv CIH" || userData?.designation === "Vertiv ZM") {
                    const sitesSnapshot = await getDocs(collection(db, "acDcRackDetails"));

                    for (const siteDoc of sitesSnapshot.docs) {
                        const siteKey = String(siteDoc.id);
                        const racksRef = collection(db, "acDcRackDetails", siteKey, "racks");
                        const racksSnapshot = await getDocs(racksRef);

                        racksSnapshot.forEach((rackDoc) => {
                            allRacks.push({
                                id: rackDoc.id,
                                siteKey,
                                ...rackDoc.data(),
                            });
                        });
                    }
                }

                // ✅ Normal user — only see their own site
                else if (userData?.site) {
                    const siteKey = userData.site.trim().toUpperCase().replace(/[\/\s]+/g, "_");
                    const racksRef = collection(db, "acDcRackDetails", siteKey, "racks");
                    const racksSnapshot = await getDocs(racksRef);

                    racksSnapshot.forEach((rackDoc) => {
                        allRacks.push({
                            id: rackDoc.id,
                            siteKey,
                            ...rackDoc.data(),
                        });
                    });
                } else {
                    console.warn("⚠️ No site assigned to this user");
                }

                setRackData(allRacks);
                console.log(`✅ Loaded ${allRacks.length} rack records`);
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };

        fetchData();
    }, [userData]);


    // 🔹 Handle delete
    const handleDelete = async (siteName) => {
        if (!window.confirm(`Delete record for ${siteName}?`)) return;
        try {
            await deleteDoc(doc(db, "acDcRackDetails", userData?.site?.toUpperCase(), "racks", siteName));
            setRackData((prev) => prev.filter((d) => d.id !== siteName));
            setStatus(`🗑️ Deleted record for ${siteName}`);
            setPreviewOpen(false);
        } catch (error) {
            console.error("Error deleting:", error);
            setStatus("❌ Failed to delete record");
        }
    };

    // 🔹 Prepare Chart Data (by Equipment Location)
    const chartDataMap = {};

    // 🔹 Advanced Filter Logic
    // 🔹 Multi-field filter logic
    const filteredData = rackData.filter((d) => {
        const isPrivileged =
            userData?.role === "Admin" ||
            userData?.role === "Super Admin" ||
            userData?.designation === "Vertiv CIH" ||
            userData?.designation === "Vertiv ZM";

        // Basic matches for each field
        const siteMatch = siteFilter
            ? d.siteName?.toLowerCase().includes(siteFilter.toLowerCase())
            : true;
        const locationMatch = locationFilter
            ? d.equipmentLocation?.toLowerCase().includes(locationFilter.toLowerCase())
            : true;
        const equipMatch = equipNoFilter
            ? d.equipmentRackNo?.toLowerCase().includes(equipNoFilter.toLowerCase())
            : true;
        const rackMatch = rackNameFilter
            ? d.rackName?.toLowerCase().includes(rackNameFilter.toLowerCase())
            : true;

        const powerMatch = powerTypeFilter
            ? d.powerType?.toLowerCase().includes(powerTypeFilter.toLowerCase())
            : true;

        const sourceMatch = sourceTypeFilter
            ? d.sourceType?.toLowerCase().includes(sourceTypeFilter.toLowerCase())
            : true;

        const typeMatch = rackType
            ? d.rackType?.toLowerCase().includes(rackType.toLowerCase())
            : true;

        const matchesAll = siteMatch && locationMatch && equipMatch && rackMatch && powerMatch && sourceMatch && typeMatch;

        const location = d.equipmentLocation || "Unknown";

        if (!chartDataMap[location]) {
            chartDataMap[location] = {
                equipmentLocation: location,
                totalLoad: 0,
                rackCount: 0,
            };
        }

        // Convert totalLoadBoth to number safely
        const loadValue = parseFloat(d.totalLoadBoth) || 0;

        chartDataMap[location].totalLoad += loadValue;
        chartDataMap[location].rackCount += 1;

        // Apply role-based restriction
        if (isPrivileged) {
            return matchesAll;
        } else {
            return (
                d.siteName?.toLowerCase() === userData?.site?.toLowerCase() &&
                matchesAll
            );
        }


    });

    // Convert map to array for Recharts
    const chartData = Object.values(chartDataMap);


    // 🔹 Download Excel
    const handleDownloadExcel = () => {
        if (filteredData.length === 0) {
            alert("No data to export!");
            return;
        }

        // Map Firestore data to a flat table
        const exportData = filteredData.map((item) => ({
            "Sl. No": filteredData.indexOf(item) + 1,
            "Circle": item.circle,
            "Site Name": item.siteName,
            "Equipment Location": item.equipmentLocation,
            "SMPS Rating A (Amps)": item.smpsRatingA,
            "SMPS Name A": item.smpsNameA,
            "DB Number A": item.dbNumberA,
            "Incomer Rating A (Amps)": item.incomerRatingA,
            "Incomer DB Cable Size A (Sq mm)": item.cableSizeA,
            "Cable Runs A (Nos)": item.cableRunA,
            "Equipment Rack No A": item.equipmentRackNoA,
            "Rack Name A": item.rackNameA,
            "Rack Incoming Power Cable Size A (Sq mm)": item.rackIncomingCableSizeA,
            "Rack Cable Run A (Nos)": item.rackCableRunA,
            "DB MCB Number A": item.dbMcbNumberA,
            "DB MCB Rating A (Amps)": item.dbMcbRatingA,
            "Temp On Mcb/Fuse A (°C)": item.tempOnMcbA,
            "Source Running Load A (Amps)": item.runningLoadA,
            "Cable Load Capacity A": item.cableCapacityA,
            "% Load Cable A": item.pctLoadCableA,
            "% PCT Load MCB A (Amps)": item.pctLoadMcbA,
            "Rack End No of DB / Power Strip A (nos.)": item.rackEndNoDbA,
            "Rack End DCDB / Power Strip Name A": item.rackEndDcdbNameA,
            "Rack End DB Running Load A (Amps)": item.rackEndRunningLoadA,
            "Rack End DB MCB Rating A (Amps)": item.rackEndMcbRatingA,
            "Rack End % Load MCB A": item.rackEndPctLoadMcbA,
            "Remarks A": item.remarksA,
            "SMPS Rating B (Amps)": item.smpsRatingB,
            "SMPS Name B": item.smpsNameB,
            "DB Number B": item.dbNumberB,
            "Incomer Rating B (Amps)": item.incomerRatingB,
            "Incomer DB Cable Size B (Sq mm)": item.cableSizeB,
            "Cable Runs B (Nos)": item.cableRunB,
            "Equipment Rack No B": item.equipmentRackNoB,
            "Rack Name B": item.rackNameB,
            "Rack Incoming Power Cable Size B (Sq mm)": item.rackIncomingCableSizeB,
            "Rack Cable Run B (Nos)": item.rackCableRunB,
            "DB MCB Number B": item.dbMcbNumberB,
            "DB MCB Rating B (Amps)": item.dbMcbRatingB,
            "Temp On Mcb/Fuse B (°C)": item.tempOnMcbB,
            "Running Load B (Amps)": item.runningLoadB,
            "Cable Load Capacity B": item.cableCapacityB,
            "% Load Cable B": item.pctLoadCableB,
            "% PCT Load MCB B (Amps)": item.pctLoadMcbB,
            "Rack End No of DB / Power Strip B (nos.)": item.rackEndNoDbB,
            "Rack End DCDB / Power Strip Name B": item.rackEndDcdbNameB,
            "Rack End DB Running Load B (Amps)": item.rackEndRunningLoadB,
            "Rack End DB MCB Rating B (Amps)": item.rackEndMcbRatingB,
            "Rack End % Load MCB B": item.rackEndPctLoadMcbB,
            "Remarks B": item.remarksB,
            "Total Load Both Sources": item.totalLoadBoth,
            "Both Cable Capacity": item.bothCableCapacity,
            "% Load on Cable": item.bothPctLoadCable,
            "% Load on MCB": item.bothPctLoadMcb,
            "Both MCB Same": item.bothMcbSame,
            "Last Updated": item.updatedAt,
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Rack Data");

        const wbout = XLSX.write(wb, { type: "array", bookType: "xlsx" });
        const blob = new Blob([wbout], { type: "application/octet-stream" });
        saveAs(blob, `ACDC_RackData_${new Date().toISOString().split("T")[0]}.xlsx`);
        // XLSX.writeFile(wb, `ACDC_RackData_${new Date().toISOString().split("T")[0]}.xlsx`);

    };

    const getHeaderStyle = (header) => {
        if (header.startsWith("(A)")) return { backgroundColor: "#F2DCDB", color: "#020202ff" };
        if (header.startsWith("(B)")) return { backgroundColor: "#C5D9F1", color: "#000" };
        if (header.includes("Cable Load Capacity") || header.startsWith("%")) return { backgroundColor: "#FFD700", color: "#000" };
        if (header.includes("Rack End")) return { backgroundColor: "#FFC000", color: "#000" };
        if (header.includes("Total")) return { backgroundColor: "#C4D79B", color: "#000" };
        if (header.includes("gen")) return { backgroundColor: "#F2F2F2", color: "#000" };
        // if (header.startsWith("%") || header === "PUE" || header === "Site Running kW") return { backgroundColor: "#F57C00", color: "#fff" };
        return { backgroundColor: "#FFFFFF", color: "#000" };
    };

    const preview = (index) => {
        const record = filteredData[index];
        setPreviewData(record);
        setPreviewOpen(true);
    };



    const getTotalRackU = (rack) => {
        const total = Number(rack.totalRackUSpace);
        return total > 0 ? total : 42;   // default 42U
    };

    const getRackDimensions = (rack) => {
        return {
            H: rack?.rackDimensions?.height || 0,
            W: rack?.rackDimensions?.width || 0,
            D: rack?.rackDimensions?.depth || 0,
        };
    };

    return (
        <div className="daily-log-container">
            <h1 style={{ color: "white", textAlign: "center", paddingBottom: "20px" }}>
                <strong>🗄️AC/DC Rack Dashboard</strong>
            </h1>


            {/* 🔹 Summary Chart Section */}
            <div
                style={{
                    background: "#1e293b",
                    padding: "15px",
                    borderRadius: "10px",
                    marginBottom: "25px",
                    color: "white",
                }}
            >
                <h2 style={{ textAlign: "center", marginBottom: "10px" }}>📊 Rack/Load Summary</h2>

                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart
                            data={chartData}
                            margin={{ top: 10, right: 20, left: 0, bottom: 30 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="equipmentLocation" angle={-25} textAnchor="end" interval={0} height={60} />
                            <YAxis />
                            <Tooltip
                                contentStyle={{ backgroundColor: "#1f6dbbff", borderRadius: "6px" }}
                                formatter={(value, name) =>
                                    name === "Total Running Load (A)"
                                        ? [`${value.toFixed(2)} A`, "Total Load (Amps)"]
                                        : [value, "Rack Count"]
                                }
                            />
                            <Legend />
                            <Bar dataKey="totalLoad" fill="#22c55e" name="Total Running Load (A)" />
                            <Bar dataKey="rackCount" fill="#3b82f6" name="Rack Count" />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <p style={{ textAlign: "center", color: "#cbd5e1" }}>
                        No data available for chart
                    </p>
                )}
            </div>


            <div style={{ marginBottom: "10px" }}>
                <button
                    className="segr-manage-btn"
                    onClick={() => navigate('/rack-details-form')}
                >
                    🗄️...✏️
                </button>
                <button className="download-btn" onClick={handleDownloadExcel}>📥 Download Excel</button>

                <button
                    style={{
                        backgroundColor: "#2563eb",
                        color: "white",
                        padding: "8px 18px",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontWeight: "bold",
                    }}
                    onClick={() => setShowFilterPopup(true)}
                >
                    🔍 Filter
                </button>
            </div>

            {/* 🔹 Filter Popup Modal */}
            {showFilterPopup && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        background: "rgba(0,0,0,0.6)",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        zIndex: 999,
                    }}
                >
                    <div
                        className="chart-container"
                        style={{
                            padding: "25px",
                            borderRadius: "10px",
                            width: "90%",
                            maxWidth: "450px",
                            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                        }}
                    >
                        <h2 style={{ textAlign: "center", marginBottom: "20px" }}>🔍 Filter Rack Data</h2>

                        {/* Input Fields */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            {(userData?.role === "Admin" ||
                                userData?.role === "Super Admin" ||
                                userData?.designation === "Vertiv CIH" ||
                                userData?.designation === "Vertiv ZM") && (
                                    <input
                                        type="text"
                                        placeholder="🏢 Site Name"
                                        value={siteFilter}
                                        onChange={(e) => setSiteFilter(e.target.value)}
                                        style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
                                    />
                                )}

                            <input
                                type="text"
                                placeholder="📍 Equipment Location"
                                value={locationFilter}
                                onChange={(e) => setLocationFilter(e.target.value)}
                                style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
                            />

                            <input
                                type="text"
                                placeholder="🔢 Equipment No"
                                value={equipNoFilter}
                                onChange={(e) => setEquipNoFilter(e.target.value)}
                                style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
                            />

                            <input
                                type="text"
                                placeholder="🗄️ Rack Name (optional)"
                                value={rackNameFilter}
                                onChange={(e) => setRackNameFilter(e.target.value)}
                                style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
                            />

                            <select
                                type="text"
                                placeholder="⚡ Power Type"
                                value={rackType}
                                onChange={(e) => setRackType(e.target.value)}
                                style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
                            >
                                <option value="">⇨⚡ Select Rack Type</option>
                                <option value="Active">Active</option>
                                <option value="Passive">Passive</option>
                            </select>

                            <select
                                type="text"
                                placeholder="⚡ Power Type"
                                value={powerTypeFilter}
                                onChange={(e) => setPowerTypeFilter(e.target.value)}
                                style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
                            >
                                <option value="">⇨⚡ Select Power Type</option>
                                <option value="AC">AC</option>
                                <option value="DC">DC</option>
                            </select>

                            <select
                                type="text"
                                placeholder="⇨○ Source Type"
                                value={sourceTypeFilter}
                                onChange={(e) => setSourceTypeFilter(e.target.value)}
                                style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
                            >
                                <option value="">⇨○ Select Source Type</option>
                                <option value="Dual Source">Dual Source</option>
                                <option value="Single Source">Single Source</option>
                            </select>
                        </div>

                        {/* Buttons */}
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                marginTop: "20px",
                            }}
                        >
                            <button
                                onClick={() => setShowFilterPopup(false)}
                                style={{
                                    padding: "8px 15px",
                                    background: "#9ca3af",
                                    border: "none",
                                    borderRadius: "6px",
                                    color: "white",
                                    cursor: "pointer",
                                }}
                            >
                                ❌ Close
                            </button>

                            <button
                                onClick={() => {
                                    setSiteFilter("");
                                    setLocationFilter("");
                                    setEquipNoFilter("");
                                    setRackNameFilter("");
                                    setPowerTypeFilter("");
                                    setSourceTypeFilter("");
                                    setRackType("");
                                }}
                                style={{
                                    padding: "8px 15px",
                                    background: "#f59e0b",
                                    border: "none",
                                    borderRadius: "6px",
                                    color: "white",
                                    cursor: "pointer",
                                }}
                            >
                                🔄 Clear
                            </button>

                            <button
                                onClick={() => setShowFilterPopup(false)}
                                style={{
                                    padding: "8px 15px",
                                    background: "#10b981",
                                    border: "none",
                                    borderRadius: "6px",
                                    color: "white",
                                    cursor: "pointer",
                                }}
                            >
                                ✅ Apply
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ display: "flex", marginBottom: "10px", fontWeight: "bold", fontSize: "12px", color: "#333" }}>
                <div style={{ justifyContent: "left" }}>🔢 <strong>Total Racks:</strong> {filteredData.length}nos.</div>
                <div style={{ marginLeft: "auto" }}>
                    ⚡ <strong>Total Running Load:</strong>{" "}
                    {filteredData.reduce((sum, d) => sum + (parseFloat(d.totalLoadBoth) || 0), 0).toFixed(2)} A
                </div>
            </div>

            <div className="table-container" style={{ maxHeight: "600px" }}>
                <table border="1" cellPadding="6" style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead style={{ background: "#e8e8e8" }}>
                        <tr>
                            <th style={getHeaderStyle(`gen`)}>Sl. No</th>
                            <th style={getHeaderStyle(`gen`)}>Circle</th>
                            <th style={getHeaderStyle(`gen`)}>Site Name</th>
                            <th style={getHeaderStyle(`gen`)}>Equipment Location(Switch Room)</th>
                            <th style={{ ...getHeaderStyle(`gen`), position: "sticky", left: 0, zIndex: 5 }}>Equipment/Rack No</th>
                            <th style={{ ...getHeaderStyle(`gen`), position: "sticky", left: 0, zIndex: 4 }}>Equipment/Rack Name</th>
                            <th style={getHeaderStyle(`gen`)}>Power Type</th>
                            <th style={getHeaderStyle(`gen`)}>Rack Type</th>
                            <th style={getHeaderStyle(`gen`)}>Rack Size (HxWxD in mm)</th>
                            <th style={getHeaderStyle(`gen`)}>Rack Temperature (T-M-B)</th>
                            <th style={getHeaderStyle(`gen`)}>Rack Description</th>
                            <th style={getHeaderStyle(`gen`)}>Rack Owner Details</th>
                            <th style={getHeaderStyle(`(A)`)}>(A) SMPS/UPS Rating (Amps/kVA)</th>
                            <th style={getHeaderStyle(`(A)`)}>(A) SMPS/UPS Name</th>
                            <th style={getHeaderStyle(`(A)`)}>(A) Source DB Number</th>
                            <th style={getHeaderStyle(`(A)`)}>(A) Incomer rating of DB (Amps):</th>
                            <th style={getHeaderStyle(`(A)`)}>(A) Incomer DB Cable Size (Sq mm)</th>
                            <th style={getHeaderStyle(`(A)`)}>(A) Cable Runs (Nos)</th>
                            <th style={getHeaderStyle(`(A)`)}>(A) Equipment Rack No</th>
                            <th style={getHeaderStyle(`(A)`)} >(A) Rack Name/Equipment Name</th>
                            <th style={getHeaderStyle(`(A)`)}>(A) Rack/Node Incoming Power Cable Size (Sq mm)</th>
                            <th style={getHeaderStyle(`(A)`)}>(A) Cable Run (Nos)</th>
                            <th style={getHeaderStyle(`(A)`)}>(A) DB MCB Number</th>
                            <th style={getHeaderStyle(`(A)`)}>(A) DB MCB Rating (Amps)</th>
                            <th style={getHeaderStyle(`(A)`)}>(A) Temp On Mcb/Fuse (°C)</th>
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
                            <th style={getHeaderStyle(`(B)`)}>(B) Incomer DB Rating (Amps):</th>
                            <th style={getHeaderStyle(`(B)`)}>(B) Incomer DB Cable Size (Sq mm)</th>
                            <th style={getHeaderStyle(`(B)`)}>(B) Cable Runs (Nos)</th>
                            <th style={getHeaderStyle(`(B)`)}>(B) Equipment Rack No</th>
                            <th style={getHeaderStyle(`(B)`)}>(B) Rack Name A</th>
                            <th style={getHeaderStyle(`(B)`)}>(B) Rack Incoming Power Cable Size (Sq mm)</th>
                            <th style={getHeaderStyle(`(B)`)}>(B) DB - RackDB Cable Run (Nos)</th>
                            <th style={getHeaderStyle(`(B)`)}>(B) DB MCB Number</th>
                            <th style={getHeaderStyle(`(B)`)}>(B) DB MCB Rating (Amps)</th>
                            <th style={getHeaderStyle(`(B)`)}>(B) Temp On Mcb/Fuse (°C)</th>
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
                            <th style={getHeaderStyle(`Total`)}>Total Load Both Sources: A</th>
                            <th style={getHeaderStyle(`Total`)}>Both Cable Capacity</th>
                            <th style={getHeaderStyle(`Total`)}>% Load on Cable</th>
                            <th style={getHeaderStyle(`Total`)}>% Load on MCB</th>
                            <th style={getHeaderStyle(`Total`)}>Both MCB Same</th>
                            <th style={getHeaderStyle(`Total`)}>Source Type</th>
                        </tr>
                    </thead>

                    <tbody>
                        {filteredData.length === 0 && (
                            <tr>
                                <td colSpan="9" style={{ textAlign: "center" }}>
                                    No data found
                                </td>
                            </tr>
                        )}

                        {filteredData.map((item, index) => (
                            <tr
                                key={item.id}
                                onClick={() => {
                                    preview(index);
                                    setEquipPopupData(item);   // pass full rack record
                                    setEquipPopupOpen(true);
                                }
                                }
                                style={{ cursor: "pointer", transition: "background 0.2s" }}
                            // onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f6")}
                            // onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >

                                <td>{index + 1}</td>
                                <td>{item.circle}</td>
                                <td>{item.siteName}</td>
                                <td>{item.equipmentLocation}</td>
                                <td className="sticky-col" style={{ position: "sticky", left: 0, zIndex: 3 }}>{item.equipmentRackNo}</td>
                                <td className="sticky-col">{item.rackName}</td>
                                <td>{item.powerType}</td>
                                <td>{item.rackType}</td>
                                <td>{item.rackSize}</td>
                                <td style={{ display: "flex", flex: "1" }}>
                                    <p>FT:{item.frontTopTemp}°C FM:{item.frontMiddleTemp}°C FB:{item.frontBottomTemp}°C</p>
                                    <p>BT:{item.backTopTemp}°C BM:{item.backMiddleTemp}°C BB:{item.backBottomTemp}°C</p>
                                </td>
                                <td>{item.rackDescription}</td>
                                <td>{item.rackOwnerName}</td>

                                {/* A Source */}
                                <td>{item.smpsRatingA}</td>
                                <td>{item.smpsNameA}</td>
                                <td>{item.dbNumberA}</td>
                                <td>{item.incomerRatingA}</td>
                                <td>{item.cableSizeA}</td>
                                <td>{item.cableRunA}</td>
                                <td>{item.equipmentRackNoA}</td>
                                <td>{item.rackNameA}</td>
                                <td>{item.rackIncomingCableSizeA}</td>
                                <td>{item.rackCableRunA}</td>
                                <td>{item.dbMcbNumberA}</td>
                                <td>{item.dbMcbRatingA}</td>
                                <td>{item.tempOnMcbA}</td>
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
                                <td>{item.incomerRatingB}</td>
                                <td>{item.cableSizeB}</td>
                                <td>{item.cableRunB}</td>
                                <td>{item.equipmentRackNoB}</td>
                                <td>{item.rackNameB}</td>
                                <td>{item.rackIncomingCableSizeB}</td>
                                <td>{item.rackCableRunB}</td>
                                <td>{item.dbMcbNumberB}</td>
                                <td>{item.dbMcbRatingB}</td>
                                <td>{item.tempOnMcbB}</td>
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
                                <td>{item.totalLoadBoth}</td>
                                <td>{item.bothCableCapacity}</td>
                                <td>{item.bothPctLoadCable}</td>
                                <td>{item.bothPctLoadMcb}</td>
                                <td>{item.isBothMcbSame}</td>
                                <td>{item.sourceType}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {status && <p style={{ marginTop: "10px" }}>{status}</p>}
            {previewOpen && previewData && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        background: "rgba(0,0,0,0.6)",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        zIndex: 1000,
                    }}
                >
                    <div
                        className="child-container"

                        style={{
                            // background: "white",
                            padding: "20px",
                            borderRadius: "10px",
                            width: "90%",
                            maxWidth: "700px",
                            maxHeight: "90%",
                            overflowY: "auto",
                            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                        }}
                    >
                        <button
                            onClick={() => setPreviewOpen(false)}
                            style={{
                                background: "#ef44442d",
                                color: "white",
                                padding: "8px 15px",
                                border: "none",
                                borderRadius: "6px",
                                cursor: "pointer",
                                marginRight: "10px",
                                position: "sticky",
                                top: 0,
                                zIndex: 1,
                                float: "right",
                            }}
                        >
                            ❌
                        </button>
                        <h2 style={{ textAlign: "center", borderBottom: "2px solid #2083a1ff", paddingBottom: "10px" }}>
                            🗄️ Rack Details Preview
                        </h2>

                        <table style={{ width: "100%", marginTop: "10px" }}>
                            {/* ---- Preview table body with explicit ordering & grouping ---- */}
                            <tbody>
                                {/* define ordered keys in the exact sequence you want */}
                                {(() => {
                                    const formatLabel = (k) =>
                                        k
                                            .replace(/([A-Z])/g, " $1")      // split camelCase / camelCaps
                                            .replace(/[_\-]+/g, " ")         // replace underscores/hyphens
                                            .replace(/\s+/g, " ")            // normalize spaces
                                            .trim()
                                            .replace(/\b\w/g, (c) => c.toUpperCase()); // Title Case

                                    // Grouped and ordered keys (customize this list to your full fields)

                                    const generalKeys = [
                                        "circle",
                                        "siteName",
                                        "equipmentLocation",
                                        "equipmentRackNo",
                                        "rackName",
                                        "powerType",
                                        "sourceType",
                                        "rackSize",
                                        "rackDescription",
                                        "rackOwnerName",
                                    ];

                                    const sourceAKeys = [
                                        "smpsRatingA",
                                        "smpsNameA",
                                        "dbNumberA",
                                        "incomerRatingA",
                                        "cableSizeA",
                                        "cableRunA",
                                        "equipmentRackNoA",
                                        "rackNameA",
                                        "rackIncomingCableSizeA",
                                        "rackCableRunA",
                                        "dbMcbNumberA",
                                        "dbMcbRatingA",
                                        "tempOnMcbA",
                                        "runningLoadA",
                                        "cableCapacityA",
                                        "pctLoadCableA",
                                        "pctLoadMcbA",
                                        "rackEndNoDbA",
                                        "rackEndDcdbNameA",
                                        "rackEndRunningLoadA",
                                        "rackEndMcbRatingA",
                                        "rackEndPctLoadMcbA",
                                        "remarksA",
                                    ];

                                    const sourceBKeys = [
                                        "smpsRatingB",
                                        "smpsNameB",
                                        "dbNumberB",
                                        "incomerRatingB",
                                        "cableSizeB",
                                        "cableRunB",
                                        "equipmentRackNoB",
                                        "rackNameB",
                                        "rackIncomingCableSizeB",
                                        "rackCableRunB",
                                        "dbMcbNumberB",
                                        "dbMcbRatingB",
                                        "tempOnMcbB",
                                        "runningLoadB",
                                        "cableCapacityB",
                                        "pctLoadCableB",
                                        "pctLoadMcbB",
                                        "rackEndNoDbB",
                                        "rackEndDcdbNameB",
                                        "rackEndRunningLoadB",
                                        "rackEndMcbRatingB",
                                        "rackEndPctLoadMcbB",
                                        "remarksB",
                                    ];

                                    const analysisKeys = [
                                        "totalLoadBoth",
                                        "bothCableCapacity",
                                        "bothPctLoadCable",
                                        "bothPctLoadMcb",
                                        "isBothMcbSame",
                                    ];

                                    // Merge everything in order; you can rearrange groups or items above
                                    const orderedKeys = [
                                        ...generalKeys,
                                        ...sourceAKeys,
                                        ...sourceBKeys,
                                        ...analysisKeys,
                                    ];

                                    // Helper to safely get display value
                                    const display = (v) =>
                                        v === null || v === undefined || String(v).trim() === "" ? "-" : String(v);

                                    // Build rows: render section headers when a new group starts
                                    const rows = [];
                                    const pushSectionHeader = (title) =>
                                        rows.push(
                                            <tr key={`hdr-${title}`}>
                                                <td colSpan="2" style={{ background: "#f3f4f6", fontWeight: "700", padding: "8px 10px", borderBottom: "1px solid #ddd" }}>
                                                    {title}
                                                </td>
                                            </tr>
                                        );

                                    // Add General header
                                    pushSectionHeader("General");

                                    orderedKeys.forEach((key) => {
                                        // insert section headers where appropriate
                                        if (sourceAKeys.includes(key) && !rows.some(r => r.key === "hdr-Source A")) pushSectionHeader("Source A");
                                        if (sourceBKeys.includes(key) && !rows.some(r => r.key === "hdr-Source B")) pushSectionHeader("Source B");
                                        if (analysisKeys.includes(key) && !rows.some(r => r.key === "hdr-Capacity Analysis")) pushSectionHeader("Capacity Analysis");

                                        rows.push(
                                            <tr key={key}>
                                                <td style={{ fontWeight: "bold", textTransform: "none", padding: "6px 10px", borderBottom: "1px solid #eee", width: "45%" }}>
                                                    {formatLabel(key)}
                                                </td>
                                                <td style={{ padding: "6px 10px", borderBottom: "1px solid #eee", width: "55%" }}>
                                                    {display(previewData[key])}
                                                </td>
                                            </tr>
                                        );
                                    });

                                    // 🔹 Show Rack Dimensions properly
                                    if (previewData.rackDimensions) {
                                        pushSectionHeader("Rack Dimensions");

                                        rows.push(
                                            <tr key="dim-height">
                                                <td style={{ fontWeight: "bold" }}>Height</td>
                                                <td>{previewData.rackDimensions.height} mm</td>
                                            </tr>
                                        );
                                        rows.push(
                                            <tr key="dim-width">
                                                <td style={{ fontWeight: "bold" }}>Width</td>
                                                <td>{previewData.rackDimensions.width} mm</td>
                                            </tr>
                                        );
                                        rows.push(
                                            <tr key="dim-depth">
                                                <td style={{ fontWeight: "bold" }}>Depth</td>
                                                <td>{previewData.rackDimensions.depth} mm</td>
                                            </tr>
                                        );
                                    }

                                    // 🔹 Show Rack Equipments properly
                                    if (previewData.rackEquipments && previewData.rackEquipments.length > 0) {
                                        pushSectionHeader("Rack Equipments (U-by-U)");

                                        previewData.rackEquipments.forEach((eq, i) => {
                                            rows.push(
                                                <tr key={`eq-${i}`}>
                                                    <td style={{ fontWeight: "bold", verticalAlign: "top" }}>
                                                        {eq.name}
                                                    </td>
                                                    <td>
                                                        <div><b>Start U:</b> {eq.startU}</div>
                                                        <div><b>End U:</b> {eq.endU}</div>
                                                        <div><b>Size U:</b> {eq.sizeU}</div>
                                                        <div><b>Remarks:</b> {eq.remarks || "—"}</div>
                                                    </td>
                                                </tr>
                                            );
                                        });
                                    }


                                    // If there are any extra keys in previewData not listed in orderedKeys, show them at the end
                                    const extraKeys = Object.keys(previewData || {}).filter(
                                        (k) => !orderedKeys.includes(k) && k !== "rackDimensions" && k !== "rackEquipments"
                                    )
                                    if (extraKeys.length > 0) {
                                        pushSectionHeader("Other Fields");
                                        extraKeys.forEach((k) =>
                                            rows.push(
                                                <tr key={`extra-${k}`}>
                                                    <td style={{ fontWeight: "bold", padding: "6px 10px", borderBottom: "1px solid #eee" }}>{formatLabel(k)}</td>
                                                    <td style={{ padding: "6px 10px", borderBottom: "1px solid #eee" }}>{display(previewData[k])}</td>
                                                </tr>
                                            )
                                        );
                                    }

                                    return rows;
                                })()}
                            </tbody>

                        </table>

                        <div style={{ marginTop: "15px", textAlign: "center" }}>
                            {(userData?.site?.toLowerCase() === previewData.siteName?.toLowerCase()) && (userData?.designation == "Vertiv Site Infra Engineer" || userData?.designation == "Vertiv CIH" || userData?.designation == "Vertiv ZM" || userData?.designation == "Vertiv Supervisor" || userData?.role == "Super User" || userData?.role == "Super Admin" || userData?.role == "Admin") && (
                                <>
                                    <button
                                        onClick={() => {
                                            setPreviewOpen(false);
                                            navigate("/rack-details-form", { state: { editData: previewData } });
                                        }}
                                        style={{
                                            background: "#10b981",
                                            color: "white",
                                            padding: "8px 15px",
                                            border: "none",
                                            borderRadius: "6px",
                                            cursor: "pointer",
                                        }}
                                    >
                                        ✏️ Edit
                                    </button>

                                    <>&nbsp;&nbsp;</>

                                    <button onClick={() => handleDelete(previewData.id)}
                                        style={{
                                            background: "#b91010ff",
                                            color: "white",
                                            padding: "8px 15px",
                                            border: "none",
                                            borderRadius: "6px",
                                            cursor: "pointer",
                                        }}
                                    >🗑️</button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 🟦 SEPARATE RACK 3D POPUP VIEW */}
            {equipPopupOpen && equipPopupData && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        background: "rgba(0,0,0,0.6)",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        zIndex: 2000,
                    }}
                >
                    <div
                        style={{
                            background: "grey",
                            padding: "20px 20px 30px",
                            borderRadius: "10px",
                            width: "95%",
                            maxWidth: "700px",
                            maxHeight: "90%",
                            overflowY: "auto",
                            position: "relative",
                        }}
                    >
                        {/* Close Button */}
                        <button
                            onClick={() => setEquipPopupOpen(false)}
                            style={{
                                background: "#b9101057",
                                color: "white",
                                padding: "8px 14px",
                                border: "none",
                                borderRadius: "6px",
                                cursor: "pointer",
                                position: "absolute",
                                top: "10px",
                                right: "10px",
                            }}
                        >
                            ❌
                        </button>

                        <h2
                            style={{
                                textAlign: "center",
                                borderBottom: "2px solid #0ea5e9",
                                paddingBottom: "10px",
                                marginBottom: "20px",
                            }}
                        >
                            🗄️ {equipPopupData.rackName} Equipment Layout (3D View)
                        </h2>

                        {/* Rack Dimensions */}
                        {(() => {
                            const dim = getRackDimensions(equipPopupData);
                            return (
                                <div style={{ textAlign: "center", marginBottom: "15px" }}>
                                    <div style={{ fontSize: "14px", fontWeight: "bold" }}>
                                        📐 Rack Dimensions
                                    </div>

                                    <div style={{ marginTop: "5px", fontSize: "13px" }}>
                                        Height: <b>{dim.H} mm</b> &nbsp; | &nbsp;
                                        Width: <b>{dim.W} mm</b> &nbsp; | &nbsp;
                                        Depth: <b>{dim.D} mm</b>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* 3D Rack View */}
                        <div className="rack-3d-wrapper">
                            <div className="rack-3d-left"></div>

                            <div className="rack-3d-main">

                                {Array.from({ length: getTotalRackU(equipPopupData) }, (_, i) => {
                                    const totalU = getTotalRackU(equipPopupData);
                                    const u = totalU - i;

                                    const allEq = equipPopupData.rackEquipments || [];

                                    // find equipment that spans this U
                                    const eq = allEq.find(item =>
                                        Number(item.startU) === u ||
                                        (u <= Number(item.startU) && u >= Number(item.endU))
                                    );

                                    const isStart = eq && Number(eq.startU) === u;
                                    const isInside = eq && u < Number(eq.startU) && u >= Number(eq.endU);

                                    return (
                                        <div key={u} className="rack-u-row" style={{ height: "18px" }}>
                                            <div className="u-label">{u}</div>

                                            {isStart ? (
                                                // Draw full-size block ONLY at startU
                                                <div
                                                    className="u-equipment"
                                                    style={{
                                                        height: `${eq.sizeU * 18}px`,
                                                        position: "relative",
                                                        background: "#cfe2ff",
                                                        border: "1px solid #8bb6ff",
                                                        zIndex: 9,
                                                        display: "flex",
                                                        alignItems: "center",
                                                        paddingLeft: "5px",
                                                    }}
                                                >
                                                    {eq.name}
                                                </div>
                                            ) : isInside ? (
                                                // Middle U rows (equipment covers this, but no block here)
                                                <div className="u-gap"></div>
                                            ) : (
                                                // Normal empty U
                                                <div className="u-empty"></div>
                                            )}

                                            <div className="u-details">
                                                {isStart && (
                                                    <div className="equipment-details">
                                                        <b>{eq.name}</b><br />
                                                        {eq.remarks || "—"}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}


        </div>

    );
};

export default AcDcRackDashboard;
