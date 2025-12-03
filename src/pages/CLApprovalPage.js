import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import {
    collection,
    getDocs,
    query,
    where,
    doc,
    updateDoc,
    addDoc,
    orderBy,
    serverTimestamp
} from "firebase/firestore";

export default function CLApprovalPage({ currentUser }) {
    const [requests, setRequests] = useState([]);
    const [siteUsers, setSiteUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState("pending");

    // Load all site users (needed for backup selection)
    useEffect(() => {
        if (!currentUser?.site) return;

        async function loadUsers() {
            const q = query(
                collection(db, "users"),
                where("site", "==", currentUser.site)
            );

            const snap = await getDocs(q);
            const arr = [];
            snap.forEach((d) => arr.push({ uid: d.id, ...d.data() }));
            setSiteUsers(arr);
        }

        loadUsers();
    }, [currentUser]);

    // Load CL requests for this site
    useEffect(() => {
        if (!currentUser?.site) return;
        async function loadRequests() {
            setLoading(true);
            let arr = [];

            // Step 1: get all users of this site
            const userSnap = await getDocs(
                query(collection(db, "users"), where("site", "==", currentUser.site))
            );

            for (const userDoc of userSnap.docs) {
                const uid = userDoc.id;

                // Step 2: load leaveRequests/{uid}/*
                const LR = collection(db, "leaveRequests", uid, "items");
                const lrSnap = await getDocs(LR);

                lrSnap.forEach((d) => {
                    arr.push({ id: d.id, userId: uid, ...d.data() });
                });
            }

            setRequests(arr);
            setLoading(false);
        }

        loadRequests();
    }, [currentUser]);

    async function approveCL(req) {
        // require backup accepted
        if (req.backupStatus && req.backupStatus !== "accepted") {
            alert("Cannot approve: backup user has not accepted. Backup status: " + req.backupStatus);
            return;
        }

        const ref = doc(db, "leaveRequests", req.userId, "items", req.id);

        await updateDoc(ref, {
            status: "approved",
            approvedBy: currentUser.uid,
            approvedAt: serverTimestamp()
        });

        // Notify Applicant
        await addDoc(collection(db, "notifications", req.userId, "items"), {
            title: "CL Request Approved",
            message: `Your CL for ${req.id} has been approved.`,
            date: req.id,
            site: currentUser.site,
            read: false,
            createdAt: serverTimestamp(),
        });

        // Notify Backup User (if accepted)
        if (req.backupUserId) {
            await addDoc(
                collection(db, "notifications", req.backupUserId, "items"),
                {
                    title: "Backup Duty Confirmed",
                    message: `Backup duty confirmed for ${req.userName} on ${req.id}.`,
                    date: req.id,
                    site: currentUser.site,
                    read: false,
                    createdAt: serverTimestamp(),
                }
            );
        }

        alert("CL Approved & Notifications sent!");
        window.location.reload();
    }


    async function rejectCL(req) {
        const ref = doc(db, "leaveRequests", req.userId, "items", req.id);

        await updateDoc(ref, {
            status: "rejected",
            approvedBy: currentUser.uid,
            approvedAt: new Date(),
        });

        // Notify Applicant
        await addDoc(collection(db, "notifications", req.userId, "items"), {
            title: "CL Request Rejected",
            message: `Your CL for ${req.id} has been rejected.`,
            date: req.id,
            site: currentUser.site,
            read: false,
            createdAt: new Date(),
        });

        alert("CL Rejected & Applicant Notified!");
        window.location.reload();
    }

    async function updateBackup(req, newBackupUid) {
        const ref = doc(db, "leaveRequests", req.userId, req.id);

        const backupUser = siteUsers.find((u) => u.uid === newBackupUid);

        await updateDoc(ref, {
            backupUserId: newBackupUid,
            backupUserName: backupUser?.fullName || "",
        });

        alert("Backup person updated!");
    }

    const filtered = requests.filter((r) => r.status === filterStatus);

    return (
        <div className="daily-log-container">
            <h2 className="text-2xl font-semibold mb-4">CL Approval Panel</h2>

            {/* Status Filter */}
            <div style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '16px'
            }}>
                {["pending", "approved", "rejected"].map((st) => (
                    <button
                        key={st}
                        onClick={() => setFilterStatus(st)}
                        style={{
                            paddingLeft: '0.75rem',
                            paddingRight: '0.75rem',
                            paddingTop: '0.25rem',
                            paddingBottom: '0.25rem',
                            borderRadius: '0.375rem',
                            backgroundColor: st === filterStatus ? '#2563eb' : '#e5e7eb',
                            color: st === filterStatus ? 'white' : 'inherit'
                        }}
                    >
                        {st.toUpperCase()}
                    </button>
                ))}
            </div>

            {loading ? (
                <div>Loading...</div>
            ) : filtered.length === 0 ? (
                <div>No CL Requests for this category.</div>
            ) : (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                }}>
                    {filtered.map((req) => (
                        <div
                            key={req.id}
                            style={{
                                border: '1px solid #e5e7eb',
                                borderRadius: '0.375rem',
                                padding: '0.75rem',
                                backgroundColor: 'white',
                                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                                display: 'flex',
                                justifyContent: 'space-between'
                            }}
                        >
                            <div>
                                <div style={{
                                    fontWeight: '600',
                                    fontSize: '1.125rem'
                                }}>
                                    {req.userName} ({req.empId})
                                </div>
                                <div style={{
                                    fontSize: '0.875rem'
                                }}>Date: {req.id}</div>
                                <div style={{
                                    fontSize: '0.875rem'
                                }}>Reason: {req.reason}</div>

                                <div style={{
                                    marginTop: '8px',
                                    fontSize: '14px'
                                }}>
                                    <span style={{
                                        fontWeight: '500'
                                    }}>Backup Team Member:</span>
                                    <select
                                        style={{
                                            marginLeft: '0.5rem',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '0.375rem',
                                            paddingLeft: '0.5rem',
                                            paddingRight: '0.5rem',
                                            paddingTop: '0.25rem',
                                            paddingBottom: '0.25rem'
                                        }}
                                        value={req.backupUserId}
                                        onChange={(e) => updateBackup(req, e.target.value)}
                                    >
                                        <option value="">Select</option>
                                        {siteUsers
                                            .filter((u) => u.uid !== req.userId)
                                            .map((u) => (
                                                <option key={u.uid} value={u.uid}>
                                                    {u.name}
                                                </option>
                                            ))}
                                    </select>
                                </div>
                            </div>

                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px'
                            }}>
                                {req.status === "pending" && (
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
                                            onClick={() => approveCL(req)}
                                        >
                                            Approve
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
                                            onClick={() => rejectCL(req)}
                                        >
                                            Reject
                                        </button>
                                    </>
                                )}

                                {req.status === "approved" && (
                                    <span style={{
                                        color: '#15803d',
                                        fontWeight: '600'
                                    }}>APPROVED</span>
                                )}

                                {req.status === "rejected" && (
                                    <span style={{
                                        color: '#dc2626',
                                        fontWeight: '600'
                                    }}>REJECTED</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
