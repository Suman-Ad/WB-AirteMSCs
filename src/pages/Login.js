// src/pages/Login.js
import React, { useState } from "react";
import { auth, db } from "../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";
import "../assets/Login.css";
import Vertiv from "../assets/vertiv.png";


const Login = ({ setUserData }) => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const { user } = await signInWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      if (!user.emailVerified) {
        setError("⚠️ Please verify your email before logging in.");
        return;
      }

      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        const userData = {
          uid: user.uid,
          circle: data.circle,
          region: data.region,
          siteId: data.siteId,
          empId: data.empId,
          name: data.name,
          role: data.role,
          site: data.site,
          email: data.email,
          designation: data.designation,
          photoURL: data.photoURL || "",
        };
        console.log("User data:", userData);
        localStorage.setItem("userData", JSON.stringify(userData));
        setUserData(userData); // <-- very important for App.js routing
        navigate("/");
      } else {
        setError("User data not found in Firestore.");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("Login failed: " + err.message);
    }
  };

  return (
    <div className="auth-container"
      style={{
        background: `url(${require("../assets/loginbg0.png")}) no-repeat center center fixed`,
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover', /* or 'contain' */
        zIndex: -1,
      }}>
      
      <form onSubmit={handleLogin} className="auth-form" style={{
          background: "rgba(255, 255, 255, 0.1)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          borderRadius: "10px",
          padding: "2rem",
          maxWidth: "400px",
        }}>
        <h2 className="title">
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

        <h2 style={{color: "white"}}>Employee Login</h2>
        {error && <p className="auth-error">{error}</p>}

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
          className="w-full p-2 mb-4 border rounded"
        />

        <button
          type="submit"
          className="auth-button"
        >
          Login
        </button>
        {/* <p>**Click on Register Button For Create A New Account**</p> */}
        <Link to={"/register"}>
        <button
          className="auth-button"
        >
          Create New Account
        </button>
        </Link>
      </form>
    </div>
  );
};

export default Login;
