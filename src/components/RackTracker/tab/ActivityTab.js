import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  getDocs,
} from "firebase/firestore";
import { db } from "../../../firebase";

const ActivityTab = ({ formData }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadActivityLogs();
  }, []);

  const loadActivityLogs = async () => {
    if (!formData?.siteName) return;

    try {
      setLoading(true);

      const siteKey = formData.siteName
        .trim()
        .toUpperCase()
        .replace(/[\/\s]+/g, "_");

      const rackKey = `${formData.equipmentLocation || "#UNKNOWN FLOOR"}_${formData.equipmentRackNo || "#A0"}-${formData.rackName || "#UNKNOWN RACK NAME"}`
        .replace(/[\/\s]+/g, "_");

      const q = query(
        collection(
          db,
          "acDcRackDetails",
          siteKey,
          "racks",
          rackKey,
          "activityLogs"
        ),
        orderBy("createdAt", "desc")
      );

      const snap = await getDocs(q);

      setLogs(
        snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatValue = (value) => {
    if (value === null || value === undefined || value === "") {
      return "-";
    }

    if (Array.isArray(value)) {
      return `${value.length} item(s)`;
    }

    if (typeof value === "object") {
      return JSON.stringify(value, null, 2);
    }

    return String(value);
  };

  if (loading) {
    return <h3>Loading Activity...</h3>;
  }

  if (logs.length === 0) {
    return (
      <div className="chart-container">
        <h3>No Activity Found</h3>
      </div>
    );
  }

  return (
    <div style={{ maxHeight: "250px", overflowY: "auto", background: "#0a0a0a", padding: "15px", borderRadius: "8px", color: "#00ff15" }}>


      {logs.map((log) => (
        <div
          key={log.id}
          style={{
            border: "1px solid #2083a1",
            borderRadius: 8,
            padding: 15,
            marginBottom: 15,
          }}
        >
          <strong>{log.action}</strong>

          <br />

          <small>
            {log.user?.name} ({log.user?.role})
          </small>

          <br />

          <small>
            {log.createdAt?.toDate
              ? log.createdAt.toDate().toLocaleString()
              : ""}
          </small>

          <hr />

          {log.changes?.map((change, index) => (
            <div
              key={index}
              style={{
                marginBottom: 12,
                padding: "8px",
                borderBottom: "1px solid #ddd",
              }}
            >
              <strong>{change.field}</strong>

              <div style={{ marginTop: 5 }}>
                <div>
                  <b>Old:</b>
                </div>
                <pre>{formatValue(change.oldValue)}</pre>

                <div>
                  <b>New:</b>
                </div>
                <pre>{formatValue(change.newValue)}</pre>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default ActivityTab;