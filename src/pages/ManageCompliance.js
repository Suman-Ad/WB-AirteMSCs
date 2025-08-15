// src/pages/ManageCompliance.js
import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import "../assets/DHRStyle.css"; // uses your main style file

// Region -> circles mapping
const regions = {
  East: ["BH & JH", "NESA", "OR", "WB"],
  West: ["GUJ", "MPCG", "ROM"],
  North: ["DEL", "HR", "PJ", "RJ", "UP", "UK"],
  South: ["AP", "KA", "KL", "TN", "TS"],
};

// circle -> site list mapping (kept same as original)
const siteList = {
  East: {
    "BH & JH": ["Patliputra", "Bhaglpur", "Muzaffarpur New", "Muzaffarpur Old", "Ranchi", "Ranchi telenor", "Marwari Awas"],
    WB: ["Andaman", "Asansol", "Berhampore", "DLF", "Globsyn", "Infinity-I", "Infinity-II", "Kharagpur", "Mira Tower", "New Alipore", "SDF", "Siliguri"],
    NESA: ["Aizwal", "Guwahati", "Jorabat New", "Jorhat", "Shillong"],
    OR: ["Cuttack", "Sambalpur"],
  },
  West: {
    GUJ: ["Astron Park", "Bharti House", "Changodar", "Rajkot Madhapar-New", "Rajkot Mavdi Old", "Surat", "Surat Telenor"],
    MPCG: ["Bhopal Center 1st floor", "Bhopal Center 4th floor", "Gobindpura", "Gwalior", "Indore Geeta Bhawan", "Jabalpur", "Pardesipura", "Raipur"],
    ROM: ["Nagpur", "Vega Center", "E-Space", "Kolhapur", "Nagpur New", "Nagpur BTSOL"],
  },
  North: {
    DEL: ["DLF", "Mira Tower"],
    HR: ["GLOBSYN"],
    PJ: [],
    RJ: [],
    UP: [],
    UK: [],
  },
  South: {
    KA: ["Infinity-I", "Infinity-II"],
    TS: ["Siliguri"],
    AP: [],
    KL: [],
    TN: [],
  },
};

