// src/components/Sidebar.js
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../firebase";

const Sidebar = ({ userData, collapsed }) => {
  const role = userData?.role;
  const site = userData?.site;
  const navigate = useNavigate();

  const handleLogout = async () => {
      await auth.signOut();
      localStorage.removeItem("userData");
      navigate("/login");
    };

  return (
    <div>
      <h1>{collapsed ? "📋" : "📋 MENU"}</h1>
      <nav>
        {(role === "Super User" || role === "Admin" || role === "Super Admin") && (
          <Link to="/daily-dashboard">📅 <span className="label">Daily Dashboard</span></Link>
          )}

        {(role === "Super User" || role === "Admin" || role === "Super Admin") && (
          <Link to="/excel-live-edit">📊 <span className="label">Daily Details Data Manager</span></Link>
          )}

        <Link to="/pdf-dashboard">📥 <span className="label">PM Dashboard</span></Link>
        {(role === "Super User" || role === "Admin" || role === "Super Admin" || role === "User") && (
          <Link to="/pm-calendar">📊 <span className="label">PM Calendar Management</span></Link>
          )}

        

        {site && (
          <Link to={`/site/${site}`}>
            📁 <span className="label">{userData.site} PM FSR's</span>
          </Link>
        )}
        
        {(role === "Admin" || role === "Super Admin") && (
          <Link to="/history">🗂️ <span className="label">PM History</span></Link>
          )}

        {(role === "Admin" || role === "Super Admin") && (
          <Link to="/admin">🛡️ <span className="label">Admin Panel</span></Link>
        )}

        <Link to="/profile">👤 <span className="label">Profile</span></Link>
        <button onClick={handleLogout} style={{ marginTop: "10rem", width: "100%", padding: "10px", backgroundColor: "#f44336", color: "#fff", border: "none", cursor: "pointer" }}>
          Logout
        </button>
      </nav>
    </div>
  );
};

export default Sidebar;

