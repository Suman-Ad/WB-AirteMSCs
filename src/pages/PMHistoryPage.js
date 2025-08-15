import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import "../assets/PMHistoryPage.css";

const PMHistoryPage = ({ userData }) => {
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [typeFilter, setTypeFilter] = useState("All");
  const [monthFilter, setMonthFilter] = useState("");

  useEffect(() => {
    const fetchUploads = async () => {
      setLoading(true);
      try {
        const uploadsRef = collection(db, "pm_reports");
        let q;

        if (["Admin", "Super Admin"].includes(userData.role)) {
          q = query(uploadsRef, orderBy("timestamp", "desc"));
        } else {
          q = query(
            uploadsRef,
            where("site", "==", userData.site),
            orderBy("timestamp", "desc")
          );
        }

        const snapshot = await getDocs(q);
        const result = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setUploads(result);
      } catch (err) {
        console.error("Error fetching uploads:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUploads();
  }, [userData]);

  const filteredUploads = uploads.filter((upload) => {
    const matchType = typeFilter === "All" || upload.type === typeFilter;
    const matchMonth = !monthFilter || upload.month === monthFilter;
    return matchType && matchMonth;
  });

  const groupedBySite = filteredUploads.reduce((acc, item) => {
    acc[item.site] = acc[item.site] || [];
    acc[item.site].push(item);
    return acc;
  }, {});

  const handleDownloadZip = async (siteUploads, site) => {
    const zip = new JSZip();
    let fileAdded = false;

    for (const upload of siteUploads) {
      try {
        const response = await fetch(upload.fileUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();

        const folder = zip.folder(upload.type); // "Vendor" or "In-House"
        const rawFileName = upload.fileUrl.split("/").pop().split("?")[0];
        const cleanFileName = decodeURIComponent(rawFileName);

        folder.file(cleanFileName, blob);
        fileAdded = true;
      } catch (err) {
        console.error(`❌ Failed to fetch file: ${upload.fileUrl}`, err);
      }
    }

    if (!fileAdded) {
      alert("⚠️ No files could be downloaded. Please check if the URLs are accessible.");
      return;
    }

    try {
      const zipBlob = await zip.generateAsync({ type: "blob" });
      saveAs(zipBlob, `PM_Reports_${site}_${Date.now()}.zip`);
    } catch (err) {
      console.error("❌ Failed to generate ZIP:", err);
      alert("❌ Error generating ZIP file.");
    }
  };


  const handleDelete = async (id) => {
    if (window.confirm("Delete this PM report?")) {
      await deleteDoc(doc(db, "pm_reports", id));
      setUploads((prev) => prev.filter((r) => r.id !== id));
    }
  };

  const handleEditClick = (report) => {
    setEditingId(report.id);
    setEditData({
      month: report.month,
      type: report.type,
      vendorName: report.vendorName || "",
      equipmentName: report.equipmentName || "",
    });
  };

  const handleEditSave = async (id) => {
    const ref = doc(db, "pm_reports", id);
    const updated = {
      month: editData.month,
      type: editData.type,
      vendorName: editData.type === "Vendor" ? editData.vendorName : null,
      equipmentName: editData.type === "In-House" ? editData.equipmentName : null,
    };

    await updateDoc(ref, updated);
    setEditingId(null);
    setEditData({});

    const refreshed = uploads.map((r) =>
      r.id === id ? { ...r, ...updated } : r
    );
    setUploads(refreshed);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  return (
    <div className="dhr-dashboard-container">
      <h2 className="pm-history-title">📁 Uploaded PM History</h2>

      {/* Filters */}
      <div className="pm-history-filter">
        <label>Type:</label>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="All">All</option>
          <option value="In-House">In-House</option>
          <option value="Vendor">Vendor</option>
        </select>

        <label style={{ marginLeft: "1rem" }}>Month:</label>
        <input
          type="month"
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="loading">Loading...</p>
      ) : Object.keys(groupedBySite).length === 0 ? (
        <p className="no-data">No uploads found.</p>
      ) : (
        Object.keys(groupedBySite).map((site) => (
          <div key={site} className="pm-site-group">
            <h3 className="pm-site-title">
              🏢 {site}
              {["Admin", "Super Admin"].includes(userData.role) && (
                <button
                  className="zip-btn"
                  onClick={() => handleDownloadZip(groupedBySite[site], site)}
                >
                  ⬇️ Download All as ZIP
                </button>
              )}
            </h3>

            <table className="pm-history-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Type</th>
                  <th>Vendor / Equipment</th>
                  <th>Uploaded By</th>
                  <th>Uploaded On</th>
                  <th>PDF</th>
                  {["Admin", "Super Admin"].includes(userData.role) && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {groupedBySite[site].map((upload) => (
                  <tr key={upload.id}>
                    {editingId === upload.id ? (
                      <>
                        <td>
                          <input
                            type="month"
                            value={editData.month}
                            onChange={(e) =>
                              setEditData({ ...editData, month: e.target.value })
                            }
                          />
                        </td>
                        <td>
                          <select
                            value={editData.type}
                            onChange={(e) =>
                              setEditData({ ...editData, type: e.target.value })
                            }
                          >
                            <option value="In-House">In-House</option>
                            <option value="Vendor">Vendor</option>
                          </select>
                        </td>
                        <td>
                          {editData.type === "Vendor" ? (
                            <input
                              type="text"
                              placeholder="Vendor Name"
                              value={editData.vendorName}
                              onChange={(e) =>
                                setEditData({
                                  ...editData,
                                  vendorName: e.target.value,
                                })
                              }
                            />
                          ) : (
                            <input
                              type="text"
                              placeholder="Equipment Name"
                              value={editData.equipmentName}
                              onChange={(e) =>
                                setEditData({
                                  ...editData,
                                  equipmentName: e.target.value,
                                })
                              }
                            />
                          )}
                        </td>
                        <td>{upload.uploadedBy?.name}</td>
                        <td>{upload.timestamp?.toDate().toLocaleString()}</td>
                        <td>—</td>
                        <td>
                          <button onClick={() => handleEditSave(upload.id)}>Save</button>
                          <button onClick={handleCancelEdit}>Cancel</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{upload.month}</td>
                        <td>{upload.type}</td>
                        <td>
                          {upload.type === "Vendor"
                            ? upload.vendorName || "—"
                            : upload.equipmentName || "—"}
                        </td>
                        <td>{upload.uploadedBy?.name}</td>
                        <td>{upload.timestamp?.toDate().toLocaleString()}</td>
                        <td>
                          <a
                            href={upload.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="view-link"
                          >
                            View PDF
                          </a>
                        </td>
                        {["Admin", "Super Admin"].includes(userData.role) && (
                          <td>
                            <button onClick={() => handleEditClick(upload)}>Edit</button>
                            <button onClick={() => handleDelete(upload.id)}>Delete</button>
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
};

export default PMHistoryPage;
