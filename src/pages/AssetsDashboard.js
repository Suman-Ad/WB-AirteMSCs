// src/pages/AssetsDashboard.js
import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
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

import { applyActivityChartTheme } from "./activityChartTheme";
import "../assets/AssetsDashboard.css";

const PAGE_SIZE = 50;
const CHART_OPTIONS = { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 } } } };
const AssetsChart = React.memo(function AssetsChart({ data }) {
  const chartRef = useRef(null);
  useEffect(() => {
    const updateTheme = () => {
      if (!chartRef.current) return;
      const style = getComputedStyle(document.documentElement);
      applyActivityChartTheme(chartRef.current, {
        text: style.getPropertyValue("--app-text").trim(),
        muted: style.getPropertyValue("--app-text-muted").trim(),
        border: style.getPropertyValue("--app-border").trim(),
      });
    };
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return <Bar ref={chartRef} data={data} options={CHART_OPTIONS} />;
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
    datasets:[{label:"Equipment Count",data:Object.values(categoryCounts),backgroundColor:["#0d9488", "#0284c7", "#8b5cf6", "#d97706", "#e11d48"],borderRadius:5,maxBarThickness:64}]
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
    <div className="assets-workspace">
      <header className="assets-header">
        <div><span className="assets-eyebrow">EQUIPMENT INVENTORY</span><h1>Assets Dashboard</h1><p>Explore equipment, site coverage, and your asset register.</p></div>
        {["Super User", "Admin", "Super Admin"].includes(userData?.role) && <Link className="assets-primary-button" to="/assets-register">Manage Assets Register <span aria-hidden="true">↗</span></Link>}
      </header>
      {loading && <div className="assets-loading" role="status"><span className="assets-spinner" aria-hidden="true" /> Fetching assets data…</div>}
      <div className="instruction-tab">
        <h2 className="noticeboard-header">Notice board</h2>
        {/* <h3 className="dashboard-header">📘 App Overview </h3> */}
        {isEditing ? (
          <>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={5}
              className="dashboard-instruction-panel"
              aria-label="Notice board instruction"
            />
            <div className="assets-notice-actions">
              <button
                className="assets-primary-button"
                onClick={async () => {
                  const docRef = doc(db, "config", "assets_dashboard_instruction");
                  await setDoc(docRef, { text: editText });
                  setInstructionText(editText);
                  setIsEditing(false);
                }}
              >
                Save
              </button>
              <button
                className="assets-button"
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
                className="assets-button"
                onClick={() => { setEditText(instructionText); setIsEditing(true); }}
              >
                Edit Instruction
              </button>
            )}
          </>
        )}
        <span className="assets-notice-author">Suman Adhikari</span>
      </div>
      <section className="assets-filter-panel" aria-label="Asset filters">
        <div className="assets-section-heading"><div><h2>Find assets</h2><p>WB Circle assets are currently available. Narrow the view by site or search.</p></div>
          <button className="assets-button" onClick={() => { setSelectedRegion(""); setSelectedCircle(""); setSelectedSite(""); setSearchTerm(""); setPage(1); }}>Clear filters</button>
        </div>
      <div className="assets-filters">
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
          placeholder="Search equipment, ID, or site…"
          value={searchTerm}
          aria-label="Search assets"
          onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
        />
      </div>

      </section>
      {/* Summary */}
      <div className="assets-summary">
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
      <section className="assets-chart-panel" aria-label="Equipment distribution">
        <div className="assets-section-heading"><div><h2>Equipment distribution</h2><p>Asset records by category for the current filters.</p></div></div>
        {filteredAssets.length ? <div className="assets-chart"><AssetsChart data={chartData} /></div> : <div className="assets-empty">No equipment to chart for this selection.</div>}
      </section>
      <section className="assets-register-panel" aria-label="Asset register">
      <h2>Asset register</h2>
      {loadError && <p role="alert">{loadError}</p>}
      <nav aria-label="Asset table pages" className="assets-pagination">
        <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage-1)}>Previous</button>
        <span role="status">{filteredAssets.length ? `${pageStart+1}–${Math.min(pageStart+PAGE_SIZE,filteredAssets.length)} of ${filteredAssets.length} assets` : "No matching assets"} · Page {currentPage} of {pageCount}</span>
        <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage+1)}>Next</button>
        {searchTerm !== deferredSearch && <span>Updating search…</span>}
      </nav>
      {/* Render only one page; totals, filters and chart still use all matching assets. */}
      <div className="assets-table-scroll" tabIndex={0} role="region" aria-label="Asset records">
      <table>
        <caption className="assets-sr-only">Equipment asset records for the selected filters</caption>
        <thead>
          <tr>
            {DEFAULT_COLUMNS.map((col) => (
              <th scope="col" key={col.key}>{col.label}</th>
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
          {!visibleAssets.length && <tr><td colSpan={DEFAULT_COLUMNS.length}><div className="assets-empty">{loading ? "Loading asset records…" : loadError ? "Asset records are unavailable." : "No assets match these filters. Try another site or clear your search."}</div></td></tr>}
        </tbody>
      </table>
      </div>
      </section>
    </div>
  );
}
