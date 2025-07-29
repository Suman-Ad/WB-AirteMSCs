// src/components/UploadForm.js
import React, { useState } from "react";
import { storage, db } from "../firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

const UploadForm = ({ userData, site }) => {
  const [file, setFile] = useState(null);
  const [month, setMonth] = useState("");
  const [type, setType] = useState("In-House");
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState("");
  

  const handleUpload = async () => {
    if (!file || !month) return;

    const storageRef = ref(
      storage,
      `pm_files/${site}/${month}_${type}_${file.name}`
    );
    const uploadTask = uploadBytesResumable(storageRef, file);
    setUploading(true);
    uploadTask.on(
      "state_changed",
      null,
      (err) => {
        alert("Upload error: " + err.message);
        setUploading(false);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        await addDoc(collection(db, "pm_reports"), {
          site,
          month,
          type,
          fileUrl: downloadURL,
          uploadedBy: {
            uid: userData.uid,
            name: userData.name,
            email: userData.email
          },
          timestamp: serverTimestamp()
        });
        setSuccess("Uploaded successfully!");
        setUploading(false);
        setFile(null);
        setMonth("");
        setTimeout(() => setSuccess(""), 3000);
      }
    );
  };

  return (
    <div className="mt-4">
      <label className="block mb-1 text-sm">Month</label>
      <input
        type="month"
        className="border p-1 w-full mb-2 rounded"
        value={month}
        onChange={(e) => setMonth(e.target.value)}
      />
      <label className="block mb-1 text-sm">PM Type</label>
      <select
        className="border p-1 w-full mb-2 rounded"
        value={type}
        onChange={(e) => setType(e.target.value)}
      >
        <option>In-House</option>
        <option>Vendor</option>
      </select>
      <input
        type="file"
        accept="application/pdf"
        className="mb-2"
        onChange={(e) => setFile(e.target.files[0])}
      />
      <button
        disabled={uploading}
        onClick={handleUpload}
        className="bg-green-600 text-white px-3 py-1 rounded disabled:opacity-50"
      >
        {uploading ? "Uploading..." : "Upload PDF"}
      </button>
      {success && <p className="text-green-600 text-sm mt-2">{success}</p>}
    </div>
  );
};

export default UploadForm;
