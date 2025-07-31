// src/pages/AdminPanel.js
import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import "../assets/AdminPanel.css";

const AdminPanel = ({ userData }) => {
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [userSiteFilter, setUserSiteFilter] = useState("");


  const siteList = [
    "Andaman", "Asansol", "Berhampore", "DLF", "GLOBSYN",
    "Infinity-I", "Infinity-II", "Kharagpur", "Mira Tower",
    "New Alipore", "SDF", "Siliguri"
  ];

  const fetchAllReports = async () => {
    const q = query(collection(db, "pm_reports"), orderBy("timestamp", "desc"));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setReports(data);
    setFilteredReports(data);
  };

  const fetchAllUsers = async () => {
    const snapshot = await getDocs(collection(db, "users"));
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setUsers(data);
  };

  useEffect(() => {
    fetchAllReports();
    if (["Admin", "Super Admin"].includes(userData.role)) {
      fetchAllUsers();
    }
  }, []);

  const [siteFilter, setSiteFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [searchUploader, setSearchUploader] = useState("");

  useEffect(() => {
    let filtered = reports;
    if (siteFilter) filtered = filtered.filter((r) => r.site === siteFilter);
    if (monthFilter) filtered = filtered.filter((r) => r.month === monthFilter);
    if (typeFilter) filtered = filtered.filter((r) => r.type === typeFilter);
    if (searchUploader)
      filtered = filtered.filter((r) =>
        r.uploadedBy?.name?.toLowerCase().includes(searchUploader.toLowerCase()) ||
        r.uploadedBy?.email?.toLowerCase().includes(searchUploader.toLowerCase())
      );
    setFilteredReports(filtered);
  }, [siteFilter, monthFilter, typeFilter, searchUploader, reports]);

  const handleDelete = async (id) => {
    if (window.confirm("Delete this PM report?")) {
      await deleteDoc(doc(db, "pm_reports", id));
      fetchAllReports();
    }
  };

  const handleDeleteUser = async (id) => {
    if (window.confirm("⚠️ Confirm deleting this user account?")) {
      await deleteDoc(doc(db, "users", id));
      fetchAllUsers();
    }
  };

  const handleEditClick = (report) => {
    setEditingId(report.id);
    setEditData({
      site: report.site,
      month: report.month,
      type: report.type,
      vendorName: report.vendorName || "",
      equipmentName: report.equipmentName || "",
    });
  };

  const handleEditSave = async (id) => {
    const ref = doc(db, "pm_reports", id);
    const payload = {
      site: editData.site,
      month: editData.month,
      type: editData.type,
      vendorName: editData.type === "Vendor" ? editData.vendorName : null,
      equipmentName: editData.type === "In-House" ? editData.equipmentName : null,
    };

    await updateDoc(ref, payload);
    setEditingId(null);
    setEditData({});
    fetchAllReports();
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditData({});
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await updateDoc(doc(db, "users", userId), { role: newRole });
      fetchAllUsers();
    } catch (error) {
      console.error("Role update failed:", error);
    }
  };

  const canChangeRole = (targetUserRole, targetUserId) => {
    if (!userData) return false;
    const isSelf = targetUserId === userData.uid;

    if (userData.role === "Super Admin") return true;
    if (userData.role === "Admin") {
      if (isSelf || targetUserRole === "Super Admin") return false;
      return true;
    }
    return false;
  };

  const getNextRoles = (currentRole) => {
    const roles = ["User", "Super User", "Admin", "Super Admin"];
    const currentIndex = roles.indexOf(currentRole);
    const next = roles[currentIndex + 1];
    const prev = roles[currentIndex - 1];
    return { promote: next, demote: prev };
  };

  return (
    <div className="admin-panel">
      <h2 className="admin-title">Admin Panel</h2>

      {/* Filters */}
      <div className="admin-filters">
        <select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
          <option value="">All Sites</option>
          {siteList.map((site) => (
            <option key={site} value={site}>{site}</option>
          ))}
        </select>

        <input type="month" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} />

        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          <option value="In-House">In-House</option>
          <option value="Vendor">Vendor</option>
        </select>

        <input
          type="text"
          placeholder="Search uploader name/email"
          value={searchUploader}
          onChange={(e) => setSearchUploader(e.target.value)}
        />
      </div>

      {/* PM Reports */}
      <div className="admin-table-wrapper">
        <h3 className="admin-subtitle">📄 PM Reports Management</h3>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Site</th>
              <th>Month</th>
              <th>Type</th>
              <th>Equipment / Vendor</th>
              <th>PDF</th>
              <th>Uploader</th>
              <th>Uploaded On</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredReports.length ? (
              filteredReports.map((report) => (
                <tr key={report.id}>
                  {editingId === report.id ? (
                    <>
                      <td>
                        <select
                          value={editData.site}
                          onChange={(e) => setEditData({ ...editData, site: e.target.value })}
                        >
                          {siteList.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="month"
                          value={editData.month}
                          onChange={(e) => setEditData({ ...editData, month: e.target.value })}
                        />
                      </td>
                      <td>
                        <select
                          value={editData.type}
                          onChange={(e) => setEditData({ ...editData, type: e.target.value })}
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
                            onChange={(e) => setEditData({ ...editData, vendorName: e.target.value })}
                          />
                        ) : (
                          <input
                            type="text"
                            placeholder="Equipment Name"
                            value={editData.equipmentName}
                            onChange={(e) => setEditData({ ...editData, equipmentName: e.target.value })}
                          />
                        )}
                      </td>
                      <td>—</td>
                      <td>{report.uploadedBy?.name}<br /><small>{report.uploadedBy?.email}</small></td>
                      <td>{report.timestamp?.toDate().toLocaleString()}</td>
                      <td>
                        <button onClick={() => handleEditSave(report.id)}>Save</button>
                        <button onClick={handleEditCancel}>Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{report.site}</td>
                      <td>{report.month}</td>
                      <td>{report.type}</td>
                      <td>{report.type === "Vendor" ? report.vendorName : report.equipmentName}</td>
                      <td><a href={report.fileUrl} target="_blank" rel="noreferrer">View</a></td>
                      <td>{report.uploadedBy?.name}<br /><small>{report.uploadedBy?.email}</small></td>
                      <td>{report.timestamp?.toDate().toLocaleString()}</td>
                      <td>
                        <button className="edit-btn" onClick={() => handleEditClick(report)}>Edit</button>
                        <button className="delete-btn" onClick={() => handleDelete(report.id)}>Delete</button>
                      </td>
                    </>
                  )}
                </tr>
              ))
            ) : (
              <tr><td colSpan="8" className="no-records">No matching records found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* User Management */}
      {["Admin", "Super Admin"].includes(userData.role) && (
        <div className="admin-table-wrapper mt-10">
          <h3 className="admin-subtitle">👥 User Role Management</h3>
          {/* Site Filter for Users */}
          <div className="mb-4">
            <label>Filter by Site: </label>
            <select
              value={userSiteFilter}
              onChange={(e) => setUserSiteFilter(e.target.value)}
              className="border p-1 rounded ml-2"
            >
              <option value="">All Sites</option>
              {siteList.map((site) => (
                <option key={site} value={site}>{site}</option>
              ))}
            </select>
          </div>

          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Site</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users
              .filter((user) => !userSiteFilter || user.site === userSiteFilter)
              .map((user) => {
                const { promote, demote } = getNextRoles(user.role);
                const canModify = canChangeRole(user.role, user.id);
                return (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>{user.site}</td>
                    <td>{user.role}</td>
                    <td>
                      {promote && canModify && (
                        <button
                          className="btn-promote"
                          onClick={() => handleRoleChange(user.id, promote)}
                        >
                          Promote to {promote}
                        </button>
                      )}
                      {demote && canModify && (
                        <button
                          className="btn-demote"
                          onClick={() => handleRoleChange(user.id, demote)}
                        >
                          Demote to {demote}
                        </button>
                      )}
                      {!canModify && <span title="Not allowed">🔒</span>}
                      {userData.role === "Super Admin" && user.id !== userData.uid && (
                        <button
                          className="btn-delete"
                          onClick={async () => {
                            if (window.confirm("Delete this user?")) {
                              await deleteDoc(doc(db, "users", user.id));
                              fetchAllUsers();
                            }
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
