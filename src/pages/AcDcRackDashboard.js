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
                    const siteKey = userData.site.trim().toUpperCase().replace(/\s+/g, "_");
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
            await deleteDoc(doc(db, "acDcRackDetails", siteName));
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
            await updateDoc(doc(db, "acDcRackDetails", item.id), {
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
            "Site Name": item.siteName,
            "Circle": item.circle,
            "Rack Name A": item.rackNameA,
            "Rack Name B": item.rackNameB,
            "Running Load A (Amps)": item.runningLoadA,
            "Running Load B (Amps)": item.runningLoadB,
            "% Load Cable A": item.pctLoadCableA,
            "% Load Cable B": item.pctLoadCableB,
            "DB MCB Rating A": item.dbMcbRatingA,
            "DB MCB Rating B": item.dbMcbRatingB,
            "Cable Size A (Sqmm)": item.cableSizeA,
            "Cable Size B (Sqmm)": item.cableSizeB,
            "Total Load Both": item.totalLoadBoth,
            "% Both Load Cable": item.bothPctLoadCable,
            "% Both Load MCB": item.bothPctLoadMcb,
            "Remarks A": item.remarksA,
            "Remarks B": item.remarksB,
            "Last Updated": item.updatedAt,
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Rack Data");

        const wbout = XLSX.write(wb, { type: "array", bookType: "xlsx" });
        const blob = new Blob([wbout], { type: "application/octet-stream" });
        saveAs(blob, `ACDC_RackData_${new Date().toISOString().split("T")[0]}.xlsx`);
    };

    return (
        <div className="daily-log-container">
            <h1 style={{ color: "white", textAlign: "center", paddingBottom: "20px" }}>
                <strong>🗄️AC/DC Rack Dashboard</strong>
            </h1>
            <div style={{ marginBottom: "10px" }}>
                <button
                    className="segr-manage-btn"
                    onClick={() => navigate('/rack-details-form')}
                >
                    🗄️ Edit Rack Details
                </button>
                <input
                    type="text"
                    placeholder="🔍 Search by Site Name"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    style={{ padding: "6px", marginBottom: "10px", width: "250px" }}
                />
                <button onClick={handleDownloadExcel}>📥 Download Excel</button>
            </div>
            <div className="table-container">
                <table border="1" cellPadding="6" style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead style={{ background: "#e8e8e8" }}>
                        <tr>
                            <th>Sl. No</th>
                            <th>Circle</th>
                            <th>Site Name</th>
                            <th>Equipment Location</th>
                            <th>Rack No</th>
                            <th>Rack Name</th>
                            <th>(A) SMPS Rating (Amps)</th>
                            <th>(A) SMPS Name</th>
                            <th>(A) DB Number</th>
                            <th>(A) Incomer DB Rating (Amps):</th>
                            <th>(A) Incomer DB Cable Size (Sq mm)</th>
                            <th>(A) PP - DB Cable Runs (Nos)</th>
                            <th>(A) Equipment Rack No</th>
                            <th>(A) Rack Name A</th>
                            <th>(A) Rack Incoming Power Cable Size (Sq mm)</th>
                            <th>(A) DB - RackDB Cable Run (Nos)</th>
                            <th>(A) DB MCB Number</th>
                            <th>(A) DB MCB Rating (Amps)</th>
                            <th>(A) Temp On Mcb/Fuse (°C)</th>
                            <th>(A) Running Load (Amps):</th>
                            <th>(A) Cable Capacity (Amps)</th>
                            <th>(A) % Load Cable</th>
                            <th>(A) % PCT Load MCB (Amps)</th>
                            <th>(A) Rack End No of DB / Power Strip (nos.)</th>
                            <th>(A) Rack End DCDB / Power Strip Name</th>
                            <th>(A) Rack End DB Running Load (Amps)</th>
                            <th>(A) Rack End DB MCB Rating (Amps)</th>
                            <th>(A) Rack End % Load MCB</th>
                            <th>(A) Remarks</th>
                            <th>(B) SMPS Rating (Amps)</th>
                            <th>(B) SMPS Name</th>
                            <th>(B) DB Number</th>
                            <th>(B) Incomer DB Rating (Amps):</th>
                            <th>(B) Incomer DB Cable Size (Sq mm)</th>
                            <th>(B) PP - DB Cable Runs (Nos)</th>
                            <th>(B) Equipment Rack No</th>
                            <th>(B) Rack Name A</th>
                            <th>(B) Rack Incoming Power Cable Size (Sq mm)</th>
                            <th>(B) DB - RackDB Cable Run (Nos)</th>
                            <th>(B) DB MCB Number</th>
                            <th>(B) DB MCB Rating (Amps)</th>
                            <th>(B) Temp On Mcb/Fuse (°C)</th>
                            <th>(B) Running Load (Amps):</th>
                            <th>(B) Cable Capacity (Amps)</th>
                            <th>(B) % Load Cable</th>
                            <th>(B) % PCT Load MCB (Amps)</th>
                            <th>(B) Rack End No of DB / Power Strip (nos.)</th>
                            <th>(B) Rack End DCDB / Power Strip Name</th>
                            <th>(B) Rack End DB Running Load (Amps)</th>
                            <th>(B) Rack End DB MCB Rating (Amps)</th>
                            <th>(B) Rack End % Load MCB</th>
                            <th>(B) Remarks</th>
                            <th>Total Load Both Sources: A</th>
                            <th>Both Cable Capacity</th>
                            <th>% Load on Cable</th>
                            <th>% Load on MCB</th>
                            <th>Both MCB Same</th>
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
                                <td>{item.equipmentRackNo}</td>
                                <td>{item.rackName}</td>

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
