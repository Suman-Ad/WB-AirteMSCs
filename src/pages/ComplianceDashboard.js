import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { db } from "../firebase";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  deleteDoc,
  setDoc,
  getDoc
} from "firebase/firestore";
import "../assets/DHRStyle.css";

export default function ComplianceDashboard({ userData }) {
  const [templates, setTemplates] = useState([]);
  const [records, setRecords] = useState([]);
  const [instructionText, setInstructionText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState("");  

  const userRole = userData?.role;
  const userSite = userData?.site;
  const userDesignation = userData?.designation;

  useEffect(() => {
    const fetchInstruction = async () => {
      const docRef = doc(db, "config", "compliance_dashboard_instruction");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setInstructionText(docSnap.data().text || "");
        setEditText(docSnap.data().text || "");
      }
    };
    fetchInstruction();
  }, []);

  useEffect(() => {
    const qt = query(collection(db, "compliance_templates"), orderBy("title", "asc"));
    const qr = query(collection(db, "compliance_records"), orderBy("site", "asc"));

    const unsubT = onSnapshot(qt, snap => setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubR = onSnapshot(qr, snap => setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unsubT(); unsubR(); };
  }, []);

  // Build merged view: for each template, create row(s) per site (if multi-site) or single row for global
  const merged = [];
  templates.forEach(t => {
    if (t.scope === "global") {
      // For global templates: find matching record for each site in records? We'll show a merged row with record if record exists for site
      // We'll create one merged row per existing record for this template (all sites), plus a generic "All Sites" missing row if no record exists for any site.
      const recordsForTemplate = records.filter(r => r.templateId === t.id);
      if (recordsForTemplate.length === 0) {
        merged.push({
          templateId: t.id,
          id: `tmpl-${t.id}-all`,
          complianceType: t.title,
          scope: t.scope,
          region: t.region || "",
          circle: t.circle || "",
          site: "All Sites",
          issueDate: null,
          expiryDate: null,
          fileUrl: null,
          recordId: null,
        });
      } else {
        recordsForTemplate.forEach(r => {
          merged.push({
            templateId: t.id,
            id: r.id,
            complianceType: t.title,
            scope: t.scope,
            region: r.region || t.region || "",
            circle: r.circle || t.circle || "",
            site: r.site || "Unknown",
            issueDate: r.issueDate || null,
            expiryDate: r.expiryDate || null,
            fileUrl: r.fileUrl || null,
            recordId: r.id,
            uploadedBy: r.uploadedBy || null,
          });
        });
      }
    } else if (t.scope === "site") {
      // Site-specific: t.sites[] may be defined — for each site show existing record if present, otherwise missing row per site
      const sitesArr = Array.isArray(t.sites) && t.sites.length ? t.sites : (t.site ? [t.site] : []);
      if (!sitesArr.length) {
        // If no sites defined, show template row (site unknown)
        merged.push({
          templateId: t.id,
          id: `tmpl-${t.id}-none`,
          complianceType: t.title,
          scope: t.scope,
          region: t.region || "",
          circle: t.circle || "",
          site: "Not assigned",
          issueDate: null,
          expiryDate: null,
          fileUrl: null,
          recordId: null,
        });
      } else {
        sitesArr.forEach(siteName => {
          const rec = records.find(r => r.templateId === t.id && r.site === siteName);
          if (rec) {
            merged.push({
              templateId: t.id,
              id: rec.id,
              complianceType: t.title,
              scope: t.scope,
              region: rec.region || t.region || "",
              circle: rec.circle || t.circle || "",
              site: siteName,
              issueDate: rec.issueDate || null,
              expiryDate: rec.expiryDate || null,
              fileUrl: rec.fileUrl || null,
              recordId: rec.id,
              uploadedBy: rec.uploadedBy || null,
            });
          } else {
            merged.push({
              templateId: t.id,
              id: `tmpl-${t.id}-${siteName}`,
              complianceType: t.title,
              scope: t.scope,
              region: t.region || "",
              circle: t.circle || "",
              site: siteName,
              issueDate: null,
              expiryDate: null,
              fileUrl: null,
              recordId: null,
            });
          }
        });
      }
    }
  });

  // Role-based filtering
  const filtered = userRole === "User"
    ? merged.filter(m => m.site === userSite || m.site === "All Sites")
    : merged;

 // Enhanced Summary: Circle -> Site -> {total, available, missing, nearestExpiry}
  const summary = {};

  filtered.forEach(item => {
    const circle = item.circle || "—";
    const site = item.site || "—";

    if (!summary[circle]) summary[circle] = {};
    if (!summary[circle][site]) {
      summary[circle][site] = {
        total: 0,
        available: 0,
        missing: 0,
        nearestExpiry: null,
      };
    }

    summary[circle][site].total += 1;

    if (item.fileUrl) {
      summary[circle][site].available += 1;

      if (item.expiryDate) {
        const expiry = new Date(item.expiryDate);
        if (
          !summary[circle][site].nearestExpiry ||
          expiry < summary[circle][site].nearestExpiry
        ) {
          summary[circle][site].nearestExpiry = expiry;
        }
      }
    } else {
      summary[circle][site].missing += 1;
    }
  });


  // Delete record or template record (Admin / SuperAdmin / SuperUser as allowed)
  const handleDeleteRecord = async (id, isTemplateRecord = false, templateId = null) => {
    if (!id) return;
    if (!window.confirm("Are you sure you want to delete this item?")) return;
    // If this id is an actual record doc id (starts with digits from setDoc id) delete from compliance_records
    // For template-level (no record) deletion should happen in Manage page (we'll not delete templates from dashboard here)
    try {
      // try to delete record doc
      await deleteDoc(doc(db, "compliance_records", id));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="dhr-dashboard-container">
      <h1 className="dashboard-header">
        <strong>⚖️ Compliance Dashboard</strong>
      </h1> 
      <div className="instruction-tab">
        <h2 className="noticeboard-header">📌 Notice Board </h2>
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
                  const docRef = doc(db, "config", "compliance_dashboard_instruction");
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

      {(userRole === "Admin" || userRole === "Super Admin" || userRole === "Super User") && (
        <Link to="/manage-compliance" className="btn-danger pm-manage-btn" style={{ marginBottom: 12 }}>
          ⚖️ Manage {userData?.site} Compliance
        </Link>
      )}

      {/* summary */}
      {(userRole === "Admin" || userRole === "Super Admin" || userRole === "Super User") && (
        <div style={{ marginBottom: 16 }}>
          <h3>Summary (Circle → Site)</h3>
          <table className="dhr-table" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>Circle</th>
                <th>Site</th>
                <th>Total Templates</th>
                <th>Available Docs</th>
                <th>Missing Docs</th>
                <th>Nearest Expiry</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(summary).map(circle =>
                Object.keys(summary[circle]).map(site => {
                  const s = summary[circle][site];
                  return (
                    <tr key={`${circle}-${site}`}>
                      <td>{circle}</td>
                      <td>{site}</td>
                      <td>{s.total}</td>
                      <td>{s.available}</td>
                      <td>{s.missing}</td>
                      <td>
                        {s.nearestExpiry
                          ? s.nearestExpiry.toLocaleDateString()
                          : (s.available > 0 ? "No Expiry (Permanent Docs)" : "-")}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

        </div>
      )}

      {/* detailed table */}
      <table className="dhr-table">
        <thead>
          <tr>
            <th>Region</th>
            <th>Circle</th>
            <th>Site</th>
            <th>Type</th>
            <th>Issue Date</th>
            <th>Expiry Date</th>
            <th>Status</th>
            {(userRole === "Admin" || userRole === "Super Admin" || userRole === "Super User") && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {filtered.map(row => {
            const hasDocument = !!row.fileUrl;
            const expiryDate = row.expiryDate ? new Date(row.expiryDate) : null;
            let statusText = "Missing Document";
            let rowClass = "missing";

            if (hasDocument) {
              if (!expiryDate) {
                // Document exists but no expiry → treat as permanently valid
                statusText = "Available";
                rowClass = "";
              } else {
                const daysLeft = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
                if (daysLeft <= 0) {
                  statusText = "Overdue";
                  rowClass = "overdue";
                } else if (daysLeft <= 30) {
                  statusText = `${daysLeft} days left`;
                  rowClass = "near-expiry";
                } else {
                  statusText = `${daysLeft} days left`;
                  rowClass = "";
                }
              }
            }

            const canEditOrDeleteRecord = (userRole === "Super User" && row.site === userSite && row.recordId && row.uploadedBy === userData.uid) || userRole === "Admin" || userRole === "Super Admin";

            return (
              <tr key={row.id} className={rowClass}>
                <td>{row.region || "-"}</td>
                <td>{row.circle || "-"}</td>
                <td>{row.site || "-"}</td>
                <td>{row.complianceType}</td>
                <td>{row.issueDate || "-"}</td>
                <td>{row.expiryDate || "-"}</td>
                <td>
                  {hasDocument ? <a href={row.fileUrl} target="_blank" rel="noreferrer">{statusText}</a> : statusText}
                </td>

                <td>
                  {/* Edit goes to ManageCompliance with query param (page handles it) */}
                  {(userRole === "Admin" || userRole === "Super Admin") && (
                    <>
                      <Link to={`/manage-compliance?editTemplate=${row.templateId}`} className="btn-primary">✏️ Edit Template</Link>
                      &nbsp;
                    </>
                  )}

                  {canEditOrDeleteRecord && row.recordId && (
                    <>
                      <Link to={`/manage-compliance?editRecord=${row.recordId}`} className="btn-secondary">✏️ Edit Record</Link>
                      <button className="btn-danger" style={{ marginLeft: 6 }} onClick={() => handleDeleteRecord(row.recordId)}>❌</button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
