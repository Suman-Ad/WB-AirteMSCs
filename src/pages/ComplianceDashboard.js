import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import "../assets/Compliance.css";

const ComplianceDashboard = ({ userData }) => {
  const [templates, setTemplates] = useState([]);
  const [records, setRecords] = useState([]);

  const userRole = userData?.role;
  const userSite = userData?.site;

  useEffect(() => {
    const unsubTemplates = onSnapshot(collection(db, "compliance_templates"), (snap) => {
      setTemplates(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    const unsubRecords = onSnapshot(collection(db, "compliance_records"), (snap) => {
      setRecords(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubTemplates();
      unsubRecords();
    };
  }, []);

  // Merge templates + records
  const mergedData = templates.map((template) => {
    const record = records.find((r) => r.templateId === template.id);
    return {
      id: template.id,
      complianceType: template.title,
      scope: template.scope,
      site: template.scope === "site" ? template.site : "All Sites",
      description: template.description,
      ...record,
    };
  });

  // Role-based filtering
  const filteredData =
    userRole === "User"
      ? mergedData.filter((c) => c.site === userSite || c.scope === "global")
      : mergedData;

  // Group summary by circle → site
  const summary = {};
  filteredData.forEach((c) => {
    const circle = c.circle || "-";
    const site = c.site || "-";
    if (!summary[circle]) summary[circle] = {};
    if (!summary[circle][site]) summary[circle][site] = 0;
    summary[circle][site] += 1;
  });

  return (
    <div className="compliance-container">
      <h2>Compliance Dashboard</h2>

      {(userRole === "Admin" ||
        userRole === "Super Admin" ||
        userRole === "Super User") && (
        <Link to="/manage-compliance">
          ⚖️ <span className="label">Manage Compliance</span>
        </Link>
      )}

      {/* Summary Table */}
      {(userRole === "Admin" || userRole === "Super Admin" || userRole === "Super User") && (
        <div className="compliance-summary">
          <h3>Summary (Circle → Site)</h3>
          <table>
            <thead>
              <tr>
                <th>Circle</th>
                <th>Site</th>
                <th>Total Records</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(summary).map((circle) =>
                Object.keys(summary[circle]).map((site) => (
                  <tr key={`${circle}-${site}`}>
                    <td>{circle}</td>
                    <td>{site}</td>
                    <td>{summary[circle][site]}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Detailed Compliance Table */}
      <table>
        <thead>
          <tr>
            <th>Region</th>
            <th>Circle</th>
            <th>Site</th>
            <th>Type</th>
            <th>Expiry</th>
            <th>Renewal</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {filteredData.map((c) => {
            const hasDocument = !!c.fileUrl;
            const today = new Date();
            const renewalDate = c.renewalDate ? new Date(c.renewalDate) : null;
            const daysLeft = renewalDate
              ? Math.ceil((renewalDate - today) / (1000 * 60 * 60 * 24))
              : null;

            let statusText = "Missing Document";
            let rowClass = "missing";

            if (hasDocument && daysLeft !== null) {
              if (daysLeft <= 0) {
                statusText = "Overdue";
                rowClass = "overdue";
              } else if (daysLeft <= 7) {
                statusText = `${daysLeft} days left`;
                rowClass = "near-expiry";
              } else {
                statusText = `${daysLeft} days left`;
                rowClass = "";
              }
            }

            return (
              <tr key={c.id} className={rowClass}>
                <td>{c.region || "-"}</td>
                <td>{c.circle || "-"}</td>
                <td>{c.site || "-"}</td>
                <td>{c.complianceType}</td>
                <td>{c.expiryDate || "-"}</td>
                <td>{c.renewalDate || "-"}</td>
                <td>
                  {hasDocument ? (
                    <a href={c.fileUrl} target="_blank" rel="noreferrer">
                      {statusText}
                    </a>
                  ) : (
                    statusText
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ComplianceDashboard;
