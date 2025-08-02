// src/components/ExcelUploadForm.js
import React, { useState, useEffect } from "react";
import { storage, db } from "../firebase";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL
} from "firebase/storage";
import {
  addDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp
} from "firebase/firestore";
import { generateExcelTemplate } from "../utils/generateExcelTemplate";
import "../assets/ExcelUploadForm.css"; // Assuming you have some styles


const ExcelUploadForm = ({ userData }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [uploads, setUploads] = useState([]);

  const today = new Date().toISOString().split("T")[0]; // yyyy-mm-dd

  const handleUpload = async () => {
    if (!file || file.type !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
      setMessage("❌ Please select a valid Excel (.xlsx) file.");
      return;
    }

    const filePath = `excel_data/${userData.site}/${today}_${file.name}`;
    const storageRef = ref(storage, filePath);

    const q = query(
      collection(db, "excel_uploads"),
      where("site", "==", userData.site),
      where("date", "==", today)
    );
    const existing = await getDocs(q);
    if (!existing.empty) {
      setMessage("⚠️ You already uploaded today’s Excel.");
      return;
    }

    setUploading(true);
    const uploadTask = uploadBytesResumable(storageRef, file);
    uploadTask.on("state_changed", null, (err) => {
      console.error(err);
      setUploading(false);
      setMessage("❌ Upload failed.");
    }, async () => {
      const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
      await addDoc(collection(db, "excel_uploads"), {
        site: userData.site,
        uploadedBy: {
          name: userData.name,
          email: userData.email,
          uid: userData.uid
        },
        date: today,
        fileUrl: downloadURL,
        timestamp: serverTimestamp()
      });
      setMessage("✅ File uploaded successfully!");
      setUploading(false);
      setFile(null);
      fetchUploads();
    });
  };

  const fetchUploads = async () => {
    const q = query(
      collection(db, "excel_uploads"),
      where("site", "==", userData.site)
    );
    const snap = await getDocs(q);
    setUploads(snap.docs.map(doc => doc.data()));
  };

  useEffect(() => {
    if (userData.site) fetchUploads();
  }, [userData.site]);

  return (
    <div>
      <h4>Upload Today’s Excel Report</h4>
      <button
        onClick={() => generateExcelTemplate(userData.site)}
        className="download-btn"
        >
        📥 Download Template Excel
        </button>

      <input
        type="file"
        accept=".xlsx"
        onChange={(e) => setFile(e.target.files[0])}
      />
      <button onClick={handleUpload} disabled={uploading}>
        {uploading ? "Uploading..." : "Upload Excel"}
      </button>
      <p>{message}</p>

      <h5>Your Uploads</h5>
      <ul>
        {uploads.map((u, i) => (
          <li key={i}>
            {u.date} - <a href={u.fileUrl} target="_blank" rel="noreferrer">Download</a>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ExcelUploadForm;
