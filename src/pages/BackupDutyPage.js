import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs, query, where, doc, updateDoc } from "firebase/firestore";

export default function BackupDutyPage({ currentUser }) {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadBackupRequests() {
            setLoading(true);
            let arr = [];

            // 1️⃣ Fetch all users in the same site
            const userSnap = await getDocs(
                query(collection(db, "users"), where("site", "==", currentUser.site))
            );

            // 2️⃣ Loop every user and load their leaveRequests collection
            for (const userDoc of userSnap.docs) {
                const empId = userDoc.id;
                const fullName = userDoc.data().name;
                const uid = userDoc.id;

                const LR = collection(db, "leaveRequests", empId, "items");
                const lrSnap = await getDocs(LR);

                lrSnap.forEach((d) => {
                    const data = d.data();

                    // only show requests assigned to this backup user
                    if (data.backupUserId === currentUser.uid) {
                        arr.push({
                            id: d.id,
                            empId,
                            userId: uid,
                            userName: fullName,
                            ...data,
                        });
                    }
                });
            }

            setRequests(arr);
            setLoading(false);
        }

        loadBackupRequests();
    }, [currentUser]);


    async function acceptBackup(req) {
        const ref = doc(db, "leaveRequests", req.empId, "Items", req.id);
        await updateDoc(ref, {
            backupStatus: "accepted",
            backupResponseAt: new Date(),
        });

        alert("Backup accepted!");
        window.location.reload();
    }

    async function rejectBackup(req) {
        const ref = doc(db, "leaveRequests", req.empId, "Items", req.id);
        await updateDoc(ref, {
            backupStatus: "rejected",
            backupResponseAt: new Date(),
        });

        alert("Backup rejected!");
        window.location.reload();
    }

    if (loading) return <div className="daily-log-container">Loading...</div>;

    return (
        <div className="daily-log-container">
            <h2>Backup Duty Requests</h2>

            {requests.length === 0 ? (
                <div>No backup requests assigned to you.</div>
            ) : (
                <div className="space-y-3">
                    {requests.map((req) => (
                        <div key={req.id} style={{
                            border: '1px solid #e5e7eb',
                            padding: '0.75rem',
                            borderRadius: '0.375rem',
                            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                            backgroundColor: 'white'
                        }}>
                            <div className="font-semibold text-lg">
                                {req.userName} applied leave for {req.id}
                            </div>

                            <div className="text-sm mt-1">Reason: {req.reason}</div>

                            <div className="mt-3 flex gap-3">
                                {req.backupStatus === "pending" && (
                                    <>
                                        <button
                                            style={{
                                                paddingLeft: '0.75rem',
                                                paddingRight: '0.75rem',
                                                paddingTop: '0.25rem',
                                                paddingBottom: '0.25rem',
                                                backgroundColor: '#16a34a',
                                                color: 'white',
                                                borderRadius: '0.375rem'
                                            }}
                                            onClick={() => acceptBackup(req)}
                                        >
                                            Accept
                                        </button>

                                        <button
                                            style={{
                                                paddingLeft: '0.75rem',
                                                paddingRight: '0.75rem',
                                                paddingTop: '0.25rem',
                                                paddingBottom: '0.25rem',
                                                backgroundColor: '#dc2626',
                                                color: 'white',
                                                borderRadius: '0.375rem'
                                            }}
                                            onClick={() => rejectBackup(req)}
                                        >
                                            Reject
                                        </button>
                                    </>
                                )}

                                {req.backupStatus === "accepted" && (
                                    <span style={{
                                        color: '#15803d',
                                        fontWeight: '600'
                                    }}>Accepted</span>
                                )}

                                {req.backupStatus === "rejected" && (
                                    <span style={{
                                        color: '#b91c1c',
                                        fontWeight: '600'
                                    }}>Rejected</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