export default function ManageCompliance({ userData }) {
  const userRole = userData?.role;
  const userSite = userData?.site;
  const userRegion = userData?.region;
  const userCircle = userData?.circle;

  const [templates, setTemplates] = useState([]);
  const [records, setRecords] = useState([]);

  // Template form states
  const [newTemplate, setNewTemplate] = useState({
    title: "",
    scope: "global", // 'global' or 'site'
    region: "",
    circle: "",
    sites: [], // multi-select
    description: "",
  });
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);

  // New record upload (Super User) -> NEW naming: issueDate & expiryDate
  const [newRecord, setNewRecord] = useState({
    templateId: "",
    issueDate: "",
    expiryDate: "",
    file: null,
  });
  const [newUploadProgress, setNewUploadProgress] = useState(0);
  const [newUploading, setNewUploading] = useState(false);

  // Record edit state
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [editingRecordForm, setEditingRecordForm] = useState({
    issueDate: "",
    expiryDate: "",
    file: null,
    site: "",
    region: "",
    circle: "",
  });
  const [editUploadProgress, setEditUploadProgress] = useState(0);
  const [editUploading, setEditUploading] = useState(false);

  // Instruction board
  const [instructionText, setInstructionText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");

  const canManageTemplates = userRole === "Admin" || userRole === "Super Admin";
  const canUploadRecords = userRole === "Super User";

  // Fetch instruction (uses single doc id "manage_compliance_instruction")
  useEffect(() => {
    const fetchInstruction = async () => {
      try {
        const docRef = doc(db, "config", "manage_compliance_instruction");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setInstructionText(docSnap.data().text || "");
          setEditText(docSnap.data().text || "");
        }
      } catch (err) {
        console.error("fetchInstruction error", err);
      }
    };
    fetchInstruction();
  }, []);

  // realtime templates
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "compliance_templates"), (snap) => {
      setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // realtime records
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "compliance_records"), (snap) => {
      setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // ---------------- Templates CRUD ----------------
  const handleAddTemplate = async () => {
    if (!newTemplate.title) return alert("Template title required");
    if (newTemplate.scope === "site" && (!newTemplate.sites || newTemplate.sites.length === 0)) {
      return alert("Select one or more sites for site-specific template");
    }
    const id = Date.now().toString();
    const payload = {
      title: newTemplate.title,
      scope: newTemplate.scope,
      region: newTemplate.region || "",
      circle: newTemplate.circle || "",
      sites: newTemplate.sites || [],
      description: newTemplate.description || "",
      createdAt: serverTimestamp(),
    };
    await setDoc(doc(db, "compliance_templates", id), payload);
    setNewTemplate({ title: "", scope: "global", region: "", circle: "", sites: [], description: "" });
  };

  const startEditTemplate = (t) => {
    setEditingTemplateId(t.id);
    setEditingTemplate({
      title: t.title || "",
      scope: t.scope || "global",
      region: t.region || "",
      circle: t.circle || "",
      sites: t.sites || [],
      description: t.description || "",
    });
  };

  const saveEditedTemplate = async () => {
    if (!editingTemplateId || !editingTemplate.title) return alert("Title required");
    if (editingTemplate.scope === "site" && (!editingTemplate.sites || editingTemplate.sites.length === 0)) {
      return alert("Select sites for site-specific template");
    }
    const templateRef = doc(db, "compliance_templates", editingTemplateId);
    await updateDoc(templateRef, {
      ...editingTemplate,
      updatedAt: serverTimestamp(),
    });
    setEditingTemplateId(null);
    setEditingTemplate(null);
  };

  const handleDeleteTemplate = async (id) => {
    if (!window.confirm("Delete this template? This will not delete existing uploaded records.")) return;
    await deleteDoc(doc(db, "compliance_templates", id));
  };

  // ---------------- Upload new record (Super User) ----------------
  const handleUploadRecord = async () => {
    // validation: template, dates, file
    if (!newRecord.templateId || !newRecord.issueDate || !newRecord.expiryDate || !newRecord.file) {
      return alert("Please select template, issue date, expiry date and file.");
    }

    try {
      setNewUploading(true);
      const template = templates.find(t => t.id === newRecord.templateId);
      const storage = getStorage();
      const storageRef = ref(storage, `compliance/${userSite}/${Date.now()}_${newRecord.file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, newRecord.file);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setNewUploadProgress(progress);
        },
        (error) => {
          console.error("Upload error", error);
          alert("File upload failed!");
          setNewUploading(false);
          setNewUploadProgress(0);
        },
        async () => {
          const fileUrl = await getDownloadURL(uploadTask.snapshot.ref);
          const id = Date.now().toString();
          await setDoc(doc(db, "compliance_records", id), {
            templateId: newRecord.templateId,
            complianceType: template?.title || "",
            region: template?.region || userRegion || "",
            circle: template?.circle || userCircle || "",
            site: userSite,
            // store as issueDate & expiryDate (new standard)
            issueDate: newRecord.issueDate,
            expiryDate: newRecord.expiryDate,
            fileUrl,
            uploadedBy: userData.uid || "",
            uploadedAt: serverTimestamp(),
          });

          // reset form
          setNewRecord({ templateId: "", issueDate: "", expiryDate: "", file: null });
          setNewUploadProgress(0);
          setNewUploading(false);
        }
      );
    } catch (err) {
      console.error("handleUploadRecord error", err);
      setNewUploading(false);
      setNewUploadProgress(0);
    }
  };

  // ---------------- Delete record ----------------
  const handleDeleteRecord = async (id) => {
    if (!window.confirm("Delete this uploaded record?")) return;
    await deleteDoc(doc(db, "compliance_records", id));
  };

  // ---------------- Edit record ----------------
  const startEditRecord = (r) => {
    // Backwards compatibility: old records may use expiryDate/renewalDate fields.
    const issueVal = r.issueDate ?? r.expiryDate ?? r.renewalDate ?? "";
    const expiryVal = r.expiryDate ?? r.renewalDate ?? r.issueDate ?? "";

    setEditingRecordId(r.id);
    setEditingRecordForm({
      issueDate: issueVal,
      expiryDate: expiryVal,
      file: null,
      site: r.site || userSite,
      region: r.region || userRegion,
      circle: r.circle || userCircle,
    });
  };

  const saveEditedRecord = async () => {
    if (!editingRecordId) return;
    try {
      const recordRef = doc(db, "compliance_records", editingRecordId);
      const updates = {
        issueDate: editingRecordForm.issueDate || "",
        expiryDate: editingRecordForm.expiryDate || "",
        site: editingRecordForm.site || userSite,
        region: editingRecordForm.region || userRegion,
        circle: editingRecordForm.circle || userCircle,
        updatedAt: serverTimestamp(),
      };

      // if file chosen -> upload with progress
      if (editingRecordForm.file) {
        setEditUploading(true);
        const storage = getStorage();
        const fileRef = ref(storage, `compliance/${updates.site}/${Date.now()}_${editingRecordForm.file.name}`);
        const uploadTask = uploadBytesResumable(fileRef, editingRecordForm.file);

        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setEditUploadProgress(progress);
          },
          (err) => {
            console.error("edit upload error", err);
            alert("File upload failed during edit!");
            setEditUploading(false);
            setEditUploadProgress(0);
          },
          async () => {
            const fileUrl = await getDownloadURL(uploadTask.snapshot.ref);
            updates.fileUrl = fileUrl;
            await updateDoc(recordRef, updates);
            setEditingRecordId(null);
            setEditingRecordForm({ issueDate: "", expiryDate: "", file: null, site: "", region: "", circle: "" });
            setEditUploadProgress(0);
            setEditUploading(false);
          }
        );
      } else {
        // no file -> just update fields
        await updateDoc(recordRef, updates);
        setEditingRecordId(null);
        setEditingRecordForm({ issueDate: "", expiryDate: "", file: null, site: "", region: "", circle: "" });
      }
    } catch (err) {
      console.error("saveEditedRecord error", err);
      setEditUploading(false);
      setEditUploadProgress(0);
    }
  };

  // templates that are visible to super user: global OR templates that include their site
  const assignedTemplates = canManageTemplates
    ? templates
    : templates.filter((t) => {
        if (t.scope === "global") return true;
        if (Array.isArray(t.sites) && t.sites.length > 0) {
          return t.sites.includes(userSite);
        }
        return t.site === userSite;
      });

  // Save instruction text (Admin / Super Admin)
  const saveInstruction = async () => {
    try {
      const docRef = doc(db, "config", "manage_compliance_instruction");
      await setDoc(docRef, { text: editText });
      setInstructionText(editText);
      setIsEditing(false);
    } catch (err) {
      console.error("saveInstruction error", err);
      alert("Failed to save instruction.");
    }
  };

  return (
    <div className="dhr-dashboard-container">
      <h1><strong>⚖️ Manage Compliance Documents</strong></h1>

      <div className="instruction-tab">
        <h2 className="dashboard-header">📌 Notice Board </h2>
        {isEditing ? (
          <>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={5}
              className="dashboard-instruction-panel"
            />
            <div className="flex gap-2">
              <button className="bg-blue-600 text-white px-3 py-1 rounded" onClick={saveInstruction}>Save</button>
              <button className="bg-gray-400 text-white px-3 py-1 rounded" onClick={() => setIsEditing(false)}>Cancel</button>
            </div>
          </>
        ) : (
          <>
            <p className="dashboard-instruction-panel">{instructionText || "No instructions available."}</p>
            {["Admin", "Super Admin"].includes(userRole) && (
              <button className="text-blue-600 underline" onClick={() => setIsEditing(true)}>Edit Instruction</button>
            )}
          </>
        )}
        <h6 style={{marginLeft: "90%"}}>Thanks & Regurds @Suman Adhikari</h6>
      </div>

      {/* Admin / Super Admin: create or edit templates */}
      {canManageTemplates && (
        <section style={{ marginBottom: "1.25rem" }}>
          <h3>Add / Edit Compliance Template</h3>

          {editingTemplateId ? (
            <div className="form-group">
              <label>Title</label>
              <input value={editingTemplate.title} onChange={(e) => setEditingTemplate({ ...editingTemplate, title: e.target.value })} />

              <label style={{ marginTop: "0.5rem" }}>Scope</label>
              <select value={editingTemplate.scope} onChange={(e) => setEditingTemplate({ ...editingTemplate, scope: e.target.value })}>
                <option value="global">Global</option>
                <option value="site">Site Specific</option>
              </select>

              {editingTemplate.scope === "site" && (
                <>
                  <label style={{ marginTop: "0.5rem" }}>Region</label>
                  <select value={editingTemplate.region} onChange={(e) => setEditingTemplate({ ...editingTemplate, region: e.target.value, circle: "", sites: [] })}>
                    <option value="">Select region</option>
                    {Object.keys(regions).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>

                  {editingTemplate.region && (
                    <>
                      <label style={{ marginTop: "0.5rem" }}>Circle</label>
                      <select value={editingTemplate.circle} onChange={(e) => setEditingTemplate({ ...editingTemplate, circle: e.target.value, sites: [] })}>
                        <option value="">Select circle</option>
                        {regions[editingTemplate.region].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </>
                  )}

                  {editingTemplate.circle && (
                    <>
                      <label style={{ marginTop: "0.5rem" }}>Sites (multiple)</label>
                      <select multiple value={editingTemplate.sites} onChange={(e) => setEditingTemplate({ ...editingTemplate, sites: Array.from(e.target.selectedOptions, o => o.value) })}>
                        {siteList[editingTemplate.region]?.[editingTemplate.circle]?.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </>
                  )}
                </>
              )}

              <label style={{ marginTop: "0.5rem" }}>Description</label>
              <textarea value={editingTemplate.description} onChange={(e) => setEditingTemplate({ ...editingTemplate, description: e.target.value })} />

              <div style={{ marginTop: "0.5rem" }}>
                <button className="btn-primary" onClick={saveEditedTemplate}>Save</button>
                <button className="btn-secondary" onClick={() => { setEditingTemplateId(null); setEditingTemplate(null); }} style={{ marginLeft: 8 }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div className="form-group">
              <label>Title</label>
              <input value={newTemplate.title} onChange={(e) => setNewTemplate({ ...newTemplate, title: e.target.value })} />

              <label style={{ marginTop: "0.5rem" }}>Scope</label>
              <select value={newTemplate.scope} onChange={(e) => setNewTemplate({ ...newTemplate, scope: e.target.value })}>
                <option value="global">Global</option>
                <option value="site">Site Specific</option>
              </select>

              {newTemplate.scope === "site" && (
                <>
                  <label style={{ marginTop: "0.5rem" }}>Region</label>
                  <select value={newTemplate.region} onChange={(e) => setNewTemplate({ ...newTemplate, region: e.target.value, circle: "", sites: [] })}>
                    <option value="">Select region</option>
                    {Object.keys(regions).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>

                  {newTemplate.region && (
                    <>
                      <label style={{ marginTop: "0.5rem" }}>Circle</label>
                      <select value={newTemplate.circle} onChange={(e) => setNewTemplate({ ...newTemplate, circle: e.target.value, sites: [] })}>
                        <option value="">Select circle</option>
                        {regions[newTemplate.region].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </>
                  )}

                  {newTemplate.circle && (
                    <>
                      <label style={{ marginTop: "0.5rem" }}>Sites (multiple)</label>
                      <select multiple value={newTemplate.sites} onChange={(e) => setNewTemplate({ ...newTemplate, sites: Array.from(e.target.selectedOptions, o => o.value) })}>
                        {siteList[newTemplate.region]?.[newTemplate.circle]?.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </>
                  )}
                </>
              )}

              <label style={{ marginTop: "0.5rem" }}>Description</label>
              <textarea value={newTemplate.description} onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })} />

              <div style={{ marginTop: "0.5rem" }}>
                <button className="btn-primary" onClick={handleAddTemplate}>Save Template</button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* SUPER USER: Upload record */}
      {canUploadRecords && (
        <section style={{ marginBottom: "1.25rem" }}>
          <h3>Upload Compliance Document (Site: {userSite})</h3>
          <div className="form-group">
            <label>⚖️ Compliance Template</label>
            <select value={newRecord.templateId} onChange={(e) => setNewRecord({ ...newRecord, templateId: e.target.value })}>
              <option value="">Select compliance template</option>
              {assignedTemplates.map(t => <option key={t.id} value={t.id}>{t.title} {t.scope === "site" ? `(sites: ${t.sites?.join(", ")})` : "(global)"}</option>)}
            </select>

            <label style={{ marginTop: "0.5rem" }}>Issue Date</label>
            <input type="date" value={newRecord.issueDate} onChange={(e) => setNewRecord({ ...newRecord, issueDate: e.target.value })} />

            <label style={{ marginTop: "0.5rem" }}>Expiry Date</label>
            <input type="date" value={newRecord.expiryDate} onChange={(e) => setNewRecord({ ...newRecord, expiryDate: e.target.value })} />

            <label style={{ marginTop: "0.5rem" }}>File (PDF/JPG)</label>
            <input type="file" accept=".pdf,image/*" onChange={(e) => setNewRecord({ ...newRecord, file: e.target.files[0] })} />

            {/* progress bar for new upload */}
            {newUploading && (
              <div style={{ marginTop: "0.5rem" }}>
                <progress value={newUploadProgress} max="100"></progress>
                <span> {Math.round(newUploadProgress)}%</span>
              </div>
            )}

            <div style={{ marginTop: "0.5rem" }}>
              <button
                className="btn-success"
                onClick={handleUploadRecord}
                disabled={
                  newUploading ||
                  !newRecord.templateId ||
                  !newRecord.issueDate ||
                  !newRecord.expiryDate ||
                  !newRecord.file
                }
              >
                {newUploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Templates table */}
      <section>
        <h3>Compliance Templates</h3>
        <table className="dhr-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Scope</th>
              <th>Region</th>
              <th>Circle</th>
              <th>Sites</th>
              <th>Description</th>
              {canManageTemplates && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {templates.map(t => (
              <tr key={t.id}>
                <td>{t.title}</td>
                <td>{t.scope}</td>
                <td>{t.region || "-"}</td>
                <td>{t.circle || "-"}</td>
                <td>{Array.isArray(t.sites) && t.sites.length ? t.sites.join(", ") : (t.site || "-")}</td>
                <td>{t.description || "-"}</td>
                {canManageTemplates && (
                  <td className="action-buttons">
                    <button className="btn-primary" onClick={() => startEditTemplate(t)}>✏️ Edit</button>
                    <button className="btn-danger" onClick={() => handleDeleteTemplate(t.id)}>❌ Delete</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Uploaded records table with inline edit for records */}
      <section style={{ marginTop: "1.25rem" }}>
        <h3>Uploaded Records</h3>
        <table className="dhr-table">
          <thead>
            <tr>
              <th>Template</th>
              <th>Region</th>
              <th>Circle</th>
              <th>Site</th>
              <th>Issue Date</th>
              <th>Expiry Date</th>
              <th>File</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {records
              .filter(r => canManageTemplates || r.site === userSite)
              .map(r => {
                const canEditRecord = (userRole === "Super User" && r.site === userSite && r.uploadedBy === userData.uid) || canManageTemplates;

                // compatibility: read issue & expiry from possible legacy fields
                const issueVal = r.issueDate ?? r.expiryDate ?? r.renewalDate ?? "";
                const expiryVal = r.expiryDate ?? r.renewalDate ?? r.issueDate ?? "";

                const expiryForCalc = r.expiryDate ?? r.renewalDate ?? r.issueDate ?? null;
                const daysLeft = expiryForCalc ? Math.ceil((new Date(expiryForCalc) - new Date()) / (1000*60*60*24)) : null;
                const rowClass = daysLeft === null ? "missing" : (daysLeft <= 0 ? "overdue" : (daysLeft <= 7 ? "near-expiry" : ""));

                return (
                  <tr key={r.id} className={rowClass}>
                    <td>{r.complianceType}</td>
                    <td>{r.region || "-"}</td>
                    <td>{r.circle || "-"}</td>
                    <td>{r.site || "-"}</td>

                    <td>
                      {editingRecordId === r.id ? (
                        <input type="date" value={editingRecordForm.issueDate} onChange={(e) => setEditingRecordForm({...editingRecordForm, issueDate: e.target.value})} />
                      ) : (issueVal || "-")}
                    </td>

                    <td>
                      {editingRecordId === r.id ? (
                        <input type="date" value={editingRecordForm.expiryDate} onChange={(e) => setEditingRecordForm({...editingRecordForm, expiryDate: e.target.value})} />
                      ) : (expiryVal || "-")}
                    </td>

                    <td>
                      {r.fileUrl ? <a href={r.fileUrl} target="_blank" rel="noreferrer">View</a> : "-"}
                    </td>

                    <td className="action-buttons">
                      {editingRecordId === r.id ? (
                        <>
                          {/* Admin may change site/region/circle inline */}
                          {canManageTemplates && (
                            <>
                              <select value={editingRecordForm.region} onChange={(e)=> setEditingRecordForm({...editingRecordForm, region: e.target.value, circle: "", site: ""})}>
                                <option value="">Region</option>
                                {Object.keys(regions).map(rr => <option key={rr} value={rr}>{rr}</option>)}
                              </select>
                              {editingRecordForm.region && (
                                <select value={editingRecordForm.circle} onChange={(e)=> setEditingRecordForm({...editingRecordForm, circle: e.target.value, site: ""})}>
                                  <option value="">Circle</option>
                                  {regions[editingRecordForm.region].map(cc => <option key={cc} value={cc}>{cc}</option>)}
                                </select>
                              )}
                              {editingRecordForm.circle && siteList[editingRecordForm.region] && siteList[editingRecordForm.region][editingRecordForm.circle] && (
                                <select value={editingRecordForm.site} onChange={(e)=> setEditingRecordForm({...editingRecordForm, site: e.target.value})}>
                                  <option value="">Site</option>
                                  {siteList[editingRecordForm.region][editingRecordForm.circle].map(ss => <option key={ss} value={ss}>{ss}</option>)}
                                </select>
                              )}
                            </>
                          )}

                          <input type="file" accept=".pdf,image/*" onChange={(e) => setEditingRecordForm({...editingRecordForm, file: e.target.files[0]})} />

                          {/* edit upload progress */}
                          {editUploading && editingRecordId === r.id && (
                            <div style={{ marginTop: "0.5rem" }}>
                              <progress value={editUploadProgress} max="100"></progress>
                              <span> {Math.round(editUploadProgress)}%</span>
                            </div>
                          )}

                          <button className="btn-primary" onClick={saveEditedRecord} disabled={editUploading}>Save</button>
                          <button className="btn-secondary" onClick={() => setEditingRecordId(null)}>Cancel</button>
                        </>
                      ) : (
                        <>
                          {canEditRecord && <button className="btn-primary" onClick={() => startEditRecord(r)}>✏️ Edit</button>}
                          {canEditRecord && <button className="btn-danger" onClick={() => handleDeleteRecord(r.id)}>❌ Delete</button>}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
