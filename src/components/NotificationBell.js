import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, orderBy, updateDoc, doc, namedQuery, addDoc, getDocs, collectionGroup, serverTimestamp, deleteDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";


export default function NotificationBell({ user }) {
    const [items, setItems] = useState([]);
    const [open, setOpen] = useState(false);
    const [filter, setFilter] = useState("all");
    const navigate = useNavigate();

    const soundRef = React.useRef(null);

    useEffect(() => {
        soundRef.current = new Audio("/notify.mp3");
        soundRef.current.volume = 0.6;
    }, []);


    useEffect(() => {
        if (!user?.uid) return;

        const q = query(
            collection(db, "notifications", user.uid, "items"),
            orderBy("createdAt", "desc")
        );

        const unsub = onSnapshot(q, (snap) => {
            const arr = [];
            snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));

            // Detect NEW notifications
            const newUnread = arr.filter(n => !n.read).length;
            const oldUnread = items.filter(n => !n.read).length;

            const newBackupReq = arr.filter(
                n => !n.read && (n.actionType === "backup_request" || n.actionType === "registration_request")
            ).length;

            const oldBackupReq = items.filter(
                n => !n.read && (n.actionType === "backup_request" || n.actionType === "registration_request")
            ).length;

            // Play sound ONLY for new backup requests
            if (!open && newBackupReq > oldBackupReq) {
                soundRef.current?.play().catch(() => { });
            }

            setItems(arr);
        });

        async function cleanupOld() {
            const q = query(collection(db, "notifications", user.uid, "items"));
            const snap = await getDocs(q);

            const now = Date.now();
            const cutoff = now - 30 * 24 * 60 * 60 * 1000; // 30 days

            snap.forEach((d) => {
                const created = d.data().createdAt?.toMillis?.() ?? 0;
                if (created < cutoff) {
                    deleteDoc(doc(db, "notifications", user.uid, "items", d.id));
                }
            });
        }

        cleanupOld();

        return () => unsub();
    }, [user]);

    const unreadCount = items.filter(n => !n.read).length;

    async function markAsRead(id) {
        await updateDoc(doc(db, "notifications", user.uid, "items", id), {
            read: true
        });
    }

    // Delete single notification
    async function deleteNotification(id) {
        await deleteDoc(doc(db, "notifications", user.uid, "items", id));
    }

    // Mark ALL as read
    async function markAllAsRead() {
        const q = query(collection(db, "notifications", user.uid, "items"));

        const snap = await getDocs(q);
        snap.forEach(async (d) => {
            await updateDoc(doc(db, "notifications", user.uid, "items", d.id), {
                read: true
            });
        });
    }

    // Accept backup inline
    async function acceptBackup(notification) {
        try {
            const { requestId, requesterId } = notification; // requestId is dateKey (YYYY-MM-DD)
            if (!requestId || !requesterId) throw new Error("Missing requestId/requesterId");

            // update leaveRequests/{requesterId}/items/{requestId}.backupStatus = "accepted"
            const leaveRef = doc(db, "leaveRequests", requesterId, "items", requestId);
            await updateDoc(leaveRef, {
                backupStatus: "accepted",
                backupResponseAt: serverTimestamp()
            });

            // mark notification read
            await updateDoc(doc(db, "notifications", user.uid, "items", notification.id), {
                read: true,
                backupStatus: "accepted"   // 🔥 ADD THIS
            });

            // notify applicant
            await addDoc(collection(db, "notifications", requesterId, "items"), {
                title: "Backup Accepted",
                message: `${user.name || user.uid} accepted backup for ${requestId}.`,
                date: requestId,
                read: false,
                createdAt: serverTimestamp(),
                actionType: "backup_response",
                requestId,
                responderId: user.uid,
                responderName: user.name || "",
            });

            // notify admins for site (find admins by site on users collection)
            // read requester user doc to get site
            const requesterUserSnap = await getDocs(query(collection(db, "users"), where("__name__", "==", requesterId)));
            let siteId = null;
            if (requesterUserSnap && requesterUserSnap.docs && requesterUserSnap.docs.length > 0) {
                siteId = requesterUserSnap.docs[0].data().site;
            }

            if (siteId) {
                const adminQ = query(collection(db, "users"), where("role", "in", ["Admin", "Super Admin"]), where("site", "==", siteId));
                const adminSnap = await getDocs(adminQ);
                for (const a of adminSnap.docs) {
                    await addDoc(collection(db, "notifications", a.id, "items"), {
                        title: "Backup Accepted",
                        message: `${user.name || user.uid} accepted backup for ${requestId}.`,
                        date: requestId,
                        read: false,
                        createdAt: serverTimestamp(),
                        actionType: "backup_response",
                        requestId,
                        responderId: user.uid
                    });
                }
            }
        } catch (e) {
            console.error("acceptBackup error", e);
            alert("Accept failed: " + (e.message || e));
        }
    }

    // Reject backup inline
    async function rejectBackup(notification) {
        try {
            const { requestId, requesterId } = notification;
            if (!requestId || !requesterId) throw new Error("Missing requestId/requesterId");

            const leaveRef = doc(db, "leaveRequests", requesterId, "items", requestId);
            await updateDoc(leaveRef, {
                backupStatus: "rejected",
                backupResponseAt: serverTimestamp()
            });

            await updateDoc(doc(db, "notifications", user.uid, "items", notification.id), {
                read: true,
                backupStatus: "rejected"   // 🔥 ADD THIS
            });


            await addDoc(collection(db, "notifications", requesterId, "items"), {
                title: "Backup Rejected",
                message: `${user.name || user.uid} rejected backup for ${requestId}. Please choose another backup.`,
                date: requestId,
                read: false,
                createdAt: serverTimestamp(),
                actionType: "backup_response",
                requestId,
                responderId: user.uid,
                responderName: user.name || ""
            });

            // notify admins same as accept
            const requesterUserSnap = await getDocs(query(collection(db, "users"), where("__name__", "==", requesterId)));
            let siteId = null;
            if (requesterUserSnap && requesterUserSnap.docs && requesterUserSnap.docs.length > 0) {
                siteId = requesterUserSnap.docs[0].data().site;
            }

            if (siteId) {
                const adminQ = query(collection(db, "users"), where("role", "in", ["Admin", "Super Admin"]), where("site", "==", siteId));
                const adminSnap = await getDocs(adminQ);
                for (const a of adminSnap.docs) {
                    await addDoc(collection(db, "notifications", a.id, "items"), {
                        title: "Backup Rejected",
                        message: `${user.name || user.uid} rejected backup for ${requestId}.`,
                        date: requestId,
                        read: false,
                        createdAt: serverTimestamp(),
                        actionType: "backup_response",
                        requestId,
                        responderId: user.uid
                    });
                }
            }
        } catch (e) {
            console.error("rejectBackup error", e);
            alert("Reject failed: " + (e.message || e));
        }
    }

    function getNotificationColor(n) {
        if (n.actionType === "backup_request") {
            if (n.backupStatus === "accepted") return "#dcfce7";  // light green
            if (n.backupStatus === "rejected") return "#fee2e2";  // light red
            return "#fef9c3"; // pending - light yellow
        }

        // default for other notifications
        return n.read ? "white" : "#dbeafe";
    }

    function filterNotifications(list) {
        if (filter === "all") return list;

        const todayISO = new Date().toISOString().split("T")[0];

        if (filter === "today") {
            return list.filter(n => n.date === todayISO);
        }

        if (filter === "week") {
            const now = new Date();
            const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;

            return list.filter(n => {
                const ts = n.createdAt?.toMillis?.() ?? 0;
                return ts >= weekAgo;
            });
        }

        return list;
    }

    async function cancelCLFromNotification(n) {
        try {
            if (!window.confirm("Cancel this CL request?")) return;

            const leaveRef = doc(db, "leaveRequests", user.uid, "items", n.requestId);
            const leaveSnap = await getDoc(leaveRef);

            if (!leaveSnap.exists()) {
                alert("CL already cancelled or processed.");
                return;
            }

            const leave = leaveSnap.data();
            if (leave.status !== "pending") {
                alert("Only pending CL can be cancelled.");
                return;
            }

            // 1️⃣ invalidate backup request notification
            if (leave.backupUserId) {
                const q = query(
                    collection(db, "notifications", leave.backupUserId, "items"),
                    where("actionType", "==", "backup_request"),
                    where("requestId", "==", n.requestId)
                );

                const snap = await getDocs(q);
                for (const d of snap.docs) {
                    await updateDoc(d.ref, {
                        backupStatus: "cancelled",
                        read: true
                    });
                }
            }

            // 2️⃣ delete leave request
            await deleteDoc(leaveRef);

            // 3️⃣ mark applicant notification cancelled
            await updateDoc(
                doc(db, "notifications", user.uid, "items", n.id),
                {
                    read: true,
                    backupStatus: "cancelled"
                }
            );

            alert("CL cancelled successfully");

        } catch (err) {
            console.error(err);
            alert("Cancel failed");
        }
    }

    async function activateUser(notification) {
        try {
            if (!window.confirm("Activate this user account?")) return;

            const userRef = doc(db, "users", notification.requesterId);

            // 1️⃣ Activate user
            await updateDoc(userRef, {
                isActive: true,
                activatedAt: serverTimestamp(),
                activatedBy: user.uid
            });

            // 2️⃣ Mark admin notification as read
            await updateDoc(
                doc(db, "notifications", user.uid, "items", notification.id),
                {
                    read: true,
                    approvalStatus: "approved"
                }
            );

            // 3️⃣ Notify user
            await addDoc(
                collection(db, "notifications", notification.requesterId, "items"),
                {
                    title: "Account Activated",
                    message: "Your account has been approved and activated by Admin.",
                    actionType: "registration_response",
                    read: false,
                    createdAt: serverTimestamp(),
                    date: new Date().toISOString().split("T")[0],
                    responderId: user.uid
                }
            );

            alert("User activated successfully");
        } catch (err) {
            console.error("activateUser error", err);
            alert("Activation failed");
        }
    }



    return (
        <div style={{ position: "relative" }}>
            {/* Bell icon */}
            <button
                onClick={() => setOpen(!open)}
                className="back-button"
            >
                🔔

                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute',
                        top: '-0.25rem',
                        right: '-0.25rem',
                        backgroundColor: '#dc2626',
                        color: 'white',
                        fontSize: '0.75rem',
                        paddingLeft: '0.375rem',
                        paddingRight: '0.375rem',
                        paddingTop: '0.125rem',
                        paddingBottom: '0.125rem',
                        borderRadius: '9999px'
                    }}>
                        {unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {open && (
                <div style={{
                    position: 'absolute',
                    right: '-1rem',
                    marginTop: '0.5rem',
                    width: '18rem',
                    backgroundColor: 'white',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    borderRadius: '0.375rem',
                    border: '1px solid #e5e7eb',
                    zIndex: '50',
                    maxHeight: '24rem',
                    overflow: 'auto'
                }}>
                    <div style={{
                        padding: '0.75rem',
                        borderBottom: '1px solid #e5e7eb',
                        fontWeight: '600',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: 'column',
                        position: 'sticky',
                        top: '0',
                        backgroundColor: 'white',
                        zIndex: 10
                    }}>
                        {/* X close */}
                        <div style={{ display: "flex", justifyContent: 'space-between', }}><h2>Notifications</h2>
                            <p onClick={() => setOpen(!open)} style={{ cursor: "pointer", height: "fit-content", position: "absolute", right: "0", top: "0", fontWeight: "bold" }} onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#cc5353b7';
                            }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = '';
                                }}>X</p>
                        </div>
                        <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
                            <p onClick={() => setFilter("today")} style={{ fontSize: '10px', borderRadius: "4px", border: "1px solid #000000ff", cursor: "pointer" }}>
                                Today
                            </p>
                            <p onClick={() => setFilter("week")} style={{ fontSize: '10px', borderRadius: "4px", border: "1px solid #000000ff", cursor: "pointer" }}>
                                This Week
                            </p>
                            <p onClick={() => setFilter("all")} style={{ fontSize: '10px', borderRadius: "4px", border: "1px solid #000000ff", cursor: "pointer" }}>
                                All
                            </p>
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                            {/* ✔ Mark All Read button */}
                            <p
                                onClick={markAllAsRead}
                                style={{
                                    fontSize: "8px",
                                    background: "#16a34a",
                                    color: "white",
                                    padding: "4px 6px",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    height: "fit-content",
                                    position: "absolute",
                                    left: "0"
                                }}
                            >
                                Mark All Read
                            </p>

                            {/* 🗑 Delete all button */}
                            <p
                                onClick={() => {
                                    if (window.confirm("Delete all notifications?")) {
                                        items.forEach(n => deleteNotification(n.id));
                                    }
                                }}
                                style={{
                                    fontSize: "8px",
                                    background: "#b91c1c",
                                    color: "white",
                                    padding: "4px 6px",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    height: "fit-content",
                                    position: "absolute",
                                    right: "0"
                                }}
                            >
                                Delete All
                            </p>
                        </div>
                    </div>

                    {items.length === 0 && (
                        <div style={{
                            padding: '0.75rem',
                            fontSize: '0.875rem',
                            color: '#6b7280',
                            textAlign: 'center',
                        }}>No notifications
                        </div>
                    )}

                    {filterNotifications(items).map((n) => (
                        <div
                            key={n.id + (n.createdAt?.toMillis?.() ?? "")}
                            style={{
                                padding: '0.75rem',
                                borderBottom: '1px solid #e5e7eb',
                                cursor: 'pointer',
                                backgroundColor: getNotificationColor(n),
                                position: 'relative'
                            }}
                            onClick={() => markAsRead(n.id)}
                        >
                            <div style={{
                                fontWeight: '500',
                                fontSize: '0.875rem'
                            }}
                                onClick={() => n.title === "Backup Duty Request" ? navigate("/backup-approvals") : n.title === "New Duty Assigned" ? navigate("/my-duty") : (user.role === "Admin" || user.role === "Sumer Admin") && n.title === "New CL Request" ? navigate("/cl-approve") : (user.role === "Admin" || user.role === "Sumer Admin") && n.title === "Backup Accepted" ? navigate("/cl-approve") : null}
                            >{n.title}</div>
                            <div style={{
                                fontSize: '0.75rem',
                                color: '#4b5563'
                            }}
                            >{n.message}</div>
                            <div style={{
                                fontSize: '10px',
                                color: '#9ca3af',
                                marginTop: '0.25rem'
                            }}>{n.date}
                            </div>

                            {/* 🔐 Registration Approval */}
                            {n.actionType === "registration_request" &&
                                (user.role === "Admin" || user.role === "Super Admin") &&
                                !n.read && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            activateUser(n);
                                        }}
                                        style={{
                                            marginTop: "6px",
                                            backgroundColor: "#16a34a",
                                            color: "white",
                                            fontSize: "0.75rem",
                                            padding: "4px 8px",
                                            borderRadius: "4px",
                                            cursor: "pointer"
                                        }}
                                    >
                                        Activate User
                                    </button>

                                )}
                            {n.approvalStatus === "approved" && (
                                <p style={{ color: "#16a34a", fontSize: "0.75rem", marginTop: "4px" }}>
                                    ✔ User Activated
                                </p>
                            )}
                            
                            {/* Inline actions for backup_request */}
                            {n.actionType === "backup_request" && (
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>

                                    {/* SHOW only if request still pending */}
                                    {n.actionType === "backup_request" && (
                                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>

                                            {/* BACKUP USER ACTIONS */}
                                            {user.uid !== n.requesterId &&
                                                n.backupStatus !== "accepted" &&
                                                n.backupStatus !== "rejected" &&
                                                n.backupStatus !== "cancelled" && (
                                                    <>
                                                        <button
                                                            style={{
                                                                backgroundColor: "#16a34a",
                                                                color: "white",
                                                                fontSize: "0.75rem",
                                                                borderRadius: "0.375rem"
                                                            }}
                                                            onClick={() => acceptBackup(n)}
                                                        >
                                                            Accept
                                                        </button>

                                                        <button
                                                            style={{
                                                                backgroundColor: "#b91c1c",
                                                                color: "white",
                                                                fontSize: "0.75rem",
                                                                borderRadius: "0.375rem"
                                                            }}
                                                            onClick={() => rejectBackup(n)}
                                                        >
                                                            Reject
                                                        </button>
                                                    </>
                                                )}

                                            {/* APPLICANT CANCEL ACTION */}
                                            {n.actionType === "cl_pending" &&
                                                n.requesterId === user.uid && (
                                                    <button
                                                        style={{
                                                            backgroundColor: "#ef4444",
                                                            color: "white",
                                                            fontSize: "0.75rem",
                                                            borderRadius: "0.375rem"
                                                        }}
                                                        onClick={() => cancelCLFromNotification(n)}
                                                    >
                                                        Cancel CL
                                                    </button>
                                                )}


                                            {/* STATUS LABELS */}
                                            {n.backupStatus === "accepted" && (
                                                <p style={{ color: "#16a34a", fontSize: "0.75rem" }}>
                                                    ✔ Backup Accepted
                                                </p>
                                            )}

                                            {n.backupStatus === "rejected" && (
                                                <p style={{ color: "#b91c1c", fontSize: "0.75rem" }}>
                                                    ✖ Backup Rejected
                                                </p>
                                            )}

                                            {n.backupStatus === "cancelled" && (
                                                <p style={{ color: "#6b7280", fontSize: "0.75rem" }}>
                                                    ⚠ Request Cancelled
                                                </p>
                                            )}
                                        </div>
                                    )}


                                </div>
                            )}

                            {/* 🗑 Delete one notification */}
                            <button
                                onClick={() => deleteNotification(n.id)}
                                style={{
                                    // position: "absolute",
                                    right: "0",
                                    top: "8px",
                                    background: "transparent",
                                    border: "none",
                                    color: "#b91c1c",
                                    cursor: "progress",
                                    fontSize: "14px"
                                }}
                                title="Delete Notification"
                            >
                                🗑
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
