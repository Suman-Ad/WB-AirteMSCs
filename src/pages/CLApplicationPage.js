import React from "react";
import { useNavigate } from "react-router-dom";
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
    const [date, setDate] = useState("");
    const [reason, setReason] = useState("");
    const [backupUser, setBackupUser] = useState("");
    const [siteUsers, setSiteUsers] = useState([]);
    const [apply, setApply] = useState(false);
    const navigate = useNavigate();

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

        loadUsers();
    }, [currentUser]);

    // add serverTimestamp import at top if not present:
    // import { serverTimestamp, addDoc, collection, doc, setDoc, getDocs, query, where } from "firebase/firestore";

    async function applyCL() {
        if (!date) return alert("Please select date");
        if (!backupUser) return alert("Please select backup team member");
        setApply(true);

        const dateKey = date; // YYYY-MM-DD

        // dateKey = "YYYY-MM-DD"
        const year = dateKey.split("-")[0];

        // count CL for this year (approved + pending)
        const lrSnapYear = await getDocs(query(collection(db, "leaveRequests", currentUser.uid, "items")));
        let count = 0;
        lrSnapYear.forEach(d => {
            const dd = d.id;
            if (!dd.startsWith(year + "-")) return;
            const data = d.data();
            if ((data.reason === "CL") && (data.status === "approved" || data.status === "pending")) {
                count++;
            }
        });

        if (count >= 12) {
            return alert("CL limit reached for this year (12). Cannot apply more.");
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
        <div style={{
            padding: '1rem',
            maxWidth: '32rem',
            marginLeft: 'auto',
            marginRight: 'auto',
            backgroundColor: 'white',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
            borderRadius: '0.375rem'
        }}>
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
                onClick={applyCL}
                style={{
                    paddingLeft: '1rem',
                    paddingRight: '1rem',
                    paddingTop: '0.5rem',
                    paddingBottom: '0.5rem',
                    backgroundColor: '#2563eb',
                    color: 'white',
                    borderRadius: '0.375rem'
                }}
            >
                {apply ? "Appling....." :"Apply CL"}
            </button>
        </div>
    );
}
