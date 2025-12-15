import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { format } from "date-fns";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#A855F7"];

export default function ActivityDashboard() {
  const [data, setData] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [summary, setSummary] = useState({});
  const [filters, setFilters] = useState({
    frequency: "All",
    performer: "All",
    category: "All",
    asset: "All",     // ✅ NEW
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    fetch("/Copy of MSC Activity  FLow.xlsx")
      .then(res => res.arrayBuffer())
      .then(buffer => {
        const wb = XLSX.read(buffer, { type: "buffer" });
        const sheet = wb.Sheets["Activity List"];
        const json = XLSX.utils.sheet_to_json(sheet);
        // Optional: add dummy "Date" for future automation (simulate activity date)
        const enhanced = json.map((r, i) => ({
          ...r,
          Date: new Date(2024, Math.floor(i % 12), Math.floor(Math.random() * 28) + 1),
        }));
        setData(enhanced);
        setFiltered(enhanced);
        calculateSummary(enhanced);
      });
  }, []);

  // Calculate summary
  const calculateSummary = (rows) => {
    const freq = {}, category = {}, performer = {},
      approvals = { CRQ_Y: 0, PTW_Y: 0, MOP_Y: 0 },
      alarms = { Yes: 0, No: 0 };

    rows.forEach(r => {
      freq[r.Frequency] = (freq[r.Frequency] || 0) + 1;
      category[r["Activity Category"]] = (category[r["Activity Category"]] || 0) + 1;
      performer[r["Activity performed by OEM/O&M"]] =
        (performer[r["Activity performed by OEM/O&M"]] || 0) + 1;
      if (r["CRQ Required (Y/N)"] === "Y") approvals.CRQ_Y++;
      if (r["PTW Required (Y/N)"] === "Y") approvals.PTW_Y++;
      if (r["MOP Approval Required (Y/N)"] === "Y") approvals.MOP_Y++;
      if (r["Alarms generated"] === "Yes") alarms.Yes++;
      else alarms.No++;
    });

    setSummary({ freq, category, performer, approvals, alarms });
  };

  const toChartData = (obj) =>
    Object.entries(obj).map(([name, value]) => ({ name, value }));

  // Handle filters
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters({ ...filters, [name]: value });
  };

  // Apply filters to data
  const applyFilters = () => {
    let temp = [...data];
    if (filters.frequency !== "All")
      temp = temp.filter(d => d.Frequency === filters.frequency);
    if (filters.performer !== "All")
      temp = temp.filter(d => d["Activity performed by OEM/O&M"] === filters.performer);
    if (filters.category !== "All")
      temp = temp.filter(d => d["Activity Category"] === filters.category);

    if (filters.asset !== "All")
      temp = temp.filter(
        d => d["Asset Name"] === filters.asset   // 🔴 change column name here if needed
      );

    if (filters.startDate && filters.endDate) {
      const start = new Date(filters.startDate);
      const end = new Date(filters.endDate);
      temp = temp.filter(d => new Date(d.Date) >= start && new Date(d.Date) <= end);
    }


    setFiltered(temp);
    calculateSummary(temp);
  };

  const resetFilters = () => {
    setFilters({
      frequency: "All",
      performer: "All",
      category: "All",
      asset: "All",
      startDate: "",
      endDate: "",
    });
    setFiltered(data);
    calculateSummary(data);
  };

  if (!data.length) return <p style={{ textAlign: "center" }}>Loading dashboard...</p>;

  return (
    <div className="daily-log-container">
      <h1 style={{ textAlign: "center", marginBottom: "30px" }}>📊 Activity Summary Dashboard</h1>

      {/* Filter Section */}
      <div className="filters">
        <div>
          <label>Asset Name:</label>
          <select
            name="asset"
            value={filters.asset}
            onChange={handleFilterChange}
          >
            <option>All</option>
            {[...new Set(data.map(d => d["Asset Name"]).filter(Boolean))]
              .map(a => (
                <option key={a}>{a}</option>
              ))}
          </select>
        </div>

        <div>
          <label>Frequency:</label>
          <select name="frequency" value={filters.frequency} onChange={handleFilterChange}>
            <option>All</option>
            {[...new Set(data.map(d => d.Frequency))].map(f => <option key={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label>Performer:</label>
          <select name="performer" value={filters.performer} onChange={handleFilterChange}>
            <option>All</option>
            {[...new Set(data.map(d => d["Activity performed by OEM/O&M"]))].map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label>Category:</label>
          <select name="category" value={filters.category} onChange={handleFilterChange}>
            <option>All</option>
            {[...new Set(data.map(d => d["Activity Category"]))].map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label>From:</label>
          <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} />
        </div>
        <div>
          <label>To:</label>
          <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} />
        </div>
        <div className="btn-group">
          <button onClick={applyFilters}>Apply</button>
          <button onClick={resetFilters}>Reset</button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="card-container">
        <div className="card">Total Activities: <strong>{filtered.length}</strong></div>
        <div className="card">Preventive: <strong>{summary.category?.["Preventive Maintenance"] || 0}</strong></div>
        <div className="card">Proactive: <strong>{summary.category?.["Proactive Maintenance"] || 0}</strong></div>
        <div className="card">Performed by OEM: <strong>{summary.performer?.["OEM"] || 0}</strong></div>
        <div className="card">Performed by O&M: <strong>{summary.performer?.["O&M"] || 0}</strong></div>
      </div>

      {/* Charts */}
      <h2>Activity Frequency Distribution</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={toChartData(summary.freq)}>
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="value" fill="#0088FE" />
        </BarChart>
      </ResponsiveContainer>

      <h2>Activity Category Overview</h2>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie data={toChartData(summary.category)} dataKey="value" nameKey="name" outerRadius={100}>
            {toChartData(summary.category).map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>

      <h2>Approvals Required (Count)</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={toChartData(summary.approvals)}>
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="value" fill="#FF8042" />
        </BarChart>
      </ResponsiveContainer>

      <h2>Alarms Generated</h2>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie data={toChartData(summary.alarms)} dataKey="value" nameKey="name" outerRadius={100}>
            {toChartData(summary.alarms).map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>

      <style>{`
        .filters {
          display: flex;
          flex-wrap: wrap;
          gap: 15px;
          margin-bottom: 25px;
          align-items: flex-end;
        }
        .filters div {
          display: flex;
          flex-direction: column;
        }
        select, input[type="date"] {
          padding: 6px;
          border-radius: 6px;
          border: 1px solid #ccc;
          min-width: 150px;
        }
        .btn-group button {
          margin-top: 8px;
          margin-right: 5px;
          padding: 7px 14px;
          border: none;
          border-radius: 6px;
          background: #2563eb;
          color: white;
          cursor: pointer;
        }
        .btn-group button:nth-child(2) {
          background: #6b7280;
        }
        .card-container {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 20px;
          margin-bottom: 40px;
        }
        .card {
          background: #f9fafb;
          padding: 20px;
          border-radius: 10px;
          text-align: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          font-size: 16px;
        }
      `}</style>
    </div>
  );
}
