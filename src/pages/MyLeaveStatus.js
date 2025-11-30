// src/pages/MyLeaveStatus.jsx
import React, { useEffect, useState } from "react";
import { collection, getDocs, query, doc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function MyLeaveStatus({ currentUser }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.uid) return;
    (async () => {
      setLoading(true);
      const q = query(collection(db, "leaveRequests", currentUser.uid, "items"));
      const snap = await getDocs(q);
      const arr = [];
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
      // sort latest first
      arr.sort((a,b) => b.id.localeCompare(a.id));
      setList(arr);
      setLoading(false);
    })();
  }, [currentUser]);

  async function cancelRequest(item) {
    if (item.status !== "pending") return alert("Only pending requests can be canceled");
    // if (!confirm("Cancel this CL request?")) return;
    await deleteDoc(doc(db, "leaveRequests", currentUser.uid, "items", item.id));
    setList(prev => prev.filter(p => p.id !== item.id));
    alert("Canceled");
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-semibold mb-4">My Leave Status</h2>
      {loading ? <div>Loading...</div> : null}
      {list.length === 0 && !loading && <div>No leave requests found.</div>}

      <div className="space-y-2">
        {list.map(it => (
          <div key={it.id} className="border p-3 rounded bg-white flex justify-between">
            <div>
              <div className="font-medium">{it.date}</div>
              <div className="text-sm">{it.reason}</div>
              <div className="text-xs text-slate-600">Status: {it.status}</div>
              <div className="text-xs text-slate-600">Backup: {it.backupUserName || it.backupUserId}</div>
            </div>
            <div className="flex flex-col gap-2">
              {it.status === "pending" && <button className="px-2 py-1 bg-red-500 text-white rounded" onClick={() => cancelRequest(it)}>Cancel</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
