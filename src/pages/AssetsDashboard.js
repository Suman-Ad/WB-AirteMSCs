// src/pages/AssetsDashboard.js
import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
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
import "../assets/DHRStyle.css";
import { Link } from "react-router-dom";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function AssetsDashboard({userData}) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState({ percent: 0, loaded: 0, total: 0 });

  // Filters
  const [regionFilter, setRegionFilter] = useState("");
  const [circleFilter, setCircleFilter] = useState("");
  const [siteFilter, setSiteFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const regions = [...new Set(assets.map(a => a.Region).filter(Boolean))];
  const circles = [...new Set(assets.map(a => a.Circle).filter(Boolean))];
  const sites = [...new Set(assets.map(a => a.SiteName?.trim()).filter(Boolean))];
  const categories = [...new Set(assets.map(a => a.EquipmentCategory).filter(Boolean))];

  useEffect(() => {
    const fetchAssets = async () => {
      setLoading(true);
      let allAssets = [];
      let totalCircles = 0;
      let loadedEquip = 0;

      const circlesSnap = await getDocs(collection(db, "assets_register"));
      totalCircles = circlesSnap.docs.length;

      let siteCount = 0;
      for (const circleDoc of circlesSnap.docs) {
        const circleName = circleDoc.id;
        const sitesSnap = await getDocs(collection(db, `assets_register/${circleName}`));

        for (const siteDoc of sitesSnap.docs) {
          const siteId = siteDoc.id;
          const equipCatSnap = await getDocs(collection(db, `assets_register/${circleName}/${siteId}`));
          for (const equipCatDoc of equipCatSnap.docs) {
            const equipCatName = equipCatDoc.id;
            const equipItemsSnap = await getDocs(collection(db, `assets_register/${circleName}/${siteId}/${equipCatName}`));


                for (const equipDoc of equipItemsSnap.docs) {
                    const equipData = equipDoc.data();
                    allAssets.push({
                    id: equipDoc.id,
                    Circle: equipData.Circle || circleName,
                    Region: equipData.Region || "",
                    SiteName: equipData.SiteName || siteId,
                    EquipmentCategory: equipData.EquipmentCategory || "",
                    Qty: Number(equipData.Qty) || 0,
                    ...equipData,
                    ManufacturingDate: formatDate(equipData.ManufacturingDate),
                    InstallationDate: formatDate(equipData.InstallationDate),
                    });
                    loadedEquip++;
                    setProgress({
                    percent: Math.round((loadedEquip / (totalCircles * 100)) * 100),
                    loaded: loadedEquip,
                    total: totalCircles * 100,
                    });
                }
            }
          siteCount++;
        }
      }
      setAssets(allAssets);
      setLoading(false);
    };

    fetchAssets();
  }, []);

  const formatDate = (val) => {
    if (!val) return "";
    if (typeof val === "number") {
      const excelEpoch = new Date(Math.round((val - 25569) * 86400 * 1000));
      return excelEpoch.toLocaleDateString("en-GB");
    }
    return val;
  };

  const filteredAssets = assets.filter(a =>
    (!regionFilter || a.Region === regionFilter) &&
    (!circleFilter || a.Circle === circleFilter) &&
    (!siteFilter || a.SiteName?.trim() === siteFilter) &&
    (!categoryFilter || a.EquipmentCategory === categoryFilter)
  );

  const getChartData = (groupBy) => {
    const grouped = {};
    filteredAssets.forEach(a => {
      const groupKey = a[groupBy] || "Unknown";
      if (!grouped[groupKey]) grouped[groupKey] = {};
      grouped[groupKey][a.EquipmentCategory] = (grouped[groupKey][a.EquipmentCategory] || 0) + a.Qty;
    });

    const labels = Object.keys(grouped);
    const allCats = [...new Set(filteredAssets.map(a => a.EquipmentCategory))];
    const datasets = allCats.map(cat => ({
      label: cat,
      data: labels.map(lbl => grouped[lbl][cat] || 0),
    }));

    return { labels, datasets };
  };

  return (
    <div className="dhr-dashboard-container">
      <h2>Assets Dashboard</h2>

      {loading ? (
        <div>
          <p>Loading... {progress.percent}% ({progress.loaded} equipments scanned)</p>
          <div style={{ background: "#eee", height: "8px", borderRadius: "4px" }}>
            <div
              style={{
                background: "#4caf50",
                height: "8px",
                width: `${progress.percent}%`,
                transition: "width 0.3s",
                borderRadius: "4px",
              }}
            ></div>
          </div>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "15px", flexWrap: "wrap" }}>
            <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)}>
              <option value="">All Regions</option>
              {regions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={circleFilter} onChange={e => setCircleFilter(e.target.value)}>
              <option value="">All Circles</option>
              {circles.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={siteFilter} onChange={e => setSiteFilter(e.target.value)}>
              <option value="">All Sites</option>
              {sites.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
              <option value="">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Charts */}
          <div style={{ overflowX: "auto", marginBottom: "20px" }}>
            <h3>Total Qty by Category per Circle</h3>
            <Bar
              data={getChartData("Circle")}
              options={{
                responsive: true,
                plugins: { legend: { position: "top" }, title: { display: true, text: "Assets by Circle" } },
                scales: { x: { stacked: true }, y: { stacked: true } },
              }}
            />
          </div>
          <div style={{ overflowX: "auto", marginBottom: "20px" }}>
            <h3>Total Qty by Category per Site</h3>
            <Bar
              data={getChartData("SiteName")}
              options={{
                responsive: true,
                plugins: { legend: { position: "top" }, title: { display: true, text: "Assets by Site" } },
                scales: { x: { stacked: true }, y: { stacked: true } },
              }}
            />
          </div>

          {(userData?.role === "Super User" || userData?.role === "Admin" || userData?.role === "Super Admin") && (
                <Link to="/assets-register">💼 <span className="label">Manage Assets Register</span></Link>
            )}

          {/* Table */}
          <div style={{ overflowX: "auto" }}>
            <table className="dhr-table">
              <thead>
                <tr>
                  <th>Region</th>
                  <th>Circle</th>
                  <th>Site Name</th>
                  <th>Equipment Category</th>
                  <th>Qty</th>
                  <th>Make</th>
                  <th>Model</th>
                  <th>Serial Number</th>
                  <th>Manufacturing Date</th>
                  <th>Installation Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.map((a, idx) => (
                  <tr key={idx}>
                    <td>{a.Region}</td>
                    <td>{a.Circle}</td>
                    <td>{a.SiteName}</td>
                    <td>{a.EquipmentCategory}</td>
                    <td>{a.Qty}</td>
                    <td>{a.EquipmentMake}</td>
                    <td>{a.EquipmentModel}</td>
                    <td>{a.EquipmentSerialNumber}</td>
                    <td>{a.ManufacturingDate}</td>
                    <td>{a.InstallationDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
