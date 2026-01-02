// src/pages/MonthlyCLSummary.jsx
import React, { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { format } from "date-fns";

function toCSV(rows) {
  const headers = [
    "User",
    "UserId",
    "Date",
    "Status",
    "Backup Person"
  ];

  const lines = [headers.join(",")];

  rows.forEach(r => {
    r.dates.forEach(d => {
      lines.push([
        r.userName,
        r.empId,
        d.date,
        d.status,
        d.backupUserName || "-"
      ].join(","));
    });
  });

  return lines.join("\n");
}

export default function MonthlyCLSummary({ currentUser }) {
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterCLPerson, setFilterCLPerson] = useState("");
  const [filterBackupPerson, setFilterBackupPerson] = useState("");

  useEffect(() => {
    if (!currentUser?.site) return;

    (async () => {
      setLoading(true);
      const [y, m] = month.split("-");

      const userSnap = await getDocs(
        query(collection(db, "users"), where("site", "==", currentUser.site))
      );

      const results = [];

      for (const u of userSnap.docs) {
        const uid = u.id;
        const name = u.data().name || uid;
        const empId = u.data().empId || "";

        const lrSnap = await getDocs(
          collection(db, "leaveRequests", uid, "items")
        );

        let approved = 0, pending = 0, rejected = 0;
        const dates = [];

        lrSnap.forEach(d => {
          const date = d.id; // YYYY-MM-DD
          if (!date.startsWith(`${y}-${m}`)) return;

          const data = d.data();
          const status = data.status;

          if (status === "approved") approved++;
          else if (status === "pending") pending++;
          else if (status === "rejected") rejected++;

          dates.push({
            date,
            status,
            backupUserName: data.backupUserName || "",
            backupStatus: data.backupStatus || "pending"
          });
        });

        const total = approved + pending + rejected;

        if (total > 0) {
          results.push({
            userName: name,
            userId: uid,
            empId: empId,
            approved,
            pending,
            rejected,
            total,
            dates
          });
        }
      }

      setRows(results);
      setLoading(false);
    })();
  }, [currentUser, month]);

  function downloadCSV() {
    const csv = toCSV(rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cl-summary-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="daily-log-container">
      <h2 style={{
        fontSize: '1.5rem',    // text-2xl = 1.5rem or 24px
        fontWeight: 600,       // font-semibold = 600
        marginBottom: '1rem'   // mb-4 = 1rem or 16px
      }}>
        Monthly CL Summary (with Backup) – {currentUser?.site}
      </h2>

      <div style={{
        display: 'flex',
        gap: '0.5rem', // gap-2 typically equals 0.5rem or 8px
        alignItems: 'center',
        marginBottom: '1rem' // mb-4 typically equals 1rem or 16px
      }}>
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          style={{
            border: '1px solid #e5e7eb', // Default border (gray-200)
            paddingLeft: '0.5rem',        // px-2 = 0.5rem horizontal
            paddingRight: '0.5rem',       // px-2 = 0.5rem horizontal
            paddingTop: '0.25rem',        // py-1 = 0.25rem vertical
            paddingBottom: '0.25rem',     // py-1 = 0.25rem vertical
            borderRadius: '0.25rem'       // rounded = 0.25rem
          }}
        />
        <button
          onClick={downloadCSV}
          style={{
            paddingLeft: '0.75rem',     // px-3 = 0.75rem (12px)
            paddingRight: '0.75rem',    // px-3 = 0.75rem
            paddingTop: '0.25rem',      // py-1 = 0.25rem (4px)
            paddingBottom: '0.25rem',   // py-1 = 0.25rem
            backgroundColor: '#2563eb', // bg-blue-600 = #2563eb
            color: 'white',             // text-white = #ffffff
            borderRadius: '0.25rem',    // rounded = 0.25rem (4px)
          }}
        >
          Export CSV
        </button>
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'row', // default, but you can change to 'column'
        gap: '0.5rem',
        marginBottom: '1rem'
      }}>
        <input
          type="text"
          placeholder="Filter CL Person"
          value={filterCLPerson}
          onChange={e => setFilterCLPerson(e.target.value)}
          style={{
            border: '1px solid #e5e7eb', // default border
            padding: '0.25rem 0.5rem',    // py-1 px-2
            borderRadius: '0.25rem'       // rounded
          }}
        />

        <input
          type="text"
          placeholder="Filter Backup Person"
          value={filterBackupPerson}
          onChange={e => setFilterBackupPerson(e.target.value)}
          style={{
            border: '1px solid #e5e7eb', // default border
            padding: '0.25rem 0.5rem',    // py-1 px-2
            borderRadius: '0.25rem'       // rounded
          }}
        />
      </div>

      {loading && <div>Loading...</div>}

      {rows
        .filter(r =>
          !filterCLPerson ||
          r.userName.toLowerCase().includes(filterCLPerson.toLowerCase())
        )
        .map(r => ({
          ...r,
          dates: r.dates.filter(d =>
            !filterBackupPerson ||
            d.backupUserName.toLowerCase().includes(filterBackupPerson.toLowerCase())
          )
        }))
        .filter(r => r.dates.length > 0)
        .map(r => (

          <div key={r.userId} style={{ border: "2px solid #000", borderRadius: "15px", padding: "5px 3px", marginTop: "10px" }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.5rem' // mb-2 typically equals 0.5rem or 8px
            }}>
              <div>
                <div className="font-semibold">{r.userName}</div>
                <div className="text-xs text-gray-500">{r.empId}</div>
              </div>
              <div className="text-sm">
                Approved: <b>{r.approved}</b> | Pending: <b>{r.pending}</b> | Rejected: <b>{r.rejected}</b>
              </div>
            </div>

            <table className="w-full text-sm border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-2 py-1">Date</th>
                  <th className="border px-2 py-1">Status</th>
                  <th className="border px-2 py-1">Backup Person</th>
                  <th className="border px-2 py-1">Backup Status</th>

                </tr>
              </thead>
              <tbody>
                {r.dates.map((d, i) => (
                  <tr key={i}>
                    <td className="border px-2 py-1">{d.date}</td>
                    <td className="border px-2 py-1 capitalize">{d.status}</td>
                    <td className="border px-2 py-1">
                      {d.backupUserName || "-"}
                    </td>
                    <td className="border px-2 py-1 capitalize">
                      {d.backupStatus || "-"}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
}
