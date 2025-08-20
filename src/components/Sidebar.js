// src/components/Sidebar.js
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../firebase";

const Sidebar = ({ userData, collapsed, setCollapsed }) => {
  const role = userData?.role;
  const site = userData?.site;
  const navigate = useNavigate();

  const handleLogout = async () => {
    await auth.signOut();
    localStorage.removeItem("userData");
    navigate("/login");
  };

  const goProfile = async () => {
    navigate("/profile");
  };

  return (
    <div className={`sidebar ${collapsed ? "collapsed" : "expanded"}`}>
      {/* Sidebar Header with Collapse Toggle */}
      <div className="sidebar-header">
        <button
        className="toggle-btn"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Expand Menu" : "Collapse Menu"}
          style={{width: "100%"}}
        >
          {collapsed ? "☰" : "📋 MENU" }
        </button>
        {collapsed ? "" :  
          <button onClick={goProfile} className="profile-manage-btn">
            {userData?.role === "Super Admin" && <span>👑 <strong>{userData?.name || "Team Member"}</strong><div style={{ color: "#6b7280", fontSize: 12 }}>*Super Admin*</div></span>}
            {userData?.role === "Admin" && <span>🔑 <strong>{userData?.name || "Team Member"}</strong><div style={{ color: "#6b7280", fontSize: 12 }}>*Admin*</div></span>}
            {userData?.role === "Super User" && <span>🦸 <strong>{userData?.name || "Team Member"}</strong><div style={{ color: "#6b7280", fontSize: 12 }}>*Super User*</div></span>}
            {userData?.role === "User" && <span>👤 <strong>{userData?.name || "Team Member"}</strong><div style={{ color: "#6b7280", fontSize: 12 }}>*User*</div></span>}
          </button>  
        }  
        <span>
          {collapsed ? "" :
            <button
              onClick={handleLogout}
              className="logout-manage-btn"
              
            >
              ⏻
            </button>
          } 
        </span>
      </div>

      {/* Navigation Links */}
      <nav>
        <Link to="/dhr-dashboard" className="sidepanel-manage-btn" title={collapsed ? "DHR Dashboard":""}>⚡<span className="label">DHR Dashboard</span></Link>

        {(role === "Super User" || role === "Admin" || role === "Super Admin") && (
          <Link to="/daily-dashboard" className="sidepanel-manage-btn" title={collapsed ? "Daily Details Dashboard":""}>📅 <span className="label">Daily Dashboard</span></Link>
        )}

        {(role === "Super User" || role === "Admin" || role === "Super Admin" || role === "User") && (
          <Link to="/daily-activity-dashboard" className="sidepanel-manage-btn" title={collapsed ? "Daily Activity Dashboard":""}>🏗️ <span className="label">Daily Activity Dashboard</span></Link>
        )}

        {(role === "Admin" || role === "Super Admin" || role === "Super User" || role === "User") && (
          <Link to="/incident-dashboard" className="sidepanel-manage-btn" title={collapsed ? "Insident Dashboard":""}>🚨 <span className="label">Incident Dashboard</span></Link>
        )}

        {(role === "Admin" || role === "Super Admin" || role === "Super User" || role === "User") && (
          <Link to="/compliance-dashboard" className="sidepanel-manage-btn" title={collapsed ? "Compliance Dashboard":""}>⚖️ <span className="label">Compliance Dashboard</span></Link>
        )}

        {(role === "Super User" || role === "Admin" || role === "Super Admin" || role === "User") && (
          <Link to="/assets-dashboard" className="sidepanel-manage-btn" title={collapsed ? "Assets Dashboard":""}>💼 <span className="label">Assets Dashboard</span></Link>
        )}

        {(role === "Super User" || role === "Admin" || role === "Super Admin" || role === "User") && (
          <Link to="/thermal-analysis-report" className="sidepanel-manage-btn" title={collapsed ? "IR Thermal Analysis & Report Generate":""}>🌡️ <span className="label">IR Thermography</span></Link>
        )}

        <Link to="/pdf-dashboard" className="sidepanel-manage-btn" title={collapsed ? "PM Dashboard":""}>🛠️ <span className="label">PM Dashboard</span></Link>

        {site && (
          <Link to={`/site/${site}`} className="sidepanel-manage-btn" title={collapsed ? "PM FSRs":""}>
            📁 <span className="label">{userData.site} PM FSR's</span>
          </Link>
        )}

        {(role === "Admin" || role === "Super Admin") && (
          <Link to="/history" className="sidepanel-manage-btn" title={collapsed ? "WB PM History File":""}>🗂️ <span className="label">WB PM Historis</span></Link>
        )}

        {(role === "Admin" || role === "Super Admin") && (
          <Link to="/admin" className="sidepanel-manage-btn" title={collapsed ? "Admin Panel":""}>🔑 <span className="label">Admin Panel</span></Link>
        )}

        {/* <Link to="/profile" className="sidepanel-manage-btn" title={collapsed ? "Profile":""}>👷 <span className="label">Profile</span></Link> */}
      </nav>
    </div>
  );
};

export default Sidebar;
