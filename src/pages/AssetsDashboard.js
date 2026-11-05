// src/pages/AssetsDashboard.js
import React, { useDeferredValue, useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
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
import { assetCatalogue, filterAssetRecords, assetSummary } from "../utils/assetsDashboardData";
import { subscribeAssets } from "../services/assetsDashboardFeed";

const PAGE_SIZE = 50;
const CHART_OPTIONS = { responsive: true, animation: false, plugins: { legend: { display: false } } };
const AssetsChart = React.memo(function AssetsChart({ data }) {
  return <Bar data={data} options={CHART_OPTIONS} />;
});

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

export default function AssetsDashboard({ userData }) {
  const [assets, setAssets] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [selectedRegion, setSelectedRegion] = useState(userData?.region || "");
  const [selectedCircle, setSelectedCircle] = useState(userData?.circle || "");
  const [selectedSite, setSelectedSite] = useState(userData?.site || "");


  const [searchTerm, setSearchTerm] = useState("");

  const deferredSearch = useDeferredValue(searchTerm);

  useEffect(() => {
    setLoading(true);
    setLoadError("");
    setAssets([]);
    return subscribeAssets(db,setAssets,() => setLoading(false),() => {
      setAssets([]);
      setLoadError("Unable to load assets. Check your connection and site access, then reload this page.");
      setLoading(false);
    });
  }, [userData?.uid]);

  // Initialize profile defaults together; changing a filter clears its children in one event.
  useEffect(() => {
    setSelectedRegion(userData?.region || "");
    setSelectedCircle(userData?.circle || "");
    setSelectedSite(userData?.site || "");
    setPage(1);
  }, [userData?.uid, userData?.region, userData?.circle, userData?.site]);

  const catalogue = useMemo(() => assetCatalogue(assets), [assets]);
  const regions = catalogue.regions;
  const circles = useMemo(() => [...(catalogue.circles.get(selectedRegion) || [])], [catalogue,selectedRegion]);
  const sites = useMemo(() => [...(catalogue.sites.get(selectedRegion)?.get(selectedCircle) || [])], [catalogue,selectedRegion,selectedCircle]);
  const filteredAssets = useMemo(() => filterAssetRecords(assets,selectedRegion,selectedCircle,selectedSite,deferredSearch),
    [assets,selectedRegion,selectedCircle,selectedSite,deferredSearch]);
  const {siteCount,categoryCounts} = useMemo(() => assetSummary(filteredAssets), [filteredAssets]);
  const chartData = useMemo(() => ({
    labels:Object.keys(categoryCounts),
    datasets:[{label:"Equipment Count",data:Object.values(categoryCounts),backgroundColor:"rgba(54, 162, 235, 0.6)"}]
  }), [categoryCounts]);
  const pageCount = Math.max(1,Math.ceil(filteredAssets.length/PAGE_SIZE));
  const currentPage = Math.min(page,pageCount);
  const pageStart = (currentPage-1)*PAGE_SIZE;
  const visibleAssets = filteredAssets.slice(pageStart,pageStart+PAGE_SIZE);

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
      {loading && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: "#0f172a",
              padding: "30px 40px",
              borderRadius: "12px",
              textAlign: "center",
              color: "white",
              boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                border: "4px solid #334155",
                borderTop: "4px solid #38bdf8",
                borderRadius: "50%",
                margin: "0 auto 15px",
                animation: "spin 1s linear infinite",
              }}
            />
            <div style={{ fontSize: "15px", fontWeight: "bold" }}>
              Fetching Assets Data…
            </div>
            <div style={{ fontSize: "12px", color: "#cbd5e1", marginTop: "4px" }}>
              Please wait
            </div>
          </div>
        </div>
      )}
      <h1 className="dashboard-header">
        <strong>
          💼 Assets Dashboard
        </strong>
      </h1>
      <div className="instruction-tab">
        <h2 className="noticeboard-header">📌 Notice Board </h2>
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
        <h6 style={{ marginLeft: "90%" }}>Thanks & Regurds @Suman Adhikari</h6>
      </div>
      <p>
        <em>
          *Only WB Circle Assets Data Available - You Can Filter Your Site*
        </em>
      </p>



      <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>

        <select
          value={selectedRegion}
          aria-label="Region"
          onChange={(e) => { setSelectedRegion(e.target.value); setSelectedCircle(""); setSelectedSite(""); setPage(1); }}
        >
          <option value="">All Regions</option>
          {regions.map(region => (
            <option key={region} value={region}>{region}</option>
          ))}
        </select>


        <select
          value={selectedCircle}
          aria-label="Circle"
          onChange={(e) => { setSelectedCircle(e.target.value); setSelectedSite(""); setPage(1); }}
          disabled={!selectedRegion}
        >
          <option value="">All Circles</option>
          {circles.map(circle => (
            <option key={circle} value={circle}>{circle}</option>
          ))}
        </select>


        <select
          value={selectedSite}
          aria-label="Site"
          onChange={(e) => { setSelectedSite(e.target.value); setPage(1); }}
          disabled={!selectedCircle}
        >
          <option value="">All Sites</option>
          {sites.map(site => (
            <option key={site} value={site}>{site}</option>
          ))}
        </select>


        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          aria-label="Search assets"
          onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
        />
      </div>

      {/* ✅ Summary */}
      <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }} className="child-container">
        <div>
          <h3>Total Assets</h3>
          <p>{filteredAssets.length}</p>
        </div>
        <div>
          <h3>Unique Sites</h3>
          <p>{siteCount}</p>
        </div>
        <div>
          <h3>Categories</h3>
          <p>{Object.keys(categoryCounts).length}</p>
        </div>
      </div>

      {/* ✅ Chart */}
      <div style={{ width: "inherit", marginBottom: "20px" }} className="chart-container">
        <AssetsChart data={chartData} />
      </div>

      {(userData?.role === "Super User" ||
        userData?.role === "Admin" ||
        userData?.role === "Super Admin") && (
          <Link to="/assets-register">
            <span className="btn-secondary pm-manage-btn">💼 Manage Assets Register</span>
          </Link>
        )}

      {loadError && <p role="alert">{loadError}</p>}
      <nav aria-label="Asset table pages" style={{display:"flex",flexWrap:"wrap",gap:"12px",alignItems:"center",margin:"16px 0"}}>
        <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage-1)}>Previous</button>
        <span role="status">{filteredAssets.length ? `${pageStart+1}–${Math.min(pageStart+PAGE_SIZE,filteredAssets.length)} of ${filteredAssets.length} assets` : "No matching assets"} · Page {currentPage} of {pageCount}</span>
        <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage+1)}>Next</button>
        {searchTerm !== deferredSearch && <span>Updating search…</span>}
      </nav>
      {/* Render only one page; totals, filters and chart still use all matching assets. */}
      <table
        border="1"
        cellPadding="6"
        className="dhr-table"
      >
        <thead>
          <tr>
            {DEFAULT_COLUMNS.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleAssets.map(({id,values:a}) => (
            <tr key={id}>
              {DEFAULT_COLUMNS.map((col) => (
                <td key={col.key}>{a[col.key] ?? ""}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
