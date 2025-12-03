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
    localStorage.removeItem("summary");
    localStorage.removeItem("dailyLogs");
    localStorage.removeItem("incidents");
    localStorage.removeItem("incidentSummary");
    localStorage.removeItem("incidentTextSummary");
    localStorage.removeItem("assets");
    localStorage.removeItem("pmData");
    localStorage.removeItem("thermalReports");
    localStorage.removeItem("lastFilling")
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
        >
          {collapsed ? "☰" : "X"}
        </button>
        {collapsed ? "" :
          <button onClick={() => {goProfile(); setCollapsed(true);}} className="profile-manage-btn" title="Profile" >
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
              title="Logout"
            >
              📴
            </button>
          }
        </span>
        {(userData?.role === "Super Admin" || userData?.role === "Admin" || userData?.designation === "Vertiv CIH" || userData?.designation === "Vertiv Site Infra Engineer" || userData?.designation === "Vertiv Supervisor") && (
        <button
          title="Site Settings"
          className="logout-manage-btn"
          onClick={() => navigate('/site-config') & setCollapsed(true)}
        >
          ⚙️
        </button>
      )}
      </div>

      {/* Navigation Links */}
      <nav>
        {(role === "Admin" || role === "Super Admin" || role === "Super User" || role === "User") && (
          <Link to="/daily-dg-log-editor" className="sidepanel-manage-btn" title={collapsed ? "Insident Dashboard" : ""} onClick={() => setCollapsed(true)}>☣️ <span className="label">Daily DG Log Book</span></Link>
        )}

        {(role === "Super User" || role === "Admin" || role === "Super Admin") && (
          <Link to="/daily-dashboard" className="sidepanel-manage-btn" title={collapsed ? "Daily Details Dashboard" : ""} onClick={() => setCollapsed(true)}>📅 <span className="label">Daily Dashboard</span></Link>
        )}

        {(role === "Admin" || role === "Super Admin" || role === "Super User" || role === "User") && (
          <Link to="/incident-dashboard" className="sidepanel-manage-btn" title={collapsed ? "Insident Dashboard" : ""} onClick={() => setCollapsed(true)}>🚨 <span className="label">Incident Dashboard</span></Link>
        )}

        {(role === "Admin" || role === "Super Admin" || role === "Super User" || role === "User") && (
          <Link to="/acdc-rack-details" className="sidepanel-manage-btn" title={collapsed ? "Rack Dashboard" : ""} onClick={() => setCollapsed(true)}>🗄️ <span className="label">AC DC Rack Details</span></Link>
        )}

        {(role === "Admin" || role === "Super Admin") && (
        <Link to="/dhr-dashboard" className="sidepanel-manage-btn" title={collapsed ? "DHR Dashboard" : ""} onClick={() => setCollapsed(true)}>⚡<span className="label">DHR Dashboard</span></Link>
          )}
        {(role === "Admin" || role === "Super Admin" || role === "Super User" || role === "User") && (
          <Link to="/daily-activity-dashboard" className="sidepanel-manage-btn" title={collapsed ? "Daily Activity Dashboard" : ""} onClick={() => setCollapsed(true)}>🏗️ <span className="label">Daily Activity Dashboard</span></Link>
        )}

        {(role === "Admin" || role === "Super Admin") && (
          <Link to="/duty-tracker" className="sidepanel-manage-btn" title={collapsed ? "Daily Activity Dashboard" : ""} onClick={() => setCollapsed(true)}>☀️ <span className="label">Duty Tracker</span></Link>
        )}

        {(role === "Admin" || role === "Super Admin" || role === "Super User" || role === "User") && (
          <Link to="/compliance-dashboard" className="sidepanel-manage-btn" title={collapsed ? "Compliance Dashboard" : ""} onClick={() => setCollapsed(true)}>⚖️ <span className="label">Compliance Dashboard</span></Link>
        )}

        {(role === "Super User" || role === "Admin" || role === "Super Admin" || role === "User") && (
          <Link to="/assets-dashboard" className="sidepanel-manage-btn" title={collapsed ? "Assets Dashboard" : ""} onClick={() => setCollapsed(true)}>💼 <span className="label">Assets Dashboard</span></Link>
        )}

        {(role === "Admin" || role === "Super Admin") && (
          <Link to="/thermal-analysis-report" className="sidepanel-manage-btn" title={collapsed ? "IR Thermal Analysis & Report Generate" : ""} onClick={() => setCollapsed(true)}>🌡️ <span className="label">IR Thermography</span></Link>
        )}

        {(role === "Admin" || role === "Super Admin") && (
          <Link to="/pdf-dashboard" className="sidepanel-manage-btn"
            title={collapsed ? "PM Dashboard" : ""}
            onClick={() => setCollapsed(true)}
          >🛠️ <span className="label">PM Dashboard</span>
          </Link>
        )}

        {site && (role === "Admin" || role === "Super Admin") && (
          <Link to={`/site/${site}`} className="sidepanel-manage-btn"
            title={collapsed ? "PM FSRs" : ""}
            onClick={() => setCollapsed(true)}
          >
            📁 <span className="label">{userData.site} PM FSR's</span>
          </Link>
        )}

        {(role === "Admin" || role === "Super Admin") && (
          <Link to="/history" className="sidepanel-manage-btn" title={collapsed ? "WB PM History File" : ""}
            onClick={() => setCollapsed(true)}
          >🗂️ <span className="label">WB PM Historis</span>
          </Link>
        )}

        {(role === "Admin" || role === "Super Admin") && (
          <Link to="/admin" className="sidepanel-manage-btn" title={collapsed ? "Admin Panel" : ""}
            onClick={() => setCollapsed(true)}
          >🔑 <span className="label">Admin Panel</span>
          </Link>
        )}

        {(role === "Super User" || role === "Admin" || role === "Super Admin" || role === "User") && (
          <Link to="/sld-editor" className="sidepanel-manage-btn" title={collapsed ? "SLD Editor" : ""}
            onClick={() => setCollapsed(true)}
          >📐 <span className="label">SLD Editor</span>
          </Link>
        )}

        {/* <Link to="/profile" className="sidepanel-manage-btn" title={collapsed ? "Profile":""}>👷 <span className="label">Profile</span></Link> */}
      </nav>
    </div>
  );
};

export default Sidebar;
