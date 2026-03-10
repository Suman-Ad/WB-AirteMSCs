import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function AllRegisterBook({ userData }) {
  const [registers, setRegisters] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const isAdmin =
    userData?.role === "Super Admin" ||
    userData?.role === "Admin";

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "register_books"), (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setRegisters(list);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const createNewRegister = async () => {
    const name = prompt("Enter Register Name:");
    if (!name) return;

    await addDoc(collection(db, "register_books"), {
      name: name.trim(),
      path: `dynamic_register/${name.trim()}`,
      createdAt: serverTimestamp(),
    });

    alert("✅ Register Created Successfully");
  };

  const openRegister = (reg) => {
    navigate(`/dynamic-register/${encodeURIComponent(reg.name)}`);
  };

  const deleteRegister = async (reg) => {
    if (!window.confirm(`Delete "${reg.name}" Register?`)) return;
    await deleteDoc(doc(db, "register_books", reg.id));
    alert("🗑 Register Deleted");
  };

  return (
    <div className="dhr-dashboard-container">
      <h1 className="dashboard-header">📚 All Register Book</h1>

      {isAdmin && (
        <button className="btn-primary" onClick={createNewRegister}>
          ➕ Add A New Register
        </button>
      )}

      {loading ? (
        <p>Loading registers...</p>
      ) : (
        <table className="daily-activity-table">
          <thead>
            <tr>
              <th>Sl. No.</th>
              <th>Register Name</th>
              <th>Firestore Path</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {registers.map((r, idx) => (
              <tr key={r.id}>
                <td>{idx + 1}. </td>
                <td>{r.name}</td>
                <td>{r.path}</td>
                <td>
                  <button
                    className="daily-activity-btn"
                    onClick={() => openRegister(r)}
                  >
                    Open
                  </button>

                  {isAdmin && (
                    <button
                      className="daily-activity-btn daily-activity-btn-danger"
                      onClick={() => deleteRegister(r)}
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}