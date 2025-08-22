// src/pages/AssetsDashboard.js
import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, doc, getDoc, setDoc } from "firebase/firestore";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { Link } from "react-router-dom";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const DEFAULT_COLUMNS = [
  { key: "UniqueID", label: "Unique ID (Don't edit)" },
  { key: "DedicatedNo", label: "Dedicated No (Don't edit)" },
  { key: "Region", label: "Region" },
  { key: "Circle", label: "Circle" },
  { key: "SiteName", label: "Site Name" },
  { key: "UniqueCode", label: "Unique Code" }, // Site ID
  { key: "EquipmentCategory", label: "Equipment Category" },
  { key: "EquipmentNameAndNo", label: "Equipment Name and No" },
  { key: "EquipmentMake", label: "Equipment Make" },
  { key: "EquipmentModel", label: "Equipment Model" },
  { key: "EquipmentSerialNumber", label: "Equipment Serial Number" },
  { key: "UnitOfMeasure", label: "Unit of measure (kva/TR etc.)" },
  { key: "RatingCapacity", label: "Rating/Capacity" },
  { key: "Qty", label: "Qty" },
  { key: "ManufacturingDate", label: "Equipment Manufacturing date (DD-MM-YY)" },
  { key: "InstallationDate", label: "Equipment Installation date (DD-MM-YY)" },
];

export default function AssetsDashboard({userData}) {
  const [assets, setAssets] = useState([]);
  const [filteredAssets, setFilteredAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedCircle, setSelectedCircle] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedSite, setSelectedSite] = useState("");

  const [searchTerm, setSearchTerm] = useState("");

  // ✅ Load assets in real-time from assets_flat
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "assets_flat"), (snapshot) => {
      const data = snapshot.docs.map((doc) => doc.data());
      setAssets(data);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // ✅ Filter logic
  useEffect(() => {
    let filtered = assets;

    if (selectedCircle) {
      filtered = filtered.filter((a) => a.Circle === selectedCircle);
    }
    if (selectedRegion) {
      filtered = filtered.filter((a) => a.Region === selectedRegion);
    }
    if (selectedSite) {
      filtered = filtered.filter((a) => a.SiteName === selectedSite);
    }
    if (searchTerm) {
      filtered = filtered.filter((a) =>
        Object.values(a).some((val) =>
          String(val).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    setFilteredAssets(filtered);
  }, [assets, selectedCircle, selectedRegion, selectedSite, searchTerm]);

  // ✅ Unique filter options
  const circles = [...new Set(assets.map((a) => a.Circle))];
  const regions = [...new Set(assets.map((a) => a.Region))];
  const sites = [...new Set(assets.map((a) => a.SiteName))];

  // ✅ Chart Data
  const categoryCounts = filteredAssets.reduce((acc, asset) => {
    const cat = asset.EquipmentCategory || "Unknown";
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  const chartData = {
    labels: Object.keys(categoryCounts),
    datasets: [
      {
        label: "Equipment Count",
        data: Object.values(categoryCounts),
        backgroundColor: "rgba(54, 162, 235, 0.6)",
      },
    ],
  };

  const [instructionText, setInstructionText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(""); 
  useEffect(() => {
    const fetchInstruction = async () => {
      const docRef = doc(db, "config", "assets_dashboard_instruction");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setInstructionText(docSnap.data().text || "");
        setEditText(docSnap.data().text || "");
      }
    };
    fetchInstruction();
  }, []);

  return (
    <div className="dhr-dashboard-container">
      <h1 className="dashboard-header">
        <strong>
          💼 Assets Dashboard
        </strong>
      </h1>
      <div className="instruction-tab">
          <h2 className="dashboard-header">📌 Notice Board </h2>
          {/* <h3 className="dashboard-header">📘 App Overview </h3> */}
          {isEditing ? (
            <>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={5}
                className="dashboard-instruction-panel"
              />
              <div className="flex gap-2">
                <button
                  className="bg-blue-600 text-white px-3 py-1 rounded"
                  onClick={async () => {
                    const docRef = doc(db, "config", "assets_dashboard_instructionn");
                    await setDoc(docRef, { text: editText });
                    setInstructionText(editText);
                    setIsEditing(false);
                  }}
                >
                  Save
                </button>
                <button
                  className="bg-gray-400 text-white px-3 py-1 rounded"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="dashboard-instruction-panel">{instructionText || "No instructions available."}</p>
              {["Admin", "Super Admin"].includes(userData?.role) && (
                <button
                  className="text-blue-600 underline"
                  onClick={() => setIsEditing(true)}
                >
                  Edit Instruction
                </button>
              )}
            </>
          )}
          <h6 style={{marginLeft: "90%"}}>Thanks & Regurds @Suman Adhikari</h6>
      </div>
      <p>
        <em>
          *Only WB Circle Assets Data Available - You Can Filter Your Site*
        </em>
      </p>

      {loading && <p>Loading assets...</p>}

      <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
        <select
          value={selectedCircle}
          onChange={(e) => setSelectedCircle(e.target.value)}
        >
          <option value="">All Circles</option>
          {circles.map((circle) => (
            <option key={circle} value={circle}>
              {circle}
            </option>
          ))}
        </select>

        <select
          value={selectedRegion}
          onChange={(e) => setSelectedRegion(e.target.value)}
        >
          <option value="">All Regions</option>
          {regions.map((region) => (
            <option key={region} value={region}>
              {region}
            </option>
          ))}
        </select>

        <select
          value={selectedSite}
          onChange={(e) => setSelectedSite(e.target.value)}
        >
          <option value="">All Sites</option>
          {sites.map((site) => (
            <option key={site} value={site}>
              {site}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* ✅ Summary */}
      <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
        <div>
          <h3>Total Assets</h3>
          <p>{filteredAssets.length}</p>
        </div>
        <div>
          <h3>Unique Sites</h3>
          <p>{new Set(filteredAssets.map((a) => a.SiteName)).size}</p>
        </div>
        <div>
          <h3>Categories</h3>
          <p>{Object.keys(categoryCounts).length}</p>
        </div>
      </div>

      {/* ✅ Chart */}
      <div style={{ width: "600px", marginBottom: "20px" }}>
        <Bar data={chartData} options={{ responsive: true, plugins: { legend: { display: false } } }} />
      </div>

      {(userData?.role === "Super User" ||
        userData?.role === "Admin" ||
        userData?.role === "Super Admin") && (
        <Link to="/assets-register">
          <span className="btn-secondary pm-manage-btn">💼 Manage Assets Register</span>
        </Link>
      )}

      {/* ✅ Table */}
      <table
        border="1"
        cellPadding="6"
        className="dhr-table"
        style={
          {overflowY: "auto", height:"1300px"}
        }
      >
        <thead>
          <tr>
            {DEFAULT_COLUMNS.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredAssets.map((a, index) => (
            <tr key={index}>
              {DEFAULT_COLUMNS.map((col) => (
                <td key={col.key}>{a[col.key] || ""}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
