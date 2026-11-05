// src/pages/ExcelLiveEditPage.js
import React, { useEffect, useMemo, useState } from "react";
import FinalSummary from "../components/FinalSummary";
import { Tabs, Tab } from "@mui/material";
import ExcelSheetEditor, { sheetTemplates, siteWiseDefaults }  from "../components/ExcelSheetEditor";
import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import "../assets/ExcelLiveEditPage.css";
import useDailyDashboardAutofill from "../hooks/useDailyDashboardAutofill";
import { fillDieselIdentity, getISTDate, mergeDailyAutofill } from "../utils/dailyDashboardAutofill";

const sheetKeys = {
  "Final Summary": "Final_Summary",
  "Diesel Back Up": "Diesel_Back_Up",
  "DG-EB Backup": "DG_EB_Backup",
  "Infra Update": "Infra_Update",
  "Fault Details": "Fault_Details",
  "Planned Activity Details": "Planned_Activity_Details",
  "Manpower Availability": "Manpower_Availability",
  "Sheet1": "Sheet1",
  "In House PM": "In_House_PM",
  "Sheet2": "Sheet2",
  "OEM PM": "OEM_PM",
  "Operational Governance Call": "Operational_Governance_Call",
};

const ExcelLiveEditPage = ({ userData }) => {
  const [selectedTab, setSelectedTab] = useState("Diesel Back Up");
  const [sheetData, setSheetData] = useState({});
  const [loading, setLoading] = useState(true);
  const today = getISTDate();
  const [selectedDate, setSelectedDate] = useState(today);
  const dateId = selectedDate;
  const siteId = userData?.site;

  const { patches, error: autofillError } = useDailyDashboardAutofill(siteId ? [siteId] : [], selectedDate, Boolean(userData?.role) && userData.role !== "User");
  const [autofillSaveError, setAutofillSaveError] = useState("");

  // Display source updates immediately, independently of the background save.
  const displayedSheetData = useMemo(() => {
    const next = mergeDailyAutofill(sheetData, patches[siteId] || {});
    if (next.Diesel_Back_Up?.length) next.Diesel_Back_Up = next.Diesel_Back_Up.map(row => fillDieselIdentity(row, userData));
    return next;
  }, [sheetData, patches, siteId, userData]);
  const fuelCalculation = patches[siteId]?.Diesel_Back_Up?.[0]?.__fuelCalculation;

  useEffect(() => {
    if (loading || !siteId || !userData?.role || userData.role === "User") return;
    const next = mergeDailyAutofill(sheetData, patches[siteId] || {});
    if (next.Diesel_Back_Up?.length) {
      next.Diesel_Back_Up = next.Diesel_Back_Up.map(row => fillDieselIdentity(row, userData));
    }
    const changed = [...new Set([...Object.keys(patches[siteId] || {}), "Diesel_Back_Up"])].filter(key => JSON.stringify(next[key]) !== JSON.stringify(sheetData[key]));
    if (!changed.length) return;
    let active = true;
    const fields = Object.fromEntries(changed.map(key => [key, next[key]]));
    setDoc(doc(db, "excel_data_by_date", dateId, "sites", siteId), fields, { merge: true })
      .then(() => { if (active) { setSheetData(previous => ({ ...previous, ...fields })); setAutofillSaveError(""); } })
      .catch(error => { if (active) setAutofillSaveError(`Autofill could not be saved: ${error.message}`); });
    return () => { active = false; };
  }, [patches, siteId, dateId, loading, sheetData, userData]);

  useEffect(() => {
    let active = true;
    const fetchSheet = async () => {
      if (!siteId) {
        console.error("Missing site ID in userData!");
        setLoading(false);
        return;
      }

      setLoading(true);
      const ref = doc(db, "excel_data_by_date", dateId, "sites", siteId);
      const snap = await getDoc(ref);

      if (!active) return;
      if (snap.exists()) {
        setSheetData(snap.data());
      } else {
        // build default data from templates
        const defaultData = {};
        Object.values(sheetKeys).forEach((key) => {
          const template = sheetTemplates[key];
          defaultData[key] = template ? template.map(row => ({ ...row })) : [];
        });

        Object.entries(siteWiseDefaults.Diesel_Back_Up || {}).forEach(([key, values]) => {
          if (values[siteId] !== undefined) defaultData.Diesel_Back_Up[0][key] = values[siteId];
        });

        defaultData.Diesel_Back_Up = defaultData.Diesel_Back_Up.map(row => fillDieselIdentity(row, userData));

        // ensure parent date doc exists
        await setDoc(doc(db, "excel_data_by_date", dateId), {
          createdAt: new Date().toISOString(),
        }, { merge: true });

        // set site doc with default data
        await setDoc(ref, {
          site: siteId,
          date: dateId,
          ...defaultData,
        }, { merge: true });

        if (!active) return;
        setSheetData({ site: siteId, date: dateId, ...defaultData });
      }

      setLoading(false);
    };

    fetchSheet().catch(error => { if (active) { setAutofillSaveError(error.message); setLoading(false); } });
    return () => { active = false; };
  }, [siteId, dateId]);
  

  const handleSheetUpdate = async (key, rows) => {
    if (!siteId) return;
    const ref = doc(db, "excel_data_by_date", dateId, "sites", siteId);
    const timestampKey = `lastUpdated_${key}`;
    const now = new Date().toISOString();

    // Save the raw rows (with formulas preserved). Use merge to only update the site doc fields.
    await setDoc(ref, {
      [key]: rows,
      [timestampKey]: now,
      site: siteId,
    }, { merge: true });

    // update local state
    setSheetData(prev => ({ ...prev, [key]: rows, [timestampKey]: now }));
  };

  const getSheetStatus = (rows) => {
    if (!Array.isArray(rows) || rows.length === 0) return { status: "Empty", color: "red", filled: 0, total: 0 };
    const keys = Object.keys(rows[0]).filter(key => !key.startsWith("__"));
    const total = rows.length * keys.length;
    let filled = 0;
    rows.forEach(row => {
      keys.forEach(k => {
        if (row[k] !== "" && row[k] !== null && row[k] !== undefined) filled++;
      });
    });
    if (filled === 0) return { status: "Empty", color: "red", filled, total };
    if (filled < total) return { status: "Partial", color: "orange", filled, total };
    return { status: "Complete", color: "green", filled, total };
  };

  if (userData.role === "User") {
    return <h3 style={{ padding: "2rem", color: "crimson" }}>🚫 You don't have access to this dashboard.</h3>;
  }

  return (
    <div className="dhr-dashboard-container">
      <h2 className="dashboard-header">📘 Daily Details Dashboard Of WB Circle Location: {siteId || "Unknown Site"}</h2>

      <p>Reporting period: previous day 4 PM to selected date 4 PM (IST). DG tank stock is opening fuel minus the selected day’s saved run consumption. External stock uses the latest saved DG log on or before the selected date (this month or the previous month). Both update automatically. DG and power-failure hours update from the selected day’s saved runs without waiting for 4 PM. Activities without start times use their scheduled date.</p>
      {(autofillError || autofillSaveError) && <p role="alert">{autofillError || autofillSaveError}</p>}
      <div style={{ marginBottom: "1rem" }}>
        <label>Select Date: </label>
        <input
          type="date"
          value={selectedDate}
          max={today}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>

      <div className="tab-scroll-container child-container">
        <Tabs
          value={selectedTab}
          onChange={(e, val) => setSelectedTab(val)}
          variant="scrollable"
        >
          {Object.entries(sheetKeys).map(([label, key]) => {
            const isSummary = key === "Final_Summary";
            const rows = displayedSheetData[key] || [];
            const { status, color, filled, total } = getSheetStatus(rows);
            const percentage = total ? Math.round((filled / total) * 100) : 0;
            return (
              <Tab
                key={label}
                label={
                  <span className={`sheet-tab ${isSummary ? "complete" : status.toLowerCase()}`}>
                    {label} <br />
                    <small style={isSummary ? undefined : { color }}>{isSummary ? "Calculated" : `${status} (${percentage}%)`}</small>
                  </span>
                }
                value={label}
              />
            );
          })}
        </Tabs>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="sheet-editor-scroll chart-container">
            {selectedTab === "Final Summary" ? (
              <FinalSummary siteData={{ [siteId]: displayedSheetData }} selectedDate={selectedDate} title={`Final Summary — ${siteId}`} />
            ) : (
              <>
              {selectedTab === "Fault Details" && <p>Faults sync from Incident Dashboard for this site and reporting window, including carried-over open incidents. Update imported details in Incident Dashboard. Manual fault entries are retained.</p>}
              {selectedTab === "Diesel Back Up" && fuelCalculation && (
                <p role="status">DG tank stock: {fuelCalculation.opening} L opening − {fuelCalculation.consumption} L consumption ({fuelCalculation.runs} DGLogTable runs for {selectedDate}) = <strong>{fuelCalculation.stock} L</strong>.</p>
              )}
              <ExcelSheetEditor
                key={`${siteId}-${selectedDate}-${selectedTab}`}
                sheetKey={sheetKeys[selectedTab]}
                rows={displayedSheetData[sheetKeys[selectedTab]] || []}
                lastUpdated={sheetData[`lastUpdated_${sheetKeys[selectedTab]}`]}
                onSave={(rows) => handleSheetUpdate(sheetKeys[selectedTab], rows)}
                userData={userData}
                selectedDate={selectedDate}
                allSheetsData={displayedSheetData}
              />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExcelLiveEditPage;
