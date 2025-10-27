// src/components/DGLogForm.js
import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, doc, setDoc, serverTimestamp, getDocs, query, orderBy, limit, where, getDoc } from "firebase/firestore";
import { oemDieselCphData } from "../config/oemDieselCphData";
import { useLocation, useNavigate } from "react-router-dom";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { saveAs } from "file-saver";
import HSDPrintTemplate from "../components/HSDPrintTemplate";



// Helper to format today as YYYY-MM-DD
const getTodayDate = () => {
    const d = new Date();
    return d.toISOString().split("T")[0];
};

const DGLogForm = ({ userData }) => {
    const { state } = useLocation();
    const [siteConfig, setSiteConfig ] = useState({});
    const siteKey = userData?.site?.toUpperCase();
    const [dgNumber, setDgNumber] = useState("DG-1");
    const [form, setForm] = useState({
        date: getTodayDate(),
        dgNumber: "DG-1",
        startTime: "",
        stopTime: "",
        hrMeterStart: "",
        hrMeterEnd: "",
        remarks: "On Load",
        fuelConsumption: "",
        kWHReading: "",
        fuelFill: "",
    });

    const [hsdForm, setHsdForm] = useState({
        inTime: "",
        informTime: "",
        parkingTime: "",
        fillingStartTime: "",
        outTime: "",
        securityName: "",
        density: "",
        temperature: "",
        ltrs: "",
        dillerInvoice: "",
        securitySign: null,
        omSign: null,
        managerSign: null
    });
    const [previewOpen, setPreviewOpen] = useState(false);


    const navigate = useNavigate();


    const handleChange = (e) => {
        const { name, value } = e.target;
        const numericFields = [
            "hrMeterStart",
            "hrMeterEnd",
            "fuelConsumption",
            "kWHReading",
            "fuelFill",
        ];
        setForm({
            ...form,
            [name]: numericFields.includes(name)
                ? value === "" ? "" : parseFloat(value)
                : value,
        });
    };

    // Site Config fetch
    const fetchConfig = async () => {
          if (!siteKey) return;
          const snap = await getDoc(doc(db, "siteConfigs", siteKey));
          if (snap.exists()) {
            setSiteConfig(snap.data());
          }
        };


    const handleSubmit = async (e) => {
        e.preventDefault();

        const totalRunHours =
            parseFloat(form.hrMeterEnd || 0) - parseFloat(form.hrMeterStart || 0);

        // Get month key like "Sep-2025"
        const dateObj = new Date(form.date);
        const monthKey =
            dateObj.toLocaleString("en-US", { month: "short" }) +
            "-" +
            dateObj.getFullYear();

        try {
            // ✅ Correct (date is a document, runs is a subcollection)
            const runsCollectionRef = collection(
                db,
                "dgLogs",
                userData.site,   // siteName
                monthKey,
                form.date,
                "runs"           // new subcollection for multiple runs
            );

            // ✅ --- NEW: Path to the parent date document ---
            const dateDocRef = doc(
                db,
                "dgLogs",
                userData.site,
                monthKey,
                form.date
            );

            // Unique runId → dgNumber + start/stop
            const runId = form.fuelFill > 0 && !form.startTime && !form.stopTime ? `${form.dgNumber}_fuelOnly_${Date.now()}` : `${form.dgNumber}_${form.startTime}_${form.stopTime}`;

            await setDoc(doc(runsCollectionRef, runId), {
                ...form,
                totalRunHours: form.fuelFill > 0 && !form.startTime && !form.stopTime
                    ? 0   // no running
                    : totalRunHours,
                remarks: form.fuelFill > 0 && !form.startTime && !form.stopTime
                    ? "Fuel Filling Only"
                    : form.remarks,
                siteId: userData.siteId,
                siteName: userData.site,
                enteredBy: userData.name,
                createdAt: serverTimestamp(),
            });

            // ✅ --- NEW: Ensure the parent date document exists with a field ---
            // This makes it visible to queries in DGLogTable.js
            await setDoc(dateDocRef, {
                lastUpdated: serverTimestamp()
            }, { merge: true }); // Use merge:true to avoid overwriting other fields if you add them later

            alert("Run log saved ✅");

            setForm({
                date: "",
                dgNumber: "DG-1",
                startTime: "",
                stopTime: "",
                hrMeterStart: "",
                hrMeterEnd: "",
                remarks: "On Load",
                fuelConsumption: "",
                kWHReading: "",
                fuelFill: "",
            });
            navigate("/dg-log-table")
        } catch (err) {
            console.error("Error saving log: ", err);
        }
    };

    // Define this with your other constants (before the component)
    const [showFuelModal, setShowFuelModal] = useState(false);
    const [dgCapacity, setDgCapacity] = useState("");
    const [dgKw, setDgKw] = useState("");
    const [dgHmr, setDgHmr] = useState("");
    const [calculationResult, setCalculationResult] = useState("");
    const [selectedCapacity, setSelectedCapacity] = useState("");
    const dgCapacityOptions = [
        "82.5 kVA", "125.0 kVA", "160.0 kVA", "180.0 kVA", "200.0 kVA",
        "250.0 kVA", "320.0 kVA", "380.0 kVA", "400.0 kVA", "500.0 kVA",
        "600.0 kVA", "625.0 kVA", "650.0 kVA", "750.0 kVA", "1010.0 kVA",
        "1250.0 kVA", "1500.0 kVA", "2000.0 kVA", "2250.0 kVA", "2500.0 kVA"
    ];

    // Then in your component, add these functions:
    const findRowDgCapacity = (dgRating) => {
        const capacities = oemDieselCphData["DG Capacity"];
        for (let i = 0; i < capacities.length; i++) {
            if (capacities[i] === dgRating) {
                return i;
            }
        }
        return -1;
    };

    const calculateSEGR = () => {
        const start = parseFloat(form.hrMeterStart) || 0;
        const end = parseFloat(form.hrMeterEnd) || 0;
        const kw = parseFloat(form.kWHReading) || 0;
        const capacity = parseFloat(siteConfig?.dgCapacity) || 0;
        const fuelFromForm = parseFloat(form.fuelConsumption) || 0; // manual override if user typed

        const hmr = end - start;
        if (hmr <= 0 || kw <= 0 || capacity <= 0) {
            setCalculationResult("");
            return; // invalid inputs — nothing to calculate
        }

        // Calculating kWh/hour (kW-hours during the run)
        const dgKwh = kw / hmr;

        // Calculating percentage of DG running (rounded)
        const runPercent = (dgKwh / (capacity * 0.8)) * 100;
        const roundedPercent = Math.round(runPercent);

        // missing-percentage list (same as calculateFuel)
        const missingColumnList = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 18, 20, 21, 23, 24, 25, 26, 29, 36];

        let result = ``;
        result += `♋️ ${dgNumber} Running Percentage: ${roundedPercent}%....\n`;

        // If OEM table doesn't exist for this percent, follow adjustableCPH branch
        if (missingColumnList.includes(roundedPercent)) {
            // adjustableCPH is the empirical 80 ltrs/hour × hours-run
            const adjustableCPH = hmr * 80; // litres for the run
            const segrUsingAdjustable = kw / adjustableCPH;
            const reqSegr = 3;

            if (fuelFromForm && fuelFromForm > 0) {
                // User provided fuelConsumption → use that for SEGR/CPH
                const segr = kw / fuelFromForm;
                const cph = fuelFromForm / hmr;
                result += `❓ As per Load % OEM Diesel CPH: OEM CPH Data Not Available for ${roundedPercent}% Load....\n`;
                result += `✅ Achieve CPH (Actual / User): ${(cph).toFixed(2)} ltrs/Hour....\n`;
                result += `⛽ Total Fuel Consumption (user): ${fuelFromForm.toFixed(2)} Ltrs for ${(hmr * 60).toFixed(0)} Minutes....\n`;
                result += `⚡ SEGR Value (Actual/User): ${segr.toFixed(2)} kW/Ltrs....\n`;
            } else {
                // System-compute path using adjustableCPH
                if (segrUsingAdjustable < reqSegr) {
                    // find smallest x such that 3*x >= kw (on-load fuel suggestion)
                    let x = 1;
                    for (; x < adjustableCPH; x++) {
                        const adjusFuel = 3 * x;
                        if (adjusFuel >= kw) break;
                    }
                    const finalSegr = kw / x;

                    result += `❓ As per Load % OEM Diesel CPH: OEM CPH Data Not Available for ${roundedPercent}% Load....\n`;
                    result += `✅ Achieve CPH as per Physical Inspection: 80.00 ltrs/Hour....\n`;
                    result += `⛽ Total Fuel Consumption for ${(hmr * 60).toFixed(0)} Minutes DG Running: ${adjustableCPH.toFixed(2)} Ltrs....\n`;
                    result += `⛽ On Load/Off Load Consumption Details: On Load ${x} ltrs / Off Load ${(adjustableCPH - x).toFixed(2)} ltrs\n`;
                    result += `⚡ SEGR Value: ${finalSegr.toFixed(2)} kW/Ltrs.... as per On Load Consumption\n`;
                } else {
                    result += `❓ As per Load % OEM Diesel CPH: OEM CPH Data Not Available for ${roundedPercent}% Load....\n`;
                    result += `✅ Achieve CPH as per Physical Inspection: 80.00 ltrs/Hour....\n`;
                    result += `⛽ Total Fuel Consumption for ${(hmr * 60).toFixed(0)} Minutes DG Running: ${adjustableCPH.toFixed(2)} Ltrs....\n`;
                    result += `⚡ SEGR Value: ${segrUsingAdjustable.toFixed(2)} kW/Ltrs....\n`;
                }

                // only auto-fill form.fuelConsumption when system computed it (avoid overwriting user edits)
                setForm((prev) => {
                    const newVal = adjustableCPH.toFixed(2);
                    if (prev.fuelConsumption && parseFloat(prev.fuelConsumption) === parseFloat(newVal)) {
                        return prev; // already same — avoid extra render
                    }
                    return { ...prev, fuelConsumption: newVal };
                });
            }
        } else {
            // OEM data exists for this percent — use OEM CPH table
            const rowIndex = findRowDgCapacity(capacity);
            const oDCPH = oemDieselCphData[`${roundedPercent}%`]?.[rowIndex];

            // If user provided fuel, prefer that; else compute using OEM CPH
            let totalFuelConsumption = fuelFromForm && fuelFromForm > 0 ? fuelFromForm : (oDCPH ? (oDCPH * 1) * hmr : 0);

            if (totalFuelConsumption <= 0) {
                // fallback: if OEM data missing and no user fuel → treat as unavailable
                result += `🖋 OEM Diesel CPH Data Not Available for ${roundedPercent}% Load and no fuel provided.\n`;
                setCalculationResult(result);
                return;
            }

            const segr = kw / totalFuelConsumption;
            const cph = totalFuelConsumption / hmr;

            if (oDCPH) {
                result += `📊 As per Load % OEM Diesel CPH: ${oDCPH.toFixed(2)} ltrs/Hour....\n`;
            } else {
                result += `❓ As per Load % OEM Diesel CPH: OEM Data Missing....\n`;
            }

            result += `✅ Achieve CPH (Actual): ${(cph).toFixed(2)} ltrs/Hour....\n`;
            result += `⛽ Total Fuel Consumption for ${(hmr * 60).toFixed(0)} Minutes DG Running: ${(totalFuelConsumption).toFixed(2)} Ltrs....\n`;
            result += `⚡ SEGR Value: ${segr.toFixed(2)} kW/Ltrs....\n`;

            // auto-fill only if system computed the value (i.e., user didn't type it)
            if (!fuelFromForm && totalFuelConsumption > 0) {
                setForm((prev) => {
                    const newVal = (totalFuelConsumption).toFixed(2);
                    if (prev.fuelConsumption && parseFloat(prev.fuelConsumption) === parseFloat(newVal)) {
                        return prev;
                    }
                    return { ...prev, fuelConsumption: newVal };
                });
            }
        }

        setCalculationResult(result);
    };

    useEffect(() => {
        const fetchPrevHrMeter = async () => {
            try {
                if (!dgNumber) return;

                const today = getTodayDate();
                const dateObj = new Date(today);

                // Month key like "Sep-2025"
                const monthKey =
                    dateObj.toLocaleString("en-US", { month: "short" }) +
                    "-" +
                    dateObj.getFullYear();

                // Path to today's runs
                const runsRef = collection(
                    db,
                    "dgLogs",
                    userData.site,
                    monthKey,
                    today,
                    "runs"
                );

                // 🔹 Get last few runs today
                const q = query(runsRef, orderBy("createdAt", "desc"), limit(5));
                const snap = await getDocs(q);

                let found = null;
                snap.forEach((doc) => {
                    const data = doc.data();
                    if (data.dgNumber === dgNumber) {
                        found = data;
                    }
                });

                if (found) {
                    setForm((prev) => ({ ...prev, hrMeterStart: found.hrMeterEnd }));
                    return;
                }

                // fallback → yesterday’s closing
                const yesterday = new Date(dateObj);
                yesterday.setDate(yesterday.getDate() - 1);
                const yDate = yesterday.toISOString().split("T")[0];
                const yMonthKey =
                    yesterday.toLocaleString("en-US", { month: "short" }) +
                    "-" +
                    yesterday.getFullYear();

                const yRunsRef = collection(
                    db,
                    "dgLogs",
                    userData.site,
                    yMonthKey,
                    yDate,
                    "runs"
                );

                const yq = query(yRunsRef, orderBy("createdAt", "desc"), limit(5));
                const ysnap = await getDocs(yq);

                let yfound = null;
                ysnap.forEach((doc) => {
                    const data = doc.data();
                    if (data.dgNumber === dgNumber) {
                        yfound = data;
                    }
                });

                if (yfound) {
                    setForm((prev) => ({ ...prev, hrMeterStart: yfound.hrMeterEnd }));
                }
            } catch (err) {
                console.error("Error fetching prev hrMeterStart:", err);
            }
        };

        fetchPrevHrMeter();
        fetchConfig();
    }, [dgNumber, userData.site]);


    // 🔹 Auto-calculate SEGR whenever key values change, including fuelConsumption edits
    useEffect(() => {
        const timer = setTimeout(() => {
            if (
                form.kWHReading &&
                form.hrMeterStart &&
                form.hrMeterEnd &&
                !isNaN(parseFloat(form.kWHReading)) &&
                !isNaN(parseFloat(form.hrMeterStart)) &&
                !isNaN(parseFloat(form.hrMeterEnd))
            ) {
                calculateSEGR();
            }
        }, 500); // short debounce
        return () => clearTimeout(timer);
    }, [
        form.kWHReading,
        form.hrMeterStart,
        form.hrMeterEnd,
        form.fuelConsumption, // include fuelConsumption to trigger SEGR/CPH on manual change
    ]);

    const generateHSDReport = async () => {
        try {
            // ✅ Fetch template correctly (must be inside /public/)
            const response = await fetch(`${process.env.PUBLIC_URL}/templates/HSD_Receiving_Template.docx`);
            if (!response.ok) throw new Error("❌ Template not found or inaccessible");
            const content = await response.arrayBuffer();

            const zip = new PizZip(content);
            const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

            // ✅ Extract proper fields
            const formattedDate = new Date(form.date).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric"
            });

            // ✅ Prepare dynamic replacements matching your .docx placeholders
            const data = {
                siteName: siteConfig?.siteName || "-",
                date: formattedDate,
                inTime: hsdForm.inTime || "",
                outTime: hsdForm.outTime || "",
                securityName: hsdForm.securityName || "Security Team",
                density: hsdForm.density || "-",
                temperature: hsdForm.temperature || "-",
                ltrs: hsdForm.ltrs || "-",
                dillerInvoice: hsdForm.dillerInvoice || "",
                actualReceived: form.fuelFill ? `${form.fuelFill} Ltr` : "-",
                omName: siteConfig?.preparedBy || "O&M Team",
                securitySign: hsdForm.securitySign,
                omSign: hsdForm.omSign,
                managerSign: hsdForm.managerSign,
            };

            // ✅ Render and handle potential template errors
            try {
                doc.setData(data);
                doc.render();
            } catch (renderErr) {
                console.error("Docxtemplater render error:", renderErr);
                throw renderErr;
            }

            // ✅ Save final file
            const output = doc.getZip().generate({ type: "blob" });
            saveAs(output, `HSD_Receiving_${data.siteName}_${formattedDate}.docx`);
        } catch (error) {
            console.error("❌ Error generating HSD report:", error);
            alert("Failed to generate HSD Receiving Report. Check console for details.");
        }
    };

    const handleSignUpload = (e, field) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                setHsdForm((prev) => ({ ...prev, [field]: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };



    return (
        <div className="daily-log-container">
            <h2 className="dashboard-header">
                <strong>🎯 Daily DG Log Entry - {userData.site}</strong>
            </h2>
            <form onSubmit={handleSubmit} className="daily-log-form">

                <label className="form-label">Date:
                    <input
                        type="date"
                        name="date"
                        value={form.date}
                        onChange={handleChange}
                        className="w-full p-2 border rounded"
                        required
                    />
                </label>

                <label className="form-label">Select DG:
                    <span style={{ fontSize: "10px", color: "#030a44ff" }}>(e.g.:- DG-1, DG-2, DG-3)</span>
                    <select
                        name="dgNumber"
                        value={dgNumber}
                        onChange={(e) => {
                            setDgNumber(e.target.value);   // update DG state
                            setForm((prev) => ({ ...prev, dgNumber: e.target.value })); // keep form in sync
                        }}
                        className="w-full p-2 border rounded"
                    >

                        <option value="">Select DG</option>;
                        {Array.from({ length: siteConfig.dgCount || 0 }, (_, i) => (
                            <option key={`DG-${i + 1}`} value={`DG-${i + 1}`}>
                                DG-{i + 1}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="form-label">Remarks:
                    <span style={{ fontSize: "10px", color: "yellow" }}>(e.g.:- ON/NO Load & Fuel Filling Only)</span>
                    <select
                        name="remarks"
                        value={form.remarks}
                        onChange={handleChange}
                        className="w-full p-2 border rounded"
                    >
                        <option value="On Load">On Load</option>
                        <option value="No Load">No Load</option>
                        <option value="Fuel Filling Only">Fuel Filling Only</option>
                    </select>
                </label>

                {(form.remarks === "On Load" || form.remarks === "No Load") && (
                    <div className="grid grid-cols-2 gap-2">
                    <label className="form-label">Start Time:
                        <input
                            type="time"
                            name="startTime"
                            value={form.startTime}
                            onChange={handleChange}
                            className="p-2 border rounded"
                        // required
                        />
                    </label>

                    <label className="form-label">Stop Time:
                        <input
                            type="time"
                            name="stopTime"
                            value={form.stopTime}
                            onChange={handleChange}
                            className="p-2 border rounded"
                        // required
                        />
                    </label>
                </div>
                )}
                

                <div className="grid grid-cols-2 gap-2">
                    <label className="form-label">Hr Meter Start:
                        <span style={{ fontSize: "10px", color: "#030a44ff" }}>(e.g.:- '1800.00', It fetch auto only check during fill)</span>
                        <input
                            type="number"
                            step="0.1"
                            name="hrMeterStart"
                            value={form.hrMeterStart}
                            onChange={handleChange}
                            placeholder="Hr meter start"
                            className="p-2 border rounded"
                            required
                        />
                    </label>
                    <label className="form-label">Hr Meter End:
                        <span style={{ fontSize: "10px", color: "yellow" }}>(e.g.:- '1800.1')</span>
                        <input
                            type="number"
                            step="0.1"
                            name="hrMeterEnd"
                            value={form.remarks === "Fuel Filling Only" ? form.hrMeterStart : form.hrMeterEnd}
                            onChange={handleChange}
                            placeholder="Hr meter end"
                            className="p-2 border rounded"
                            required
                        />
                    </label>
                </div>

                {(form.remarks === "On Load" || form.remarks === "No Load") && (
                <label className="form-label">Reading (kWH):
                    <span style={{ fontSize: "10px", color: "#0a4604ff" }}>(e.g.:- Closing kWh - Opening kWh = Reading)</span>
                    <input
                        type="number"
                        step="0.1"
                        name="kWHReading"
                        value={form.remarks === "Fuel Filling Only" ? 0 : form.kWHReading}
                        onChange={handleChange}
                        placeholder="Generated kWH"
                        className="w-full p-2 border rounded"
                        required
                    />
                </label>
                )}

                {(form.remarks === "On Load" || form.remarks === "No Load") && (
                <label className="form-label">Fuel Consumption (Liters):
                    <span style={{ fontSize: "10px", color: "#851010ff" }}>(e.g.:- Opening Fuel - Closing Fuel = Fuel Consumption)</span>
                    <input
                        type="number"
                        step="0.1"
                        name="fuelConsumption"
                        value={form.remarks === "Fuel Filling Only" ? 0 : form.fuelConsumption}
                        onChange={handleChange}
                        placeholder="Fuel consumption (L)"
                        className="w-full p-2 border rounded"
                        required
                    />
                </label>
            )}

                <label className="form-label">Fuel Filling (Liters):
                    <span style={{ fontSize: "10px", color: "yellow" }}>(e.g.:- Skip it('0') if Fuel not fill)</span>
                    <input
                        type="number"
                        step="0.1"
                        name="fuelFill"
                        value={form.fuelFill}
                        onChange={handleChange}
                        placeholder="Add fuel filling (L)"
                        className="w-full p-2 border rounded"
                        required
                    />
                </label>

                {calculationResult && (
                    <div className="child-container">
                        <h2 style={{ fontSize: "20px", borderBottom: "3px solid #eee" }}><strong>🔢 {siteConfig.dgCapacity}kVA</strong> Cummins DG CPH/SEGR Calculation Results:</h2>
                        <pre >{calculationResult}</pre>
                    </div>
                )}
                <button
                    type="submit"
                    className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
                >
                    Save Log
                </button>
            </form>

            {form.remarks === "Fuel Filling Only" && (
                <div className="child-container" style={{ padding: "10px", border: "1px solid #ccc", borderRadius: "10px", marginBottom: "10px" }}>
                    <h3>🛢️ HSD Receiving Info</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
                        <div>
                            <label>Diesel Tanker (In time HH:MM)</label>
                            <input type="time" name="inTime" value={hsdForm.inTime} onChange={(e) => setHsdForm({ ...hsdForm, inTime: e.target.value })} required />
                        </div>
                        <div>
                            <label>Time: Informed to O&M team of arrival of HSD tanker by Security Team</label>
                            <input type="time" name="informTime" value={hsdForm.informTime} onChange={(e) => setHsdForm({ ...hsdForm, informTime: e.target.value })} required />
                        </div>

                        <div>
                            <label>HSD parking and ignition off time at HSD yard (HH:MM)</label>
                            <input type="time" name="parkingTime" value={hsdForm.parkingTime} onChange={(e) => setHsdForm({ ...hsdForm, parkingTime: e.target.value })} required />
                        </div>

                        <div>
                            <label>HSD Tanker settling time (HH:MM)</label>
                            <input type="time" name="fillingStartTime" value={hsdForm.fillingStartTime} onChange={(e) => setHsdForm({ ...hsdForm, fillingStartTime: e.target.value })} required />
                        </div>
                        <div>
                            <label>HSD tanker (Out time) (HH:MM)</label>
                            <input type="time" name="outTime" value={hsdForm.outTime} onChange={(e) => setHsdForm({ ...hsdForm, outTime: e.target.value })} required />
                        </div>
                        <div>
                            <label>HSD Ltrs.</label>
                            <input type="number" name="ltrs" value={hsdForm.ltrs || form.fuelFill} onChange={(e) => setHsdForm({ ...hsdForm, ltrs: e.target.value })} required />
                        </div>
                        <div>
                            <label>HSD Density</label>
                            <input type="number" name="density" value={hsdForm.density} onChange={(e) => setHsdForm({ ...hsdForm, density: e.target.value })} required />
                        </div>
                        <div>
                            <label>HSD Temperature °C</label>
                            <input type="number" name="temperature" value={hsdForm.temperature} onChange={(e) => setHsdForm({ ...hsdForm, temperature: e.target.value })} required />
                        </div>
                        <div>
                            <label>Security Name</label>
                            <input type="text" name="securityName" value={hsdForm.securityName} onChange={(e) => setHsdForm({ ...hsdForm, securityName: e.target.value })} required />
                        </div>
                        <div>
                            <label>Accepted Invoice/Delivery challan number</label>
                            <input type="text" name="dillerInvoice" value={hsdForm.dillerInvoice} onChange={(e) => setHsdForm({ ...hsdForm, dillerInvoice: e.target.value })} required />
                        </div>
                    </div>

                    <h4 style={{ marginTop: "15px" }}>Upload Signatures</h4>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
                        <div>
                            <label>Security Signature</label><br />
                            <input type="file" accept="image/*" onChange={(e) => handleSignUpload(e, "securitySign")} />
                            {hsdForm.securitySign && <img src={hsdForm.securitySign} alt="Security Sign" width={80} />}
                        </div>
                        <div>
                            <label>O&M Signature</label><br />
                            {/* <input type="file" accept="image/*" onChange={(e) => handleSignUpload(e, "omSign")} /> */}
                            {siteConfig.omSign && <img src={siteConfig.omSign} alt="OM Sign" width={80} />}
                        </div>
                        <div>
                            <label>Manager Signature</label><br />
                            {/* <input type="file" accept="image/*" onChange={(e) => handleSignUpload(e, "managerSign")} /> */}
                            {siteConfig.managerSign && <img src={siteConfig.managerSign} alt="Manager Sign" width={80} />}
                        </div>
                    </div>

                    <div style={{ marginTop: "15px" }}>
                        <button type="button" onClick={() => setPreviewOpen(true)}>👁️ Preview</button>
                        <button type="button" style={{ marginLeft: "10px" }} onClick={() => generateHSDReport()}>📄 Generate HSD Report</button>
                    </div>
                </div>
            )}

            {previewOpen && (
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
                    <HSDPrintTemplate
                        form={form}
                        hsdForm={hsdForm}
                        siteConfig={siteConfig}
                        setPreviewOpen={setPreviewOpen}
                    />
                </div>
            )}

        </div>
    );
};

export default DGLogForm;
