// src/pages/RackTrackerForm.js
import React, { useState } from "react";
import { db } from "../firebase.js"; // ✅ make sure firebase.js is configured
import { doc, setDoc, updateDoc, collection, deleteDoc, getDocs } from "firebase/firestore";
import { useNavigate, useLocation } from "react-router-dom";
import { XAxis, YAxis, ZAxis } from "recharts";
import * as XLSX from "xlsx";
import { useSiteConfig } from "../hooks/useSiteConfig.js";
import { isPrivilegedUser, isAdminAssignmentValid } from "../hooks/useRackPermissions.js";
import { computeCapacityAnalysis, recomputeUSpaceFromEquipments } from "../utils/rackCalculations.js";
import GeneralTab from "../components/RackTracker/tab/GeneralTab.js";
import EquipmentTab from "../components/RackTracker/tab/EquipmentTab.js";
import TemperatureTab from "../components/RackTracker/tab/TemperatureTab.js";
import DomainDRTab from "../components/RackTracker/tab/DomainDRTab.js";
import BulkUploadTab from "../components/RackTracker/tab/BulkUploadTab.js";
import SourceTab from "../components/RackTracker/tab/SourceTab.js";
import CapacityAnalysisTab from "../components/RackTracker/tab/CapacityAnalysisTab.js";
import ActivityTab from "../components/RackTracker/tab/ActivityTab";
import { createInitialFormData } from "../constants/initialFormData.js";
import { saveRack, rollbackBulkUpload, bulkUploadRacks } from "../services/rackService.js";
import "../assets/RackTrackerForm.css";
import { getTabCompletion } from "../utils/tabCompletion.js";


