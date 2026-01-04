import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  where,
  limit,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc
} from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";


const formatDuration = (sec) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
};

const getToday = () => format(new Date(), "yyyy-MM-dd");

const DGRunHistory = ({ userData }) => {
  const [logs, setLogs] = useState([]);
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(getToday());
  // Edit Tools
  const [editId, setEditId] = useState(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");


  /** permissions */
  const isAdmin =
    userData?.role === "Super Admin" ||
    userData?.role === "Admin" ||
    userData.isAdminAssigned ||
    // isAdminAssignmentValid(userData) ||
    userData?.designation === "Vertiv Site Infra Engineer" ||
    userData?.designation === "Vertiv CIH" ||
    userData?.designation === "Vertiv ZM";


  const handleDelete = async (id) => {
    const confirm = window.confirm(
      "⚠️ Are you sure you want to delete this DG run entry?\nThis action cannot be undone."
    );

    if (!confirm) return;

    try {
      await deleteDoc(
        doc(db, "dgRunLogs", userData.site, "entries", id)
      );

      alert("🗑️ DG run entry deleted successfully");
    } catch (err) {
      console.error("Delete failed:", err);
      alert("❌ Failed to delete entry");
    }
  };

  const handleEdit = (row) => {
    setEditId(row.id);
    setEditStart(row.startTime);
    setEditEnd(row.endTime);
  };

  const handleSaveEdit = async (row) => {
    try {
      const start = new Date(`${row.date} ${editStart}`);
      const end = new Date(`${row.date} ${editEnd}`);

      if (end <= start) {
        alert("❌ Stop time must be after start time");
        return;
      }

      const runSeconds = Math.floor((end - start) / 1000);

      await updateDoc(
        doc(db, "dgRunLogs", userData.site, "entries", row.id),
        {
          startTime: editStart,
          endTime: editEnd,
          runSeconds,
          updatedAt: new Date(),
          updatedBy: userData?.name || userData?.email,
        }
      );

      setEditId(null);
    } catch (err) {
      console.error(err);
      alert("❌ Failed to update time");
    }
  };


  useEffect(() => {
    if (!userData?.site || !selectedDate) return;

    const q = query(
      collection(db, "dgRunLogs", userData.site, "entries"),
      where("date", "==", selectedDate),
      // orderBy("createdAt", "desc")
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
  }, [userData?.site, selectedDate]);

  return (
    <div className="daily-log-container" style={{ padding: "16px" }}>
      <h3>⛽ DG Run History</h3>

      <div style={{ marginBottom: "12px" }}>
        <label style={{ fontWeight: "bold" }}>
          📅 Select Date:&nbsp;
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              padding: "6px",
              borderRadius: "6px",
              border: "1px solid #ccc",
            }}
          />
        </label>
      </div>

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
              {isAdmin && (
                <th>Action</th>
              )}
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
                  <td>
                    {editId === r.id ? (
                      <input
                        type="time"
                        value={editStart}
                        onChange={(e) => setEditStart(e.target.value)}
                      />
                    ) : (
                      r.startTime
                    )}
                  </td>

                  <td>
                    {editId === r.id ? (
                      <input
                        type="time"
                        value={editEnd}
                        onChange={(e) => setEditEnd(e.target.value)}
                      />
                    ) : (
                      r.endTime
                    )}
                  </td>

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
                  {isAdmin && (
                    <td style={{ textAlign: "center" }}>
                      {editId === r.id ? (
                        <>
                          <button
                            onClick={() => handleSaveEdit(r)}
                            style={{
                              marginRight: "6px",
                              padding: "4px 6px",
                              background: "#16a34a",
                              color: "#fff",
                              borderRadius: "6px",
                              border: "none",
                            }}
                          >
                            💾 Save
                          </button>

                          <button
                            onClick={() => setEditId(null)}
                            style={{
                              padding: "4px 6px",
                              background: "#9ca3af",
                              color: "#fff",
                              borderRadius: "6px",
                              border: "none",
                            }}
                          >
                            ✖ Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleEdit(r)}
                          disabled={r.dgLogAdded && userData.name !== "Suman Adhikari"}
                          style={{
                            marginRight: "6px",
                            padding: "4px 6px",
                            background: r.dgLogAdded ? "#9ca3af" : "#2563eb",
                            color: "#fff",
                            borderRadius: "6px",
                            border: "none",
                            cursor: r.dgLogAdded  && userData.name !== "Suman Adhikari" ? "not-allowed" : "pointer",
                          }}
                        >
                          ✏️ Edit
                        </button>
                      )}
                      <button
                        disabled={isUpdated && userData.name !== "Suman Adhikari"}
                        onClick={() => handleDelete(r.id)}
                        style={{
                          padding: "4px 8px",
                          borderRadius: "6px",
                          border: "1px solid #dc2626",
                          background: "#dc2626",
                          color: "#fff",
                          cursor: "pointer",
                          fontSize: "12px",
                        }}
                      >
                        🗑 Delete
                      </button>
                    </td>
                  )}
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
