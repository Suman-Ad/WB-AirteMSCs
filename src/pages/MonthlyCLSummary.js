// src/pages/MonthlyCLSummary.jsx
import React, { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { format } from "date-fns";

function toCSV(rows) {
  const headers = ["User", "UserId", "Approved", "Pending", "Rejected", "TotalCL"];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push([r.userName, r.userId, r.approved, r.pending, r.rejected, r.total].join(","));
  }
  return lines.join("\n");
}

export default function MonthlyCLSummary({ currentUser }) {
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentUser?.site) return;
    (async () => {
      setLoading(true);
      const [y, m] = month.split("-");
      // load all users for site
      const userSnap = await getDocs(query(collection(db, "users"), where("site", "==", currentUser.site)));
      const results = [];
      for (const u of userSnap.docs) {
        const uid = u.id;
        const name = u.data().name || uid;
        const lrSnap = await getDocs(collection(db, "leaveRequests", uid, "items"));
        let approved = 0, pending = 0, rejected = 0;
        lrSnap.forEach(d => {
          const date = d.id; // yyyy-mm-dd
          if (!date.startsWith(y + "-" + m)) return;
          const st = d.data().status;
          if (st === "approved") approved++;
          else if (st === "pending") pending++;
          else if (st === "rejected") rejected++;
        });
        const total = approved + pending + rejected;
        if (total > 0) results.push({ userName: name, userId: uid, approved, pending, rejected, total });
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
    <div className="p-4">
      <h2 className="text-2xl font-semibold mb-4">Monthly CL Summary - {currentUser?.site}</h2>
      <div className="flex gap-2 items-center mb-4">
        <input type="month" value={month} onChange={e=>setMonth(e.target.value)} className="border px-2 py-1 rounded" />
        <button onClick={downloadCSV} className="px-3 py-1 bg-blue-600 text-white rounded">Export CSV</button>
      </div>

      {loading ? <div>Loading...</div> : null}

      <div className="space-y-2">
        {rows.map(r => (
          <div key={r.userId} className="border p-2 rounded bg-white flex justify-between">
            <div>
              <div className="font-medium">{r.userName}</div>
              <div className="text-xs text-slate-600">{r.userId}</div>
            </div>
            <div className="text-sm">
              Approved: <b>{r.approved}</b> &nbsp; Pending: <b>{r.pending}</b> &nbsp; Rejected: <b>{r.rejected}</b>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
