// src/components/DGLogForm.js
import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, doc, setDoc, serverTimestamp, getDocs, query, orderBy, limit, where, getDoc, addDoc, updateDoc } from "firebase/firestore";
import { oemDieselCphData } from "../config/oemDieselCphData";
import { useNavigate, useLocation } from "react-router-dom";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { saveAs } from "file-saver";
import HSDPrintTemplate from "../components/HSDPrintTemplate";
// import { toast } from "react-toastify";
// import "react-toastify/dist/ReactToastify.css";


// Helper to format today as YYYY-MM-DD
const getTodayDate = () => {
    const d = new Date();
    return d.toISOString().split("T")[0];
};

const DGLogForm = ({ userData }) => {
    const [siteConfig, setSiteConfig] = useState({});
    const siteKey = userData?.site?.toUpperCase();
    const [dgNumber, setDgNumber] = useState("DG-1");
    const [form, setForm] = useState({
        date: getTodayDate(),
        dgNumber: "DG-1",
        startTime: "",
        stopTime: "",
        hrMeterStart: "",
        hrMeterEnd: "",
        kwhMeterStart: "",
        kwhMeterEnd: "",
        remarks: "No Load",
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
        securityId: "",        // ✅ ADD THIS
        securityName: "",
        density: "",
        temperature: "",
        ltrs: "",
        dillerInvoice: "",
        transactionId: "",
        securitySign: null,
        omSign: null,
        managerSign: null
    });

    const [previewOpen, setPreviewOpen] = useState(false);

    const fetchHsdForEdit = async () => {
        const q = query(
            collection(db, "dgHsdLogs", userData.site, "entries"),
            where("date", "==", form.date),
            limit(1)
        );

        const snap = await getDocs(q);
        if (!snap.empty) {
            const docSnap = snap.docs[0];
            setHsdForm({ id: docSnap.id, ...docSnap.data() });
        }
    };

    const navigate = useNavigate();
    const { state } = useLocation();
    // const isEdit = state?.editMode;
    const isEditMode = Boolean(state?.editMode);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [calcNumbers, setCalcNumbers] = useState({
        segr: 0,
        dgRunPercentage: 0,
        cph: 0,
        oemCPH: "",
    });

    const [totalFuelFilledDGCount, setTotalFuelFilledDGCount] = useState(0);
    const [totalFilledFuelBefore, setTotalFilledFuelBefore] = useState(0);
    const [fieldDGNumbers, setFieldDGNumbers] = useState([]);
    const [fuelFilledDGs, setFuelFilledDGs] = useState([]);
    const dgFillProgress = `${fuelFilledDGs.length} / ${fieldDGNumbers.length}`;
    const fromHistoryRunId = state?.runId;

    const isLastDGFill =
        form.remarks === "Fuel Filling Only" &&
        fieldDGNumbers.length > 0 &&
        fuelFilledDGs.length === fieldDGNumbers.length - 1;

    const isDGSelectionDisabled =
        isEditMode || (form.remarks === "Fuel Filling Only" && isLastDGFill) || fromHistoryRunId;

    const fetchTotalFuelFilledForDate = async (date) => {
        if (!userData?.site || !date) return;

        const dateObj = new Date(date);
        const monthKey =
            dateObj.toLocaleString("en-US", { month: "short" }) +
            "-" +
            dateObj.getFullYear();

        const runsRef = collection(
            db,
            "dgLogs",
            userData.site,
            monthKey,
            date,
            "runs"
        );

        const snap = await getDocs(
            query(runsRef, where("remarks", "==", "Fuel Filling Only"))
        );

        let sum = 0;
        snap.forEach((d) => {
            if (isEditMode && d.id === state?.logData?.id) return; // 🛑 skip self
            const data = d.data();
            sum += Number(data.fuelFill || 0);
        });

        setTotalFilledFuelBefore(sum);
    };

    const fetchFuelFilledDGNumbers = async (date) => {
        if (!userData?.site || !date) return;

        const dateObj = new Date(date);
        const monthKey =
            dateObj.toLocaleString("en-US", { month: "short" }) +
            "-" +
            dateObj.getFullYear();

        const runsRef = collection(
            db,
            "dgLogs",
            userData.site,
            monthKey,
            date,
            "runs"
        );

        const q = query(
            runsRef,
            where("remarks", "==", "Fuel Filling Only")
        );

        const snap = await getDocs(q);

        const filledDGs = [];
        snap.forEach((doc) => {
            const data = doc.data();
            if (data.dgNumber) {
                filledDGs.push(data.dgNumber);
            }
        });

        setFuelFilledDGs(filledDGs);
    };


    useEffect(() => {
        if (form.remarks === "Fuel Filling Only") {
            setCalcNumbers({ segr: 0, dgRunPercentage: 0, cph: 0, oemCPH: "" });
        }
    }, [form.remarks]);

    useEffect(() => {
        if (isEditMode && form.remarks === "Fuel Filling Only") {
            fetchHsdForEdit();
        }
        if (!isEditMode && form.remarks === "Fuel Filling Only") {
            fetchTodayFuelFilledDGCount(form.date);
            fetchTotalFuelFilledForDate(form.date);
        }
    }, [isEditMode, form.date, form.remarks]);

    useEffect(() => {
        if (
            form.remarks === "Fuel Filling Only" &&
            (isLastDGFill || !isEditMode)
        ) {
            const totalLtrs =
                Number(totalFilledFuelBefore || 0) + Number(form.fuelFill || 0);

            setHsdForm((prev) => ({
                ...prev,
                ltrs: totalLtrs > 0 ? totalLtrs : prev.ltrs,
            }));
        }
    }, [form.fuelFill, totalFilledFuelBefore, isLastDGFill, isEditMode]);

    useEffect(() => {
        if (!siteConfig?.dgCount) {
            setFieldDGNumbers([]);
            return;
        }

        const dgList = Array.from(
            { length: siteConfig.dgCount },
            (_, i) => `DG-${i + 1}`
        );

        setFieldDGNumbers(dgList);
    }, [siteConfig.dgCount]);

    useEffect(() => {
        if (form.remarks === "Fuel Filling Only") {
            fetchFuelFilledDGNumbers(form.date);
        }
    }, [form.remarks, form.date]);


    const unfilledDGNumbers = fieldDGNumbers.filter(
        (dg) => !fuelFilledDGs.includes(dg)
    );

    useEffect(() => {
        if (form.remarks !== "Fuel Filling Only") return;

        // If all DGs are already filled → do nothing
        if (!unfilledDGNumbers.length) return;

        // If current DG already filled → auto-switch to next available DG
        if (fuelFilledDGs.includes(dgNumber)) {
            const nextDG = unfilledDGNumbers[0];

            setDgNumber(nextDG);
            setForm((prev) => ({
                ...prev,
                dgNumber: nextDG,
            }));
        }
    }, [form.remarks, fuelFilledDGs, fieldDGNumbers]);

    useEffect(() => {
        if (form.remarks !== "Fuel Filling Only") return;

        if (
            fieldDGNumbers.length > 0 &&
            fuelFilledDGs.length === fieldDGNumbers.length &&
            !isEditMode
        ) {
            alert("🚫 All DGs already fuel filled today");

            // Optional: reset remarks to avoid invalid entry
            setForm((prev) => ({
                ...prev,
                remarks: "No Load",
            }));
        }
    }, [form.remarks, fuelFilledDGs, fieldDGNumbers, isEditMode]);


    const handleChange = (e) => {
        const { name, value } = e.target;
        const numericFields = [
            "hrMeterStart",
            "hrMeterEnd",
            "fuelConsumption",
            "kwhMeterStart",
            "kwhMeterEnd",
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

    //For HSD Form work while lasting Fuel Filling DG Count
    const fetchTodayFuelFilledDGCount = async (date) => {
        if (!userData?.site || !date) return;

        const dateObj = new Date(date);
        const monthKey =
            dateObj.toLocaleString("en-US", { month: "short" }) +
            "-" +
            dateObj.getFullYear();

        const runsRef = collection(
            db,
            "dgLogs",
            userData.site,
            monthKey,
            date,
            "runs"
        );

        const q = query(
            runsRef,
            where("remarks", "==", "Fuel Filling Only")
        );

        const snap = await getDocs(q);

        setTotalFuelFilledDGCount(snap.size);
    };


    const uploadedBy = {
        uid: userData.uid,
        name: userData.name || "",
        role: userData.role,
        empId: userData.empId,
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
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

            const finalHrMeterEnd =
                form.remarks === "Fuel Filling Only"
                    ? (form.hrMeterStart)
                    : form.hrMeterEnd;

            if (isEditMode) {
                const logRef = doc(
                    db,
                    "dgLogs",
                    userData.site,
                    monthKey,
                    form.date,
                    "runs",
                    state.logData.id
                );
                if (isEditMode) {
                    const confirmUpdate = window.confirm("⚠️ Are you sure you want to UPDATE this DG log?");
                    if (!confirmUpdate) {
                        setIsSubmitting(false);
                        return;
                    }
                }

                // ✅ SAVE / UPDATE HSD ENTRY (SEPARATE COLLECTION)
                if (
                    form.remarks === "Fuel Filling Only" &&
                    (isLastDGFill || isEditMode)
                ) {
                    if (hsdForm?.id) {
                        // 🔁 UPDATE EXISTING HSD
                        const hsdRef = doc(
                            db,
                            "dgHsdLogs",
                            userData.site,
                            "entries",
                            hsdForm.id
                        );

                        await updateDoc(hsdRef, {
                            ...hsdForm,
                            date: form.date,
                            siteName: userData.site,
                            siteId: userData.siteId,
                            updatedAt: serverTimestamp(),
                            updatedBy: uploadedBy,
                        });

                    } else {
                        // ➕ CREATE NEW HSD
                        const q = query(
                            collection(db, "dgHsdLogs", userData.site, "entries"),
                            where("date", "==", form.date),
                            limit(1)
                        );

                        const snap = await getDocs(q);

                        if (snap.empty) {
                            await addDoc(
                                collection(db, "dgHsdLogs", userData.site, "entries"),
                                {
                                    ...hsdForm,
                                    date: form.date,
                                    siteName: userData.site,
                                    siteId: userData.siteId,
                                    createdAt: serverTimestamp(),
                                    createdBy: uploadedBy,
                                }
                            );
                        }
                    }
                }

                await setDoc(
                    logRef,
                    {
                        ...form,
                        hrMeterEnd: finalHrMeterEnd,
                        totalRunHours:
                            form.remarks === "Fuel Filling Only"
                                ? 0
                                : (finalHrMeterEnd - form.hrMeterStart),

                        // ✅ ADD THIS (logic applies on UPDATE also)
                        segr:
                            form.remarks === "Fuel Filling Only"
                                ? 0
                                : calcNumbers.segr,

                        dgRunPercentage:
                            form.remarks === "Fuel Filling Only"
                                ? 0
                                : calcNumbers.dgRunPercentage,
                        cph:
                            form.remarks === "Fuel Filling Only"
                                ? 0
                                : calcNumbers.cph,

                        oemCPH:
                            form.remarks === "Fuel Filling Only" && form.remarks === "No Load"
                                ? "N/A"
                                : calcNumbers.oemCPH,

                        updatedBy: uploadedBy,
                        updatedAt: serverTimestamp(),
                    },
                    { merge: true }
                );
                alert("Log updated ✅");
                navigate("/dg-log-table")
            } else {

                // 🔥 SAVE HSD DATA ON EVERY FUEL FILLING
                if (form.remarks === "Fuel Filling Only" && (isLastDGFill || isEditMode)) {
                    const q = query(
                        collection(db, "dgHsdLogs", userData.site, "entries"),
                        where("date", "==", form.date),
                        limit(1)
                    );

                    const snap = await getDocs(q);

                    if (snap.empty) {
                        await addDoc(
                            collection(db, "dgHsdLogs", userData.site, "entries"),
                            {
                                ...hsdForm,
                                date: form.date,
                                siteId: userData.siteId,
                                siteName: userData.site,
                                createdAt: serverTimestamp(),
                                createdBy: uploadedBy,
                            }
                        );
                    }
                }

                await setDoc(doc(runsCollectionRef, runId), {
                    ...form,
                    hrMeterEnd: finalHrMeterEnd,
                    totalRunHours: form.remarks === "Fuel Filling Only" ? 0 : (finalHrMeterEnd - form.hrMeterStart),
                    remarks: form.remarks === "Fuel Filling Only" ? "Fuel Filling Only" : form.remarks,
                    siteId: userData.siteId,
                    // ✅ NEW — numeric & safe
                    segr: form.remarks === "Fuel Filling Only" ? 0 : calcNumbers.segr,
                    dgRunPercentage: form.remarks === "Fuel Filling Only" ? 0 : calcNumbers.dgRunPercentage,         // save calculation result snapshot
                    cph: form.remarks === "Fuel Filling Only" ? 0 : calcNumbers.cph,
                    oemCPH: form.remarks === "Fuel Filling Only" && form.remarks === "No Load" ? "N/A" : calcNumbers.oemCPH,
                    siteName: userData.site,
                    enteredBy: uploadedBy,
                    createdAt: serverTimestamp(),
                });

                // ✅ --- NEW: Ensure the parent date document exists with a field ---
                // This makes it visible to queries in DGLogTable.js
                await setDoc(dateDocRef, {
                    lastUpdated: serverTimestamp()
                }, { merge: true }); // Use merge:true to avoid overwriting other fields if you add them later


                alert("Run log saved ✅");
                // window.location.reload(); // Reload to reflect changes

                if (fromHistoryRunId) {
                    const historyRef = doc(
                        db,
                        "dgRunLogs",
                        userData.site,
                        "entries",
                        fromHistoryRunId
                    );

                    await updateDoc(historyRef, {
                        dgLogAdded: true,
                        dgLogId: runId,               // link to dgLogs
                        updatedAt: serverTimestamp(),
                        updatedBy: uploadedBy,
                    });
                }

                setForm({
                    date: "",
                    dgNumber: "DG-1",
                    startTime: "",
                    stopTime: "",
                    hrMeterStart: "",
                    hrMeterEnd: "",
                    kwhMeterStart: "",
                    kwhMeterEnd: "",
                    remarks: "No Load",
                    fuelConsumption: "",
                    kWHReading: "",
                    fuelFill: "",
                });
                navigate("/dg-log-table")
            }
        } catch (err) {
            console.error("Error saving log: ", err);
            alert("Something went wrong ❌");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Define this with your other constants (before the component)
    const [calculationResult, setCalculationResult] = useState("");

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
        setCalcNumbers(prev => ({
            ...prev,
            dgRunPercentage: roundedPercent,
        }));


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
                setCalcNumbers(prev => ({
                    ...prev,
                    segr: Number(segr.toFixed(2)),
                    cph: Number(cph.toFixed(2)),
                    oemCPH: `N/A for ${roundedPercent}%`
                }));
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
                    setCalcNumbers(prev => ({
                        ...prev,
                        segr: Number(finalSegr.toFixed(2)),
                        cph: Number(adjustableCPH.toFixed(2)),
                        oemCPH: `N/A for ${roundedPercent}%`
                    }));

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

            setCalcNumbers(prev => ({
                ...prev,
                segr: Number(segr.toFixed(2)),
                cph: Number(cph.toFixed(2)),
                oemCPH: oDCPH,
            }));

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
            if (isEditMode) return; // 🛑 STOP auto-fetch during edit

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
                    setForm((prev) => ({ ...prev, hrMeterStart: found.hrMeterEnd, kwhMeterStart: found.kwhMeterEnd }));
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
                    setForm((prev) => ({ ...prev, hrMeterStart: yfound.hrMeterEnd, kwhMeterStart: yfound.kwhMeterEnd }));
                }
            } catch (err) {
                console.error("Error fetching prev hrMeterStart:", err);
            }
        };

        if (state?.editMode && state?.logData) {
            setForm({
                ...state.logData,
                date: state.selectedDate,
            });
            setDgNumber(state.logData.dgNumber);
        }

        fetchPrevHrMeter();
        fetchConfig();
        // ✅ NEW
        fetchTodayFuelFilledDGCount(form.date);
    }, [dgNumber, userData.site, state, isEditMode]);


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

    const handleSecuritySelect = (securityId) => {
        const selected = siteConfig.securityTeam?.find(
            (s) => String(s.id) === String(securityId)
        );

        setHsdForm((prev) => ({
            ...prev,
            securityId: securityId,              // ✅ keep ID for select
            securityName: selected?.name || "",  // ✅ save name separately
            securitySign: selected?.signUrl || null
        }));
    };

    useEffect(() => {
        if (state?.autoFromDgStop) {
            setForm((prev) => ({
                ...prev,
                date: state.date || prev.date,
                dgNumber: state.dgNumber || prev.dgNumber,
                startTime: state.startTime || "",
                stopTime: state.stopTime || "",
                remarks: "On Load",
            }));

            setDgNumber(state.dgNumber || "DG-1");
        }
    }, [state]);

    useEffect(() => {
        if (state?.autoFromDgStop) {
            window.history.replaceState({}, document.title);
        }
    }, []);


    return (
        <div className="daily-log-container">
            <h2 className="dashboard-header">
                <strong>
                    🎯 {isEditMode ? "Update DG Log" : "Daily DG Log Entry"} - {userData.site}
                </strong>
            </h2>

            <form onSubmit={handleSubmit} className="daily-log-form">

                <label className="form-label">Date:
                    <input
                        type="date"
                        name="date"
                        value={form.date}
                        onChange={handleChange}
                        disabled={isEditMode || fromHistoryRunId}
                        className={`w-full p-2 border rounded ${isEditMode ? "bg-gray-200 cursor-not-allowed" : ""}`}
                        required
                    />

                </label>

                <label className="form-label">Operation Remarks:
                    <span style={{ fontSize: "10px", color: "yellow" }}>(e.g.:- ON/NO Load & Fuel Filling Only)</span>
                    <select
                        name="remarks"
                        value={form.remarks}
                        disabled={isEditMode || fromHistoryRunId}
                        onChange={handleChange}
                        className="w-full p-2 border rounded"
                    >
                        <option value="On Load" disabled={state.isDGOnLoad === false && !userData?.designation === "Vertiv Site Infra Engineer"}>On Load</option>
                        <option value="No Load">No Load</option>
                        <option value="Fuel Filling Only">Fuel Filling Only</option>
                    </select>
                </label>

                <label className="form-label">Select DG:
                    <span style={{ fontSize: "10px", color: "#030a44ff" }}>(e.g.:- DG-1, DG-2, DG-3)</span>
                    <select
                        name="dgNumber"
                        value={dgNumber}
                        disabled={isDGSelectionDisabled}
                        onChange={(e) => {
                            setDgNumber(e.target.value);
                            setForm((prev) => ({ ...prev, dgNumber: e.target.value }));
                        }}
                        className={`w-full p-2 border rounded ${isDGSelectionDisabled
                            ? "bg-gray-200 cursor-not-allowed"
                            : ""
                            }`}
                    >
                        <option value="">Select DG</option>

                        {fieldDGNumbers.map((dg) => (
                            <option key={dg} value={dg}>
                                {dg}
                            </option>
                        ))}
                    </select>
                    {form.remarks === "Fuel Filling Only" && (
                        <div
                            style={{
                                fontSize: "13px",
                                marginTop: "4px",
                                color:
                                    fuelFilledDGs.length === fieldDGNumbers.length
                                        ? "red"
                                        : "blue",
                            }}
                        >
                            📊 DG Fuel Filled: {dgFillProgress}
                        </div>
                    )}
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

                {/* Hr Meter/ kWH Meter */}
                <div className="grid grid-cols-2 gap-2">
                    {(form.remarks === "On Load") && (
                        <label className="form-label">Start Reading (kWH):
                            <span style={{ fontSize: "10px", color: "#0a4604ff" }}>(e.g.:- Opening kWh)</span>
                            <input
                                type="number"
                                step="0.1"
                                name="kwhMeterStart"
                                value={form.remarks === "Fuel Filling Only" ? 0 : form.kwhMeterStart}
                                onChange={handleChange}
                                placeholder="Start kwh reading"
                                className="w-full p-2 border rounded"
                                required
                            />
                        </label>
                    )}

                    {(form.remarks === "On Load") && (
                        <label className="form-label">End Reading (kWH):
                            <span style={{ fontSize: "10px", color: "#0a4604ff" }}>(e.g.:- Closing kWh)</span>
                            <input
                                type="number"
                                step="0.1"
                                name="kwhMeterEnd"
                                value={form.remarks === "Fuel Filling Only" ? 0 : form.kwhMeterEnd}
                                onChange={handleChange}
                                placeholder="End kwh reading"
                                className="w-full p-2 border rounded"
                                required
                            />
                        </label>
                    )}

                    {(form.remarks === "On Load") && (
                        <label className="form-label">Reading (kWH):
                            <span style={{ fontSize: "10px", color: "#0a4604ff" }}>(e.g.:- Closing kWh - Opening kWh = Reading)</span>
                            <input
                                type="number"
                                step="0.1"
                                name="kWHReading"
                                value={form.remarks === "Fuel Filling Only" ? 0 : form.kWHReading = Number(form.kwhMeterEnd - form.kwhMeterStart)}
                                onChange={handleChange}
                                placeholder="Generated kWH"
                                className="w-full p-2 border rounded"
                                required
                                disabled
                            />
                        </label>
                    )}
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
                    {(form.remarks === "On Load" || form.remarks === "No Load") && (
                        <label className="form-label">Hr Meter End:
                            <span style={{ fontSize: "10px", color: "yellow" }}>(e.g.:- '1800.1')</span>
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
                    )}

                    {(form.remarks === "On Load" || form.remarks === "No Load") && (
                        <label className="form-label">Total Hr Meter:
                            <span style={{ fontSize: "10px", color: "yellow" }}>(e.g.:- '1.0')</span>
                            <input
                                type="number"
                                step="0.1"
                                name="totalHRMeter"
                                value={(form.hrMeterEnd - form.hrMeterStart).toFixed(1)}
                                onChange={handleChange}
                                placeholder="Hr meter end"
                                className="p-2 border rounded"
                                required
                                disabled
                            />

                        </label>
                    )}


                </div>

                {(form.remarks === "On Load" || form.remarks === "No Load") && (
                    <label className="form-label">Fuel Consumption (Liters):
                        <span style={{ fontSize: "10px", color: "#851010ff" }}>(e.g.:- Opening Fuel - Closing Fuel = Fuel Consumption)</span>
                        <input
                            type="number"
                            step="0.1"
                            name="fuelConsumption"
                            value={form.fuelConsumption}
                            onChange={handleChange}
                            placeholder="Fuel consumption (L)"
                            className="w-full p-2 border rounded"
                            required
                        />
                    </label>
                )}

                {form.remarks === "Fuel Filling Only" && (
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
                    </label>)}

                {form.remarks === "Fuel Filling Only" && (isLastDGFill || (isEditMode && fuelFilledDGs.length === fieldDGNumbers.length)) && (
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
                                <input
                                    type="number"
                                    name="ltrs"
                                    value={
                                        hsdForm.ltrs !== "" && hsdForm.ltrs !== null
                                            ? hsdForm.ltrs
                                            : ""
                                    }
                                    disabled={!isEditMode}
                                    className={!isEditMode ? "bg-gray-100" : ""}
                                    required
                                />

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
                                <label>Accepted Invoice/Delivery challan number</label>
                                <input type="text" name="dillerInvoice" value={hsdForm.dillerInvoice} onChange={(e) => setHsdForm({ ...hsdForm, dillerInvoice: e.target.value })} required />
                            </div>
                            <div>
                                <label>Transaction ID Number</label>
                                <input type="text" name="transactionId" value={hsdForm.transactionId} onChange={(e) => setHsdForm({ ...hsdForm, transactionId: e.target.value })} required />
                            </div>
                            <div>
                                <label>Security Name</label>
                                <select
                                    name="securityId"
                                    value={hsdForm.securityId}   // ✅ VALUE IS ID
                                    onChange={(e) => handleSecuritySelect(e.target.value)}
                                    required
                                    style={{ padding: "6px", borderRadius: "6px", border: "1px solid #ccc" }}
                                >
                                    <option value="">Select Security</option>
                                    {siteConfig.securityTeam?.map((sec) => (
                                        <option key={sec.id} value={sec.id}>
                                            {sec.name} ({sec.role})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <h4 style={{ marginTop: "15px" }}>Upload Signatures</h4>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
                            <div>
                                <label>Security Signature</label><br />
                                {hsdForm.securitySign ? (
                                    <img src={hsdForm.securitySign} alt="Security Sign" width={80} />
                                ) : (
                                    <p style={{ fontSize: "12px", color: "#777" }}>No signature selected</p>
                                )}
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
                            <button type="button" onClick={() => setPreviewOpen(true)}>👁️ Preview & Save PDF</button>
                            {/* <button type="button" style={{ marginLeft: "10px" }} onClick={() => generateHSDReport()}>📄 Generate HSD Report</button> */}
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

                {calculationResult && (
                    <div className="child-container">
                        <h2 style={{ fontSize: "20px", borderBottom: "3px solid #eee" }}><strong>🔢 {siteConfig.dgCapacity}kVA</strong> Cummins DG CPH/SEGR Calculation Results:</h2>
                        <pre >{calculationResult}</pre>
                    </div>
                )}
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`w-full p-2 rounded text-white ${isSubmitting ? "bg-gray-400 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600"
                        }`}
                >
                    {isSubmitting
                        ? isEditMode
                            ? "Updating...."
                            : "Saving...."
                        : isEditMode
                            ? "UPDATE"
                            : "SAVE"}
                </button>

            </form>



        </div>
    );
};

export default DGLogForm;
