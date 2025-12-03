import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { startOfMonth, endOfMonth, eachDayOfInterval, format } from "date-fns";
import { db } from "../firebase";

export default function MyDutySchedule({ currentUser }) {
  const [myDays, setMyDays] = useState([]);

  useEffect(() => {
    if (!currentUser?.site || !currentUser?.uid) return;

    async function load() {
      const start = startOfMonth(new Date());
      const end = endOfMonth(new Date());

      const days = eachDayOfInterval({ start, end });

      const list = [];

      for (let day of days) {
        const iso = format(day, "yyyy-MM-dd");
        const docId = `${currentUser.site}_${iso}`;
        const snap = await getDocs(
          collection(db, "dutyRoster"),
        );

        const docSnap = snap.docs.find(d => d.id === docId);
        if (docSnap) {
          const data = docSnap.data();
          const shift = Object.keys(data.shifts).find(s =>
            data.shifts[s].includes(currentUser.uid)
          );

          if (shift) list.push({ date: iso, shift });
        }
      }

      setMyDays(list);
    }

    load();
  }, [currentUser]);

  return (
    <div className="daily-log-container">
      <h2>My Duty Schedule</h2>
      <p>Name: {currentUser.name}</p>
      <p>Emp. ID.: {currentUser.empId}</p>

      <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" }}>
        {myDays.length === 0 && <p>No duty assigned this month.</p>}

        {myDays.map((d) => (
          <div
            key={d.date}
            style={{
              padding: "10px",
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              justifyContent: "space-between"
            }}
          >
            <span>{d.date}</span>
            <strong>{d.shift === "M" ? "Morning Shift" : d.shift === "E" ? "Evening Shift" : d.shift === "N" ? "Night Shift" : d.shift === "G" ? "General Shift" : "Weekly Off"}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
