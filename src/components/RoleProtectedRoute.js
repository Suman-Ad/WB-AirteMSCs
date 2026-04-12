// src/components/RoleProtectedRoute.js
import React from "react";
import { Navigate } from "react-router-dom";

const isAdminAssignmentValid = (userData) => {
  if (!userData?.isAdminAssigned) return false;
  if (!userData?.adminAssignFrom || !userData?.adminAssignTo) return false;

  const today = new Date();
  const from = new Date(userData.adminAssignFrom);
  const to = new Date(userData.adminAssignTo);

  return today >= from && today <= to;
};

const RoleProtectedRoute = ({ userData, allowedRoles, children }) => {
  // Wait until userData is loaded
  if (userData === undefined || userData === null) {
    return <Navigate to="/login" />;
  }

  if (allowedRoles.includes(userData.role || isAdminAssignmentValid(userData) ? "Admin" : "User")) {
    return children;
  }

  return <Navigate to="/login" />;
};

export default RoleProtectedRoute;
