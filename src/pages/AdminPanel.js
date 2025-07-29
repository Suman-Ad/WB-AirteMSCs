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
  updateDoc
} from "firebase/firestore";
import "../assets/AdminPanel.css";

const AdminPanel = ({ userData }) => {
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);

  // Filters
  const [siteFilter, setSiteFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [searchUploader, setSearchUploader] = useState("");

  // Fetch all PM reports
  const fetchAllReports = async () => {
    const q = query(collection(db, "pm_reports"), orderBy("timestamp", "desc"));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setReports(data);
    setFilteredReports(data);
  };

  // Fetch all users
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

  // Apply filters
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

    if (userData.role === "Super Admin") {
      // Super Admin can change anyone's role (including own if needed)
      return true;
    }

    if (userData.role === "Admin") {
      if (isSelf) return false; // Admin cannot promote/demote self
      if (targetUserRole === "Super Admin") return false; // Admin cannot touch Super Admin
      return true; // Admin can manage users, super users, and other admins
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
          {[
            "Andaman", "Asansol", "Berhampore", "DLF", "GLOBSYN",
            "Infinity-I", "Infinity-II", "Kharagpur", "Mira Tower",
            "New Alipore", "SDF", "Siliguri"
          ].map((site) => (
            <option key={site} value={site}>{site}</option>
          ))}
        </select>

        <input
          type="month"
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
        />

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

      {/* PM Report Table */}
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
                  <td>{report.site}</td>
                  <td>{report.month}</td>
                  <td>{report.type}</td>
                  <td>{report.type === "Vendor" ? report.vendorName : report.equipmentName}</td>
                  <td>
                    <a href={report.fileUrl} target="_blank" rel="noopener noreferrer">
                      View
                    </a>
                  </td>
                  <td>
                    {report.uploadedBy?.name}
                    <br />
                    <small>{report.uploadedBy?.email}</small>
                  </td>
                  <td>{report.timestamp?.toDate().toLocaleString()}</td>
                  <td>
                    <button className="delete-btn" onClick={() => handleDelete(report.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="no-records">No matching records found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* User Role Management */}
      {["Admin", "Super Admin"].includes(userData.role) && (
        <div className="admin-table-wrapper mt-10">
          <h3 className="admin-subtitle">👥 User Role Management</h3>
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
              {users.map((user) => {
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
