import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs, setDoc, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import * as XLSX from "xlsx";
import "../assets/VendorEscalation.css";

const emptyLevel = { level: "", name: "", phone: "", email: "", responseTime: "" };
const emptyForm = { id: null, vendorName: "", category: "", logoFile: "", escalationLevels: [] };

const CATEGORY_OPTIONS = ["DG", "PAC", "SRC", "HVAC", "UPS", "SMPS", "SMPS Battery", "UPS Battery", "Fire Safety", "General", "Fuel", "Transformer, HT/LT Panel", "Non-Critical UPS", "Small Battery", "WLD", "EB", "IT", "Other"];

// ⏱️ Parse "30 min", "1 hr", "90" → minutes
const parseMinutes = (val) => {
    if (!val) return 0;
    const str = String(val).toLowerCase();
    if (str.includes("hr")) return Number(str.replace(/[^0-9.]/g, "")) * 60;
    return Number(str.replace(/[^0-9.]/g, "")) || 0;
};

// 🧠 Auto escalation helper
export const getEscalationLevelByMinutes = (levels = [], minutes = 0) => {
    if (!levels.length) return null;
    const sorted = [...levels].sort((a, b) => parseMinutes(a.responseTime) - parseMinutes(b.responseTime));
    for (let i = 0; i < sorted.length; i++) {
        const threshold = parseMinutes(sorted[i].responseTime);
        if (minutes <= threshold) return sorted[i];
    }
    return sorted[sorted.length - 1];
};

