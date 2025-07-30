// src/components/UploadForm.js
import React, { useState } from "react";
import { storage, db } from "../firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { addDoc, collection, query, where, getDocs, serverTimestamp } from "firebase/firestore";
import "../assets/UploadForm.css";

const UploadForm = ({ userData, site }) => {
  const [file, setFile] = useState(null);
  const [month, setMonth] = useState("");
  const [type, setType] = useState("In-House");
  const [vendorName, setVendorName] = useState("");
  const [equipmentName, setEquipmentName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");

  const handleUpload = async () => {
    setMessage("");

    if (!file || !month || !type) {
      setMessage("⚠️ Please fill in all required fields.");
      return;
    }

    if (file.type !== "application/pdf") {
      setMessage("❌ Only PDF files are allowed.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("❌ File size exceeds 5MB limit.");
      return;
    }

    // Check if same file name already exists
    const reportsRef = collection(db, "pm_reports");
    const q = query(
      reportsRef,
      where("site", "==", site),
      where("month", "==", month),
      where("type", "==", type)
    );
    const snapshot = await getDocs(q);
    const duplicate = snapshot.docs.some((doc) => {
      const existingName = decodeURIComponent(doc.data().fileUrl.split("/").pop().split("?")[0]);
      return existingName.includes(file.name);
    });
    if (duplicate) {
      setMessage("⚠️ This exact file already exists for the selected month and type.");
      return;
    }

    const path = `pm_files/${site}/${month}_${type}_${file.name}`;
    const storageRef = ref(storage, path);
    const uploadTask = uploadBytesResumable(storageRef, file);
    setUploading(true);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        setProgress(pct);
      },
      (err) => {
        setMessage("❌ Upload error: " + err.message);
        setUploading(false);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        await addDoc(reportsRef, {
          site,
          month,
          type,
          vendorName: type === "Vendor" ? vendorName : null,
          equipmentName: type === "In-House" ? equipmentName : null,
          fileUrl: downloadURL,
          uploadedBy: {
            uid: userData.uid,
            name: userData.name,
            email: userData.email
          },
          timestamp: serverTimestamp()
        });

        setMessage("✅ File uploaded successfully!");
        setUploading(false);
        setFile(null);
        setMonth("");
        setVendorName("");
        setEquipmentName("");
        setProgress(0);

        setTimeout(() => setMessage(""), 5000);
      }
    );
  };

  return (
    <div className="upload-form">
      <label>Month: (Select From Calender)</label>
      <input
        type="month"
        value={month}
        onChange={(e) => setMonth(e.target.value)}
        required
      />

      <label>PM Type: (In-House/Vendor..) </label>
      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
      >
        <option value="In-House">In-House</option>
        <option value="Vendor">Vendor</option>
      </select>

      {type === "Vendor" && (
        <>
          <label>Vendor Name:</label>
          <input
            type="text"
            placeholder="Enter vendor name"
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
            required
          />
        </>
      )}

      {type === "In-House" && (
        <>
          <label>Equipment Name: (DG, UPS, SMPS, PAC, Panel etc..)</label>
          <input
            type="text"
            placeholder="Enter equipment name"
            value={equipmentName}
            onChange={(e) => setEquipmentName(e.target.value)}
            required
          />
        </>
      )}

      <label>Choose PDF file:</label>
      <input
        type="file"
        accept="application/pdf"
        onChange={(e) => setFile(e.target.files[0])}
      />

      <button
        onClick={handleUpload}
        disabled={uploading}
        className="upload-btn"
      >
        {uploading ? `Uploading... ${progress}%` : "Upload PDF"}
      </button>

      {uploading && <progress value={progress} max="100" />}
      {message && <p className="upload-message">{message}</p>}
    </div>
  );
};

export default UploadForm;
