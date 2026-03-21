import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  collection, addDoc, serverTimestamp,
  doc, getDoc, setDoc, updateDoc, query, where, getDocs
} from 'firebase/firestore';
import IncidentEditorPage from '../components/IncidentEditorPage';
import { useParams, useNavigate } from 'react-router-dom';
import '../assets/IncidentManagement.css';
import * as XLSX from "xlsx";

const IncidentManagement = ({ userData }) => {
  const { incidentId } = useParams();   // detect edit mode if id is present
  const navigate = useNavigate();

  const [instructionText, setInstructionText] = useState("");
  const [isEditingNotice, setIsEditingNotice] = useState(false);
  const [editText, setEditText] = useState("");

  const [previewData, setPreviewData] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);
  const [importProgress, setImportProgress] = useState({
    total: 0,
    processed: 0,
    success: 0,
    failed: 0,
  });
  const [isImporting, setIsImporting] = useState(false);

  const [formData, setFormData] = useState({
    region: userData?.region || '',
    circle: userData?.circle || '',
    siteId: userData?.siteId || '',
    siteName: userData?.site || '',
    ompPartner: '',
    dateOfIncident: '',
    timeOfIncident: '',
    saNsa: 'NSA',
    equipmentCategory: '',
    incidentTitle: '',
    incidentDescription: '',
    type: 'Alarm',
    effect: 'Non-Outage',
    effectedEquipmentDetails: '',
    actionsTaken: '',
    rcaStatus: 'N',
    ownership: '',
    reasonCategory: '',
    realReason: '',
    impactType: 'Partial',
    remarks: '',
    closureDate: '',
    closureTime: '',
    status: 'Open',
    mttr: '',
    learningShared: 'N',
    closureRemarks: '',
    ttDocketNo: '',
    rcaFileUrl: ''
  });

  // 🔹 Fetch Notice Board Text
  useEffect(() => {
    const fetchInstruction = async () => {
      const docRef = doc(db, "config", "incident_Edit_instruction");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setInstructionText(docSnap.data().text || "");
        setEditText(docSnap.data().text || "");
      }
    };
    fetchInstruction();
  }, []);

  // 🔹 Load existing incident in edit mode
  useEffect(() => {
    const fetchIncident = async () => {
      if (!incidentId) return;
      const docRef = doc(db, "incidents", incidentId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();

        // Role + Site restriction
        if (
          !["Admin", "Super Admin"].includes(userData.role) &&
          data.siteName !== userData.site
        ) {
          alert("You don’t have permission to edit this incident.");
          navigate("/incident-dashboard");
          return;
        }

        setFormData(data);
      } else {
        alert("Incident not found.");
        navigate("/incident-dashboard");
      }
    };
    fetchIncident();
  }, [incidentId, userData, navigate]);

  // 🔹 Form change handler
  const handleFormChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 🔹 Validate required fields
  const validateForm = () => {
    const requiredFields = [
      'region', 'circle', 'siteName', 'ompPartner', 'dateOfIncident',
      'timeOfIncident', 'saNsa', 'equipmentCategory', 'incidentTitle', 'incidentDescription',
      'effectedEquipmentDetails', 'actionsTaken'
    ];
    for (const field of requiredFields) {
      if (!formData[field]) {
        alert(`Please fill in ${field}`);
        return false;
      }
    }
    return true;
  };

  // 🔹 Submit handler (Create or Update)
  const handleSubmit = async () => {
    if (!validateForm()) return;

    // Additional validation for RCA file if RCA status is 'Y'
    // if (formData.rcaStatus === "Y" && !formData.rcaFileUrl) {
    //   alert("Please upload an RCA file before submitting.");
    //   return;
    // }

    try {
      const incidentDate = new Date(formData.dateOfIncident);
      const year = incidentDate.getFullYear();
      const month = String(incidentDate.getMonth() + 1).padStart(2, '0');
      const day = String(incidentDate.getDate()).padStart(2, '0');


      if (incidentId) {
        // 🔸 Update existing incident
        await updateDoc(doc(db, "incidents", incidentId), {
          ...formData,
          updatedAt: serverTimestamp(),
          rcaFileUrl: formData.rcaFileUrl || ""   // ✅ Update RCA file link
        });
        alert("Incident updated successfully!");
      } else {
        // 🔸 Create new incident
        await addDoc(collection(db, 'incidents'), {
          ...formData,
          reportedBy: userData.email,
          reportedById: userData.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          ttDocketNo: formData.ttDocketNo || "To Be raised",
          siteId: userData.siteId,
          year,
          month,
          day,
          dateKey: `${year}-${month}-${day}`,
          siteDateKey: `${userData.site}_${year}-${month}-${day}`,
          rcaFileUrl: formData.rcaFileUrl || ""   // ✅ Save RCA file link
        });
        alert("Incident reported successfully!");
      }

      navigate("/incident-dashboard"); // go back after success
    } catch (err) {
      console.error("Error saving incident:", err);
      alert("Failed to save incident.");
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        region: "",
        circle: "",
        siteName: "",
        ompPartner: "",
        dateOfIncident: "2026-03-21",
        timeOfIncident: "14:30",
        saNsa: "NSA",
        equipmentCategory: "",
        incidentTitle: "",
        incidentDescription: "",
        type: "Alarm",
        effect: "Non-Outage",
        effectedEquipmentDetails: "",
        actionsTaken: "",
        rcaStatus: "N",
        ownership: "",
        reasonCategory: "",
        realReason: "",
        impactType: "Partial",
        remarks: "",
        closureDate: "",
        closureTime: "",
        status: "Open",
        mttr: "",
        learningShared: "N",
        closureRemarks: "",
        ttDocketNo: "",
        rcaFileUrl: ""
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "IncidentTemplate");

    XLSX.writeFile(wb, "Incident_Template.xlsx");
  };

  const findExistingIncident = async (row) => {
    const q = query(
      collection(db, "incidents"),
      where("siteName", "==", row.siteName),
      where("dateOfIncident", "==", row.dateOfIncident),
      where("incidentTitle", "==", row.incidentTitle)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs[0]; // return first match
  };

  const handlePreviewExcel = (file) => {
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(sheet);

      const errors = [];

      jsonData.forEach((row, index) => {
        if (!row.siteName) {
          errors.push(`Row ${index + 2}: siteName missing`);
        }
        if (!row.dateOfIncident) {
          errors.push(`Row ${index + 2}: dateOfIncident missing`);
        }
        if (!row.incidentTitle) {
          errors.push(`Row ${index + 2}: incidentTitle missing`);
        }
      });

      setPreviewData(jsonData);
      setValidationErrors(errors);
    };

    reader.readAsArrayBuffer(file);
  };

  const handleConfirmImport = async () => {
    if (validationErrors.length > 0) {
      alert("Fix validation errors first!");
      return;
    }

    setIsImporting(true);

    const total = previewData.length;
    let success = 0;
    let failed = 0;

    setImportProgress({ total, processed: 0, success: 0, failed: 0 });

    for (let i = 0; i < previewData.length; i++) {
      const row = previewData[i];

      try {
        const incidentDate = new Date(row.dateOfIncident);
        const year = incidentDate.getFullYear();
        const month = String(incidentDate.getMonth() + 1).padStart(2, "0");
        const day = String(incidentDate.getDate()).padStart(2, "0");

        const existingDoc = await findExistingIncident(row);

        if (existingDoc) {
          // 🔁 UPDATE
          await updateDoc(doc(db, "incidents", existingDoc.id), {
            ...row,
            updatedAt: serverTimestamp(),
          });
        } else {
          // 🆕 CREATE
          await addDoc(collection(db, "incidents"), {
            ...formData,
            ...row,
            reportedBy: userData.email,
            reportedById: userData.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            siteId: userData.siteId,
            year,
            month,
            day,
            dateKey: `${year}-${month}-${day}`,
            siteDateKey: `${row.siteName}_${year}-${month}-${day}`,
          });
        }

        success++;
      } catch (err) {
        console.error(err);
        failed++;
      }

      setImportProgress({
        total,
        processed: i + 1,
        success,
        failed,
      });
    }

    setIsImporting(false);
    alert("Import Completed ✅");
  };

  return (
    <div className="dhr-dashboard-container">
      <h1 className="dashboard-header">
        <strong>🚨 {incidentId ? "Edit Incident" : "Incident Management"}</strong>
      </h1>

      {/* Notice Board */}
      <div className="instruction-tab">
        <h2 className="noticeboard-header">📌 Notice Board </h2>
        {isEditingNotice ? (
          <>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={5}
              className="dashboard-instruction-panel"
            />
            <div className="flex gap-2">
              <button
                className="bg-blue-600 text-white px-3 py-1 rounded"
                onClick={async () => {
                  const docRef = doc(db, "config", "incident_Edit_instruction");
                  await setDoc(docRef, { text: editText });
                  setInstructionText(editText);
                  setIsEditingNotice(false);
                }}
              >
                Save
              </button>
              <button
                className="bg-gray-400 text-white px-3 py-1 rounded"
                onClick={() => setIsEditingNotice(false)}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="dashboard-instruction-panel">
              {instructionText || "No instructions available."}
            </p>
            {["Admin", "Super Admin"].includes(userData?.role) && (
              <button
                className="text-blue-600 underline"
                onClick={() => setIsEditingNotice(true)}
              >
                Edit Instruction
              </button>
            )}
          </>
        )}
        <h6 style={{ marginLeft: "90%" }}>Thanks & Regards @Suman Adhikari</h6>
      </div>

      <div style={{ marginBottom: "20px" }}>
        
      </div>

      <div className="import-section">

        <button
          onClick={downloadTemplate}
          className="bg-green-600 text-white px-4 py-2 rounded mr-2"
        >
          📥 Download Upload Template
        </button>

        <h3>📤 Bulk Import</h3>

        <input
          type="file"
          accept=".xlsx, .xls"
          onChange={(e) => handlePreviewExcel(e.target.files[0])}
        />

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div style={{ color: "red", marginTop: "10px" }}>
            <h4>❌ Validation Errors:</h4>
            {validationErrors.map((err, i) => (
              <div key={i}>{err}</div>
            ))}
          </div>
        )}

        {/* Preview Table */}
        {previewData.length > 0 && (
          <div style={{ marginTop: "20px", maxHeight: "300px", overflow: "auto" }}>
            <h4>📊 Preview Data</h4>
            <table className="preview-table">
              <thead>
                <tr>
                  {Object.keys(previewData[0]).map((key) => (
                    <th key={key}>{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.slice(0, 20).map((row, i) => (
                  <tr key={i}>
                    {Object.values(row).map((val, j) => (
                      <td key={j}>{val}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Import Button */}
        {previewData.length > 0 && (
          <button
            onClick={handleConfirmImport}
            disabled={isImporting}
            className="bg-blue-600 text-white px-4 py-2 mt-2 rounded"
          >
            🚀 Confirm Import
          </button>
        )}

        {/* Progress Bar */}
        {isImporting && (
          <div style={{ marginTop: "15px" }}>
            <progress
              value={importProgress.processed}
              max={importProgress.total}
            />
            <p>
              Processed: {importProgress.processed}/{importProgress.total} |
              ✅ {importProgress.success} |
              ❌ {importProgress.failed}
            </p>
          </div>
        )}

      </div>

      {/* Incident Editor Form */}
      <IncidentEditorPage
        formData={formData}
        onFormChange={handleFormChange}
        onSubmit={handleSubmit}
        userData={userData}
        incidentId={incidentId}
      />
    </div>
  );
};

export default IncidentManagement;
