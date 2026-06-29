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
import { createInitialFormData } from "../constants/initialFormData.js";
import { saveRack, rollbackBulkUpload, bulkUploadRacks } from "../services/rackService.js";
import { getTabCompletion } from "../utils/tabCompletion.js";


const RackTrackerForm = ({ userData }) => {

  /** permissions */
  const isAdmin = isPrivilegedUser(userData);

  const navigate = useNavigate();
  const location = useLocation();
  const editData = location.state?.editData || null;
  const powerType = ["AC", "DC", "AC+DC"];
  const rackType = ["Active", "Passive"];
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

  return (
    <div className="daily-log-container">
      <h1 style={{ color: "white", textAlign: "center", paddingBottom: "20px" }}>
        <strong>🗄️UPS / SMPS Equipment Details</strong>
      </h1>

      <div
        className="rack-tabs"
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
              className={`rack-tab ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
              style={{
                flexShrink: 0,
                minWidth: "120px",
              }}
            >
              <div>{tab}</div>

              <small>
                {percent}%
              </small>
            </button>
          );
        })}
      </div>


      <form onSubmit={handleSubmit}>
        <div className="child-container" style={{ border: "2px solid #2083a1ff", padding: "10px", marginBottom: "20px" }}>
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

          <div className="form-section" style={{ display: "flex", gap: "2px", justifyContent: "space-between" }}>
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

        </div>

        {/* Submit */}
        <button type="submit" className="submit-btn">{saving ? "Saving..." : "💾 Save"}</button>
      </form>

      {status && <p>{status}</p>}
    </div>
  );
};

export default RackTrackerForm;
