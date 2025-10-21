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

const AcDcRackDashboard = ({ userData }) => {
    const [rackData, setRackData] = useState([]);
    const [editIndex, setEditIndex] = useState(null);
    const [filter, setFilter] = useState("");
    const [status, setStatus] = useState("");
    const navigate = useNavigate();

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
        setEditIndex(index);
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
            await updateDoc(doc(db, "acDcRackDetails", userData?.site?.toUpperCase(), "racks", item.id), {
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

    // 🔹 Filter by site name
    const filteredData = rackData.filter((d) =>
        d.siteName?.toLowerCase().includes(filter.toLowerCase())
    );

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
            "Total Load Both Sources: A": item.totalLoadBoth,
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

    return (
        <div className="daily-log-container">
            <h1 style={{ color: "white", textAlign: "center", paddingBottom: "20px" }}>
                <strong>🗄️AC/DC Rack Dashboard</strong>
            </h1>
            <div style={{ color: "green", marginBottom: "10px", width: "100%", textAlign: "center", display:"flex" }}>
                <input
                    type="text"
                    placeholder="🔍 Search by Site Name"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                />
            </div>
            <div style={{ marginBottom: "10px" }}>
                <button
                    className="segr-manage-btn"
                    onClick={() => navigate('/rack-details-form')}
                >
                    🗄️...✏️
                </button>
                <button className="download-btn" onClick={handleDownloadExcel}>📥 Download Excel</button>
            </div>
            
            <div className="table-container">
                <table border="1" cellPadding="6" style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead style={{ background: "#e8e8e8" }}>
                        <tr>
                            <th style={getHeaderStyle(`gen`)}>Sl. No</th>
                            <th style={getHeaderStyle(`gen`)}>Circle</th>
                            <th style={getHeaderStyle(`gen`)}>Site Name</th>
                            <th style={getHeaderStyle(`gen`)}>Equipment Location</th>
                            <th style={getHeaderStyle(`(A)`)}>(A) SMPS Rating (Amps)</th>
                            <th style={getHeaderStyle(`(A)`)}>(A) SMPS Name</th>
                            <th style={getHeaderStyle(`(A)`)}>(A) Source DB Number</th>
                            <th style={getHeaderStyle(`(A)`)}>(A) Incomer rating of DB (Amps):</th>
                            <th style={getHeaderStyle(`(A)`)}>(A) Incomer DB Cable Size (Sq mm)</th>
                            <th style={getHeaderStyle(`(A)`)}>(A) Cable Runs (Nos)</th>
                            <th style={getHeaderStyle(`(A)`)}>(A) Equipment Rack No</th>
                            <th style={{ ...getHeaderStyle(`(A)`), position: "sticky", left: 0, zIndex: 10 }} >(A) Rack Name/Equipment Name</th>
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
                            <th style={getHeaderStyle(`(B)`)}>(B) SMPS Rating (Amps)</th>
                            <th style={getHeaderStyle(`(B)`)}>(B) SMPS Name</th>
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
                            <th>Actions</th>
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
                            <tr key={item.id}>
                                <td>{index + 1}</td>
                                <td>{item.circle}</td>
                                <td>{item.siteName}</td>
                                <td>{item.equipmentLocation}</td>

                                {/* A Source */}
                                <td>
                                    {editIndex === index ? (
                                        <input
                                            name="smpsRatingA"
                                            value={item.smpsRatingA || ""}
                                            onChange={(e) => handleChange(e, index)}
                                        />
                                    ) : (
                                        item.smpsRatingA
                                    )}
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

                                <td className="sticky-col">
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
                                        <>
                                            <button onClick={() => handleUpdate(index)}>💾 Save</button>
                                            <button onClick={() => setEditIndex(null)}>❌ Cancel</button>
                                        </>
                                    ) : (
                                        <>
                                            {(userData?.site?.toLowerCase() === item.siteName?.toLowerCase()) && (userData?.designation == "Vertiv Site Infra Engineer" || userData?.designation == "Vertiv CIH" || userData?.designation == "Vertiv ZM" || userData?.designation == "Vertiv Supervisor" || userData?.role == "Super User" || userData?.role == "Super Admin" || userData?.role == "Admin") && (
                                                <>
                                                    <button onClick={() => handleEdit(index)}>✏️ Edit</button>
                                                    <button onClick={() => handleDelete(item.id)}>🗑️ Delete</button>
                                                </>
                                            )}
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {status && <p style={{ marginTop: "10px" }}>{status}</p>}
        </div>
    );
};

export default AcDcRackDashboard;
