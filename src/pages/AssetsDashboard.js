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

export default function AssetsDashboard({ userData }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState({ percent: 0, loaded: 0, total: 0 });

  // Filters
  const [regionFilter, setRegionFilter] = useState("");
  const [circleFilter, setCircleFilter] = useState("");
  const [siteFilter, setSiteFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  // derived filter lists
  const regions = [...new Set(assets.map((a) => a.Region).filter(Boolean))];
  const circles = [...new Set(assets.map((a) => a.Circle).filter(Boolean))];
  const sites = [...new Set(assets.map((a) => a.SiteName?.trim()).filter(Boolean))];
  const categories = [...new Set(assets.map((a) => a.EquipmentCategory).filter(Boolean))];

  // format Firestore Timestamp, Excel-number, or simple string/date
  const formatDate = (val) => {
    if (!val && val !== 0) return "";
    // Firestore Timestamp (has toDate)
    if (val && typeof val === "object" && typeof val.toDate === "function") {
      return val.toDate().toLocaleDateString("en-GB");
    }
    // Excel-style serial stored as number (e.g., 41343)
    if (typeof val === "number") {
      try {
        const excelEpoch = new Date(Math.round((val - 25569) * 86400 * 1000));
        return excelEpoch.toLocaleDateString("en-GB");
      } catch {
        return String(val);
      }
    }
    // fallback to string/date
    try {
      const d = new Date(val);
      if (!isNaN(d.getTime())) return d.toLocaleDateString("en-GB");
    } catch {}
    return String(val);
  };

  // Fetch assets using correct nested traversal:
  // assets_register (collection) -> circleDoc (doc) -> siteCollection -> equipmentDocs
  useEffect(() => {
    const fetchAssets = async () => {
      setLoading(true);
      setAssets([]);
      setProgress({ percent: 0, loaded: 0, total: 0 });

      try {
        const circlesSnap = await getDocs(collection(db, "assets_register"));
        if (!circlesSnap || circlesSnap.empty) {
          // no circles found
          setAssets([]);
          setLoading(false);
          return;
        }

        // FIRST PASS: compute total asset count for progress accuracy
        let totalAssets = 0;
        for (const circleDoc of circlesSnap.docs) {
          const circleName = circleDoc.id;
          const sitesSnap = await getDocs(collection(db, "assets_register", circleName));
          for (const siteDoc of sitesSnap.docs) {
            const equipSnap = await getDocs(collection(db, "assets_register", circleName, siteDoc.id));
            totalAssets += equipSnap.size;
          }
        }
        setProgress((p) => ({ ...p, total: totalAssets }));

        // SECOND PASS: actually load assets and update progress
        const allAssets = [];
        let loaded = 0;

        for (const circleDoc of circlesSnap.docs) {
          const circleName = circleDoc.id;
          const sitesSnap = await getDocs(collection(db, "assets_register", circleName));

          for (const siteDoc of sitesSnap.docs) {
            const siteId = siteDoc.id;
            const equipSnap = await getDocs(collection(db, "assets_register", circleName, siteId));

            for (const equipDoc of equipSnap.docs) {
              const equipData = equipDoc.data() || {};
              // push normalized asset object
              allAssets.push({
                id: equipDoc.id,
                Circle: equipData.Circle || circleName,
                Region: equipData.Region || "",
                SiteName: (equipData.SiteName || siteId || "").toString(),
                EquipmentCategory: equipData.EquipmentCategory || "",
                Qty: equipData.Qty !== undefined ? Number(equipData.Qty) || 0 : 0,
                EquipmentMake: equipData.EquipmentMake || equipData.Make || "",
                EquipmentModel: equipData.EquipmentModel || equipData.Model || "",
                EquipmentSerialNumber: equipData.EquipmentSerialNumber || equipData.SerialNumber || "",
                ManufacturingDate: formatDate(equipData.ManufacturingDate),
                InstallationDate: formatDate(equipData.InstallationDate),
                ...equipData,
              });

              loaded++;
              const percent = totalAssets ? Math.round((loaded / totalAssets) * 100) : 100;
              setProgress({ percent, loaded, total: totalAssets });
            }
          }
        }

        setAssets(allAssets);
      } catch (err) {
        console.error("Error fetching assets:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAssets();
    // run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // filter assets for display and charts
  const filteredAssets = assets.filter(
    (a) =>
      (!regionFilter || a.Region === regionFilter) &&
      (!circleFilter || a.Circle === circleFilter) &&
      (!siteFilter || a.SiteName?.trim() === siteFilter) &&
      (!categoryFilter || a.EquipmentCategory === categoryFilter)
  );

  // grouped stacked chart data (by circle or by site) similar to your original function
  const getChartData = (groupBy) => {
    const grouped = {};
    filteredAssets.forEach((a) => {
      const groupKey = a[groupBy] || "Unknown";
      if (!grouped[groupKey]) grouped[groupKey] = {};
      const cat = a.EquipmentCategory || "Unknown";
      grouped[groupKey][cat] = (grouped[groupKey][cat] || 0) + (Number(a.Qty) || 0);
    });

    const labels = Object.keys(grouped);
    const allCats = [...new Set(filteredAssets.map((a) => a.EquipmentCategory || "Unknown"))];
    const datasets = allCats.map((cat) => ({
      label: cat,
      data: labels.map((lbl) => grouped[lbl][cat] || 0),
    }));

    return { labels, datasets };
  };

  return (
    <div className="dhr-dashboard-container">
      {/* Manage link for privileged roles */}
              {(userData?.role === "Super User" || userData?.role === "Admin" || userData?.role === "Super Admin") && (
                <Link to="/assets-register">
                  <span className="btn-secondary pm-manage-btn"> 💼 Manage Assets Register</span>
                </Link>
              )}
      <h2>Assets Dashboard</h2>

      {loading ? (
        <div>
          <p>
            Loading... {progress.percent}% ({progress.loaded} of {progress.total || "?"} assets scanned)
          </p>
          <div style={{ background: "#eee", height: 8, borderRadius: 4 }}>
            <div
              style={{
                background: "#4caf50",
                height: 8,
                width: `${progress.percent}%`,
                transition: "width 0.25s",
                borderRadius: 4,
              }}
            />
          </div>
        </div>
      ) : (
        <>
          {assets.length === 0 ? (
            <div>
              <p>No asset records found in Firestore under <code>assets_register</code>. Check console or Firestore paths.</p>
            </div>
          ) : (
            <>
              {/* Filters */}
              <div style={{ display: "flex", gap: 10, marginBottom: 15, flexWrap: "wrap" }}>
                <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
                  <option value="">All Regions</option>
                  {regions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>

                <select value={circleFilter} onChange={(e) => setCircleFilter(e.target.value)}>
                  <option value="">All Circles</option>
                  {circles.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
                  <option value="">All Sites</option>
                  {sites.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                  <option value="">All Categories</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Chart: Qty by Category per Circle */}
              <div style={{ overflowX: "auto", marginBottom: 20 }}>
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

              {/* Chart: Qty by Category per Site */}
              <div style={{ overflowX: "auto", marginBottom: 20 }}>
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

              {/* Manage link for privileged roles */}
              {(userData?.role === "Super User" || userData?.role === "Admin" || userData?.role === "Super Admin") && (
                <Link to="/assets-register">
                  <span className="btn-secondary pm-manage-btn"> 💼 Manage Assets Register</span>
                </Link>
              )}

              {/* Table */}
              <div style={{ overflowX: "auto", marginTop: 12 }}>
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
                      <tr key={a.id || idx}>
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
        </>
      )}
    </div>
  );
}
