// src/pages/Register.js
import React, { useState } from "react";
import { auth, db } from "../firebase";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, query, collection, getDocs, where, addDoc, serverTimestamp } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";
import "../assets/Register.css";
import Vertiv from "../assets/vertiv.png";
import { regions, siteList, siteIdMap } from "../config/siteConfigs";

const Register = () => {
  const [formData, setFormData] = useState({
    name: "",
    empId: "",  // <-- new field
    mobileNo: "",
    email: "",
    password: "",
    designation: "",
    region: "",
    circle: "",
    site: "",
    siteId: "",   // <-- new field
  });

  const [availableCircles, setAvailableCircles] = useState([]);
  const [availableSites, setAvailableSites] = useState([]);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const navigate = useNavigate();
  const [registering, setRegistering] = useState(false);

  const designations = [
    "Vertiv ZM",
    "Vertiv CIH",
    "Vertiv Site Infra Engineer",
    "Vertiv Supervisor",
    "Vertiv Technician",
    "LT Panel Engg.(Alexis)",
    "Site Infra Manager(Nxtra)"
  ];

  const getRoleFromDesignation = (designation) => {
    return designation === "Vertiv Technician" ? "User" : "Super User";
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Update dependent fields when region or circle changes
    if (name === "region") {
      setAvailableCircles(regions[value] || []);
      setFormData(prev => ({
        ...prev,
        circle: "",
        site: ""
      }));
      setAvailableSites([]);
    } else if (name === "circle") {
      const sitesForCircle = siteList[formData.region]?.[value] || [];
      setAvailableSites(sitesForCircle);
      setFormData(prev => ({
        ...prev,
        site: sitesForCircle.length > 0 ? sitesForCircle[0] : "",
        siteId: sitesForCircle.length > 0 ? siteIdMap[sitesForCircle[0]] || "" : "",
      }));
    } else if (name === "site") {
      // When site changes, set siteId accordingly
      setFormData((prev) => ({
        ...prev,
        siteId: siteIdMap[value] || "",
      }));
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setRegistering(true);

    try {
      const role = getRoleFromDesignation(formData.designation);

      const { user } = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      await updateProfile(user, { displayName: formData.name });
      await sendEmailVerification(user);

      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        name: formData.name,
        empId: formData.empId,
        mobileNo: formData.mobileNo,
        email: formData.email,
        region: formData.region,
        circle: formData.circle,
        site: formData.site,
        siteId: formData.siteId,
        role,
        designation: formData.designation,
        isActive: false,
        createdAt: new Date().toISOString()
      });

      // Notify Admin
      const adminQuery = query(
        collection(db, "users"),
        where("role", "in", ["Admin", "Super Admin"]),
        where("site", "==", formData.site)
      );

      const adminSnap = await getDocs(adminQuery);
      const todayISO = new Date().toISOString().split("T")[0];

      for (const adminDoc of adminSnap.docs) {
        await addDoc(
          collection(db, "notifications", adminDoc.id, "items"),
          {
            title: "New Registration",
            message:
              `New membership request

UID: ${user.uid}
Name: ${formData.name}
Emp ID: ${formData.empId}
Mobole No: ${formData.mobileNo}
Email: ${formData.email}

Region: ${formData.region}
Circle: ${formData.circle}
Site: ${formData.site} (${formData.siteId})
Role: ${role}
Designation: ${formData.designation}`,

            date: todayISO,
            createdAt: serverTimestamp(),

            site: formData.site,
            siteId: formData.siteId,

            actionType: "registration_request",
            requesterId: user.uid,
            roleRequested: role,
            designation: formData.designation,

            read: false
          }
        );
      }


      setSuccessMsg("Registered successfully. Please verify your email.");
      setFormData({
        name: "",
        empId: "",
        mobileNo:"",
        email: "",
        password: "",
        designation: "",
        region: "",
        circle: "",
        site: ""
      });
      setRegistering(false);
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError("Registration error: " + err.message);
    }
  };

  return (
    <div className="auth-container">
      <form onSubmit={handleRegister} className="auth-form" style={{
        background: "rgba(255, 255, 255, 0.1)",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(255, 255, 255, 0.2)",
        borderRadius: "10px",
        padding: "2rem",
        maxWidth: "400px",
      }}>

        <h2>
          <img
            src={Vertiv}
            alt="Vertiv Logo"
            className="logo"
            style={{
              height: '2.5em',
              verticalAlign: 'middle',
              margin: '0 0.2em'
            }}
          />
        </h2>
        <h2 style={{ color: "white" }}>Employee Register</h2>
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
          type="text"
          name="empId"
          placeholder="Employee ID"
          value={formData.empId}
          onChange={handleChange}
          required
          className="w-full p-2 mb-2 border rounded"
        />

        <input
          type="number"
          name="mobileNo"
          placeholder="Mobile No"
          value={formData.mobileNo}
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

        <label className="block text-sm mb-1">Designation</label>
        <select
          name="designation"
          value={formData.designation}
          onChange={handleChange}
          required
          className="w-full p-2 mb-2 border rounded"
        >
          <option value="">-- Select Designation --</option>
          {designations.map((desig) => (
            <option key={desig} value={desig}>{desig}</option>
          ))}
        </select>

        <label className="block text-sm mb-1">Region</label>
        <select
          name="region"
          value={formData.region}
          onChange={handleChange}
          required
          className="w-full p-2 mb-2 border rounded"
        >
          <option value="">-- Select Region --</option>
          {Object.keys(regions).map(region => (
            <option key={region} value={region}>{region}</option>
          ))}
        </select>

        <label className="block text-sm mb-1">Circle</label>
        <select
          name="circle"
          value={formData.circle}
          onChange={handleChange}
          required
          disabled={!formData.region}
          className="w-full p-2 mb-2 border rounded"
        >
          <option value="">-- Select Circle --</option>
          {availableCircles.map(circle => (
            <option key={circle} value={circle}>{circle}</option>
          ))}
        </select>

        <label className="block text-sm mb-1">Site</label>
        <select
          name="site"
          value={formData.site}
          onChange={handleChange}
          required
          disabled={!formData.circle}
          className="w-full p-2 mb-4 border rounded"
        >
          <option value="">-- Select Site --</option>
          {availableSites.map(site => (
            <option key={site} value={site}>{site}</option>
          ))}
        </select>

        <button
          type="submit"
          className="auth-button"
        >
          {registering ? "Registering..." : "Register"}
        </button>

        <Link to={"/login"}>
          <button
            className="auth-button"
            type="button"
          >
            Already have an account? Login
          </button>
        </Link>
      </form>
    </div>
  );
};

export default Register;