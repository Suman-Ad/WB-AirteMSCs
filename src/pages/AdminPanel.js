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
  const [cardFilter, setCardFilter] = useState("");

  const [roleCounts, setRoleCounts] = useState({
    "Super Admin": 0,
    "Admin": 0,
    "Super User": 0,
    "User": 0,
    "Total": 0
  });
  const [searchName, setSearchName] = useState("");
  const [tempAdminDraft, setTempAdminDraft] = useState({
    from: "",
    to: ""
  });

  const validateTempAdminPeriod = (from, to) => {
    if (!from || !to) return "From and To dates are required";

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (fromDate > toDate) return "From date cannot be after To date";

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (toDate < today) return "To date cannot be in the past";

    return null;
  };

  const assignTempAdmin = async (userId) => {
    const error = validateTempAdminPeriod(
      tempAdminDraft.from,
      tempAdminDraft.to
    );

    if (error) {
      alert(error);
      return;
    }

    try {
      await updateDoc(doc(db, "users", userId), {
        isAdminAssigned: true,
        adminAssignFrom: tempAdminDraft.from,
        adminAssignTo: tempAdminDraft.to,
      });

      setTempAdminDraft({ from: "", to: "" });
      fetchAllUsers();
      alert("Temporary admin access assigned");
    } catch (err) {
      console.error("Temp admin assign failed", err);
    }
  };

  const removeTempAdmin = async (userId) => {
    if (!window.confirm("Remove temporary admin access?")) return;

    try {
      await updateDoc(doc(db, "users", userId), {
        isAdminAssigned: false,
        adminAssignFrom: "",
        adminAssignTo: "",
      });

      fetchAllUsers();
    } catch (err) {
      console.error("Remove temp admin failed", err);
    }
  };

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

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    data.forEach(async (u) => {
      if (u.isAdminAssigned && u.adminAssignTo) {
        const end = new Date(u.adminAssignTo);
        if (end < today) {
          await updateDoc(doc(db, "users", u.id), {
            isAdminAssigned: false
          });
        }
      }
    });

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

  const isTempAdminValid = (user) => {
    if (!user.isAdminAssigned) return false;
    if (!user.adminAssignFrom || !user.adminAssignTo) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const from = new Date(user.adminAssignFrom);
    const to = new Date(user.adminAssignTo);
    to.setHours(23, 59, 59, 999);

    return today >= from && today <= to;
  };

  const tempAdminCount = users.filter(
    (u) => isTempAdminValid(u)
  ).length;

  const handleCardFilter = (filterKey) => {
    setCardFilter((prev) => (prev === filterKey ? "" : filterKey));
  };


  return (
    <div className="admin-panel">
      <h2 className="dashboard-header">🧑‍💻👁️ Admin User Control Panel</h2>
      {userData.role === "Super Admin" && (
        <p className="admin-subtitle">🔐 Full access granted. Click edit button to modify user info.</p>
      )}

      {(["Admin", "Super Admin"].includes(userData.role)) && (
        <div className="admin-table-wrapper mt-10 child-container">
          <h3 className="admin-subtitle">👥 User Role Management</h3>

          {/* User Count Statistics */}

          <div className="user-stats-container">
            <div
              className={`user-stat-card total ${cardFilter === "ALL" ? "active" : ""}`}
              onClick={() => handleCardFilter("ALL")}
            >
              <span className="stat-number">{roleCounts.Total}</span>
              <span className="stat-label">Total Users</span>
            </div>

            <div
              className={`user-stat-card super-admin ${cardFilter === "Super Admin" ? "active" : ""}`}
              onClick={() => handleCardFilter("Super Admin")}
            >
              <span className="stat-number">{roleCounts["Super Admin"]}</span>
              <span className="stat-label">Super Admins</span>
            </div>

            <div
              className={`user-stat-card admin ${cardFilter === "Admin" ? "active" : ""}`}
              onClick={() => handleCardFilter("Admin")}
            >
              <span className="stat-number">{roleCounts["Admin"]}</span>
              <span className="stat-label">Admins</span>
            </div>

            <div
              className={`user-stat-card temp-admin ${cardFilter === "Temp Admin" ? "active" : ""}`}
              onClick={() => handleCardFilter("Temp Admin")}
            >
              <span className="stat-number">{tempAdminCount}</span>
              <span className="stat-label">Temp Admin</span>
            </div>

            <div
              className={`user-stat-card super-user ${cardFilter === "Super User" ? "active" : ""}`}
              onClick={() => handleCardFilter("Super User")}
            >
              <span className="stat-number">{roleCounts["Super User"]}</span>
              <span className="stat-label">Super Users</span>
            </div>

            <div
              className={`user-stat-card user ${cardFilter === "User" ? "active" : ""}`}
              onClick={() => handleCardFilter("User")}
            >
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

          <div className="mb-4">
            <label>Search by Name: </label>
            <input
              type="text"
              placeholder="Enter name..."
              className="border p-1 rounded ml-2"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
            />
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
                  {(userData.role === "Admin" || userData.role === "Super Admin") && (
                    <th>UID</th>
                  )}
                    <th>Actions</th>

                </tr>
              </thead>
              <tbody>
                {users
                  .filter((user) =>
                    !userSiteFilter || user.site === userSiteFilter
                  )
                  .filter((user) =>
                    user.name?.toLowerCase().includes(searchName.toLowerCase())
                  )
                  .filter((user) => {
                    if (!cardFilter || cardFilter === "ALL") return true;

                    if (cardFilter === "Temp Admin") {
                      return isTempAdminValid(user);
                    }

                    return user.role === cardFilter;
                  })
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
                        {(userData.role === "Admin" || userData.role === "Super Admin") && (
                          <td data-label="UID">{user.uid}</td>
                        )}
                        <td data-label="Actions">
                          <div className="action-buttons">
                            {["Admin", "Super Admin"].includes(userData.role) && user.id !== userData.uid && (
                              <div className="temp-admin-box">
                                {user.isAdminAssigned ? (
                                  <>
                                    <span className="temp-admin-badge">
                                      Temp Admin<br />
                                      {user.adminAssignFrom} → {user.adminAssignTo}
                                    </span>
                                    <button
                                      className="btn-demote"
                                      onClick={() => removeTempAdmin(user.id)}
                                    >
                                      Remove
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <input
                                      type="date"
                                      value={tempAdminDraft.from}
                                      onChange={(e) =>
                                        setTempAdminDraft(d => ({ ...d, from: e.target.value }))
                                      }
                                    />
                                    <input
                                      type="date"
                                      value={tempAdminDraft.to}
                                      onChange={(e) =>
                                        setTempAdminDraft(d => ({ ...d, to: e.target.value }))
                                      }
                                    />
                                    <button
                                      className="btn-promote"
                                      onClick={() => assignTempAdmin(user.id)}
                                    >
                                      Temp Admin
                                    </button>
                                  </>
                                )}
                              </div>
                            )}

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