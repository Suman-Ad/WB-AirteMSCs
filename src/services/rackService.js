import { db } from "../firebase.js";
import { doc, setDoc, updateDoc, deleteDoc, getDocs, collection, getDoc } from "firebase/firestore";
import * as XLSX from "xlsx";

import { sanitizeRackEquipments, recomputeUSpaceFromEquipments, computeCapacityAnalysis } from "../utils/rackCalculations.js";
import { getChangedFields } from "../utils/activityLogger.js";
import { writeActivityLog } from "./activityService.js";

export async function saveRack(
  formData,
  editData,
  userData,
  setStatus,
  setSaving,
  navigate,
  rackEquipments
) {
  if (!formData.siteName) {
    setStatus("❌ Please enter Site Name before saving");
    return;
  }
  setSaving(true);
  const uploadedBy = {
    uid: userData.uid,
    name: userData.name || "",
    role: userData.role,
    empId: userData.empId,
  };
  try {
    const isEditMode = !!editData;
    const siteKey = formData.siteName.trim().toUpperCase().replace(/[\/\s]+/g, "_");
    const rackKey = `${formData.equipmentLocation || "#UNKNOWN FLOOR"}_${formData.equipmentRackNo || "#A0"
      }-${formData.rackName || "#UNKNOWN RACK NAME"}`.replace(/[\/\s]+/g, "_");
    const siteRef = doc(db, "acDcRackDetails", siteKey);

    const payload = {
      ...formData,
      rackDimensions: {
        height: Number(formData.rackHeight) || 0,
        width: Number(formData.rackWidth) || 0,
        depth: Number(formData.rackDepth) || 0,
      },
      rackEquipments: sanitizeRackEquipments(rackEquipments),
      updatedBy: uploadedBy,
      updatedAt: new Date().toISOString(),
    };

    if (isEditMode) {
      const rackRef = doc(siteRef, "racks", rackKey);
      const snapshot = await getDoc(rackRef);

      const oldData = snapshot.exists()
        ? snapshot.data()
        : {};

      const changes = getChangedFields(
        oldData,
        payload
      );
      if (changes.length > 0) {
        await writeActivityLog({
          siteKey,
          rackKey,
          action: "UPDATE",
          user: uploadedBy,
          changes,
        });
      }
      await updateDoc(rackRef, payload);
    } else {
      await setDoc(siteRef, { createdAt: new Date().toISOString() }, { merge: true });
      await setDoc(doc(siteRef, "racks", rackKey), payload, { merge: true });
      await writeActivityLog({
        siteKey,
        rackKey,
        action: "CREATE",
        user: uploadedBy,
        changes: [
          {
            field: "Rack",
            oldValue: null,
            newValue: formData.rackName,
          }
        ]
      });
    }

    setStatus(
      isEditMode
        ? `✅ Updated record for ${formData.rackName}`
        : `✅ Data saved for site: ${formData.siteName}`
    );
    setSaving(false);
  } catch (err) {
    console.error("Error saving to Firestore:", err);
    setStatus("❌ Error saving data");
  }

  setTimeout(() => navigate("/acdc-rack-details"), 800);
}

export async function updateRack() { }

