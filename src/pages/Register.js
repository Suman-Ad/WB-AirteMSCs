// src/pages/Register.js
import React, { useState } from "react";
import { auth, db } from "../firebase";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";
import "../assets/Register.css";


const Register = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "User",
    site: "Asansol"
  });
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const navigate = useNavigate();

  const sites = [
    "Andaman", "Asansol", "Berhampore", "DLF", "GLOBSYN",
    "Infinity-I", "Infinity-II", "Kharagpur", "Mira Tower",
    "New Alipore", "SDF", "Siliguri"
  ];

  const roles = ["User", "Super User"]; // Only allow these for signup (Admin roles added manually)

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    try {
      const { user } = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      await updateProfile(user, { displayName: formData.name });

      // Send email verification
      await sendEmailVerification(user);

      // Add user data to Firestore
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        name: formData.name,
        email: formData.email,
        role: formData.role,
        site: formData.site
      });

      setSuccessMsg("Registered successfully. Please check your email to verify before logging in.");
      setFormData({ name: "", email: "", password: "", role: "User", site: "Asansol" });
      navigate("/login");
    } catch (err) {
      setError("Registration error: " + err.message);
    }
  };

  return (
    <div className="auth-container">
      <form onSubmit={handleRegister} className="auth-form">
        <strong><h2>WB Airtel MSC's - Vertiv</h2></strong>
        <h2>Register</h2>
        {error && <p className="auth-error">{error}</p>}
        {successMsg && <p className="auth-success">{successMsg}</p>}

        <input
          type="text"
          name="name"
          placeholder="Full Name"
          value={formData.name}
          onChange={handleChange}
          required
          className="w-full p-2 mb-2 border rounded"
        />
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={formData.email}
          onChange={handleChange}
          required
          className="w-full p-2 mb-2 border rounded"
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          value={formData.password}
          onChange={handleChange}
          required
          className="w-full p-2 mb-2 border rounded"
        />

        <label className="block text-sm mb-1">Role</label>
        <select
          name="role"
          value={formData.role}
          onChange={handleChange}
          className="w-full p-2 mb-2 border rounded"
        >
          {roles.map((role) => (
            <option key={role} value={role}>{role}</option>
          ))}
        </select>

        <label className="block text-sm mb-1">Site</label>
        <select
          name="site"
          value={formData.site}
          onChange={handleChange}
          className="w-full p-2 mb-4 border rounded"
        >
          {sites.map((site) => (
            <option key={site} value={site}>{site}</option>
          ))}
        </select>

        <button
          type="submit"
          className="bg-blue-600 text-white p-2 w-full rounded"
        >
          Register
        </button>
        <Link to={"/login"}>
          <button
            className="bg-blue-600 text-white p-2 w-full rounded mt-2"
          >
            Already have an account? Login
          </button>
          </Link>
      </form>
    </div>
  );
};

export default Register;
