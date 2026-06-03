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
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import {
  format,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths
} from "date-fns";


const formatDuration = (sec) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
};

const getToday = () => format(new Date(), "yyyy-MM-dd");

const isAdminAssignmentValid = (userData) => {
  if (!userData?.isAdminAssigned) return false;
  if (!userData?.adminAssignFrom || !userData?.adminAssignTo) return false;

  const today = new Date();
  const from = new Date(userData.adminAssignFrom);
  const to = new Date(userData.adminAssignTo);

  return today >= from && today <= to;
};

const DGRunHistory = ({ userData }) => {
  const [logs, setLogs] = useState([]);
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(getToday());
  // Edit Tools
  const [editId, setEditId] = useState(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");

  const [monthLogs, setMonthLogs] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());


  /** permissions */
  const isAdmin =
    userData?.role === "Super Admin" ||
    userData?.role === "Admin" ||
    userData.isAdminAssigned ||
    isAdminAssignmentValid(userData) ||
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

  useEffect(() => {
    if (!userData?.site) return;

    const monthStart = format(
      startOfMonth(currentMonth),
      "yyyy-MM-dd"
    );

    const monthEnd = format(
      endOfMonth(currentMonth),
      "yyyy-MM-dd"
    );

    const q = query(
      collection(
        db,
        "dgRunLogs",
        userData.site,
        "entries"
      ),
      where("date", ">=", monthStart),
      where("date", "<=", monthEnd)
    );

    const unsub = onSnapshot(q, (snap) => {
      setMonthLogs(
        snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
      );
    });

    return () => unsub();
  }, [userData?.site, currentMonth]);

  const pendingLogs =
    logs.filter(
      row =>
        !row.dgLogAdded &&
        !row.dgLogId
    ).length;

  const getDateStatus = (dateObj) => {
    const date = format(
      dateObj,
      "yyyy-MM-dd"
    );

    const dayLogs =
      monthLogs.filter(
        x => x.date === date
      );

    if (dayLogs.length === 0)
      return "empty";

    const updated =
      dayLogs.filter(
        x =>
          x.dgLogAdded ||
          x.dgLogId
      ).length;

    if (updated === 0)
      return "pending";

    if (updated === dayLogs.length)
      return "complete";

    return "partial";
  };

  const summary = {
    complete: 0,
    partial: 0,
    pending: 0
  };

  const uniqueDates =
    [...new Set(
      monthLogs.map(
        x => x.date
      )
    )];

  uniqueDates.forEach(date => {

    const rows =
      monthLogs.filter(
        x => x.date === date
      );

    const updated =
      rows.filter(
        x =>
          x.dgLogAdded ||
          x.dgLogId
      ).length;

    if (updated === rows.length)
      summary.complete++;

    else if (updated === 0)
      summary.pending++;

    else
      summary.partial++;
  });

  return (
    <div className="daily-log-container" style={{ padding: "16px" }}>
      <h3>⛽ DG Run History</h3>

      <div
        style={{
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          marginBottom: "15px"
        }}
      >

        <div
          style={{
            background: "#14532d",
            color: "#fff",
            padding: "10px",
            borderRadius: "8px"
          }}
        >
          🟢 Updated Days
          <br />
          {summary.complete}
        </div>

        <div
          style={{
            background: "#92400e",
            color: "#fff",
            padding: "10px",
            borderRadius: "8px"
          }}
        >
          🟡 Partial Days
          <br />
          {summary.partial}
        </div>

        <div
          style={{
            background: "#991b1b",
            color: "#fff",
            padding: "10px",
            borderRadius: "8px"
          }}
        >
          🔴 Pending Days
          <br />
          {summary.pending}
        </div>

      </div>
      <div
        style={{
          marginBottom: "20px"
        }}
      >

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "10px"
          }}
        >
          <button
            onClick={() =>
              setCurrentMonth(
                subMonths(
                  currentMonth,
                  1
                )
              )
            }
          >
            ◀ Previous Month
          </button>

          <button
            onClick={() =>
              setCurrentMonth(
                addMonths(
                  currentMonth,
                  1
                )
              )
            }
          >
            Next Month ▶
          </button>
        </div>

        <Calendar
          value={
            new Date(selectedDate)
          }
          onChange={(value) =>
            setSelectedDate(
              format(
                value,
                "yyyy-MM-dd"
              )
            )
          }
          activeStartDate={currentMonth}
          onActiveStartDateChange={({ activeStartDate }) =>
            setCurrentMonth(activeStartDate)
          }
          tileContent={({ date, view }) => {
            if (view !== "month") return null;

            const status = getDateStatus(date);

            let color = "";

            if (status === "complete")
              color = "#22c55e";

            if (status === "partial")
              color = "#f59e0b";

            if (status === "pending")
              color = "#ef4444";

            if (!color) return null;

            return (
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: color,
                  margin: "2px auto 0"
                }}
              />
            );
          }}
        />

      </div>
      <div
        style={{
          marginBottom: "12px",
          padding: "10px",
          background:
            pendingLogs > 0
              ? "#7f1d1d"
              : "#14532d",
          color: "#fff",
          borderRadius: "8px",
          fontWeight: "bold",
        }}
      >
        {pendingLogs > 0
          ? `🚨 ${pendingLogs} DG entries pending update`
          : "✅ All DG entries updated"}
      </div>

      {/* <div style={{ marginBottom: "12px" }}>
        <label style={{ fontWeight: "bold" }}>
          📅 Select Date:&nbsp;
          <div
            style={{
              marginBottom: "12px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "flex"
            }}
          >
            <button
              onClick={() =>
                setSelectedDate(
                  format(
                    subDays(
                      new Date(selectedDate),
                      1
                    ),
                    "yyyy-MM-dd"
                  )
                )
              }
            >
              ⬅ Prev
            </button>

            <input
              type="date"
              value={selectedDate}
              onChange={(e) =>
                setSelectedDate(e.target.value)
              }
            />

            <button
              onClick={() =>
                setSelectedDate(
                  format(
                    addDays(
                      new Date(selectedDate),
                      1
                    ),
                    "yyyy-MM-dd"
                  )
                )
              }
            >
              Next ➡
            </button>
          </div>
        </label>
      </div> */}
      {pendingLogs > 0 && (
        <div
          style={{
            marginBottom: "10px",
            color: "#dc2626",
            fontWeight: "bold",
            fontSize: "14px",
          }}
        >
          🔴 Selected date contains DG entries that are not updated.
        </div>
      )}
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
                <tr
                  key={r.id}
                  style={{
                    background:
                      !isUpdated
                        ? "#fef2f2"
                        : "transparent",
                    borderLeft:
                      !isUpdated
                        ? "5px solid #dc2626"
                        : "5px solid transparent",
                  }}
                >
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
                            cursor: r.dgLogAdded && userData.name !== "Suman Adhikari" ? "not-allowed" : "pointer",
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
