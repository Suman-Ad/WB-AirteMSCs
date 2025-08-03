// src/pages/ExcelLiveEditPage.js
import React, { useEffect, useState } from "react";
import { Tabs, Tab } from "@mui/material";
import { ExcelSheetEditor, sheetTemplates } from "../components/ExcelSheetEditor";
import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import "../assets/ExcelLiveEditPage.css";

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
  const [selectedTab, setSelectedTab] = useState("A_Final Summary");
  const [sheetData, setSheetData] = useState({});
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const dateId = selectedDate;
  const siteId = userData?.site;

  useEffect(() => {
    const fetchSheet = async () => {
      if (!siteId) {
        console.error("Missing site ID in userData!");
        setLoading(false);
        return;
      }

      setLoading(true);
      const ref = doc(db, "excel_data_by_date", dateId, "sites", siteId);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        setSheetData(snap.data());
      } else {
        const defaultData = {};
        Object.values(sheetKeys).forEach((key) => {
          const template = sheetTemplates[key];
          defaultData[key] = template ? template.map((row) => ({ ...row })) : [];
        });

        await setDoc(doc(db, "excel_data_by_date", dateId), {
          createdAt: new Date().toISOString(),
        }, { merge: true });

        await setDoc(ref, {
          site: siteId,
          date: today,
          ...defaultData,
        });

        setSheetData({ site: siteId, date: today, ...defaultData });
      }

      setLoading(false);
    };

    fetchSheet();
  }, [siteId, dateId]);

  const handleSheetUpdate = async (key, rows) => {
    const ref = doc(db, "excel_data_by_date", dateId, "sites", siteId);
    const timestampKey = `lastUpdated_${key}`;
    const now = new Date().toISOString();
    await setDoc(ref, {
      ...sheetData,
      [key]: rows,
      [timestampKey]: now,
    });
    setSheetData((prev) => ({
      ...prev,
      [key]: rows,
      [timestampKey]: now,
    }));
  };

  // useEffect(() => {
  //   window.alert(
  //     "Dear My All Team Members, This Daily Details Data on Upgradation Stage. Please try to fill data for Fixing Issues . \nThanks & Regards\n@Suman Adhikari"
  //   );
  // }, []);

  const getSheetStatus = (rows) => {
    if (!Array.isArray(rows) || rows.length === 0) return { status: "Empty", color: "red", filled: 0, total: 0 };
    const keys = Object.keys(rows[0]);
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

  return (
    <div className="excel-live-edit-container">
      <h2>📘 Daily Details Dashboard Of WB Circle Location: {siteId || "Unknown Site"}</h2>

      <div style={{ marginBottom: "1rem" }}>
        <label>Select Date: </label>
        <input
          type="date"
          value={selectedDate}
          max={today}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>

      <div className="tab-scroll-container">
        <Tabs
          value={selectedTab}
          onChange={(e, val) => setSelectedTab(val)}
          variant="scrollable"
        >
          {Object.entries(sheetKeys).map(([label, key]) => {
            const rows = sheetData[key] || [];
            const { status, color, filled, total } = getSheetStatus(rows);
            const percentage = total ? Math.round((filled / total) * 100) : 0;
            return (
              <Tab
                key={label}
                label={
                  <span className={`sheet-tab ${status.toLowerCase()}`}>
                    {label} <br />
                    <small style={{ color }}>{status} ({percentage}%)</small>
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
          <div className="sheet-editor-scroll">
            <ExcelSheetEditor
              sheetKey={sheetKeys[selectedTab]}
              rows={sheetData[sheetKeys[selectedTab]] || []}
              lastUpdated={sheetData[`lastUpdated_${sheetKeys[selectedTab]}`]}
              onSave={(rows) => handleSheetUpdate(sheetKeys[selectedTab], rows)}
              userData={userData}
              selectedDate={selectedDate}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ExcelLiveEditPage;
