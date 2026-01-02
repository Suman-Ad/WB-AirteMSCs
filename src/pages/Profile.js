import React, { useState, useEffect } from "react";
import { db, storage, auth } from "../firebase";
import {
  doc,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import {
  getAuth,
  updateProfile,
  sendPasswordResetEmail
} from "firebase/auth";
import {
  ref,
  uploadBytes,
  getDownloadURL
} from "firebase/storage";
import { useNavigate } from "react-router-dom";
import "../assets/Profile.css";
import { updateLocalUserData } from "../utils/userStorage";

const ProfilePage = ({ userData }) => {
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({
    name: "",
    site: "",
    designation: "",
    photoURL: "",
    region: "",
    circle: "",
    siteId: "",
    empId: "",
    mobileNo: "",
  });
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await auth.signOut();
    localStorage.removeItem("userData");
    navigate("/login");
  };

  useEffect(() => {
    if (userData) {
      setForm({
        name: userData.name || "",
        site: userData.site || "",
        designation: userData.designation || "",
        photoURL: userData.photoURL || "",
        region: userData.region || "",
        circle: userData.circle || "",
        siteId: userData.siteId || "",
        empId: userData.empId || "",
        mobileNo: userData.mobileNo || "",
      });
    }
  }, [userData]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith("image/")) {
      setPhoto(file);
    } else {
      alert("Please select a valid image file.");
    }
  };

  const handleSave = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return;

    setSaving(true);
    try {
      let photoURL = form.photoURL;

      if (photo) {
        const photoRef = ref(storage, `profile_photos/${user.uid}.jpg`);
        await uploadBytes(photoRef, photo);
        photoURL = await getDownloadURL(photoRef);
      }

      // Firestore update
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        name: form.name,
        site: form.site,
        designation: form.designation,
        region: form.region,
        circle: form.circle,
        siteId: form.siteId,
        empId: form.empId,
        mobileNo: form.mobileNo,
        photoURL
      });

      // Firebase Auth update
      await updateProfile(user, {
        displayName: form.name,
        photoURL
      });

      const updatedUser = updateLocalUserData({
        name: form.name,
        designation: form.designation,
        site: form.site,
        siteId: form.siteId,
        empId: form.empId,
        mobileNo:form.mobileNo,
        photoURL,
      });

      if (updatedUser) {
        // optional: update parent state if passed
        // setUserData(updatedUser);
      }

      alert("Profile updated!");
      setEditMode(false);
      setPhoto(null);
    } catch (err) {
      console.error("Update error:", err);
      alert("Failed to update profile.");
    }
    setSaving(false);
  };

  const handleResetPassword = async () => {
    const auth = getAuth();
    if (userData?.email) {
      await sendPasswordResetEmail(auth, userData.email);
      alert("Password reset email sent!");
    }
  };

  return (
    <div className="profile-container child-container">
      <h2 className="dashboard-header">👤 Profile</h2>

      {/* Profile Image */}
      <div className="profile-image-section">
        <img
          src={form.photoURL || "/default-avatar.png"}
          alt="Profile"
          className="profile-avatar"
          style={{ width: "300px", height: "300px", borderRadius: "50%" }}
        />
        <p style={{ color: "whitesmoke", background: `${userData?.isActive ? "Green" : "Red"}`, height: "fit-content", borderRadius: "6px", borderBottom: "1px solid" }}>{userData?.isActive ? "Active" : "Inactive"}</p>
      </div>

      {editMode && (
        <div className="profile-row">
          <label>Change Profile Picture:</label>
          <input type="file" accept="image/*" onChange={handlePhotoChange} />
        </div>
      )}

      {/* Name */}
      <div className="profile-row">
        <label>🪪 Name:</label>
        {editMode ? (
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
          />
        ) : (
          <span className="profile-row span">{form.name}</span>
        )}
      </div>

      {/* Designation */}
      <div className="profile-row">
        <label> 🎖️ Designation:</label>
        {editMode ? (
          <input
            type="text"
            name="designation"
            value={form.designation}
            onChange={handleChange}
          />
        ) : (
          <span className="profile-row span">{form.designation || "N/A"}</span>
        )}
      </div>

      {/* Employee ID */}
      <div className="profile-row">
        <label>📇 EMP. ID:</label>
        {editMode ? (
          <input
            type="text"
            name="empId"
            value={form.empId}
            onChange={handleChange}
          />
        ) : (
          <span className="profile-row span">{form.empId}</span>
        )}
      </div>

      {/* Mobile No */}
      <div className="profile-row">
        <label>📇 Mobile No.:</label>
        {editMode ? (
          <input
            type="number"
            name="mobileNo"
            value={form.mobileNo}
            onChange={handleChange}
          />
        ) : (
          <span className="profile-row span">{form.mobileNo}</span>
        )}
      </div>

      {/* Email */}
      <div className="profile-row">
        <label>📧 Email:</label>
        <span>{userData?.email || "Missing email"}</span>
      </div>

      {/* Site */}
      <div className="profile-row">
        <label>🏢 Site:</label>
        {editMode && userData?.role === "Admin" ? (
          <input
            type="text"
            name="site"
            value={form.site}
            onChange={handleChange}
          />
        ) : (
          <span>{form.site || "N/A"}</span>
        )}
      </div>

      {/* Site ID */}
      <div className="profile-row">
        <label>🆔 Site ID:</label>
        {editMode && userData?.role === "Admin" ? (
          <input
            type="text"
            name="siteId"
            value={form.siteId}
            onChange={handleChange}
          />
        ) : (
          <span>{form.siteId || "N/A"}</span>
        )}
      </div>


      {/* Circle */}
      <div className="profile-row">
        <label>⭕ Circle:</label>
        <span>{userData?.circle}</span>
      </div>

      {/* Region */}
      <div className="profile-row">
        <label>🗺️ Region:</label>
        <span>{userData?.region}</span>
      </div>

      {/* Role */}
      <div className="profile-row">
        <label>🎭 Role:</label>
        <span>{userData?.role}</span>
      </div>

      {/* Actions */}
      <div className="profile-actions">
        {editMode ? (
          <>
            <button onClick={handleSave} className="save-btn" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
            <button onClick={() => setEditMode(false)} className="cancel-btn">
              Cancel
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setEditMode(true)} className="edit-btn">
              ✏️ Edit Profile
            </button>
            <button onClick={handleResetPassword} className="reset-btn">
              🔐 Change Password
            </button>
            <button onClick={handleLogout} className="logout-manage-btn">
              📴 Logout
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
