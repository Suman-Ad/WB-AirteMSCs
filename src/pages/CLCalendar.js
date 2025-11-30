// src/pages/CLCalendar.jsx
import React, { useEffect, useState } from "react";
import { startOfMonth, endOfMonth, eachDayOfInterval, format } from "date-fns";
import { collection, getDocs, query, where, collectionGroup } from "firebase/firestore";
import { db } from "../firebase";

function formatISO(d) {
  return format(d, "yyyy-MM-dd");
}

export default function CLCalendar({ currentUser, mode = "me", siteId: propSiteId }) {
  const [monthDate, setMonthDate] = useState(new Date());
  const [events, setEvents] = useState({}); // { 'YYYY-MM-DD': [ {..} ] }
  const siteId = propSiteId || currentUser?.site;

  useEffect(() => {
    async function load() {
      const start = formatISO(startOfMonth(monthDate));
      const end = formatISO(endOfMonth(monthDate));
      const map = {};

      if (mode === "me") {
        if (!currentUser?.uid) return;
        // load current user's leaveRequests for the month
        const q = query(collection(db, "leaveRequests", currentUser.uid, "items"));
        const snap = await getDocs(q);
        snap.forEach(d => {
          const data = d.data();
          const date = d.id;
          if (date >= start && date <= end) {
            map[date] = map[date] || [];
            map[date].push(data);
          }
        });
      } else {
        // site view - fetch all users of site then their items
        const userSnap = await getDocs(query(collection(db, "users"), where("site", "==", siteId)));
        for (const udoc of userSnap.docs) {
          const uid = udoc.id;
          const lrSnap = await getDocs(collection(db, "leaveRequests", uid, "items"));
          lrSnap.forEach(d => {
            const date = d.id;
            if (date >= start && date <= end) {
              map[date] = map[date] || [];
              map[date].push({ userId: uid, userName: udoc.data().fullName, ...d.data() });
            }
          });
        }
      }

      setEvents(map);
    }

    load();
  }, [currentUser, monthDate, mode, siteId]);

  const days = eachDayOfInterval({ start: startOfMonth(monthDate), end: endOfMonth(monthDate) });

  function prevMonth() {
    const d = new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1);
    setMonthDate(d);
  }
  function nextMonth() {
    const d = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
    setMonthDate(d);
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={prevMonth} className="px-2 py-1 bg-gray-200 rounded">Prev</button>
        <div className="font-semibold">{format(monthDate, "MMMM yyyy")}</div>
        <button onClick={nextMonth} className="px-2 py-1 bg-gray-200 rounded">Next</button>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=> <div key={d} className="text-center font-medium">{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-2 mt-2">
        {days.map(day => {
          const iso = formatISO(day);
          const dayEvents = events[iso] || [];
          return (
            <div key={iso} className="min-h-[90px] border rounded p-2">
              <div className="text-sm font-medium">{format(day,"d MMM")}</div>

              {dayEvents.map((ev, i) => {
                const status = ev.status || ev.backupStatus || "pending";
                const color = status === "approved" ? "bg-green-100" : status === "rejected" ? "bg-red-100" : "bg-yellow-100";
                return (
                  <div key={i} className={`mt-2 p-1 text-xs rounded ${color}`}>
                    <div className="font-medium">{ev.userName || ev.userId}</div>
                    <div>{ev.reason}</div>
                    <div className="text-[11px] text-slate-600">{status}</div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
