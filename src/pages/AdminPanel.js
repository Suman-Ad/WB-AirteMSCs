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
  const [users, setUsers] = useState([]);
  const [userSiteFilter, setUserSiteFilter] = useState("");
  const [editingUserId, setEditingUserId] = useState(null);
  const [roleCounts, setRoleCounts] = useState({
    "Super Admin": 0,
    "Admin": 0,
    "Super User": 0,
    "User": 0,
    "Total": 0
  });

  const siteList = [
    "Andaman", "Asansol", "Berhampore", "DLF", "Globsyn",
    "Infinity-I", "Infinity-II", "Kharagpur", "Mira Tower",
    "New Alipore", "SDF", "Siliguri"
  ];

  const fetchAllUsers = async () => {
    const snapshot = await getDocs(collection(db, "users"));
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setUsers(data);
    updateRoleCounts(data);
  };

  const updateRoleCounts = (users) => {
    const counts = {
      "Super Admin": 0,
      "Admin": 0,
      "Super User": 0,
      "User": 0,
      "Total": users.length
    };

    users.forEach(user => {
      if (counts.hasOwnProperty(user.role)) {
        counts[user.role]++;
      } else {
        counts["User"]++;
      }
    });

    setRoleCounts(counts);
  };

  useEffect(() => {
    if (["Admin", "Super Admin"].includes(userData.role)) {
      fetchAllUsers();
    }
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    try {
      await updateDoc(doc(db, "users", userId), { role: newRole });
      fetchAllUsers();
    } catch (error) {
      console.error("Role update failed:", error);
    }
  };

  const handleUserFieldEdit = async (userId, field, newValue) => {
    try {
      await updateDoc(doc(db, "users", userId), { [field]: newValue });
      fetchAllUsers();
    } catch (err) {
      console.error("Update failed:", err);
    }
  };

  const canChangeRole = (targetUserRole, targetUserId) => {
    if (!userData) return false;
    const isSelf = targetUserId === userData.uid;
    
    if (userData.role === "Super Admin") return true;
    
    if (userData.role === "Admin") {
      if (isSelf || targetUserRole === "Super Admin") return false;
      if (targetUserRole === "Admin") return false;
      return true;
    }
    return false;
  };

  const getNextRoles = (currentRole) => {
    const roles = ["User", "Super User", "Admin", "Super Admin"];
    const currentIndex = roles.indexOf(currentRole);
    const next = roles[currentIndex + 1];
    const prev = roles[currentIndex - 1];
    
    if (userData.role === "Admin" && next === "Super Admin") {
      return { promote: null, demote: prev };
    }
    
    return { promote: next, demote: prev };
  };

  const toggleEditMode = (userId) => {
    if (editingUserId === userId) {
      setEditingUserId(null);
    } else {
      setEditingUserId(userId);
    }
  };

  const isEditable = (userId) => {
    return userData.role === "Super Admin" && editingUserId === userId;
  };

  return (
    <div className="admin-panel">      
      <h2 className="dashboard-header">🧑‍💻👁️ Admin User Control Panel</h2>
      {userData.role === "Super Admin" && (
        <p className="admin-subtitle">🔐 Full access granted. Click edit button to modify user info.</p>
      )}

      {(["Admin", "Super Admin"].includes(userData.role)) && (
        <div className="admin-table-wrapper mt-10">
          <h3 className="admin-subtitle">👥 User Role Management</h3>

          {/* User Count Statistics */}
          <div className="user-stats-container">
            <div className="user-stat-card total">
              <span className="stat-number">{roleCounts.Total}</span>
              <span className="stat-label">Total Users</span>
            </div>
            <div className="user-stat-card super-admin">
              <span className="stat-number">{roleCounts["Super Admin"]}</span>
              <span className="stat-label">Super Admins</span>
            </div>
            <div className="user-stat-card admin">
              <span className="stat-number">{roleCounts["Admin"]}</span>
              <span className="stat-label">Admins</span>
            </div>
            <div className="user-stat-card super-user">
              <span className="stat-number">{roleCounts["Super User"]}</span>
              <span className="stat-label">Super Users</span>
            </div>
            <div className="user-stat-card user">
              <span className="stat-number">{roleCounts["User"]}</span>
              <span className="stat-label">Users</span>
            </div>
          </div>

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
          
          {/* User Table */}
          <div className="daily-activity-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Designation</th>
                <th>EMP ID</th>
                <th>Email ID</th>
                <th>Site ID</th>
                <th>Site Name</th>
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
                const canPromote = canModify && promote && !(userData.role === "Admin" && promote === "Super Admin");
                
                return (
                  <tr key={user.id}>
                    <td data-label="Name">
                      {userData.role === "Super Admin" ? (
                        isEditable(user.id) ? (
                          <input
                            className="editable-field"
                            value={user.name || ""}
                            onChange={(e) => handleUserFieldEdit(user.id, "name", e.target.value)}
                          />
                        ) : (
                          user.name
                        )
                      ) : user.name}
                    </td>
                    <td data-label="Designation">
                      {userData.role === "Super Admin" ? (
                        isEditable(user.id) ? (
                          <input
                            className="editable-field"
                            value={user.designation || ""}
                            onChange={(e) => handleUserFieldEdit(user.id, "designation", e.target.value)}
                          />
                        ) : (
                          user.designation
                        )
                      ) : user.designation}
                    </td>
                    <td data-label="EMP ID">{user.empId}</td>
                    <td data-label="Email">{user.email}</td>
                    <td data-label="Site ID">{user.siteId}</td>
                    <td data-label="Site">
                      {userData.role === "Super Admin" ? (
                        isEditable(user.id) ? (
                          <select
                            className="editable-field"
                            value={user.site || ""}
                            onChange={(e) => handleUserFieldEdit(user.id, "site", e.target.value)}
                          >
                            <option value="">Select</option>
                            {siteList.map((site) => (
                              <option key={site} value={site}>{site}</option>
                            ))}
                          </select>
                        ) : (
                          user.site
                        )
                      ) : user.site}
                    </td>
                    <td data-label="Role">{user.role}</td>
                    
                    <td data-label="Actions">
                      <div className="action-buttons">
                        {userData.role === "Super Admin" && (
                          <button
                            className={`btn-edit ${editingUserId === user.id ? 'btn-cancel' : ''}`}
                            onClick={() => toggleEditMode(user.id)}
                          >
                            {editingUserId === user.id ? 'Cancel' : 'Edit'}
                          </button>
                        )}
                        {canPromote && (
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
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;