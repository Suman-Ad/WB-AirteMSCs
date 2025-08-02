import React, { useEffect, useState } from "react";
import { Tabs, Tab } from "@mui/material";
import ExcelSheetEditor from "../components/ExcelSheetEditor";
import { db } from "../firebase";
import {
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import "../assets/ExcelLiveEditPage.css"; // Assuming you have some styles

const sheetKeys = {
  "A_Final Summary": "Final_Summary",
  "B_Diesel Back Up": "Diesel_Back_Up",
  "C_DG-EB Backup": "DG_EB_Backup",
  "D_Infra Update": "Infra_Update",
  "E_Fault Details": "Fault_Details",
  "F_Planned Activity Details": "Planned_Activity_Details",
  "F_Manpower Availability": "Manpower_Availability",
  "F_Sheet1": "Sheet1",
  "F_In House PM": "In_House_PM",
  "F_Sheet2": "Sheet2",
  "F_OEM PM": "OEM_PM",
  "F_Operational Governance Call": "Operational_Governance_Call",
};

const ExcelLiveEditPage = ({ userData }) => {
  const [selectedTab, setSelectedTab] = useState("A_Final Summary");
  const [sheetData, setSheetData] = useState({});
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split("T")[0]; // "2025-08-01"
  const docId = `${userData.site}_${today}`;

  const fetchSheet = async () => {
    setLoading(true);
    const ref = doc(db, "excel_data", docId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      setSheetData(snap.data());
    } else {
      // Init empty rows
      const defaultData = {};
      Object.values(sheetKeys).forEach((key) => {
        defaultData[key] = Array(5).fill({ slNo: "", parameter: "", status: "", remark: "" });
      });
      await setDoc(ref, {
        site: userData.site,
        date: today,
        ...defaultData,
      });
      setSheetData({ site: userData.site, date: today, ...defaultData });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSheet();
  }, []);

  const handleSheetUpdate = async (key, rows) => {
    const ref = doc(db, "excel_data", docId);
    await setDoc(ref, { ...sheetData, [key]: rows });
    setSheetData((prev) => ({ ...prev, [key]: rows }));
  };

  useEffect(() => {
    window.alert("Dear All, It is Under Maintenance Please Don't Put Any Data. Thanks & Regards @Suman Adhikari");
  }, []);

  return (
    <div className="excel-live-edit-container">
      <h2>📘 Excel Daily Entry: {userData.site}</h2>

      <div className="tab-scroll-container">
        <Tabs value={selectedTab} onChange={(e, val) => setSelectedTab(val)} variant="scrollable">
          {Object.keys(sheetKeys).map((name) => (
            <Tab key={name} label={name} value={name} />
          ))}
        </Tabs>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="sheet-editor-scroll">
            <ExcelSheetEditor
              sheetKey={sheetKeys[selectedTab]}
              rows={sheetData[sheetKeys[selectedTab]] || []}
              onSave={(rows) => handleSheetUpdate(sheetKeys[selectedTab], rows)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ExcelLiveEditPage;
