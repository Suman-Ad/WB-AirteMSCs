// src/pages/Register.js
import React, { useState } from "react";
import { auth, db } from "../firebase";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";
import "../assets/Register.css";
import Vertiv from "../assets/vertiv.png";

const regions = {
  East: ["BH & JH", "NESA", "OR", "WB"],
  West: ["GUJ", "MPCG", "ROM"],
  North: ["DEL", "HR", "PJ", "RJ", "UP", "UK"],
  South: ["AP", "KA", "KL", "TN", "TS"]
};

const siteList = {
  "East": {
    "BH & JH": ["Patliputra", "Bhaglpur", "Muzaffarpur New", "Muzaffarpur Old", "Ranchi", "Ranchi telenor", "Marwari Awas"],
    "WB": ["Andaman", "Asansol", "Berhampore", "DLF", "Globsyn", "Infinity-I", "Infinity-II", "Kharagpur", "Mira Tower", "New Alipore", "SDF", "Siliguri"],
    "NESA":["Aizwal", "Guwahati", "Jorabat New", "Jorhat", "Shillong"],
    "OR": ["Cuttack", "Sambalpur"],

  },
  "West": {
    "GUJ": ["Astron Park", "Bharti House", "Changodar", "Rajkot Madhapar-New", "Rajkot Mavdi Old", "Surat", "Surat Telenor"],
    "MPCG": ["Bhopal Center 1st floor", "Bhopal Center 4th floor", "Gobindpura", "Gwalior", "Indore Geeta Bhawan", "Jabalpur", "Pardesipura", "Raipur"],
    "ROM": ["Nagpur", "Vega Center", "E-Space", "Kolhapur", "Nagpur New", "Nagpur BTSOL"],
  },
  "North": {
    "DEL": ["DLF", "Mira Tower"],
    "HR": ["GLOBSYN"]
  },
  "South": {
    "KA": ["Infinity-I", "Infinity-II"],
    "TS": ["Siliguri"]
  }
};

// Add this mapping near the top of the file (below siteList)
const siteIdMap = {
  "Astron Park": "N24027A",
  "Bharti House": "N24028A",
  "Changodar": "N24024A",
  "Rajkot Madhapar-New": "N24025A",
  "Rajkot Mavdi Old": "N24026A",
  "Surat": "N24023A",
  "Surat Telenor": "Tel-Surat",
  "Cuttack": "N21062A",
  "Sambalpur": "N21061A",
  "Aizwal": "N15122A",
  "Guwahati": "N18060A",
  "Jorabat New": "N18059A",
  "Jorhat": "N17121A",
  "Shillong": "NET006263",
  "Patliputra": "N10009A",
  "Bhaglpur": "N10011A",
  "Muzaffarpur New": "N10010A",
  "Muzaffarpur Old": "N10012A",
  "Ranchi": "N20029A",
  "Ranchi telenor": "Tel-Ranchi",
  "Marwari Awas": "N10013A",
  "Bhopal Center 1st floor": "N23044A",
  "Bhopal Center 4th floor": "N23045B",
  "Gobindpura": "N23048A",
  "Gwalior": "N23046A",
  "Indore Geeta Bhawan": "N23042A",
  "Jabalpur": "N23043A",
  "Pardesipura": "N23047A",
  "Raipur": "N22014A",
  "Nagpur": "N27066A",
  "Vega Center": "N27064A",
  "E-Space": "N27065A",
  "Kolhapur": "N27067A",
  "Nagpur New": "N27068A",
  "Nagpur BTSOL": "N27069A",
  "Andaman": "N35113A",
  "Asansol": "N19106A",
  "Berhampore": "N19104A",
  "Globsyn": "N19114A",
  "Mira Tower": "N19108A",
  "New Alipore": "N19107A",
  "DLF": "N19112A",
  "Infinity-I": "N19111A",
  "Infinity-II": "Infinity2.0",
  "Kharagpur": "N19103A",
  "SDF": "N19109A",
  "Siliguri": "N19105A",
};

const Register = () => {
  const [formData, setFormData] = useState({
    name: "",
    empId: "",  // <-- new field
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
        email: formData.email,
        region: formData.region,
        circle: formData.circle,
        site: formData.site,
        siteId: formData.siteId,
        role,
        designation: formData.designation,
        createdAt: new Date().toISOString()
      });

      setSuccessMsg("Registered successfully. Please verify your email.");
      setFormData({
        name: "",
        empId: "",
        email: "",
        password: "",
        designation: "",
        region: "",
        circle: "",
        site: ""
      });
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
        <h2 style={{color: "white"}}>Employee Register</h2>
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
          Register
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