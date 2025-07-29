// src/components/Sidebar.js
import React from "react";
import { Link } from "react-router-dom";

const Sidebar = ({ role, collapsed }) => {
  return (
    <div>
      <h1>{collapsed ? "📋" : "📋 MSC PM"}</h1>
      <nav>
        <Link to="/dashboard">🏠 <span className="label">Dashboard</span></Link>
        <Link to="/site/:siteName">📁 <span className="label">My Site</span></Link>
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
