import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import AppContent from "./AppContent";

function App() {

  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
