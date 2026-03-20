import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs, setDoc, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

const emptyLevel = { level: "", name: "", phone: "", email: "", responseTime: "" };
const emptyForm = { id: null, vendorName: "", category: "", escalationLevels: [] };

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
    const [selectedSite, setSelectedSite] = useState(userData?.site || "");
    const [vendors, setVendors] = useState([]);
    const [filterCategory, setFilterCategory] = useState("ALL");

    const [form, setForm] = useState(emptyForm);
    const [isEditing, setIsEditing] = useState(false);

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

    return (
        <div className="p-4">
            <h2 className="text-xl font-bold mb-4">Vendor Escalation Matrix</h2>

            {/* Site + Filter Row */}
            <div className="flex flex-wrap gap-3 items-center mb-4">
                {isAdmin && (
                    <select className="border p-2 rounded" value={selectedSite} onChange={(e) => setSelectedSite(e.target.value)}>
                        <option value="">Select Site</option>
                        {sites.map((s) => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                )}

                <select className="border p-2 rounded" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                    <option value="ALL">All Categories</option>
                    {CATEGORY_OPTIONS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                </select>

                <div className="ml-auto text-sm text-gray-500">Total: {filteredVendors.length}</div>
            </div>

            {/* Form Card */}
            <div style={{
                border: "1px solid #ddd",
                borderRadius: "10px",
                padding: "15px",
                boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                marginBottom: "10px"
            }}>
                <div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input
                            className="border p-2 rounded"
                            name="vendorName"
                            placeholder="Vendor Name"
                            value={form.vendorName}
                            onChange={handleChange}
                        />

                        <select
                            className="border p-2 rounded"
                            name="category"
                            value={form.category}
                            onChange={handleChange}
                        >
                            <option value="">Select Category</option>
                            {CATEGORY_OPTIONS.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>

                        <div className="flex gap-2">
                            <button
                                style={{
                                    padding: "6px 12px",
                                    margin: "4px",
                                    borderRadius: "5px",
                                    border: "none",
                                    backgroundColor: "#007bff",
                                    color: "#fff",
                                    cursor: "pointer"
                                }} onClick={addLevel}>+ Add Level</button>
                            {isEditing && (
                                <button
                                    style={{
                                        padding: "6px 12px",
                                        margin: "4px",
                                        borderRadius: "5px",
                                        border: "none",
                                        backgroundColor: "#6c757d",
                                        color: "#fff",
                                        cursor: "pointer"
                                    }} onClick={resetForm}>Cancel</button>
                            )}
                        </div>
                    </div>

                    {/* Levels */}
                    <div className="mt-4 grid grid-cols-1 gap-3">
                        {form.escalationLevels.map((lvl, i) => (
                            <div key={i} className="grid grid-cols-2 md:grid-cols-6 gap-2 border p-3 rounded-xl">
                                <input className="border p-2 rounded" placeholder="Level (L1/L2)" value={lvl.level} onChange={(e) => updateLevel(i, "level", e.target.value)} />
                                <input className="border p-2 rounded" placeholder="Name" value={lvl.name} onChange={(e) => updateLevel(i, "name", e.target.value)} />
                                <input className="border p-2 rounded" placeholder="Phone" value={lvl.phone} onChange={(e) => updateLevel(i, "phone", e.target.value)} />
                                <input className="border p-2 rounded" placeholder="Email" value={lvl.email} onChange={(e) => updateLevel(i, "email", e.target.value)} />
                                <input className="border p-2 rounded" placeholder="Response Time (e.g. 30 min, 1 hr)" value={lvl.responseTime} onChange={(e) => updateLevel(i, "responseTime", e.target.value)} />
                                <button
                                    style={{
                                        padding: "6px 12px",
                                        margin: "4px",
                                        borderRadius: "5px",
                                        border: "none",
                                        backgroundColor: "red",
                                        color: "#fff",
                                        cursor: "pointer"
                                    }} onClick={() => deleteLevel(i)}>Delete
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="mt-4">
                        <button
                            style={{
                                padding: "6px 12px",
                                margin: "4px",
                                borderRadius: "5px",
                                border: "none",
                                backgroundColor: "#007bff",
                                color: "#fff",
                                cursor: "pointer"
                            }}
                            onClick={saveVendor}>{isEditing ? "Update Vendor" : "Save Vendor"}
                        </button>
                    </div>
                </div>
            </div>

            {/* Vendor List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredVendors.map((v) => (
                    <div
                        style={{
                            border: "1px solid #ddd",
                            borderRadius: "10px",
                            padding: "15px",
                            boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                            marginBottom: "10px"
                        }} key={v.id} className="shadow-lg rounded-2xl">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <div className="text-lg font-semibold">{v.vendorName}</div>
                                    <div className="text-xs text-gray-500">{v.category}</div>
                                </div>
                                <div className="flex gap-2">
                                    <button style={{
                                        padding: "6px 12px",
                                        margin: "4px",
                                        borderRadius: "5px",
                                        border: "none",
                                        backgroundColor: "green",
                                        color: "#fff",
                                        cursor: "pointer"
                                    }} onClick={() => editVendor(v)}>Edit</button>
                                    <button style={{
                                        padding: "6px 12px",
                                        margin: "4px",
                                        borderRadius: "5px",
                                        border: "none",
                                        backgroundColor: "red",
                                        color: "#fff",
                                        cursor: "pointer"
                                    }} onClick={() => deleteVendor(v.id)}>Delete</button>
                                </div>
                            </div>

                            <div className="mt-2 space-y-1 text-sm">
                                {(v.escalationLevels || []).map((lvl, i) => (
                                    <div key={i} className="flex justify-between border-b py-1">
                                        <span className="font-medium">{lvl.level}</span>
                                        <span>{lvl.name}</span>
                                        <span>{lvl.phone}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default VendorEscalation;