export async function bulkUploadRacks(
  e,
  userData,
  setStatus,
  setUploadProgress,
  bulkControlRef,
  setBulkCreatedRefs,
  setBulkControl,
  uploadProgress,
  recomputeUSpaceFromEquipments,
  computeCapacityAnalysis
) {
  if (userData?.role === "User" || userData?.role === "Super User" && userData?.designation === "Vertiv Technician") {
    alert("Not Authorised");
    return;
  }
  const file = e.target.files[0];
  if (!file) return;

  if (
    !window.confirm(
      "Are you sure you want to start bulk upload?\n\n" +
      "• Existing racks will NOT be overwritten\n" +
      "• Duplicate racks will be skipped\n" +
      "• This action can be undone after upload"
    )
  ) {
    return;
  }

  const uploadedBy = {
    uid: userData.uid,
    name: userData.name || "",
    role: userData.role,
    empId: userData.empId,
  };

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer);

  const rackSheet = workbook.Sheets["Racks"];
  if (!rackSheet) {
    alert("❌ 'Racks' sheet not found");
    return;
  }

  const rackRows = XLSX.utils.sheet_to_json(rackSheet);

  const eqSheet = workbook.Sheets["RackEquipments"];
  const eqRows = eqSheet ? XLSX.utils.sheet_to_json(eqSheet) : [];

  let success = 0;
  let failed = [];

  setUploadProgress({
    total: rackRows.length,
    current: 0,
    skipped: 0,
    active: true,
  });

  bulkControlRef.current = { paused: false, cancelled: false };

  for (const row of rackRows) {
    // Cancel check
    if (bulkControlRef.current.cancelled) {
      setStatus("❌ Bulk upload cancelled by user");
      break;
    }

    // Pause check
    while (bulkControlRef.current.paused) {
      await new Promise(res => setTimeout(res, 300));
    }

    try {
      if (!row.siteName || !row.equipmentRackNo || !row.rackName) {
        throw new Error("Missing required fields");
      }

      const isRestrictedSuperUser =
        userData?.role === "Super User" &&
        (
          userData?.designation === "Vertiv Technician" ||
          userData?.designation === "Vertiv Site Infra Engineer"
        );

      if (isRestrictedSuperUser && row.siteName !== userData?.site) {
        alert(`❌ Site Name Mismatch.\nPlease use site: "${userData?.site}"`);
        return;
      }

      const excelSite = String(row.siteName).trim().toUpperCase();
      const userSite = String(userData?.site).trim().toUpperCase();

      if (isRestrictedSuperUser && excelSite !== userSite) {
        alert(`❌ Site Name Mismatch.\nExpected: "${userData?.site}"`);
        return;
      }

      const siteKey = row.siteName
        .trim()
        .toUpperCase()
        .replace(/[\/\s]+/g, "_");

      const rackKey = `${row.equipmentLocation}_${row.equipmentRackNo}-${row.rackName}`
        .replace(/[\/\s]+/g, "_");

      /* Filter equipments for this rack */
      const rackEquipments = eqRows
        .filter(
          e =>
            e.siteName === row.siteName &&
            e.rackName === row.rackName
        )
        .map(e => {
          const startU = Number(e.startU) || 0;
          const endU = Number(e.endU) || 0;
          const sizeU =
            startU >= endU && endU > 0 ? startU - endU + 1 : 0;

          return {
            id: Date.now().toString() + Math.random(),
            name: e.name || "",
            startU,
            endU,
            sizeU,
            remarks: e.remarks || "",
          };
        })
        .filter(e => e.sizeU > 0);

      const uCalc = recomputeUSpaceFromEquipments(
        rackEquipments,
        row.totalRackUSpace
      );

      const baseData = {
        ...row,
        ...uCalc,
        rackEquipments,
        rackDimensions: {
          height: Number(row.rackHeight) || 0,
          width: Number(row.rackWidth) || 0,
          depth: Number(row.rackDepth) || 0,
        },
        createdAt: new Date().toISOString(),
      };

      const calc = computeCapacityAnalysis(baseData);
      const payload = {
        ...baseData, ...calc, updatedBy: uploadedBy,
        updatedAt: new Date().toISOString()
      };
      const existingRackKeys = new Set();

      const siteSnap = await getDocs(
        collection(db, "acDcRackDetails", siteKey, "racks")
      );

      siteSnap.forEach(doc => existingRackKeys.add(doc.id));

      const siteRef = doc(db, "acDcRackDetails", siteKey);
      await setDoc(siteRef, { createdAt: new Date() }, { merge: true });

      if (existingRackKeys.has(rackKey)) {
        setUploadProgress(p => ({
          ...p,
          skipped: p.skipped + 1,
        }));
        continue; // ⬅️ important (do NOT throw)
      }


      await setDoc(
        doc(siteRef, "racks", rackKey),
        payload,
        { merge: true }
      );

      await writeActivityLog({
        siteKey,
        rackKey,
        action: "BULK_UPLOAD",
        user: uploadedBy,
        changes: [
          {
            field: "Rack",
            oldValue: null,
            newValue: row.rackName,
          }
        ]
      });

      success++;

      setUploadProgress(p => ({
        ...p,
        current: p.current + 1,
      }));


      setBulkCreatedRefs(prev => [
        ...prev,
        {
          siteKey,
          rackKey,
        },
      ]);

    } catch (err) {
      console.error("Bulk upload error:", err);
      failed.push({ rack: row.rackName, error: err.message });
    }
  }
  setBulkControl({ paused: false, cancelled: false });
  setUploadProgress(p => ({ ...p, active: false }));
  bulkControlRef.current = { paused: false, cancelled: false };


  alert(`✅ Bulk upload completed\nSuccess: ${success}\nSkipped: ${uploadProgress.skipped}\nFailed: ${failed.length}`);
}

export async function rollbackBulkUpload(
  bulkCreatedRefs,
  setBulkCreatedRefs
) {
  if (bulkCreatedRefs.length === 0) {
    alert("No bulk-uploaded racks to rollback.");
    return;
  }

  if (
    !window.confirm(
      `Rollback ${bulkCreatedRefs.length} uploaded racks?\n\nThis cannot be undone.`
    )
  ) {
    return;
  }

  try {
    for (const ref of bulkCreatedRefs) {
      await writeActivityLog({
        siteKey: ref.siteKey,
        rackKey: ref.rackKey,
        action: "ROLLBACK",
        user: {
          ...ref.user,
        },
        changes: []
      });

      await deleteDoc(
        doc(db, "acDcRackDetails", ref.siteKey, "racks", ref.rackKey)
      );
    }

    setBulkCreatedRefs([]);
    alert("✅ Bulk upload rollback completed successfully.");

  } catch (err) {
    console.error("Rollback failed:", err);
    alert("❌ Rollback failed. Check console.");
  }
}