import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import "../assets/Compliance.css";

const ManageCompliance = ({ userData }) => {
  const userRole = userData?.role;
  const userSite = userData?.site;
  const [templates, setTemplates] = useState([]);
  const [records, setRecords] = useState([]);

  const [newTemplate, setNewTemplate] = useState({
    title: "",
    scope: "global",
    site: "",
    description: "",
  });

  const [newRecord, setNewRecord] = useState({
    templateId: "",
    expiryDate: "",
    renewalDate: "",
    file: null,
  });

  const canManageTemplates = userRole === "Admin" || userRole === "Super Admin";
  const canUploadRecords = userRole === "Super User";

  // Fetch templates
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "compliance_templates"), (snap) => {
      setTemplates(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Fetch records
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "compliance_records"), (snap) => {
      setRecords(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const handleAddTemplate = async () => {
    if (!newTemplate.title) return alert("Title required");

    const id = `${Date.now()}`;
    await setDoc(doc(db, "compliance_templates", id), {
      ...newTemplate,
      createdAt: serverTimestamp(),
    });

    setNewTemplate({ title: "", scope: "global", site: "", description: "" });
  };

  const handleDeleteTemplate = async (id) => {
    await deleteDoc(doc(db, "compliance_templates", id));
  };

  const handleUploadRecord = async () => {
    if (!newRecord.templateId || !newRecord.file) {
      return alert("Select template and file");
    }

    const storage = getStorage();
    const storageRef = ref(
      storage,
      `compliance/${userSite}/${Date.now()}_${newRecord.file.name}`
    );

    await uploadBytes(storageRef, newRecord.file);
    const fileUrl = await getDownloadURL(storageRef);

    const id = `${Date.now()}`;
    await setDoc(doc(db, "compliance_records", id), {
      templateId: newRecord.templateId,
      site: userSite,
      region: userData?.region || "",
      circle: userData?.circle || "",
      expiryDate: newRecord.expiryDate,
      renewalDate: newRecord.renewalDate,
      fileUrl,
      uploadedBy: userData.uid,
      uploadedAt: serverTimestamp(),
    });

    setNewRecord({
      templateId: "",
      expiryDate: "",
      renewalDate: "",
      file: null,
    });
  };

  const assignedTemplates = canManageTemplates
    ? templates
    : templates.filter(
        (t) => t.scope === "global" || (t.scope === "site" && t.site === userSite)
      );

  return (
    <div className="compliance-container">
      <h2>Manage Compliance</h2>

      {/* ADMIN/SUPER ADMIN: TEMPLATE CREATION */}
      {canManageTemplates && (
        <div className="form-section">
          <h3>Add Compliance Template</h3>
          <input
            type="text"
            placeholder="Title"
            value={newTemplate.title}
            onChange={(e) =>
              setNewTemplate({ ...newTemplate, title: e.target.value })
            }
          />
          <select
            value={newTemplate.scope}
            onChange={(e) =>
              setNewTemplate({ ...newTemplate, scope: e.target.value })
            }
          >
            <option value="global">Global</option>
            <option value="site">Site Specific</option>
          </select>
          {newTemplate.scope === "site" && (
            <input
              type="text"
              placeholder="Site Name"
              value={newTemplate.site}
              onChange={(e) =>
                setNewTemplate({ ...newTemplate, site: e.target.value })
              }
            />
          )}
          <textarea
            placeholder="Description"
            value={newTemplate.description}
            onChange={(e) =>
              setNewTemplate({ ...newTemplate, description: e.target.value })
            }
          />
          <button onClick={handleAddTemplate}>Save Template</button>
        </div>
      )}

      {/* SUPER USER: FILE UPLOAD */}
      {canUploadRecords && (
        <div className="form-section">
          <h3>Upload Compliance Document</h3>
          <select
            value={newRecord.templateId}
            onChange={(e) =>
              setNewRecord({ ...newRecord, templateId: e.target.value })
            }
          >
            <option value="">Select Template</option>
            {assignedTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={newRecord.expiryDate}
            onChange={(e) =>
              setNewRecord({ ...newRecord, expiryDate: e.target.value })
            }
          />
          <input
            type="date"
            value={newRecord.renewalDate}
            onChange={(e) =>
              setNewRecord({ ...newRecord, renewalDate: e.target.value })
            }
          />
          <input
            type="file"
            onChange={(e) =>
              setNewRecord({ ...newRecord, file: e.target.files[0] })
            }
          />
          <button onClick={handleUploadRecord}>Upload</button>
        </div>
      )}

      {/* TEMPLATES LIST */}
      <h3>Compliance Templates</h3>
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Scope</th>
            <th>Site</th>
            <th>Description</th>
            {canManageTemplates && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {templates.map((t) => (
            <tr key={t.id}>
              <td>{t.title}</td>
              <td>{t.scope}</td>
              <td>{t.scope === "site" ? t.site : "-"}</td>
              <td>{t.description}</td>
              {canManageTemplates && (
                <td>
                  <button onClick={() => handleDeleteTemplate(t.id)}>
                    Delete
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {/* RECORDS LIST */}
      <h3>Uploaded Records</h3>
      <table>
        <thead>
          <tr>
            <th>Template</th>
            <th>Region</th>
            <th>Circle</th>
            <th>Site</th>
            <th>Expiry</th>
            <th>Renewal</th>
            <th>Status</th>
            <th>File</th>
          </tr>
        </thead>
        <tbody>
          {assignedTemplates.map((t) => {
            const rec = records.find(
              (r) => r.templateId === t.id && r.site === userSite
            );
            if (!rec) {
              return (
                <tr key={t.id} className="missing">
                  <td>{t.title}</td>
                  <td>{userData?.region || "-"}</td>
                  <td>{userData?.circle || "-"}</td>
                  <td>{t.scope === "site" ? t.site : "All Sites"}</td>
                  <td colSpan={3}>Missing Document</td>
                  <td>-</td>
                </tr>
              );
            }

            const daysLeft = Math.ceil(
              (new Date(rec.renewalDate) - new Date()) /
                (1000 * 60 * 60 * 24)
            );

            return (
              <tr
                key={rec.id}
                className={
                  daysLeft <= 0 ? "overdue" : daysLeft <= 7 ? "near-expiry" : ""
                }
              >
                <td>{t.title}</td>
                <td>{rec.region}</td>
                <td>{rec.circle}</td>
                <td>{rec.site}</td>
                <td>{rec.expiryDate}</td>
                <td>{rec.renewalDate}</td>
                <td>{daysLeft <= 0 ? "Expired" : `${daysLeft} days left`}</td>
                <td>
                  <a href={rec.fileUrl} target="_blank" rel="noreferrer">
                    View
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ManageCompliance;
