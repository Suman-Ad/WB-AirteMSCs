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
      arr.sort((a, b) => b.id.localeCompare(a.id));
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
    <div className="daily-log-container">
      <h2 style={{
        fontSize: '1.5rem',
        fontWeight: '600',
        marginBottom: '1rem'
      }}>My Leave Status</h2>
      {loading ? <div>Loading...</div> : null}
      {list.length === 0 && !loading && <div>No leave requests found.</div>}

      <div className="space-y-2">
        {list.map(it => (
          <div key={it.id} style={{
            border: '1px solid #e5e7eb',
            padding: '0.75rem',
            borderRadius: '0.375rem',
            backgroundColor: 'white',
            display: 'flex',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontWeight: '500' }}>{it.date}</div>
              <div style={{ fontSize: '14px' }}>{it.reason}</div>
              <div style={{ fontSize: '12px', color: '#475569' }}>Status: {it.status}</div>
              <div className="text-xs text-slate-600">Backup: {it.backupUserName || it.backupUserId}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {it.status === "pending" && <button style={{
                paddingLeft: '0.5rem',
                paddingRight: '0.5rem',
                paddingTop: '0.25rem',
                paddingBottom: '0.25rem',
                backgroundColor: '#ef4444',
                color: 'white',
                borderRadius: '0.375rem'
              }} onClick={() => cancelRequest(it)}>Cancel</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
