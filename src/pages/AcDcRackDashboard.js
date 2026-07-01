// src/pages/AcDcRackDashboard.js
import React, { useEffect, useState, useMemo } from "react";
import { auth, db } from "../firebase";
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

import { isPrivilegedUser, isAdminAssignmentValid } from "../hooks/useRackPermissions";
import { useFilteredRacks } from "../hooks/useFilteredRacks";
import useRackData from "../hooks/useRackData";
import { exportRackExcel } from "../utils/excelExport";
import { buildRackAudit, getMissingFields } from "../utils/rackAudit";
import RackTable from "../components/rackDashboard/RackTable";
import ActivityTab from "../components/RackTracker/tab/ActivityTab";


const AcDcRackDashboard = ({ userData }) => {
    // const [rackData, setRackData] = useState([]);
    // 🔹 Filter popup states
    const [universalFilter, setUniversalFilter] = useState("");
    const [showFilterPopup, setShowFilterPopup] = useState(false);
    const [showAuditOnly, setShowAuditOnly] = useState(false);
    const [filters, setFilters] = useState(() => {
        const saved = localStorage.getItem("acdcRackFilters");
        return saved
            ? JSON.parse(saved)
            : {
                site: "",
                location: "",
                equipNo: "",
                rackName: "",
                powerType: "",
                sourceType: "",
                rackType: "",
                rackDomainType: "",
            };
    });

    const rackStatus = ["Installed Rack", "New Installed Rack", "Switched-OFF", "Switched-OFF Rack Removed", "Free Rack space", "Reserve Rack Space"]


    const isPrivileged = isPrivilegedUser(userData);

    const {
        rackData,
        setRackData,
        loading,
        refreshRackData,
    } = useRackData(userData);

    const {
        auditData,
        completeRacks,
        incompleteRacks,
    } = useMemo(
        () => buildRackAudit(rackData),
        [rackData]
    );

    const [status, setStatus] = useState("");
    const navigate = useNavigate();
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [equipPopupOpen, setEquipPopupOpen] = useState(false);
    const [equipPopupData, setEquipPopupData] = useState(null);
    // const [loading, setLoading] = useState(false);
    const rackTableRef = React.useRef(null);
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 25;

    useEffect(() => {
        localStorage.setItem("acdcRackFilters", JSON.stringify(filters));
    }, [filters]);


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

    // 🔹 Handle delete ALL (filtered) racks
    const handleDeleteAll = async () => {
        if (filteredData.length === 0) {
            alert("No racks to delete for current filters");
            return;
        }

        const confirmMsg =
            `Delete ALL ${filteredData.length} rack records currently shown (matching filters)?\n` +
            `This cannot be undone.`;
        if (!window.confirm(confirmMsg)) return;

        try {
            // const isPrivileged = isPrivilegedUser(userData);

            // Delete each rack using its own siteKey (works for multi-site / admin view)
            const deletePromises = filteredData.map((rack) =>
                deleteDoc(
                    doc(db, "acDcRackDetails", rack.siteKey, "racks", rack.id)
                )
            );

            await Promise.all(deletePromises);

            // Remove them from local state
            const idsToDelete = new Set(filteredData.map((r) => r.id));
            setRackData((prev) => prev.filter((r) => !idsToDelete.has(r.id)));

            setStatus(`🗑️ Deleted ${filteredData.length} rack records`);
            setPreviewOpen(false);
        } catch (error) {
            console.error("Error deleting all racks:", error);
            setStatus("❌ Failed to delete all records");
        }
    };

    useEffect(() => {
        setFilters((prev) => ({ ...prev, location: "" }));
    }, [filters.site]);

    // 🔹 Filter Logic
    const isLocationEnabled =
        // Admin / Super Admin → only after site selected
        (isPrivileged && !!filters.site) ||
        // Normal user → always enabled (site is fixed)
        (!isPrivileged && !!userData?.site);

    // 🔹 Derived filter options from loaded rackData
    const siteOptions = Array.from(
        new Set(rackData.map(d => d.siteName).filter(Boolean))
    ).sort();

    const locationOptions = Array.from(
        new Set(
            rackData
                .filter(d =>
                    filters.site
                        ? d.siteName === filters.site
                        : true
                )
                .map(d => d.equipmentLocation)
                .filter(Boolean)
        )
    ).sort();

    const filteredData = useFilteredRacks(
        rackData,
        filters,
        universalFilter,
        userData,
        isPrivileged
    );

    // 🔹 Site-wise Summary Calculation
    const siteSummaryChartData = useMemo(() => {
        const siteSummaryMap = {};

        filteredData.forEach(rack => {
            const site = rack.siteName || "UNKNOWN";

            if (!siteSummaryMap[site]) {
                siteSummaryMap[site] = {
                    site,
                    totalInstalled: 0,
                    totalPassive: 0,
                    totalActive: 0,
                    totalCore: 0,
                    totalTNG: 0,
                    totalOther: 0,
                    totalSwitchOff: 0,
                };
            }

            const s = siteSummaryMap[site];

            // Total installed
            s.totalInstalled += 1;

            // Rack type
            if (rack.rackType === "Passive") s.totalPassive += 1;
            if (rack.rackType === "Active") s.totalActive += 1;

            // Domain type
            if (rack.rackDomainType === "Core") s.totalCore += 1;
            else if (rack.rackDomainType === "TNG") s.totalTNG += 1;
            else if (rack.rackDomainType) s.totalOther += 1;

            // Switch Off logic
            const totalLoad = Number(rack.totalLoadBoth) || 0;
            if ((totalLoad === 0) && !rack.rackName.includes("ODF")) s.totalSwitchOff += 1;
        });
        return Object.values(siteSummaryMap);
    }, [filteredData]);

    const totalPages = Math.ceil(filteredData.length / rowsPerPage);

    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * rowsPerPage;
        return filteredData.slice(
            startIndex,
            startIndex + rowsPerPage
        );
    }, [filteredData, currentPage]);

    // Convert map to array for Recharts
    // const siteSummaryChartData = Object.values(siteSummaryMap);


    const getHeaderStyle = (header) => {
        if (header.startsWith("(A)")) return { backgroundColor: "#F2DCDB", color: "#020202ff" };
        if (header.startsWith("(B)")) return { backgroundColor: "#C5D9F1", color: "#000" };
        if (header.includes("Cable Load Capacity") || header.startsWith("%")) return { backgroundColor: "#FFD700", color: "#000" };
        if (header.includes("Rack End")) return { backgroundColor: "#FFC000", color: "#000" };
        if (header.includes("Total")) return { backgroundColor: "#C4D79B", color: "#000" };
        if (header.includes("gen")) return { backgroundColor: "#336e3d", color: "#000" };
        if (header.includes("DR Test")) return { backgroundColor: "#faef52", color: "#000" };
        if (header.includes("missing")) return { backgroundColor: "#dc2626", color: "#fff" };
        // if (header.startsWith("%") || header === "PUE" || header === "Site Running kW") return { backgroundColor: "#F57C00", color: "#fff" };
        return { backgroundColor: "#FFFFFF", color: "#000" };
    };

    const preview = (record) => {
        // const record = filteredData[index];
        setPreviewData(record);
        setEquipPopupData(record);
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

    const handleSiteRowClick = (site) => {
        setFilters((prev) => ({
            ...prev,
            site,
            location: "",
            equipNo: "",
            rackName: "",
        }));

        // smooth scroll to table
        setTimeout(() => {
            rackTableRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        }, 100);
    };

    const thStyle = {
        padding: "10px",
        borderBottom: "2px solid #334155",
        fontWeight: "bold",
        textAlign: "center",
    };

    const tdStyle = {
        padding: "8px",
        textAlign: "center",
    };

    useEffect(() => {
        setCurrentPage(1);
    }, [filteredData.length]);


    return (
        <div className="daily-log-container">
            {loading && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0,0,0,0.6)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 9999,
                    }}
                >
                    <div
                        style={{
                            background: "#0f172a",
                            padding: "30px 40px",
                            borderRadius: "12px",
                            textAlign: "center",
                            color: "white",
                            boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
                        }}
                    >
                        <div
                            style={{
                                width: "40px",
                                height: "40px",
                                border: "4px solid #334155",
                                borderTop: "4px solid #38bdf8",
                                borderRadius: "50%",
                                margin: "0 auto 15px",
                                animation: "spin 1s linear infinite",
                            }}
                        />
                        <div style={{ fontSize: "15px", fontWeight: "bold" }}>
                            Fetching Rack Data…
                        </div>
                        <div style={{ fontSize: "12px", color: "#cbd5e1", marginTop: "4px" }}>
                            Please wait
                        </div>
                    </div>
                </div>
            )}

            <h1 style={{ color: "white", textAlign: "center", paddingBottom: "20px" }}>
                <strong>🗄️AC/DC Rack Dashboard</strong>
            </h1>

            {/* 🔹 Site-wise Rack Summary */}
            <div
                style={{
                    background: "#1e293b",
                    padding: "15px",
                    borderRadius: "10px",
                    marginBottom: "25px",
                    color: "white",
                }}
            >
                <h2 style={{ textAlign: "center", marginBottom: "10px" }}>
                    📊 Site-wise Rack Summary
                </h2>

                {siteSummaryChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={360}>
                        <BarChart
                            data={siteSummaryChartData}
                            margin={{ top: 10, right: 30, left: 10, bottom: 60 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                                dataKey="site"
                                angle={-30}
                                textAnchor="end"
                                interval={0}
                                height={80}
                            />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Legend />

                            <Bar dataKey="totalInstalled" stackId="a" name="Installed" fill="#22c55e" />
                            <Bar dataKey="totalActive" stackId="a" name="Active" fill="#3b82f6" />
                            <Bar dataKey="totalPassive" stackId="a" name="Passive" fill="#94a3b8" />

                            <Bar dataKey="totalCore" stackId="b" name="Core" fill="#f97316" />
                            <Bar dataKey="totalTNG" stackId="b" name="TNG" fill="#a855f7" />
                            <Bar dataKey="totalOther" stackId="b" name="Other" fill="#64748b" />

                            <Bar dataKey="totalSwitchOff" name="Switch Off" fill="#ef4444" />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <p style={{ textAlign: "center", color: "#cbd5e1" }}>
                        No data available for summary
                    </p>
                )}
            </div>


            {/* 🔹 Site-wise Summary Table */}
            <div style={{ marginTop: "20px", overflowX: "auto" }}>
                <table
                    style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "13px",
                        background: "#020617",
                        color: "#e5e7eb",
                        borderRadius: "8px",
                        overflow: "hidden",
                    }}
                >
                    <thead>
                        <tr style={{ background: "#0f172a" }}>
                            <th style={thStyle}>Site</th>
                            <th style={thStyle}>Installed</th>
                            <th style={thStyle}>Active</th>
                            <th style={thStyle}>Passive</th>
                            <th style={thStyle}>Core</th>
                            <th style={thStyle}>TNG</th>
                            <th style={thStyle}>Other</th>
                            <th style={thStyle}>Switch Off</th>
                        </tr>
                    </thead>

                    <tbody>
                        {siteSummaryChartData.map((row) => (
                            <tr
                                key={row.site}
                                onClick={() => handleSiteRowClick(row.site)}
                                style={{
                                    textAlign: "center",
                                    cursor: "pointer",
                                    background:
                                        filters.site === row.site ? "#1e293b" : "#020617",
                                    borderBottom: "1px solid #1e293b",
                                    transition: "background 0.2s",
                                }}
                                onMouseEnter={(e) =>
                                    e.currentTarget.style.backgroundColor = "#0f172a"
                                }
                                onMouseLeave={(e) =>
                                    e.currentTarget.style.backgroundColor =
                                    filters.site === row.site ? "#1e293b" : "#020617"
                                }
                            >

                                <td style={{ ...tdStyle, textAlign: "left", fontWeight: "bold" }}>
                                    {row.site}
                                </td>
                                <td style={tdStyle}>{row.totalInstalled}</td>
                                <td style={{ ...tdStyle, color: "#60a5fa" }}>{row.totalActive}</td>
                                <td style={{ ...tdStyle, color: "#94a3b8" }}>{row.totalPassive}</td>
                                <td style={{ ...tdStyle, color: "#fb923c" }}>{row.totalCore}</td>
                                <td style={{ ...tdStyle, color: "#c084fc" }}>{row.totalTNG}</td>
                                <td style={{ ...tdStyle, color: "#9ca3af" }}>{row.totalOther}</td>
                                <td style={{ ...tdStyle, color: "#ef4444", fontWeight: "bold" }}>
                                    {row.totalSwitchOff}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {/* 🔹 Action Buttons */}

            <div style={{ marginBottom: "10px" }}>
                <button
                    className="segr-manage-btn"
                    onClick={() => navigate('/rack-details-form')}
                >
                    + Add New Rack ✏️
                </button>
                <button
                    className="download-btn"
                    onClick={() => exportRackExcel(filteredData)}
                >📥 Download Excel</button>

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

                <button
                    style={{
                        background: "#dc2626",
                        color: "#fff",
                        padding: "8px 18px",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontWeight: "bold",
                    }}
                    onClick={() => setShowAuditOnly(!showAuditOnly)}
                >
                    🚨 Missing Data Only
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
                        zIndex: 1100,
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
                                isAdminAssignmentValid(userData) ||
                                userData?.designation === "Vertiv CIH" ||
                                userData?.designation === "Vertiv ZM") && (
                                    <select
                                        value={filters.site}
                                        onChange={(e) =>
                                            setFilters((prev) => ({ ...prev, site: e.target.value }))
                                        }
                                        style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
                                    >
                                        <option value="">🏢 Select Site</option>
                                        {siteOptions.map(site => (
                                            <option key={site} value={site}>{site}</option>
                                        ))}
                                    </select>

                                )}

                            <select
                                value={filters.location}
                                disabled={!isLocationEnabled}
                                onChange={(e) =>
                                    setFilters((prev) => ({ ...prev, location: e.target.value }))
                                }
                                style={{
                                    padding: "8px",
                                    borderRadius: "6px",
                                    border: "1px solid #ccc",
                                    backgroundColor: isLocationEnabled ? "#fff" : "#f3f4f6",
                                    cursor: isLocationEnabled ? "pointer" : "not-allowed",
                                }}
                            >
                                <option value="">
                                    {isLocationEnabled
                                        ? "📍 Select Equipment Location"
                                        : "🔒 Select Site First"}
                                </option>

                                {locationOptions.map((loc) => (
                                    <option key={loc} value={loc}>
                                        {loc}
                                    </option>
                                ))}
                            </select>

                            <input
                                type="text"
                                placeholder="🔢 Equipment No"
                                value={filters.equipNo}
                                onChange={(e) => setFilters((prev) => ({ ...prev, equipNo: e.target.value }))
                                }
                                style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
                            />

                            <input
                                type="text"
                                placeholder="🗄️ Rack Name (optional)"
                                value={filters.rackName}
                                onChange={(e) => setFilters((prev) => ({ ...prev, rackName: e.target.value }))
                                }
                                style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
                            />

                            <select
                                type="text"
                                placeholder="⚡ Power Type"
                                value={filters.rackType}
                                onChange={(e) => setFilters((prev) => ({ ...prev, rackType: e.target.value }))
                                }
                                style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
                            >
                                <option value="">⇨⚡ Select Rack Type</option>
                                <option value="Active">Active</option>
                                <option value="Passive">Passive</option>
                            </select>

                            <select
                                type="text"
                                placeholder="⚡ Power Type"
                                value={filters.powerType}
                                onChange={(e) => setFilters((prev) => ({ ...prev, powerType: e.target.value }))
                                }
                                style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
                            >
                                <option value="">⇨⚡ Select Power Type</option>
                                <option value="AC">AC</option>
                                <option value="DC">DC</option>
                                <option value="AC+DC">AC+DC</option>
                            </select>

                            <select
                                type="text"
                                placeholder="⇨○ Source Type"
                                value={filters.sourceType}
                                onChange={(e) => setFilters((prev) => ({ ...prev, sourceType: e.target.value }))
                                }
                                style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
                            >
                                <option value="">⇨○ Select Source Type</option>
                                <option value="Dual Source">Dual Source</option>
                                <option value="Single Source">Single Source</option>
                            </select>

                            <select
                                type="text"
                                placeholder="⇨Domain Name"
                                value={filters.rackDomainType}
                                onChange={(e) => setFilters((prev) => ({ ...prev, rackDomainType: e.target.value }))
                                }
                                style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
                            >
                                <option value="">⇨○ Select Domain Name</option>
                                <option value="Core">Core</option>
                                <option value="TNG">TNG</option>
                                <option value="Others">Others</option>
                            </select>

                            <select
                                type="text"
                                placeholder="⚡ Rack Status"
                                value={filters.rackStatus}
                                onChange={(e) => setFilters((prev) => ({ ...prev, rackStatus: e.target.value }))
                                }
                                style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
                            >
                                <option value="">⇨⚡ Select Rack Status</option>
                                {rackStatus.map((q) => (
                                    <option key={q} value={q}>{q}</option>
                                ))}
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
                                    const emptyFilters = {
                                        site: "",
                                        location: "",
                                        equipNo: "",
                                        rackName: "",
                                        powerType: "",
                                        sourceType: "",
                                        rackType: "",
                                    };
                                    setFilters(emptyFilters);
                                    localStorage.removeItem("acdcRackFilters");
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

            <div
                style={{
                    marginBottom: "12px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "10px",
                }}
            >
                <input
                    type="text"
                    placeholder="🔍 Search Site, Rack, Location, Owner, RFAI, Source..."
                    value={universalFilter}
                    onChange={(e) => setUniversalFilter(e.target.value)}
                    style={{
                        width: "100%",
                        maxWidth: "500px",
                        padding: "10px",
                        borderRadius: "8px",
                        border: "1px solid #475569",
                        background: "#0f172a",
                        color: "#000000",
                    }}
                />

                {universalFilter && (
                    <button
                        onClick={() => setUniversalFilter("")}
                        style={{
                            background: "#dc2626",
                            color: "#fff",
                            border: "none",
                            borderRadius: "8px",
                            padding: "10px 14px",
                            cursor: "pointer",
                        }}
                    >
                        ❌ Clear
                    </button>
                )}
            </div>

            <div style={{ display: "flex", marginBottom: "10px", fontWeight: "bold", fontSize: "12px", color: "#333" }}>
                <div style={{ justifyContent: "left" }}>🔢 <strong>Total Racks:</strong> {filteredData.length}nos.</div>
                <div style={{ marginLeft: "auto" }}>
                    ⚡ <strong>Total Running Load:</strong>{" "}
                    {filteredData.reduce((sum, d) => sum + (parseFloat(d.totalLoadBoth) || 0), 0).toFixed(2)} A
                </div>
                {isPrivileged && (
                    <p
                        onClick={handleDeleteAll}
                        style={{ color: "white", background: "#d6090938", borderRadius: '3px', height: "fit-content", fontSize: '12px', marginLeft: "16px", cursor: "pointer", padding: "2px 3px" }}
                        onMouseMove={(e) => { e.currentTarget.style.backgroundColor = '#d60909a1' }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#d6090938';
                        }}
                        title="Delete All button, Please ensure before delete !!!"
                    >
                        ❌ All Data
                    </p>)}
            </div>

            <div ref={rackTableRef}>
                <RackTable
                    data={paginatedData}
                    currentPage={currentPage}
                    rowsPerPage={rowsPerPage}
                    getHeaderStyle={getHeaderStyle}
                    getMissingFields={getMissingFields}
                    onPreview={preview}
                />
            </div>
            <div style={{ display: "flex", justifyContent: "center", marginTop: "10px", alignItems: "center" }}>
                <div className="flex items-center justify-center gap-2 mt-4">
                    <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((p) => p - 1)}
                        className="px-3 py-1 border rounded"
                    >
                        Previous
                    </button>

                    <span>
                        Page {currentPage} of {totalPages}
                    </span>
                    {/* <div className="flex flex-wrap gap-1 justify-center mt-4">
                    {Array.from({ length: totalPages }, (_, i) => (
                        <button
                            key={i + 1}
                            onClick={() => setCurrentPage(i + 1)}
                            className={`px-3 py-1 rounded ${currentPage === i + 1
                                ? "bg-blue-600 text-white"
                                : "bg-gray-200"
                                }`}
                        >
                            {i + 1}
                        </button>
                    ))}
                </div> */}

                    <button
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage((p) => p + 1)}
                        className="px-3 py-1 border rounded"
                    >
                        Next
                    </button>
                </div>

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
                        // fontSize: "10px"
                    }}
                >

                    <div
                        className="child-container"

                        style={{
                            // background: "white",
                            padding: "20px",
                            borderRadius: "10px",
                            width: "100%",
                            // maxWidth: "700px",
                            maxHeight: "99%",
                            overflowY: "auto",
                            boxShadow: "0 4px 20px rgb(0, 0, 0)",
                        }}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid #2083a1ff", position: "sticky", top: "0", zIndex: 2000, background: "#0c334d" }}>
                            <div style={{ left: 0, textAlign: "center", }}>
                                <h2 style={{ cursor: "pointer", borderBottom: "2px solid #2083a1ff", borderRadius: "5px", padding: 2 }}
                                    onClick={() => setEquipPopupOpen(true)}
                                    onMouseMove={(e) => { e.currentTarget.style.backgroundColor = "#c72525ff" }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#3ba2b4a6" }}
                                >
                                    🗄️ Viwe Rack Details Preview
                                </h2>
                            </div>

                            {/*Action Button */}
                            <div style={{ marginTop: "15px", textAlign: "center" }}>
                                {(userData?.site?.toLowerCase() === previewData.siteName?.toLowerCase() || userData.role === "Super Admin" || userData.role === "Admin" || isAdminAssignmentValid(userData)) && (
                                    <div style={{ display: "inline-flex", gap: "10px" }}>
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
                                    </div>
                                )}
                            </div>

                            <div>
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
                                        left: 0,
                                        zIndex: 1,
                                        float: "right",
                                        width: "fit-content",

                                    }}
                                >
                                    ❌
                                </button>
                            </div>
                        </div>

                        <div
                            style={{
                                background: "grey",
                                padding: "20px 20px 30px",
                                borderRadius: "10px",
                                width: "99%",
                                // maxWidth: "700px",
                                maxHeight: "90%",
                                overflowY: "auto",
                                // position: "relative",
                            }}
                        >

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

                            <div style={{ display: "flex", overflowX: "auto" }}>
                                <div >
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
                                                                    background: "cyan",
                                                                    border: "1px solid #8bb6ff",
                                                                    zIndex: 9,
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    paddingLeft: "5px",
                                                                    borderTop: "2px solid rgba(30, 79, 134, 1)",
                                                                    borderRadius: "6px"
                                                                }}
                                                            >
                                                                {isStart && (
                                                                    <div
                                                                        className="u-details"
                                                                        style={{ maxHeight: `${eq.sizeU * 18}px` }}
                                                                    >

                                                                        <div className="equipment-details"
                                                                        >
                                                                            <b
                                                                                style={{
                                                                                    color: "rgba(44, 42, 156, 1)",
                                                                                    borderRadius: "3px",
                                                                                    borderBottom: "1px solid",
                                                                                    borderTop: "1px solid",
                                                                                    borderBottomColor: "ActiveBorder",
                                                                                }}>{eq.name}</b><br />
                                                                            {eq.remarks || "—"}
                                                                        </div>

                                                                    </div>
                                                                )}

                                                            </div>
                                                        ) : isInside ? (
                                                            // Middle U rows (equipment covers this, but no block here)
                                                            <div className="u-gap"></div>
                                                        ) : (
                                                            // Normal empty U
                                                            <div className="u-empty"><span>empty</span></div>
                                                        )}

                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    {/* Table */}
                                    <div style={{ overflowY: "auto", maxHeight: window.innerHeight, borderRadius: "8px" }}>
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
                                                                <td colSpan="2"
                                                                    style={title === "Rack Equipments (U-by-U)" ? { background: 'linear-gradient(105deg, #3ba2b4a6 10%, #a3a360 100%)', cursor: "pointer", borderRadius: "8px" } : { background: "#f3f4f6", fontWeight: "700", padding: "8px 10px", borderBottom: "1px solid #ddd", borderRadius: "8px" }}
                                                                    onClick={() => title === "Rack Equipments (U-by-U)" ? setEquipPopupOpen(true) : ""}
                                                                    onMouseMove={(e) => title === "Rack Equipments (U-by-U)" ? e.currentTarget.style.backgroundColor = "#ec1414ff" : ""}
                                                                    onMouseLeave={(e) => title === "Rack Equipments (U-by-U)" ? e.currentTarget.style.backgroundColor = "#3ba2b4a6" : ""}
                                                                >
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
                                                        (k) => !orderedKeys.includes(k) && k !== "rackDimensions" && k !== "rackEquipments" && k !== "updatedBy" && k !== "updatedAt"
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

                                                    // Update By
                                                    if (previewData?.updatedBy && typeof previewData.updatedBy === "object") {
                                                        pushSectionHeader("Updated By");

                                                        rows.push(
                                                            <tr key="updatedBy-name">
                                                                <td style={{ fontWeight: "bold" }}>Name</td>
                                                                <td>Mr. {previewData.updatedBy.name || "-"}</td>
                                                            </tr>
                                                        );

                                                        rows.push(
                                                            <tr key="updatedBy-empId">
                                                                <td style={{ fontWeight: "bold" }}>Emp. ID</td>
                                                                <td>{previewData.updatedBy.empId || "-"}</td>
                                                            </tr>
                                                        );

                                                        rows.push(
                                                            <tr key="updatedBy-role">
                                                                <td style={{ fontWeight: "bold" }}>Role</td>
                                                                <td>{previewData.updatedBy.role || "-"}</td>
                                                            </tr>
                                                        );

                                                        rows.push(
                                                            <tr key="updatedAt">
                                                                <td style={{ fontWeight: "bold" }}>Update At</td>
                                                                <td>{previewData.updatedAt || "-"}</td>
                                                            </tr>
                                                        );
                                                    }

                                                    return rows;
                                                })()}
                                            </tbody>

                                        </table>
                                    </div>

                                    <div style={{ marginTop: "20px", borderTop: "2px solid #2083a1ff", paddingTop: "10px" }}>
                                        <ActivityTab formData={previewData} />
                                    </div>
                                </div>
                            </div>
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
                                position: "sticky",
                                top: 0,
                                zIndex: 11,
                                float: "right",
                                width: "fit-content",
                                left: 0,
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
                                                        background: "cyan",
                                                        border: "1px solid #8bb6ff",
                                                        zIndex: 9,
                                                        display: "flex",
                                                        alignItems: "center",
                                                        paddingLeft: "5px",
                                                        borderTop: "2px solid rgba(30, 79, 134, 1)",
                                                        borderRadius: "6px"
                                                    }}
                                                >
                                                    {isStart && (
                                                        <div
                                                            className="u-details"
                                                            style={{ maxHeight: `${eq.sizeU * 18}px` }}
                                                        >

                                                            <div className="equipment-details"
                                                            >
                                                                <b
                                                                    style={{
                                                                        color: "rgba(44, 42, 156, 1)",
                                                                        borderRadius: "3px",
                                                                        borderBottom: "1px solid",
                                                                        borderTop: "1px solid",
                                                                        borderBottomColor: "ActiveBorder",
                                                                    }}>{eq.name}</b><br />
                                                                {eq.remarks || "—"}
                                                            </div>

                                                        </div>
                                                    )}

                                                </div>
                                            ) : isInside ? (
                                                // Middle U rows (equipment covers this, but no block here)
                                                <div className="u-gap"></div>
                                            ) : (
                                                // Normal empty U
                                                <div className="u-empty"><span>empty</span></div>
                                            )}

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
