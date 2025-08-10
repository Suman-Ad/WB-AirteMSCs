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
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import "../assets/DHRStyle.css"; // uses your main style file

// Region -> circles mapping
const regions = {
  East: ["BH & JH", "NESA", "OR", "WB"],
  West: ["GUJ", "MPCG", "ROM"],
  North: ["DEL", "HR", "PJ", "RJ", "UP", "UK"],
  South: ["AP", "KA", "KL", "TN", "TS"],
};

// circle -> site list mapping
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

  // New template form state
  const [newTemplate, setNewTemplate] = useState({
    title: "",
    scope: "global", // 'global' or 'site'
    region: "",
    circle: "",
    sites: [], // multi-select
    description: "",
  });

  // Template edit state (admin)
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);

  // New record upload (super user)
  const [newRecord, setNewRecord] = useState({
    templateId: "",
    expiryDate: "",
    renewalDate: "",
    file: null,
  });

  // Record edit state (super user and admin can edit)
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [editingRecordForm, setEditingRecordForm] = useState({
    expiryDate: "",
    renewalDate: "",
    file: null,
    site: "",
    region: "",
    circle: "",
  });

  const canManageTemplates = userRole === "Admin" || userRole === "Super Admin";
  const canUploadRecords = userRole === "Super User";
  const [instructionText, setInstructionText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");  

  useEffect(() => {
    const fetchInstruction = async () => {
      const docRef = doc(db, "config", "manage_compliance_instruction");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setInstructionText(docSnap.data().text || "");
        setEditText(docSnap.data().text || "");
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

  // Create template
  const handleAddTemplate = async () => {
    if (!newTemplate.title) return alert("Template title required");
    // if site-specific ensure at least one site selected
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

  // Start editing a template (populate editingTemplate)
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

  // Save edited template
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

  // Remove template
  const handleDeleteTemplate = async (id) => {
    if (!window.confirm("Delete this template? This will not delete existing uploaded records.")) return;
    await deleteDoc(doc(db, "compliance_templates", id));
  };

  // Upload new record (Super User)
  const handleUploadRecord = async () => {
    if (!newRecord.templateId || !newRecord.file) return alert("Template and file required");
    // find template to fill region/circle if template site-specific use template data otherwise fallback to userData
    const template = templates.find(t => t.id === newRecord.templateId);
    const storage = getStorage();
    const storageRef = ref(storage, `compliance/${userSite}/${Date.now()}_${newRecord.file.name}`);
    await uploadBytes(storageRef, newRecord.file);
    const fileUrl = await getDownloadURL(storageRef);

    const id = Date.now().toString();
    await setDoc(doc(db, "compliance_records", id), {
      templateId: newRecord.templateId,
      complianceType: template?.title || "",
      region: template?.region || userRegion || "",
      circle: template?.circle || userCircle || "",
      site: userSite,
      expiryDate: newRecord.expiryDate || "",
      renewalDate: newRecord.renewalDate || "",
      fileUrl,
      uploadedBy: userData.uid || "",
      uploadedAt: serverTimestamp(),
    });

    setNewRecord({ templateId: "", expiryDate: "", renewalDate: "", file: null });
  };

  // Admin / Super Admin or SuperUser delete record
  const handleDeleteRecord = async (id) => {
    if (!window.confirm("Delete this uploaded record?")) return;
    await deleteDoc(doc(db, "compliance_records", id));
  };

  // Start edit record
  const startEditRecord = (r) => {
    setEditingRecordId(r.id);
    setEditingRecordForm({
      expiryDate: r.expiryDate || "",
      renewalDate: r.renewalDate || "",
      file: null,
      site: r.site || userSite,
      region: r.region || userRegion,
      circle: r.circle || userCircle,
    });
  };

  // Save edited record
  const saveEditedRecord = async () => {
    if (!editingRecordId) return;
    const recordRef = doc(db, "compliance_records", editingRecordId);
    const updates = {
      expiryDate: editingRecordForm.expiryDate || "",
      renewalDate: editingRecordForm.renewalDate || "",
      // site/region/circle only updateable by Admins (we'll allow admin to change site if they want)
      site: editingRecordForm.site,
      region: editingRecordForm.region,
      circle: editingRecordForm.circle,
    };

    if (editingRecordForm.file) {
      const storage = getStorage();
      const refPath = `compliance/${updates.site}/${Date.now()}_${editingRecordForm.file.name}`;
      const fileRef = ref(storage, refPath);
      await uploadBytes(fileRef, editingRecordForm.file);
      const fileUrl = await getDownloadURL(fileRef);
      updates.fileUrl = fileUrl;
    }

    await updateDoc(recordRef, updates);

    setEditingRecordId(null);
    setEditingRecordForm({ expiryDate: "", renewalDate: "", file: null, site: "", region: "", circle: "" });
  };

  // templates that are visible to super user: global OR templates that include their site
  const assignedTemplates = canManageTemplates
    ? templates
    : templates.filter((t) => {
        if (t.scope === "global") return true;
        // t.sites is array of sites (multiple)
        if (Array.isArray(t.sites) && t.sites.length > 0) {
          return t.sites.includes(userSite);
        }
        // fallback single site field
        return t.site === userSite;
      });

  return (
    <div className="dhr-dashboard-container">
      <h2 className="dashboard-header">Manage Compliance</h2>
      <h2 className="dashboard-header">
        👋 Welcome, <strong>{userData?.name || "Team Member"}</strong>
      </h2>
      <p className="dashboard-subinfo">
        {userRole === "Super Admin" && <span>🔒 <strong>Super Admin</strong></span>}
        {userRole === "Admin" && <span>🛠️ <strong>Admin</strong></span>}
        {userRole === "Super User" && <span>📍 <strong>Super User</strong></span>}
        {userRole === "User" && <span>👤 <strong>User</strong></span>}
        &nbsp; | &nbsp; 🏢 Site: <strong>{userSite || "All"}</strong> | &nbsp; 🛡️ Site ID: <strong>{userData.siteId || "All"}</strong>
      </p>
      <h1>
        <strong>⚖️ Manage Compliance Documents</strong>
      </h1> 
      <div className="instruction-tab">
        <h2 className="dashboard-header">📌 Notice Board </h2>
        {/* <h3 className="dashboard-header">📘 App Overview </h3> */}
        {isEditing ? (
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
                  const docRef = doc(db, "config", "manage_compliance_instructionn");
                  await setDoc(docRef, { text: editText });
                  setInstructionText(editText);
                  setIsEditing(false);
                }}
              >
                Save
              </button>
              <button
                className="bg-gray-400 text-white px-3 py-1 rounded"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="dashboard-instruction-panel">{instructionText || "No instructions available."}</p>
            {["Admin", "Super Admin"].includes(userRole) && (
              <button
                className="text-blue-600 underline"
                onClick={() => setIsEditing(true)}
              >
                Edit Instruction
              </button>
            )}
          </>
        )}
        <h6 style={{marginLeft: "90%"}}>Thanks & Regurds @Suman Adhikari</h6>
      </div>

      {/* Admin / Super Admin: create or edit templates */}
      {canManageTemplates && (
        <section style={{ marginBottom: "1.25rem" }}>
          <h3>Add / Edit Compliance Template</h3>

          {/* if editing show separate form */}
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
            <label>Template</label>
            <select value={newRecord.templateId} onChange={(e) => setNewRecord({ ...newRecord, templateId: e.target.value })}>
              <option value="">Select template</option>
              {assignedTemplates.map(t => <option key={t.id} value={t.id}>{t.title} {t.scope === "site" ? `(sites: ${t.sites?.join(", ")})` : "(global)"}</option>)}
            </select>

            <label style={{ marginTop: "0.5rem" }}>Expiry Date</label>
            <input type="date" value={newRecord.expiryDate} onChange={(e) => setNewRecord({ ...newRecord, expiryDate: e.target.value })} />

            <label style={{ marginTop: "0.5rem" }}>Renewal Date</label>
            <input type="date" value={newRecord.renewalDate} onChange={(e) => setNewRecord({ ...newRecord, renewalDate: e.target.value })} />

            <label style={{ marginTop: "0.5rem" }}>File (PDF/JPG)</label>
            <input type="file" onChange={(e) => setNewRecord({ ...newRecord, file: e.target.files[0] })} />

            <div style={{ marginTop: "0.5rem" }}>
              <button className="btn-success" onClick={handleUploadRecord}>Upload</button>
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
              <th>Expiry</th>
              <th>Renewal</th>
              <th>File</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {records
              .filter(r => canManageTemplates || r.site === userSite)
              .map(r => {
                const canEditRecord = (userRole === "Super User" && r.site === userSite && r.uploadedBy === userData.uid) || canManageTemplates;
                const daysLeft = r.renewalDate ? Math.ceil((new Date(r.renewalDate) - new Date()) / (1000*60*60*24)) : null;
                const rowClass = daysLeft === null ? "missing" : (daysLeft <= 0 ? "overdue" : (daysLeft <= 7 ? "near-expiry" : ""));

                return (
                  <tr key={r.id} className={rowClass}>
                    <td>{r.complianceType}</td>
                    <td>{r.region || "-"}</td>
                    <td>{r.circle || "-"}</td>
                    <td>{r.site || "-"}</td>

                    <td>
                      {editingRecordId === r.id ? (
                        <input type="date" value={editingRecordForm.expiryDate} onChange={(e) => setEditingRecordForm({...editingRecordForm, expiryDate: e.target.value})} />
                      ) : r.expiryDate || "-"}
                    </td>

                    <td>
                      {editingRecordId === r.id ? (
                        <input type="date" value={editingRecordForm.renewalDate} onChange={(e) => setEditingRecordForm({...editingRecordForm, renewalDate: e.target.value})} />
                      ) : r.renewalDate || "-"}
                    </td>

                    <td>
                      <a href={r.fileUrl} target="_blank" rel="noreferrer">View</a>
                    </td>

                    <td className="action-buttons">
                      {editingRecordId === r.id ? (
                        <>
                          {/* Admin may change site/region/circle inline (if desired) */}
                          {canManageTemplates && (
                            <>
                              <select value={editingRecordForm.region} onChange={(e)=> setEditingRecordForm({...editingRecordForm, region: e.target.value})}>
                                <option value="">Region</option>
                                {Object.keys(regions).map(rr => <option key={rr} value={rr}>{rr}</option>)}
                              </select>
                              {editingRecordForm.region && (
                                <select value={editingRecordForm.circle} onChange={(e)=> setEditingRecordForm({...editingRecordForm, circle: e.target.value})}>
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

                          <input type="file" onChange={(e) => setEditingRecordForm({...editingRecordForm, file: e.target.files[0]})} />
                          <button className="btn-primary" onClick={saveEditedRecord}>Save</button>
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
