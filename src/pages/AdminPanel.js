// src/pages/AdminPanel.js
import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  query,
  orderBy
} from "firebase/firestore";

const AdminPanel = ({ userData }) => {
  const [reports, setReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);

  // Filters
  const [siteFilter, setSiteFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [searchUploader, setSearchUploader] = useState("");

  const fetchAllReports = async () => {
    const q = query(collection(db, "pm_reports"), orderBy("timestamp", "desc"));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setReports(data);
    setFilteredReports(data);
  };

  useEffect(() => {
    fetchAllReports();
  }, []);

  useEffect(() => {
    let filtered = reports;

    if (siteFilter) filtered = filtered.filter((r) => r.site === siteFilter);
    if (monthFilter) filtered = filtered.filter((r) => r.month === monthFilter);
    if (typeFilter) filtered = filtered.filter((r) => r.type === typeFilter);
    if (searchUploader)
      filtered = filtered.filter((r) =>
        r.uploadedBy?.name?.toLowerCase().includes(searchUploader.toLowerCase()) ||
        r.uploadedBy?.email?.toLowerCase().includes(searchUploader.toLowerCase())
      );

    setFilteredReports(filtered);
  }, [siteFilter, monthFilter, typeFilter, searchUploader, reports]);

  const handleDelete = async (id) => {
    if (window.confirm("Delete this PM report?")) {
      await db.collection("pm_reports").doc(id).delete();
      fetchAllReports();
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Admin Panel</h2>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
        <select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)} className="border p-2 rounded">
          <option value="">All Sites</option>
          {[
            "Andaman", "Asansol", "Berhampore", "DLF", "GLOBSYN",
            "Infinity-I", "Infinity-II", "Kharagpur", "Mira Tower",
            "New Alipore", "SDF", "Siliguri"
          ].map((site) => (
            <option key={site} value={site}>{site}</option>
          ))}
        </select>

        <input
          type="month"
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="border p-2 rounded"
        />

        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="border p-2 rounded">
          <option value="">All Types</option>
          <option value="In-House">In-House</option>
          <option value="Vendor">Vendor</option>
        </select>

        <input
          type="text"
          placeholder="Search uploader name/email"
          value={searchUploader}
          onChange={(e) => setSearchUploader(e.target.value)}
          className="border p-2 rounded"
        />
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full border">
          <thead>
            <tr className="bg-gray-200">
              <th className="p-2 border">Site</th>
              <th className="p-2 border">Month</th>
              <th className="p-2 border">Type</th>
              <th className="p-2 border">PDF</th>
              <th className="p-2 border">Uploader</th>
              <th className="p-2 border">Uploaded On</th>
              <th className="p-2 border">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredReports.length ? (
              filteredReports.map((report) => (
                <tr key={report.id}>
                  <td className="p-2 border">{report.site}</td>
                  <td className="p-2 border">{report.month}</td>
                  <td className="p-2 border">{report.type}</td>
                  <td className="p-2 border">
                    <a
                      href={report.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline"
                    >
                      View / Download
                    </a>
                  </td>
                  <td className="p-2 border">
                    {report.uploadedBy?.name}
                    <br />
                    <small className="text-gray-500">{report.uploadedBy?.email}</small>
                  </td>
                  <td className="p-2 border">
                    {report.timestamp?.toDate().toLocaleString()}
                  </td>
                  <td className="p-2 border">
                    <button
                      onClick={() => handleDelete(report.id)}
                      className="text-red-600 underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="p-4 text-center text-gray-500">
                  No matching records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminPanel;
