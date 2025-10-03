// src/components/DGLogForm.js
import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, doc, setDoc, serverTimestamp, getDocs, query, orderBy, limit, where } from "firebase/firestore";
import { oemDieselCphData } from "../config/oemDieselCphData";


// Helper to format today as YYYY-MM-DD
const getTodayDate = () => {
    const d = new Date();
    return d.toISOString().split("T")[0];
};

const DGLogForm = ({ userData }) => {
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

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
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

    const calculateFuel = () => {
        if (!dgCapacity || !dgKw || !dgHmr) {
            setCalculationResult("Please fill all fields");
            return;
        }

        const capacity = parseFloat(dgCapacity);
        const kw = parseFloat(dgKw);
        const hmr = parseFloat(dgHmr);

        // Calculating kWh
        const dgKwh = kw / hmr;

        // Calculating percentage of DG running
        const runPercent = (dgKwh / (capacity * 0.8)) * 100;
        const roundedPercent = Math.round(runPercent);

        // List of missing percentage columns
        const missingColumnList = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 18, 20, 21, 23, 24, 25, 26, 29, 36];

        let result = `\n*********This Is For You*********\n\n`;
        result += `🖋 DG Run Percentage: ${roundedPercent}%....\n`;

        if (missingColumnList.includes(roundedPercent)) {
            const adjustableCPH = hmr * 80;
            const segr = kw / adjustableCPH;
            const reqSegr = 3;

            if (segr < reqSegr) {
                let x;
                for (x = 1; x < adjustableCPH; x++) {
                    const adjusFuel = 3 * x;
                    if (adjusFuel >= kw) {
                        break;
                    }
                }
                const finalSegr = kw / x;

                result += `🖋 As per Load % OEM Diesel CPH: OEM CPH Data Not Available for ${roundedPercent}% Load....\n`;
                result += `🖋 Achieve CPH as per Physical Inspection: 80.00 ltrs/Hour....\n`;
                result += `🖋 Total Fuel Consumption for ${hmr * 60} Minutes DG Running: ${adjustableCPH.toFixed(2)} Ltrs....\n`;
                result += `🖋 On Load/Off Load Consumption Details: On Load ${x} ltrs / Off Load ${(adjustableCPH - x).toFixed(2)} ltrs\n`;
                result += `🖋 SEGR Value: ${finalSegr.toFixed(2)} kW/Ltrs.... as per On Load Consumption\n`;
            } else {
                result += `🖋 As per Load % OEM Diesel CPH: OEM CPH Data Not Available for ${roundedPercent}% Load....\n`;
                result += `🖋 Achieve CPH as per Physical Inspection: 80.00 ltrs/Hour....\n`;
                result += `🖋 Total Fuel Consumption for ${hmr * 60} Minutes DG Running: ${adjustableCPH.toFixed(2)} Ltrs....\n`;
                result += `🖋 SEGR Value: ${segr.toFixed(2)} kW/Ltrs....\n`;
            }
        } else {
            const rowIndex = findRowDgCapacity(capacity);
            const oDCPH = oemDieselCphData[`${roundedPercent}%`][rowIndex];
            const totalFuelConsumption = (oDCPH * 1.15) * hmr;
            const segr = kw / totalFuelConsumption;
            const cph = totalFuelConsumption / hmr;

            result += `🖋 As per Load % OEM Diesel CPH: ${oDCPH.toFixed(2)} ltrs/Hour....\n`;
            result += `🖋 Achieve CPH as per Physical Inspection: ${cph.toFixed(2)} ltrs/Hour....\n`;
            result += `🖋 Total Fuel Consumption for ${hmr * 60} Minutes DG Running: ${totalFuelConsumption.toFixed(2)} Ltrs....\n`;
            result += `🖋 SEGR Value: ${segr.toFixed(2)} kW/Ltrs....\n`;
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
    }, [dgNumber, userData.site]);


    return (
        <div className="daily-log-container">
            <h2 className="dashboard-header">
                <strong>🎯 Daily DG Log Entry - {userData.site}</strong>
            </h2>
            <button
                className="segr-manage-btn"
                onClick={() => setShowFuelModal(true)}
                style={{ width: "100%" }}
            >
                💥 Cummins DG CPH/SEGR Manager
            </button>

            {showFuelModal && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '600px' }}>
                        <h1>Cummins DG CPH/SEGR Monitor</h1>
                        <h3>WB-AirtelMSCs</h3>

                        <div className="form-group">
                            <label>Select DG Capacity:</label>
                            <select
                                value={selectedCapacity}
                                onChange={(e) => {
                                    setSelectedCapacity(e.target.value);
                                    setDgCapacity(parseFloat(e.target.value));
                                }}
                                className="form-control"
                            >
                                <option value="">Select Capacity</option>
                                {dgCapacityOptions.map((option, index) => (
                                    <option key={index} value={parseFloat(option)}>{option}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Enter DG Generated kW:</label>
                            <input
                                type="number"
                                value={dgKw}
                                onChange={(e) => setDgKw(e.target.value)}
                                className="form-control"
                                placeholder="Enter kW"
                            />
                        </div>

                        <div className="form-group">
                            <label>Enter DG Hour Meter Reading:</label>
                            <input
                                type="number"
                                value={dgHmr}
                                onChange={(e) => setDgHmr(e.target.value)}
                                className="form-control"
                                placeholder="Enter hours"
                                step="0.1"
                            />
                        </div>

                        <div className="button-group">
                            <button
                                onClick={calculateFuel}
                                className="btn-primary"
                            >
                                Calculate
                            </button>
                            <button
                                onClick={() => {
                                    setShowFuelModal(false);
                                    setCalculationResult("");
                                }}
                                className="btn-secondary"
                            >
                                Close
                            </button>
                        </div>

                        {calculationResult && (
                            <div className="result-container">
                                <h4>Calculation Results:</h4>
                                <pre>{calculationResult}</pre>
                            </div>
                        )}
                    </div>
                </div>
            )}
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
                    <span style={{fontSize:"10px", color:"#030a44ff"}}>(e.g.:- DG-1, DG-2, DG-3)</span>
                    <select
                        name="dgNumber"
                        value={dgNumber}
                        onChange={(e) => {
                            setDgNumber(e.target.value);   // update DG state
                            setForm((prev) => ({ ...prev, dgNumber: e.target.value })); // keep form in sync
                        }}
                        className="w-full p-2 border rounded"
                    >
                        <option value="DG-1">DG-1</option>
                        <option value="DG-2">DG-2</option>
                    </select>
                </label>

                <label className="form-label">Remarks:
                    <span style={{fontSize:"10px", color:"yellow"}}>(e.g.:- ON/NO Load & Fuel Filling Only)</span>
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

                <div className="grid grid-cols-2 gap-2">
                    <label className="form-label">Hr Meter Start:
                    <span style={{fontSize:"10px", color:"#030a44ff"}}>(e.g.:- '1800.00', It fetch auto only check during fill)</span>
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
                    <span style={{fontSize:"10px", color:"yellow"}}>(e.g.:- '1800.1')</span>
                        <input
                            type="number"
                            step="0.1"
                            name="hrMeterEnd"
                            value={form.hrMeterEnd}
                            onChange={handleChange}
                            placeholder="Hr meter end"
                            className="p-2 border rounded"
                            required
                        />
                    </label>
                </div>
                
                <label className="form-label">Fuel Consumption (Liters):
                    <span style={{fontSize:"10px", color:"#851010ff"}}>(e.g.:- Opening Fuel - Closing Fuel = Fuel Consumption)</span>
                    <input
                        type="number"
                        step="0.1"
                        name="fuelConsumption"
                        value={form.fuelConsumption || 0}
                        onChange={handleChange}
                        placeholder="Fuel consumption (L)"
                        className="w-full p-2 border rounded"
                        required
                    />
                </label>
                <label className="form-label">Reading (kWH):
                    <span style={{fontSize:"10px", color:"#0a4604ff"}}>(e.g.:- Opening kWh - Closing kWh = Reading)</span>
                    <input
                        type="number"
                        step="0.1"
                        name="kWHReading"
                        value={form.kWHReading || 0}
                        onChange={handleChange}
                        placeholder="Generated kWH"
                        className="w-full p-2 border rounded"
                        required
                    />
                </label>
                <label className="form-label">Fuel Filling (Liters):
                    <span style={{fontSize:"10px", color:"yellow"}}>(e.g.:- Skip it('0') if Fuel not fill)</span>
                    <input
                        type="number"
                        step="0.1"
                        name="fuelFill"
                        value={form.fuelFill || 0}
                        onChange={handleChange}
                        placeholder="Add fuel filling (L)"
                        className="w-full p-2 border rounded"
                        required
                    />
                </label>
                <button
                    type="submit"
                    className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
                >
                    Save Log
                </button>
            </form>
        </div>
    );
};

export default DGLogForm;
