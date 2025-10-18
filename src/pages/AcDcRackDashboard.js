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

const AcDcRackDashboard = ({userData}) => {
    const [rackData, setRackData] = useState([]);
    const [editIndex, setEditIndex] = useState(null);
    const [filter, setFilter] = useState("");
    const [status, setStatus] = useState("");
    const navigate = useNavigate();

    // 🔹 Fetch all site data from Firestore
    useEffect(() => {
        const fetchData = async () => {
            try {
                const sitesSnapshot = await getDocs(collection(db, "acDcRackDetails"));
                let allRacks = [];

                for (const siteDoc of sitesSnapshot.docs) {
                    const siteKey = siteDoc.id;
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
                setRackData(allRacks);
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };
        fetchData();
    }, []);

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
            <h2>AC/DC Rack Dashboard</h2>
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
                        <th>SMPS Rating (Amps)</th>
                        <th>Rack Name A</th>
                        <th>Rack Name B</th>
                        <th>Running Load A</th>
                        <th>Running Load B</th>
                        <th>% Load Cable A</th>
                        <th>% Load Cable B</th>
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
                                        name="runningLoadA"
                                        type="number"
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
                                        name="runningLoadB"
                                        type="number"
                                        value={item.runningLoadB || ""}
                                        onChange={(e) => handleChange(e, index)}
                                    />
                                ) : (
                                    item.runningLoadB
                                )}
                            </td>

                            <td>{item.pctLoadCableA}</td>
                            <td>{item.pctLoadCableB}</td>

                            <td>
                                {editIndex === index ? (
                                    <>
                                        <button onClick={() => handleUpdate(index)}>💾 Save</button>
                                        <button onClick={() => setEditIndex(null)}>❌ Cancel</button>
                                    </>
                                ) : (
                                    <>
                                        {(userData?.site?.toLowerCase() === item.siteName?.toLowerCase()) && (userData?.designation == "Vertiv Site Infra Engineer") && (
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
