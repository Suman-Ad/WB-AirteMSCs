// src/components/RoleProtectedRoute.js
import React from "react";
import { Navigate } from "react-router-dom";

const RoleProtectedRoute = ({ userData, allowedRoles, children }) => {
  // Wait until userData is loaded
  if (userData === undefined || userData === null) {
    return <Navigate to="/login" />;
  }

  if (allowedRoles.includes(userData.role)) {
    return children;
  }

  return <Navigate to="/login" />;
};

export default RoleProtectedRoute;
