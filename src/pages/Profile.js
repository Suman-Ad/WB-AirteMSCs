// src/pages/ProfilePage.js
import React, { useState, useEffect } from "react";
import { db, storage } from "../firebase";
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
import "../assets/Profile.css";

const ProfilePage = ({ userData }) => {
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({
    name: "",
    site: "",
    photoURL: ""
  });
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (userData) {
      setForm({
        name: userData.name || "",
        site: userData.site || "",
        photoURL: userData.photoURL || ""
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

      // Upload new profile photo if selected
      if (photo) {
        const photoRef = ref(storage, `profile_photos/${user.uid}.jpg`);
        await uploadBytes(photoRef, photo);
        photoURL = await getDownloadURL(photoRef);
      }

      // Update Firestore
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        name: form.name,
        site: form.site,
        photoURL
      });

      // Update Firebase Auth profile
      await updateProfile(user, {
        displayName: form.name,
        photoURL
      });

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
    <div className="profile-container">
      <h2 className="profile-title">👤 Profile</h2>

      {/* Profile Image */}
      {form.photoURL && (
        <img
          src={form.photoURL}
          alt="Profile"
          className="profile-avatar"
        />
      )}

      {editMode && (
        <div className="profile-row">
          <label>Change Profile Picture:</label>
          <input type="file" accept="image/*" onChange={handlePhotoChange} />
        </div>
      )}

      {/* Name */}
      <div className="profile-row">
        <label>Name:</label>
        {editMode ? (
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
          />
        ) : (
          <span>{form.name}</span>
        )}
      </div>

      {/* Email */}
      <div className="profile-row">
        <label>Email:</label>
        <span>{userData?.email}</span>
      </div>

      {/* Site */}
      <div className="profile-row">
        <label>Site:</label>
        {editMode ? (
          <select name="site" value={form.site} onChange={handleChange}>
            <option value="">--Select Site--</option>
            {[
              "Andaman", "Asansol", "Berhampore", "DLF", "GLOBSYN",
              "Infinity-I", "Infinity-II", "Kharagpur", "Mira Tower",
              "New Alipore", "SDF", "Siliguri"
            ].map((site) => (
              <option key={site} value={site}>
                {site}
              </option>
            ))}
          </select>
        ) : (
          <span>{form.site || "N/A"}</span>
        )}
      </div>

      {/* Role */}
      <div className="profile-row">
        <label>Role:</label>
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
              Edit Profile
            </button>
            <button onClick={handleResetPassword} className="reset-btn">
              Change Password
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
