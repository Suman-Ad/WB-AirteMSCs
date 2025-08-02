// src/components/Sidebar.js
import React from "react";
import { Link } from "react-router-dom";

const Sidebar = ({ userData, collapsed }) => {
  const role = userData?.role;
  const site = userData?.site;

  return (
    <div>
      <h1>{collapsed ? "📋" : "📋 MENU"}</h1>
      <nav>
        <Link to="/dashboard">🏠 <span className="label">Dashboard</span></Link>
        {(role === "Super User" || role === "Admin" || role === "Super Admin") && (
          <Link to="/daily-dashboard">📅 <span className="label">Daily Dashboard</span></Link>
          )}
        <Link to="/excel-live-edit">📊 <span className="label">Excel Data Manager</span></Link>

        {site && (
          <Link to={`/site/${site}`}>
            📁 <span className="label">My Site</span>
          </Link>
        )}

        <Link to="/history">🗂️ <span className="label">PM History</span></Link>

        {(role === "Admin" || role === "Super Admin") && (
          <Link to="/admin">🛡️ <span className="label">Admin Panel</span></Link>
        )}

        <Link to="/profile">👤 <span className="label">Profile</span></Link>
      </nav>
    </div>
  );
};

export default Sidebar;

