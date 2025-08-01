// src/components/UploadForm.js
import React, { useEffect, useState } from "react";
import { storage, db } from "../firebase";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
  getDoc,
  doc,
  setDoc,
} from "firebase/firestore";
import "../assets/UploadForm.css";

const quarterMonths = {
  Q1: ["2025-04", "2025-05", "2025-06"],
  Q2: ["2025-07", "2025-08", "2025-09"],
  Q3: ["2025-10", "2025-11", "2025-12"],
  Q4: ["2026-01", "2026-02", "2026-03"],
};

const UploadForm = ({ userData, site }) => {
  const [file, setFile] = useState(null);
  const [type, setType] = useState("In-House");
  const [month, setMonth] = useState("");
  const [quarter, setQuarter] = useState("Q1");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [equipmentName, setEquipmentName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [equipmentList, setEquipmentList] = useState([]);
  const [uploadedItems, setUploadedItems] = useState([]);

  const isAdmin = ["Admin", "Super Admin"].includes(userData.role);

  useEffect(() => {
    const fetchEquipmentList = async () => {
      try {
        const docRef = doc(
          db,
          "config",
          type === "Vendor" ? "vendor_equipment" : "inhouse_equipment"
        );
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setEquipmentList(docSnap.data().list || []);
        } else {
          setEquipmentList([]);
        }
      } catch (err) {
        console.error("Error loading equipment list:", err);
      }
    };
    fetchEquipmentList();
  }, [type]);

  useEffect(() => {
    const fetchUploaded = async () => {
      const currentMonth = type === "Vendor" ? selectedMonth : month;
      if (!currentMonth || !site) return;
      const reportsRef = collection(db, "pm_reports");
      const q = query(
        reportsRef,
        where("site", "==", site),
        where("month", "==", currentMonth),
        where("type", "==", type)
      );
      const snap = await getDocs(q);
      const names = snap.docs.map((doc) =>
        type === "Vendor" ? doc.data().vendorName : doc.data().equipmentName
      );
      setUploadedItems(names);
    };
    fetchUploaded();
  }, [month, site, type, selectedMonth]);

  const handleUpload = async () => {
    setMessage("");

    const finalMonth = type === "Vendor" ? selectedMonth : month;

    if (!file || !finalMonth || !type) {
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

    const reportsRef = collection(db, "pm_reports");
    const q = query(
      reportsRef,
      where("site", "==", site),
      where("month", "==", finalMonth),
      where("type", "==", type),
      where(
        type === "Vendor" ? "vendorName" : "equipmentName",
        "==",
        type === "Vendor" ? vendorName : equipmentName
      )
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      setMessage("⚠️ This report already exists for selected period and equipment.");
      return;
    }

    const nameLabel = type === "Vendor" ? vendorName : equipmentName;
    const path = `pm_files/${site}/${finalMonth}_${type}_${nameLabel}.pdf`;
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
          month: finalMonth,
          type,
          status: "Done",
          vendorName: type === "Vendor" ? vendorName : null,
          equipmentName: type === "In-House" ? equipmentName : null,
          fileUrl: downloadURL,
          uploadedBy: {
            uid: userData.uid,
            name: userData.name,
            email: userData.email,
          },
          timestamp: serverTimestamp(),
        });

        setMessage("✅ File uploaded successfully!");
        setUploading(false);
        setFile(null);
        setMonth("");
        setQuarter("Q1");
        setSelectedMonth("");
        setVendorName("");
        setEquipmentName("");
        setProgress(0);
        setTimeout(() => setMessage(""), 5000);
      }
    );
  };

  const handleEditList = async () => {
    const list = prompt("Enter comma-separated list:", equipmentList.join(", "));
    if (!list) return;
    const newList = list.split(",").map((e) => e.trim()).filter((e) => e);
    const docRef = doc(
      db,
      "config",
      type === "Vendor" ? "vendor_equipment" : "inhouse_equipment"
    );
    await setDoc(docRef, { list: newList });
    setEquipmentList(newList);
  };

  return (
    <div className="upload-form">
      <label>PM Type:</label>
      <select value={type} onChange={(e) => setType(e.target.value)}>
        <option value="In-House">In-House</option>
        <option value="Vendor">Vendor</option>
      </select>

      {type === "In-House" && (
        <>
          <label>Month:</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </>
      )}

      {type === "Vendor" && (
        <>
          <label>Quarter:</label>
          <select value={quarter} onChange={(e) => setQuarter(e.target.value)}>
            {Object.keys(quarterMonths).map((qtr) => (
              <option key={qtr} value={qtr}>{qtr}</option>
            ))}
          </select>

          <label>Select Month in {quarter}:</label>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
            <option value="">--Select Month--</option>
            {quarterMonths[quarter].map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </>
      )}

      {type === "Vendor" ? (
        <>
          <label>Vendor Name:</label>
          <select
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
          >
            <option value="">--Select Vendor--</option>
            {equipmentList.map((vendor) => (
              <option key={vendor} value={vendor}>{vendor}</option>
            ))}
          </select>
        </>
      ) : (
        <>
          <label>Equipment Name:</label>
          <select
            value={equipmentName}
            onChange={(e) => setEquipmentName(e.target.value)}
          >
            <option value="">--Select Equipment--</option>
            {equipmentList.map((eq) => (
              <option key={eq} value={eq}>{eq}</option>
            ))}
          </select>
        </>
      )}

      {isAdmin && (
        <button className="edit-list-btn" onClick={handleEditList}>
          ✏️ Edit {type === "Vendor" ? "Vendor List" : "Equipment List"}
        </button>
      )}

      <label>Choose PDF file:</label>
      <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files[0])} />

      <button onClick={handleUpload} disabled={uploading} className="upload-btn">
        {uploading ? `Uploading... ${progress}%` : "Upload PDF"}
      </button>

      {uploading && <progress value={progress} max="100" />}
      {message && <p className="upload-message">{message}</p>}

      {(type === "In-House" ? month : selectedMonth) && equipmentList.length > 0 && (
        <div className="status-table">
          <h4>Status Summary ({type})</h4>
          <table>
            <thead>
              <tr>
                <th>{type === "Vendor" ? "Vendor" : "Equipment"}</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {equipmentList.map((item) => (
                <tr key={item}>
                  <td>{item}</td>
                  <td style={{ color: uploadedItems.includes(item) ? "green" : "red" }}>
                    {uploadedItems.includes(item) ? "✅ Done" : "❌ Pending"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default UploadForm;
