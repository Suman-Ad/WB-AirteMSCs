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
    const [editIndex, setEditIndex] = useState(null);
    // 🔹 Filter popup states
    const [showFilterPopup, setShowFilterPopup] = useState(false);
    const [siteFilter, setSiteFilter] = useState("");
    const [locationFilter, setLocationFilter] = useState("");
    const [equipNoFilter, setEquipNoFilter] = useState("");
    const [rackNameFilter, setRackNameFilter] = useState("");
    const [status, setStatus] = useState("");
    const navigate = useNavigate();
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewData, setPreviewData] = useState(null);

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
        } catch (error) {
            console.error("Error deleting:", error);
            setStatus("❌ Failed to delete record");
        }
    };

    // 🔹 Handle edit
    const handleEdit = (index) => {
        const record = filteredData[index];
        navigate("/rack-details-form", { state: { editData: record } });
    };


    // 🔹 Handle input changes during edit
    const handleChange = (e, index) => {
        const { name, value } = e.target;
        const updated = [...rackData];
        updated[index][name] = value;
        setRackData(updated);
    };

    // 🔹 Handle update/save
    const handleUpdate = async (index) => {
        const item = rackData[index];
        try {
            await updateDoc(doc(db, "acDcRackDetails", item.siteName?.toUpperCase(), "racks", item.id), {
                ...item,
                updatedAt: new Date().toISOString(),
            });
            setEditIndex(null);
            setStatus(`✅ Updated record for ${item.id}`);
        } catch (error) {
            console.error("Error updating:", error);
            setStatus("❌ Update failed");
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

        const matchesAll = siteMatch && locationMatch && equipMatch && rackMatch;

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
                        style={{
                            background: "white",
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
                            <th style={getHeaderStyle(`gen`)}>Rack Owner Name</th>
                            <th style={{ ...getHeaderStyle(`gen`), position: "sticky", left: 0, zIndex: 5 }}>Equipment/Rack No</th>
                            <th style={{ ...getHeaderStyle(`gen`), position: "sticky", left: 0, zIndex: 4 }}>Equipment/Rack Name</th>
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
                                onClick={() => preview(index)}
                                style={{ cursor: "pointer", transition: "background 0.2s" }}
                            // onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f6")}
                            // onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >

                                <td>{index + 1}</td>
                                <td>{item.circle}</td>
                                <td>{item.siteName}</td>
                                <td>{item.equipmentLocation}</td>
                                <td>{item.rackOwnerName}</td>
                                <td className="sticky-col" style={{ position: "sticky", left: 0, zIndex: 3 }}>
                                    {item.equipmentRackNo}
                                </td>
                                <td className="sticky-col">
                                    {item.rackName}
                                </td>

                                {/* A Source */}
                                <td>
                                    {
                                        item.smpsRatingA
                                    }
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="smpsNameA"
                                            value={item.smpsNameA || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.smpsNameA
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="dbNumberA"
                                            value={item.dbNumberA || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.dbNumberA
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="incomerRatingA"
                                            value={item.incomerRatingA || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.incomerRatingA
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="cableSizeA"
                                            value={item.cableSizeA || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.cableSizeA
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="cableRunA"
                                            value={item.cableRunA || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.cableRunA
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="equipmentRackNoA"
                                            value={item.equipmentRackNoA || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.equipmentRackNoA
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="rackNameA"
                                            value={item.rackNameA || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.rackNameA
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="rackIncomingCableSizeA"
                                            value={item.rackIncomingCableSizeA || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.rackIncomingCableSizeA
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="rackCableRunA"
                                            value={item.rackCableRunA || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.rackCableRunA
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="dbMcbNumberA"
                                            value={item.dbMcbNumberA || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.dbMcbNumberA
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="dbMcbRatingA"
                                            value={item.dbMcbRatingA || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.dbMcbRatingA
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="tempOnMcbA"
                                            value={item.tempOnMcbA || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.tempOnMcbA
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="runningLoadA"
                                            value={item.runningLoadA || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.runningLoadA
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="cableCapacityA"
                                            value={item.cableCapacityA || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.cableCapacityA
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="pctLoadCableA"
                                            value={item.pctLoadCableA || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.pctLoadCableA
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="pctLoadMcbA"
                                            value={item.pctLoadMcbA || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.pctLoadMcbA
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="rackEndNoDbA"
                                            value={item.rackEndNoDbA || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.rackEndNoDbA
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="rackEndDcdbNameA"
                                            value={item.rackEndDcdbNameA || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.rackEndDcdbNameA
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="rackEndRunningLoadA"
                                            value={item.rackEndRunningLoadA || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.rackEndRunningLoadA
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="rackEndMcbRatingA"
                                            value={item.rackEndMcbRatingA || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.rackEndMcbRatingA
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="rackEndPctLoadMcbA"
                                            value={item.rackEndPctLoadMcbA || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.rackEndPctLoadMcbA
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="remarksA"
                                            value={item.remarksA || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.remarksA
                                    )}
                                </td>


                                {/* B Source */}
                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="smpsRatingB"
                                            value={item.smpsRatingB || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.smpsRatingB
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="smpsNameB"
                                            value={item.smpsNameB || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.smpsNameB
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="dbNumberB"
                                            value={item.dbNumberB || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.dbNumberB
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="incomerRatingB"
                                            value={item.incomerRatingB || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.incomerRatingB
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="cableSizeB"
                                            value={item.cableSizeB || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.cableSizeB
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="cableRunB"
                                            value={item.cableRunB || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.cableRunB
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="equipmentRackNoB"
                                            value={item.equipmentRackNoB || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.equipmentRackNoB
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="rackNameB"
                                            value={item.rackNameB || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.rackNameB
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="rackIncomingCableSizeB"
                                            value={item.rackIncomingCableSizeB || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.rackIncomingCableSizeB
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="rackCableRunB"
                                            value={item.rackCableRunB || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.rackCableRunB
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="dbMcbNumberB"
                                            value={item.dbMcbNumberB || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.dbMcbNumberB
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="dbMcbRatingB"
                                            value={item.dbMcbRatingB || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.dbMcbRatingB
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="tempOnMcbB"
                                            value={item.tempOnMcbB || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.tempOnMcbB
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="runningLoadB"
                                            value={item.runningLoadB || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.runningLoadB
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="cableCapacityB"
                                            value={item.cableCapacityB || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.cableCapacityB
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="pctLoadCableB"
                                            value={item.pctLoadCableB || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.pctLoadCableB
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="pctLoadMcbB"
                                            value={item.pctLoadMcbB || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.pctLoadMcbB
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="rackEndNoDbB"
                                            value={item.rackEndNoDbB || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.rackEndNoDbB
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="rackEndDcdbNameB"
                                            value={item.rackEndDcdbNameB || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.rackEndDcdbNameB
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="rackEndRunningLoadB"
                                            value={item.rackEndRunningLoadB || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.rackEndRunningLoadB
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="rackEndMcbRatingB"
                                            value={item.rackEndMcbRatingB || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.rackEndMcbRatingB
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="rackEndPctLoadMcbB"
                                            value={item.rackEndPctLoadMcbB || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.rackEndPctLoadMcbB
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="remarksB"
                                            value={item.remarksB || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.remarksB
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="totalLoadBoth"
                                            value={item.totalLoadBoth || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.totalLoadBoth
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="bothCableCapacity"
                                            value={item.bothCableCapacity || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.bothCableCapacity
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="bothPctLoadCable"
                                            value={item.bothPctLoadCable || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.bothPctLoadCable
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="bothPctLoadMcb"
                                            value={item.bothPctLoadMcb || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.bothPctLoadMcb
                                    )}
                                </td>

                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="isBothMcbSame"
                                            value={item.isBothMcbSame || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.isBothMcbSame
                                    )}
                                </td>
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
                                        "updatedAt",
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

                                    // If there are any extra keys in previewData not listed in orderedKeys, show them at the end
                                    const extraKeys = Object.keys(previewData || {}).filter((k) => !orderedKeys.includes(k));
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

        </div>

    );
};

export default AcDcRackDashboard;