const VendorEscalation = ({ userData }) => {
    const isAdmin = userData?.role === "Admin" || userData?.role === "Super Admin";

    const [sites, setSites] = useState([]);
    const [selectedSite, setSelectedSite] = useState(userData?.site?.toUpperCase() || "");
    const [vendors, setVendors] = useState([]);
    const [filterCategory, setFilterCategory] = useState("ALL");

    const [form, setForm] = useState(emptyForm);
    const [isEditing, setIsEditing] = useState(false);

    const [uploadProgress, setUploadProgress] = useState({
        total: 0,
        processed: 0,
        success: 0,
        skipped: 0,
        errors: []
    });

    const [isUploading, setIsUploading] = useState(false);


    // Fetch Sites
    useEffect(() => {
        const fetchSites = async () => {
            const snap = await getDocs(collection(db, "siteConfigs"));
            setSites(snap.docs.map((d) => d.id));
        };
        if (isAdmin) fetchSites();
    }, [isAdmin]);

    // Fetch Vendors
    const fetchVendors = async () => {
        if (!selectedSite) return;
        const snap = await getDocs(collection(db, "vendorEscalation", selectedSite, "vendors"));
        setVendors(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    };

    useEffect(() => {
        fetchVendors();
    }, [selectedSite]);

    // Derived filtered list
    const filteredVendors = useMemo(() => {
        if (filterCategory === "ALL") return vendors;
        return vendors.filter((v) => (v.category || "").toUpperCase() === filterCategory);
    }, [vendors, filterCategory]);

    // Handle Input Change
    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    // Add Escalation Level
    const addLevel = () => {
        setForm((prev) => ({ ...prev, escalationLevels: [...prev.escalationLevels, { ...emptyLevel }] }));
    };

    // Update Level
    const updateLevel = (index, field, value) => {
        const updated = [...form.escalationLevels];
        updated[index][field] = value;
        setForm((prev) => ({ ...prev, escalationLevels: updated }));
    };

    // Delete Level
    const deleteLevel = (index) => {
        const updated = form.escalationLevels.filter((_, i) => i !== index);
        setForm((prev) => ({ ...prev, escalationLevels: updated }));
    };

    // Reset Form
    const resetForm = () => {
        setForm(emptyForm);
        setIsEditing(false);
    };

    // Save / Update Vendor
    const saveVendor = async () => {
        if (!selectedSite || !form.vendorName) return alert("Fill required fields");

        const payload = {
            vendorName: form.vendorName,
            category: form.category || "Other",
            logoFile: form.logoFile || "",
            escalationLevels: form.escalationLevels || [],
            updatedAt: new Date(),
        };

        if (isEditing && form.id) {
            await updateDoc(doc(db, "vendorEscalation", selectedSite, "vendors", form.id), payload);
        } else {
            const id = Date.now().toString();
            await setDoc(doc(db, "vendorEscalation", selectedSite, "vendors", id), payload);
        }

        resetForm();
        fetchVendors();
    };

    // Edit Vendor
    const editVendor = (vendor) => {
        setForm({
            id: vendor.id,
            vendorName: vendor.vendorName || "",
            category: vendor.category || "",
            logoFile: vendor.logoFile || "",
            escalationLevels: vendor.escalationLevels || [],
        });
        setIsEditing(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // Delete Vendor
    const deleteVendor = async (id) => {
        if (!window.confirm("Delete vendor?")) return;
        await deleteDoc(doc(db, "vendorEscalation", selectedSite, "vendors", id));
        fetchVendors();
    };

    // Download Excel Template
    const downloadTemplate = () => {
        const data = [
            ["vendorName", "category", "level", "name", "phone", "email", "responseTime"],
            ["ABC Vendor", "DG", "L1", "John Doe", "9999999999", "john@mail.com", "30 min"],
            ["ABC Vendor", "DG", "L2", "Manager", "8888888888", "manager@mail.com", "1 hr"],
        ];

        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");

        XLSX.writeFile(wb, "Vendor_Escalation_Template.xlsx");
    };

    // Validate Excel Row
    const validateRow = (row, index) => {
        const errors = [];

        if (!row.vendorName) errors.push("Missing vendorName");
        if (!row.level) errors.push("Missing level");
        if (!row.name) errors.push("Missing name");

        return errors.length
            ? { row: index + 2, errors } // +2 for Excel header offset
            : null;
    };

    // Upload Excel File
    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !selectedSite) {
            alert("Select file and site");
            return;
        }

        setIsUploading(true);
        setUploadProgress({ total: 0, processed: 0, success: 0, skipped: 0, errors: [] });

        const reader = new FileReader();

        reader.onload = async (evt) => {
            const workbook = XLSX.read(evt.target.result, { type: "binary" });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(sheet);

            // 🔍 Validate first
            const validationErrors = jsonData
                .map((row, i) => validateRow(row, i))
                .filter(Boolean);

            if (validationErrors.length) {
                setUploadProgress((prev) => ({ ...prev, errors: validationErrors }));
                setIsUploading(false);
                return;
            }

            // 📦 Group data
            const grouped = {};
            jsonData.forEach((row) => {
                const key = row.vendorName.trim();

                if (!grouped[key]) {
                    grouped[key] = {
                        vendorName: key,
                        category: row.category || "Other",
                        escalationLevels: []
                    };
                }

                grouped[key].escalationLevels.push({
                    level: row.level || "",
                    name: row.name || "",
                    phone: row.phone || "",
                    email: row.email || "",
                    responseTime: row.responseTime || ""
                });
            });

            const keys = Object.keys(grouped);

            setUploadProgress((prev) => ({ ...prev, total: keys.length }));

            // 🔄 Fetch existing vendors (for update/skip)
            const snap = await getDocs(collection(db, "vendorEscalation", selectedSite, "vendors"));
            const existing = {};
            snap.docs.forEach((d) => {
                existing[d.data().vendorName] = { id: d.id, ...d.data() };
            });

            // 🚀 Process each vendor
            for (let i = 0; i < keys.length; i++) {
                const vendor = grouped[keys[i]];

                try {
                    if (existing[vendor.vendorName]) {
                        // 🔁 UPDATE existing
                        await updateDoc(
                            doc(db, "vendorEscalation", selectedSite, "vendors", existing[vendor.vendorName].id),
                            {
                                ...vendor,
                                updatedAt: new Date()
                            }
                        );
                    } else {
                        // 🆕 NEW
                        const id = Date.now().toString() + Math.random().toString(36).substr(2, 5);

                        await setDoc(
                            doc(db, "vendorEscalation", selectedSite, "vendors", id),
                            {
                                ...vendor,
                                updatedAt: new Date()
                            }
                        );
                    }

                    setUploadProgress((prev) => ({
                        ...prev,
                        processed: prev.processed + 1,
                        success: prev.success + 1
                    }));
                } catch (err) {
                    setUploadProgress((prev) => ({
                        ...prev,
                        processed: prev.processed + 1,
                        skipped: prev.skipped + 1
                    }));
                }
            }

            setIsUploading(false);
            fetchVendors();
        };

        reader.readAsBinaryString(file);
    };

    // Export to Excel
    const exportToExcel = () => {
        const rows = [];

        vendors.forEach((v) => {
            (v.escalationLevels || []).forEach((lvl) => {
                rows.push({
                    vendorName: v.vendorName,
                    category: v.category,
                    level: lvl.level,
                    name: lvl.name,
                    phone: lvl.phone,
                    email: lvl.email,
                    responseTime: lvl.responseTime
                });
            });
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Vendors");

        XLSX.writeFile(wb, `${selectedSite}_Vendors.xlsx`);
    };

    return (
        <div className="vendor-page">
            <h2 className="vendor-header">Vendor Escalation Matrix</h2>

            <div className="vendor-controls">
                {/* Site selector (for Admin only) */}
                {isAdmin && (
                    <select
                        value={selectedSite}
                        onChange={(e) => setSelectedSite(e.target.value)}
                    >
                        <option value="">Select Site</option>
                        {sites.map((s) => (
                            <option key={s} value={s}>
                                {s}
                            </option>
                        ))}
                    </select>
                )}

                {/* Category filter to match vendor list */}
                <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                >
                    <option value="ALL">All Category</option>
                    {CATEGORY_OPTIONS.map((c) => (
                        <option key={c} value={c.toUpperCase()}>
                            {c}
                        </option>
                    ))}
                </select>

                {/* Buttons in one row – similar to Excel actions */}
                <button className="btn btn-primary" onClick={downloadTemplate}>
                    Download Template
                </button>

                <label className="btn btn-secondary file-btn">
                    Import Excel
                    <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleFileUpload}
                        style={{ display: "none" }}
                    />
                </label>

                <button className="btn btn-info" onClick={exportToExcel}>
                    Export Vendors
                </button>
            </div>

            <div className="vendor-card">
                <div className="vendor-card-header">
                    <div>
                        <label>Vendor Name</label>
                        <input
                            name="vendorName"
                            value={form.vendorName}
                            onChange={handleChange}
                            placeholder="Vertiv, Cummins, Honeywell…"
                        />
                    </div>

                    {/* in vendor-card-header */}
                    <div>
                        <label>Logo file (from public/vendor-logos)</label>
                        <input
                            name="logoFile"
                            value={form.logoFile || ""}
                            onChange={handleChange}
                            placeholder={`${form.logoFile || form.vendorName?.toLowerCase() || "vendor"}.png`}
                        />
                    </div>


                    <div>
                        <label>Equipment Category</label>
                        <select
                            name="category"
                            value={form.category}
                            onChange={handleChange}
                        >
                            <option value="">Select</option>
                            {CATEGORY_OPTIONS.map((c) => (
                                <option key={c} value={c}>
                                    {c}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="vendor-card-actions">
                        <button className="btn btn-success" onClick={saveVendor}>
                            {isEditing ? "Update Vendor" : "Save Vendor"}
                        </button>
                        {isEditing && (
                            <button className="btn btn-secondary" onClick={resetForm}>
                                Cancel
                            </button>
                        )}
                    </div>
                </div>

                {/* Escalation levels – column style like L1–L4 */}
                <div className="level-table-header">
                    <span className="col-level">Level</span>
                    <span className="col-name">Name</span>
                    <span className="col-phone">Phone</span>
                    <span className="col-email">Email</span>
                    <span className="col-rt">Resp. Time</span>
                    <span className="col-actions">Action</span>
                </div>

                {form.escalationLevels.map((lvl, idx) => (
                    <div className="level-table-row" key={idx}>
                        <select
                            value={lvl.level}
                            onChange={(e) => updateLevel(idx, "level", e.target.value)}
                        >
                            <option value="">Level</option>
                            <option value="L1">L1</option>
                            <option value="L2">L2</option>
                            <option value="L3">L3</option>
                            <option value="L4">L4</option>
                        </select>

                        <input
                            placeholder="Name"
                            value={lvl.name}
                            onChange={(e) => updateLevel(idx, "name", e.target.value)}
                        />

                        <input
                            placeholder="Phone"
                            value={lvl.phone}
                            onChange={(e) => updateLevel(idx, "phone", e.target.value)}
                        />

                        <input
                            placeholder="Email"
                            value={lvl.email}
                            onChange={(e) => updateLevel(idx, "email", e.target.value)}
                        />

                        <input
                            placeholder="30 min / 1 hr"
                            value={lvl.responseTime}
                            onChange={(e) => updateLevel(idx, "responseTime", e.target.value)}
                        />

                        <button
                            className="btn btn-danger btn-sm"
                            onClick={() => deleteLevel(idx)}
                        >
                            X
                        </button>
                    </div>
                ))}

                <button className="btn btn-secondary add-level-btn" onClick={addLevel}>
                    + Add Level
                </button>
            </div>

            {/* Vendor List – Excel style */}
            <div className="vendor-table-wrapper">
                <h2 className="vendor-header">Vendor List</h2>

                <div className="vendor-table">
                    <div className="vendor-table-header">
                        <div className="col circle">Circle</div>
                        <div className="col site-name">Site Name</div>
                        <div className="col equipment">Equipment Details</div>
                        <div className="col freq">FREQUENCY PM</div>
                        <div className="col vendor">Name of Service Provider</div>
                        <div className="col customer-support">Customer support officer</div>
                        <div className="col level">L1</div>
                        <div className="col level">L2</div>
                        <div className="col level">L3</div>
                        <div className="col level">L4</div>
                        <div className="col actions">Actions</div> {/* NEW */}
                    </div>


                    {filteredVendors.map((v) => {
                        const levelsByName = {};
                        (v.escalationLevels || []).forEach((lvl) => {
                            levelsByName[(lvl.level || "").toUpperCase()] = lvl;
                        });
                        const levelKeys = ["L1", "L2", "L3", "L4"];

                        return (
                            <div className="vendor-row" key={v.id}>
                                <div className="vendor-meta">
                                    <div className="cell circle">{userData?.circle || "-"}</div>
                                    <div className="cell site-name">{selectedSite}</div>
                                    <div className="cell equipment">{v.category || "-"}</div>
                                    <div className="cell freq">QTLy</div>

                                    <div className="cell vendor">
                                        <div className="vendor-logo-name">
                                            {v.logoFile && (
                                                <img
                                                    src={`/vendor-logos/${v.logoFile}`}
                                                    alt={v.vendorName}
                                                    className="vendor-logo"
                                                />
                                            )}
                                            <span className="vendor-name">{v.vendorName}</span>
                                        </div>
                                    </div>



                                    <div className="cell customer-support">
                                        {v.escalationLevels?.[0] ? (
                                            <>
                                                <div>{v.escalationLevels[0].name}</div>
                                                <div>{v.escalationLevels[0].phone}</div>
                                                <div>{v.escalationLevels[0].email}</div>
                                            </>
                                        ) : (
                                            <span>-</span>
                                        )}
                                    </div>

                                    {levelKeys.map((key) => {
                                        const lvl = levelsByName[key] || {};
                                        return (
                                            <div className="cell level" key={key}>
                                                <div className="level-title">{key}</div>
                                                <div>{lvl.name || "-"}</div>
                                                <div>{lvl.phone}</div>
                                                <div>{lvl.email}</div>
                                            </div>
                                        );
                                    })}
                                    {/* Actions cell – per row */}
                                    <div className="cell actions-cell">
                                        <button
                                            className="btn btn-info btn-xs"
                                            onClick={() => editVendor(v)}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            className="btn btn-danger btn-xs"
                                            onClick={() => deleteVendor(v.id)}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>

                            </div>
                        );
                    })}
                </div>
            </div>

        </div>
    );
};

export default VendorEscalation;
