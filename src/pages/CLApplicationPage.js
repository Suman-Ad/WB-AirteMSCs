import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { db } from "../firebase";
import {
    collection,
    doc,
    setDoc,
    getDocs,
    query,
    where,
    serverTimestamp,
    addDoc
} from "firebase/firestore";
import { set } from "date-fns";

export default function CLApplicationPage({ currentUser }) {
    const location = useLocation();
    const [date, setDate] = useState(location.state?.date || "");
    const [reason, setReason] = useState("");
    const [backupUser, setBackupUser] = useState("");
    const [siteUsers, setSiteUsers] = useState([]);
    const [apply, setApply] = useState(false);
    const navigate = useNavigate();
    const [yearlyCLUsed, setYearlyCLUsed] = useState(0);
    const [yearlyCLRemaining, setYearlyCLRemaining] = useState(10);


    useEffect(() => {
        if (!currentUser?.site) return;

        async function loadUsers() {
            const q = query(
                collection(db, "users"),
                where("site", "==", currentUser.site)
            );
            const snap = await getDocs(q);
            const arr = [];
            snap.forEach(d => arr.push({ uid: d.id, ...d.data() }));
            setSiteUsers(arr);
        }

        async function fetchYearlyCL() {
            const year = new Date().getFullYear().toString();

            const snap = await getDocs(
                collection(db, "leaveRequests", currentUser.uid, "items")
            );

            let count = 0;

            snap.forEach(docSnap => {
                const id = docSnap.id; // YYYY-MM-DD
                if (!id.startsWith(year + "-")) return;

                const d = docSnap.data();
                if (d.reason === "CL" || (d.status === "approved" || d.status === "pending")) {
                    count++;
                }
            });

            setYearlyCLUsed(count);
            setYearlyCLRemaining(10 - count);
        }

        fetchYearlyCL();

        loadUsers();
    }, [currentUser]);

    // add serverTimestamp import at top if not present:
    // import { serverTimestamp, addDoc, collection, doc, setDoc, getDocs, query, where } from "firebase/firestore";

    async function applyCL() {
        if (!date) return alert("Please select date");
        if (!backupUser) return alert("Please select backup team member");
        setApply(true);

        const dateKey = date; // YYYY-MM-DD

        // ------- CHECK YEARLY LIMIT (10 max) -------
        const year = dateKey.split("-")[0];

        const lrSnapYear = await getDocs(
            collection(db, "leaveRequests", currentUser.uid, "items")
        );

        let used = 0;

        lrSnapYear.forEach(d => {
            const id = d.id;
            if (!id.startsWith(year + "-")) return;

            const data = d.data();
            if (data.reason === "CL" && (data.status === "approved" || data.status === "pending")) {
                used++;
            }
        });

        if (used >= 10) {
            setApply(false);
            return alert("❌ You have already used all 10 CL for this year.");
        }


        // path: leaveRequests/{uid}/items/{dateKey}
        const ref = doc(db, "leaveRequests", currentUser.uid, "items", dateKey);

        const backupUserData = siteUsers.find(u => u.uid === backupUser);

        await setDoc(ref, {
            userId: currentUser.uid,
            userName: currentUser.name,
            empId: currentUser.empId,
            siteId: currentUser.site,
            date: dateKey,
            reason,
            backupUserId: backupUser,
            backupUserName: backupUserData?.name || "",
            status: "pending",
            backupStatus: "pending",       // NEW
            backupResponseAt: null,        // NEW
            appliedAt: serverTimestamp()
        });

        // Notify Admin/Super Admin of the site (same as before), and notify backup user with actionType
        const adminQuery = query(
            collection(db, "users"),
            where("role", "in", ["Admin", "Super Admin"]),
            where("site", "==", currentUser.site)
        );
        const adminSnap = await getDocs(adminQuery);

        for (const adminDoc of adminSnap.docs) {
            await addDoc(
                collection(db, "notifications", adminDoc.id, "items"),
                {
                    title: "New CL Request",
                    message: `${currentUser.name} applied CL for ${dateKey}`,
                    date: dateKey,
                    site: currentUser.site,
                    read: false,
                    createdAt: serverTimestamp(),
                    actionType: "cl_request",
                    requestId: dateKey,
                    requesterId: currentUser.uid
                }
            );
        }

        // Notify the backup user and include actionType so they know it's a backup acceptance request
        await addDoc(
            collection(db, "notifications", backupUser, "items"),
            {
                title: "Backup Duty Request",
                message: `You are requested as backup for ${currentUser.name}(${currentUser.empId}) on ${dateKey}. Please Accept or Reject.`,
                date: dateKey,
                site: currentUser.site,
                read: false,
                createdAt: serverTimestamp(),
                actionType: "backup_request",
                requestId: dateKey,
                requesterId: currentUser.uid
            }
        );

        setApply(false);
        alert("CL Request Submitted!");
        setReason("");
        setBackupUser("");
        setDate("");
        navigate("/my-leave");
    }


    return (
        <div className="daily-log-container" style={{
            padding: '1rem',
            maxWidth: '32rem',
            marginLeft: 'auto',
            marginRight: 'auto',
            backgroundColor: 'white',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
            borderRadius: '0.375rem'
        }}>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <p className="pm-manage-btn" onClick={() => navigate("/my-leave")}>My Leaves</p>
                <p className="pm-manage-btn" onClick={() => navigate("/cl-calendar")}>My CL Calendar</p>
            </div>

            <div
                style={{
                    background: "#f3f4f6",
                    padding: "10px",
                    borderRadius: "8px",
                    marginBottom: "16px"
                }}
            >
                <p><strong>CL Used:</strong> {yearlyCLUsed} / 10</p>
                <p><strong>CL Remaining:</strong> {yearlyCLRemaining}</p>
            </div>


            <h2 className="text-xl font-semibold mb-4">Apply for CL</h2>

            <label style={{
                display: 'block',
                marginBottom: '0.5rem'
            }}>Select Date</label>
            <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                style={{
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    width: '100%',
                    marginBottom: '16px'
                }}
                disabled
            />

            <label style={{
                display: 'block',
                marginBottom: '0.5rem'
            }}>Reason</label>
            <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                style={{
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    width: '100%',
                    marginBottom: '16px'
                }}
                placeholder="Enter reason"
            />

            <label style={{
                display: 'block',
                marginBottom: '0.5rem'
            }}>Select Backup Team Member</label>
            <select
                value={backupUser}
                onChange={e => setBackupUser(e.target.value)}
                style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.375rem',
                    paddingLeft: '0.75rem',
                    paddingRight: '0.75rem',
                    paddingTop: '0.5rem',
                    paddingBottom: '0.5rem',
                    width: '100%',
                    marginBottom: '1rem'
                }}
            >
                <option value="">Select</option>
                {siteUsers
                    .filter(u => u.uid !== currentUser.uid)
                    .map(u => (
                        <option key={u.uid} value={u.uid}>
                            {u.name} ({u.empId})
                        </option>
                    ))}
            </select>

            <button
                disabled={yearlyCLRemaining <= 0 || apply}
                onClick={applyCL}
                style={{
                    paddingLeft: "1rem",
                    paddingRight: "1rem",
                    paddingTop: "0.5rem",
                    paddingBottom: "0.5rem",
                    backgroundColor: yearlyCLRemaining <= 0 ? "#9ca3af" : "#2563eb",
                    cursor: yearlyCLRemaining <= 0 ? "not-allowed" : "pointer",
                    color: "white",
                    borderRadius: "0.375rem"
                }}
            >
                {apply ? "Applying..." : yearlyCLRemaining <= 0 ? "CL Limit Reached" : "Apply CL"}
            </button>

        </div>
    );
}
