import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot
} from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";


const formatDuration = (sec) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
};

const DGRunHistory = ({ userData }) => {
  const [logs, setLogs] = useState([]);
  const navigate = useNavigate();


  useEffect(() => {
    if (!userData?.site) return;

    const q = query(
      collection(db, "dgRunLogs", userData.site, "entries"),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d, i) => ({
        id: d.id,
        sl: i + 1,
        ...d.data(),
      }));
      setLogs(rows);
    });

    return () => unsub();
  }, [userData?.site]);

  return (
    <div style={{ padding: "16px" }}>
      <h3>⛽ DG Run History</h3>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>Sl</th>
              <th>Date</th>
              <th>DG</th>
              <th>Start</th>
              <th>End</th>
              <th>Duration</th>
              <th>Reported By</th>
              <th>Status</th> {/* ✅ NEW */}
            </tr>
          </thead>

          <tbody>
  {logs.length === 0 && (
    <tr>
      <td colSpan="8" style={{ textAlign: "center" }}>
        No DG run logs
      </td>
    </tr>
  )}

  {logs.map((r) => {
    const isUpdated = r.dgLogAdded === true || !!r.dgLogId;

    return (
      <tr key={r.id}>
        <td>{r.sl}</td>
        <td>{r.date}</td>
        <td>{r.dgNumber}</td>
        <td>{r.startTime}</td>
        <td>{r.endTime}</td>
        <td>{formatDuration(r.runSeconds)}</td>
        <td>
          {r.startedBy}
          <br />
          <small>{r.empId}</small>
        </td>

        {/* ✅ STATUS COLUMN */}
        <td style={{ textAlign: "center" }}>
          {isUpdated ? (
            <span style={{ color: "green", fontWeight: "bold" }}>
              ✔ Updated
            </span>
          ) : (
            <button
              style={{
                padding: "4px 10px",
                borderRadius: "6px",
                border: "1px solid #2563eb",
                background: "#2563eb",
                color: "#fff",
                cursor: "pointer",
              }}
              onClick={() =>
                navigate("/dg-log-entry", {
                  state: {
                    autoFromDgStop: true,
                    site: userData.site,
                    dgNumber: r.dgNumber,
                    startTime: r.startTime,
                    stopTime: r.endTime,
                    date: format(new Date(), "yyyy-MM-dd"),
                    runId: r.id, // 🔑 link back to run history
                  },
                })
              }
            >
              ➕ Add Entry
            </button>
          )}
        </td>
      </tr>
    );
  })}
</tbody>
        </table>
      </div>
    </div>
  );
};

export default DGRunHistory;
