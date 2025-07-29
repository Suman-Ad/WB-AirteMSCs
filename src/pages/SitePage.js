// src/pages/SitePage.js
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { db } from "../firebase";
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  orderBy
} from "firebase/firestore";

const SitePage = ({ userData }) => {
  const { siteName } = useParams();
  const [reports, setReports] = useState([]);
  const [filterMonth, setFilterMonth] = useState("");

  const fetchReports = async () => {
    let q = query(
      collection(db, "pm_reports"),
      where("site", "==", siteName),
      orderBy("timestamp", "desc")
    );
    const snapshot = await getDocs(q);
    const filtered = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((doc) => (filterMonth ? doc.month === filterMonth : true));
    setReports(filtered);
  };

  useEffect(() => {
    fetchReports();
  }, [siteName, filterMonth]);

  const canDelete = (report) => {
    if (!userData) return false;
    if (["Admin", "Super Admin"].includes(userData.role)) return true;
    return userData.site === report.site && userData.uid === report.uploadedBy.uid;
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this file?")) return;
    await deleteDoc(doc(db, "pm_reports", id));
    fetchReports();
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-2">Site: {siteName}</h2>

      <div className="mb-4">
        <label className="mr-2">Filter by Month:</label>
        <input
          type="month"
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="border px-2 py-1 rounded"
        />
        <button
          onClick={() => setFilterMonth("")}
          className="ml-2 text-blue-600 underline"
        >
          Clear
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border">
          <thead>
            <tr className="bg-gray-200">
              <th className="p-2 border">Month</th>
              <th className="p-2 border">Type</th>
              <th className="p-2 border">PDF</th>
              <th className="p-2 border">Uploaded By</th>
              <th className="p-2 border">Uploaded On</th>
              {["Admin", "Super Admin", "Super User"].includes(userData.role) && (
                <th className="p-2 border">Action</th>
              )}
            </tr>
          </thead>
          <tbody>
            {reports.length > 0 ? (
              reports.map((report) => (
                <tr key={report.id}>
                  <td className="p-2 border">{report.month}</td>
                  <td className="p-2 border">{report.type}</td>
                  <td className="p-2 border">
                    <a
                      href={report.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline"
                    >
                      View PDF
                    </a>
                  </td>
                  <td className="p-2 border">{report.uploadedBy?.name}</td>
                  <td className="p-2 border">
                    {report.timestamp?.toDate().toLocaleString()}
                  </td>
                  {canDelete(report) && (
                    <td className="p-2 border">
                      <button
                        onClick={() => handleDelete(report.id)}
                        className="text-red-600 underline"
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="p-4 text-center text-gray-500">
                  No reports found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SitePage;
