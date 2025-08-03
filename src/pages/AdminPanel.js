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

  const siteList = [
    "Andaman", "Asansol", "Berhampore", "DLF", "GLOBSYN",
    "Infinity-I", "Infinity-II", "Kharagpur", "Mira Tower",
    "New Alipore", "SDF", "Siliguri"
  ];

  const fetchAllUsers = async () => {
    const snapshot = await getDocs(collection(db, "users"));
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setUsers(data);
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
      <h2 className="admin-title">Admin User Control Panel</h2>
      {userData.role === "Super Admin" && (
        <p className="admin-subtitle">🔐 Full access granted. Click on fields to edit user info.</p>
      )}

      {(["Admin", "Super Admin"].includes(userData.role)) && (
        <div className="admin-table-wrapper mt-10">
          <h3 className="admin-subtitle">👥 User Role Management</h3>

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
                <th>Designation</th>
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
                    <td>
                      {userData.role === "Super Admin" ? (
                        <input
                          className="editable-field"
                          value={user.name || ""}
                          onChange={(e) => handleUserFieldEdit(user.id, "name", e.target.value)}
                        />
                      ) : user.name}
                    </td>
                    <td>{user.email}</td>
                    <td>
                      {userData.role === "Super Admin" ? (
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
                      ) : user.site}
                    </td>
                    <td>{user.role}</td>
                    <td>
                      {userData.role === "Super Admin" ? (
                        <input
                          className="editable-field"
                          value={user.designation || ""}
                          onChange={(e) => handleUserFieldEdit(user.id, "designation", e.target.value)}
                        />
                      ) : user.designation}
                    </td>
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