const RackTrackerForm = ({ userData }) => {

  /** permissions */
  const isAdmin = isPrivilegedUser(userData);

  const navigate = useNavigate();
  const location = useLocation();
  const editData = location.state?.editData || null;
  const powerType = ["AC", "DC", "AC+DC"];
  const rackType = ["Active", "Passive"];
  const rackStatus = ["Installed Rack", "New Installed Rack", "Switched-OFF", "Switched-OFF Rack Removed", "Free Rack space", "Reserve Rack Space"]
  const [saving, setSaving] = useState(false);
  const bulkControlRef = React.useRef({
    paused: false,
    cancelled: false,
  });

  const tabs = [
    "General",
    "Equipment",
    "Temperature",
    "Source A",
    "Source B",
    "Capacity",
    "Domain & DR",
    "Bulk Upload",
    "Activity",
  ];

  const [activeTab, setActiveTab] = useState("General");

  const siteConfig = useSiteConfig(userData?.site?.toUpperCase());

  const [uploadProgress, setUploadProgress] = useState({
    total: 0,
    current: 0,
    skipped: 0,
    active: false,
  });

  const [bulkCreatedRefs, setBulkCreatedRefs] = useState([]);
  const [bulkControl, setBulkControl] = useState({
    paused: false,
    cancelled: false,
  });


  const [formData, setFormData] = useState(
    createInitialFormData({
      userData,
      editData,
      rackType,
      rackStatus,
    })
  );

  const [status, setStatus] = useState("");
  const floorList = ["Ground Floor", "1st Floor", "2nd Floor", "3rd Floor", "4th Floor", "5th Floor"]


  const handleBulkRollback = async () => {
    await rollbackBulkUpload(bulkCreatedRefs, setBulkCreatedRefs);
  };

  const handleDownloadExcelTemplate = () => {
    const link = document.createElement("a");
    link.href = "/rack-bulk-upload-template.xlsx"; // public folder path
    link.download = "Rack_Bulk_Upload_Template.xlsx";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkExcelUpload = async (e) => {
    await bulkUploadRacks(
      e,
      userData,
      setStatus,
      setUploadProgress,
      bulkControlRef,
      setBulkCreatedRefs,
      uploadProgress,
      setBulkControl,
    );
  };


  // U-by-U equipment map for SLD-style rack view
  const [rackUSlots, setRackUSlots] = useState(() => {
    const totalU = Number(formData.totalRackUSpace) || 42; // default 42U
    // Each slot: { uNo, label, occupied }
    return Array.from({ length: totalU }, (_, i) => ({
      uNo: totalU - i,      // 42 at top, 1 at bottom
      label: "",
      occupied: false,
    }));
  });

  const [rackEquipments, setRackEquipments] = useState(
    (editData && editData.rackEquipments) || [
      { id: Date.now().toString(), name: "", startU: "", endU: "", sizeU: 0, remarks: "" },
    ]
  );

  // ✅ Update input + auto-calc
  const handleChange = (e) => {
    const { name, value } = e.target;
    let updated = { ...formData, [name]: value };

    if (name === "rackType" && value === "Passive") {
      updated.powerType = "None";
    }
    if (name === "rackType" && value === "Active") {
      updated.powerType = "";
    }

    // When totalRackUSpace changes, recalc from equipments
    if (name === "totalRackUSpace") {
      const uCalc = recomputeUSpaceFromEquipments(rackEquipments, value);
      updated = { ...updated, ...uCalc };
    }

    if (name === "rackHeight" || name === "rackWidth" || name === "rackDepth") {
      updated[name] = value.replace(/[^0-9]/g, ""); // numeric only
    }

    const calc = computeCapacityAnalysis(updated);
    setFormData({ ...updated, ...calc });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await saveRack(
      formData,
      editData,
      userData,
      setStatus,
      setSaving,
      navigate,
      rackEquipments
    );
  };

  const visibleTabs = tabs.filter(tab => tab !== "Bulk Upload" || (isAdmin && !editData));
  const currentTabIndex = visibleTabs.indexOf(activeTab);
  const tabDescriptions = {
    General: "Identify the rack, location, and operating status.",
    Equipment: "Record rack dimensions and equipment positions in U space.",
    Temperature: "Record front and rear temperature readings in degrees Celsius.",
    "Source A": "Enter the primary power source, cabling, and protection details.",
    "Source B": "Enter the secondary power source, cabling, and protection details.",
    Capacity: "Review calculated load, cable capacity, and rack occupancy.",
    "Domain & DR": "Record ownership, network domain, and disaster recovery test details.",
    "Bulk Upload": "Import multiple rack records using the Excel template.",
    Activity: "Review the saved change history for this rack.",
  };

  return (
    <div className="daily-log-container rack-form-page">
      <header className="rack-form-header">
        <div><span className="rack-form-eyebrow">AC / DC infrastructure</span><h1>{editData ? "Edit rack details" : "New rack details"}</h1><p>UPS / SMPS equipment register</p></div>
        <button type="button" className="rack-form-back" onClick={() => navigate('/acdc-rack-details')}>Back to dashboard</button>
      </header>
      <div className="rack-form-summary">
        <div><span>Site</span><strong>{formData.siteName || userData?.site || "Not selected"}</strong></div>
        <div><span>Rack</span><strong>{[formData.equipmentRackNo, formData.rackName].filter(Boolean).join(' · ') || "New record"}</strong></div>
        <div><span>Power / status</span><strong>{[formData.powerType, formData.rackStatus].filter(Boolean).join(' · ') || "Not specified"}</strong></div>
      </div>

      <div
        className="rack-form-tabs"
        role="group" aria-label="Rack form sections"
      >
        {tabs.map((tab) => {
          if (tab === "Bulk Upload" && !(isAdmin && !editData)) {
            return null;
          }

          const percent = getTabCompletion(
            tab,
            formData,
            rackEquipments
          );

          return (
            <button
              key={tab}
              type="button"
              className={`rack-form-tab ${activeTab === tab ? "active" : ""}`}
              aria-pressed={activeTab === tab}
              aria-controls="rack-form-section"
              onClick={() => setActiveTab(tab)}

            >
              <div>{tab}</div>

              {!['Bulk Upload', 'Activity'].includes(tab) && <small aria-label={`${percent}% filled`}>{percent}%</small>}
            </button>
          );
        })}
      </div>


      <form onSubmit={handleSubmit} aria-busy={saving}>
        <section id="rack-form-section" className="rack-form-content" aria-labelledby="rack-form-section-title">
          <div className="rack-form-section-heading"><div><h2 id="rack-form-section-title">{activeTab}</h2><p>{tabDescriptions[activeTab]}</p></div><span>Section {currentTabIndex + 1} of {visibleTabs.length}</span></div>
          {activeTab === "General" && (
            <GeneralTab
              formData={formData}
              handleChange={handleChange}
              editData={editData}
              siteConfig={siteConfig}
              userRole={userData?.role}
              floorList={floorList}
              rackType={rackType}
              powerType={powerType}
              rackStatus={rackStatus}
            />
          )}

          {activeTab === "Equipment" && (
            <EquipmentTab
              rackEquipments={rackEquipments}
              setRackEquipments={setRackEquipments}
              formData={formData}
              setFormData={setFormData}
              recomputeUSpaceFromEquipments={recomputeUSpaceFromEquipments}
              computeCapacityAnalysis={computeCapacityAnalysis}
              handleChange={handleChange}
            />
          )}

          {activeTab === "Temperature" && (
            <TemperatureTab
              formData={formData}
              handleChange={handleChange}
            />
          )}

          {activeTab === "Domain & DR" && (
            <DomainDRTab
              formData={formData}
              handleChange={handleChange}
            />
          )}

          {activeTab === "Bulk Upload" && (
            <BulkUploadTab
              handleBulkExcelUpload={handleBulkExcelUpload}
              handleDownloadExcelTemplate={handleDownloadExcelTemplate}
              uploadProgress={uploadProgress}
              bulkControl={bulkControl}
              bulkControlRef={bulkControlRef}
              setUploadProgress={setUploadProgress}
              setBulkControl={setBulkControl}
              handleBulkRollback={handleBulkRollback}
              bulkCreatedRefs={bulkCreatedRefs}
              status={status}
              setStatus={setStatus}
              userData={userData}
              isAdmin={isAdmin}
              editData={editData}
            />
          )}

          <div className="rack-form-source-container">
            {/* Source A */}
            {activeTab === "Source A" && (
              <SourceTab
                source="A"
                formData={formData}
                handleChange={handleChange}
                isAdmin={isAdmin}
                editData={editData}
                siteConfig={siteConfig}
              />
            )}

            {/* Source B */}
            {activeTab === "Source B" && (
              <SourceTab
                source="B"
                formData={formData}
                handleChange={handleChange}
                isAdmin={isAdmin}
                editData={editData}
                siteConfig={siteConfig}
              />
            )}

          </div>

          {/* Capacity Analysis (auto) */}

          {activeTab === "Capacity" && (
            <CapacityAnalysisTab
              formData={formData}
            />
          )}

          {/* Activity Log */}
          {activeTab === "Activity" && (
            <>
              <h2>Activity History</h2>
              <ActivityTab
                formData={formData}
              />
            </>

          )}

        </section>

        <div className="rack-form-actions">
          <div className="rack-form-step-actions">
            <button type="button" disabled={currentTabIndex === 0} onClick={() => setActiveTab(visibleTabs[currentTabIndex - 1])}>Previous section</button>
            <button type="button" disabled={currentTabIndex === visibleTabs.length - 1} onClick={() => setActiveTab(visibleTabs[currentTabIndex + 1])}>Next section</button>
          </div>
          <button type="submit" className="rack-form-save" disabled={saving || uploadProgress.active}>{saving ? "Saving…" : editData ? "Save changes" : "Save rack"}</button>
        </div>
      </form>

      {status && <p className="rack-form-status" role="status">{status}</p>}
    </div>
  );
};

export default RackTrackerForm;
