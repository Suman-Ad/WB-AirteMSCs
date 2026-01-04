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
import { siteIdMap } from "../config/siteConfigs";
// import { getFunctions, httpsCallable } from "firebase/functions";
import { updateLocalUserData } from "../utils/userStorage";


const AdminPanel = ({ userData }) => {
  const [users, setUsers] = useState([]);
  const [userSiteFilter, setUserSiteFilter] = useState("");
  const [editingUserId, setEditingUserId] = useState(null);
  const [cardFilter, setCardFilter] = useState("");
  const [onlineCount, setOnlineCount] = useState(0);

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

  const isUserOnline = (user) => {
    if (!user.lastActiveAt) return false;
    const last = user.lastActiveAt.toDate
      ? user.lastActiveAt.toDate()
      : new Date(user.lastActiveAt);

    return (Date.now() - last.getTime()) < 5 * 60 * 1000; // 5 min
  };


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
    // const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const data = snapshot.docs.map((docSnap) => {
      const d = docSnap.data();
      return {
        id: docSnap.id,
        ...d,
        isActive: d.isActive ?? true, // ✅ fallback for old users
      };
    });
    setUsers(data);
    // count online users
    const online = data.filter((u) => isUserOnline(u)).length;
    setOnlineCount(online);
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

  const toggleUserActive = async (userId, currentStatus) => {
    try {
      await updateDoc(doc(db, "users", userId), {
        isActive: !currentStatus,
      });
      fetchAllUsers();
    } catch (err) {
      console.error("Failed to update user status", err);
    }
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
          <div className="summary-card">
            <h3>🟢 Online Users: {onlineCount}</h3>
          </div>

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
                  <th>Live Status</th>
                  <th>Photo</th>
                  <th>Name</th>
                  <th>Designation</th>
                  <th>EMP ID</th>
                  <th>Mobile No.</th>
                  <th>Email ID</th>
                  <th>Site ID</th>
                  <th>Site Name</th>
                  <th>Role</th>
                  <th>Status</th>
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
                        <td>
                          {isUserOnline(user) ? (
                            <span style={{ color: "green" }}>🟢 Online</span>
                          ) : (
                            <span style={{ color: "gray" }}>⚫ Offline</span>
                          )}
                        </td>
                        <td data-label="Photo">
                          {user.photoURL ? (
                            <img
                              src={user.photoURL}
                              alt="User Avatar"
                              className="user-avatar"
                              style={{
                                width: "50px",
                                height: "50px",
                                borderRadius: "50%",
                                border: "2px solid black",
                                cursor: "pointer",
                                transition: "transform 0.2s ease-in-out",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = "scale(3.0)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = "scale(1)";
                              }}
                              onClick={() => window.open(user.photoURL, "_blank")}
                            />
                          ) : (
                            <div className="profile-avatar"
                              style={{
                                width: "50px",
                                height: "50px",
                                borderRadius: "50%",
                                border: "2px solid black",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: "#ccc",
                                fontWeight: "bold",
                                fontSize: "20px",
                                color: "#333",
                              }}>
                              {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                            </div>
                          )}
                        </td>
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

                        <td data-label="EMP ID">
                          {userData.role === "Super Admin" ? (
                            isEditable(user.id) ? (
                              <input
                                className="editable-field"
                                value={user.empId || ""}
                                onChange={(e) => handleUserFieldEdit(user.id, "empId", e.target.value)}
                              />
                            ) : (
                              user.empId
                            )
                          ) : user.empId}
                        </td>

                        <td data-label="Mobile No">{user.mobileNo}</td>
                        <td data-label="Email">{user.email}</td>

                        <td data-label="Site ID">
                          {user.siteId}
                        </td>
                        <td data-label="Site">
                          {/* Site Name column */}
                          {userData.role === "Super Admin" ? (
                            isEditable(user.id) ? (
                              <select
                                value={user.site || ""}
                                onChange={(e) => {
                                  const newSite = e.target.value;
                                  const newSiteId = siteIdMap[newSite] || "";
                                  // update both site and siteId together
                                  handleUserFieldEdit(user.id, "site", newSite);
                                  handleUserFieldEdit(user.id, "siteId", newSiteId);
                                }}
                              >
                                <option value="">Select Site</option>
                                {siteList.map((site) => (
                                  <option key={site} value={site}>
                                    {site}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              user.site
                            )
                          ) : (
                            user.site
                          )}
                        </td>
                        <td data-label="Role">{user.role}</td>
                        <td data-label="Status">
                          <span
                            className={`status-badge ${user.isActive ? "active" : "inactive"}`}
                          >
                            {user.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        {(userData.role === "Admin" || userData.role === "Super Admin") && (
                          <td data-label="UID">{user.uid}</td>
                        )}
                        <td data-label="Actions" style={{ display:"flex"}}>
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
                                    {user?.role !== "Admin" && user?.role !== "Super Admin" && (
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

                            {["Admin", "Super Admin"].includes(userData.role) &&
                              user.id !== userData.uid && (
                                <button
                                  className={user.isActive ? "btn-deactivate" : "btn-activate"}
                                  onClick={() => toggleUserActive(user.id, user.isActive)}
                                >
                                  {user.isActive ? "Deactivate" : "Activate"}
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
                              // <button
                              //   className="btn-delete"
                              //   onClick={async () => {
                              //     if (!window.confirm("Delete this user permanently?")) return;

                              //     try {
                              //       const functions = getFunctions();
                              //       const deleteUserFn = httpsCallable(functions, "deleteUserCompletely");
                              //       await deleteUserFn({ uid: user.id });

                              //       alert("User deleted from Auth & Database");
                              //       fetchAllUsers();
                              //     } catch (err) {
                              //       console.error(err);
                              //       alert(err.message || "Delete failed");
                              //     }
                              //   }}
                              // >
                              //   Delete
                              // </button>
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