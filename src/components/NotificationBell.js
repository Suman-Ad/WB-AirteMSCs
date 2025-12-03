import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, orderBy, updateDoc, doc, namedQuery, addDoc, getDocs, collectionGroup, serverTimestamp, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";


export default function NotificationBell({ user }) {
    const [items, setItems] = useState([]);
    const [open, setOpen] = useState(false);
    const [acrejBtn, setAcrejBtn] = useState(true); // Show accept/reject buttons for backup_request notifications
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

            if (!open && newUnread > oldUnread) {
                soundRef.current?.play().catch(() => { });
            }
            setItems(arr);
        });

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

            setAcrejBtn(false);

            // mark notification read
            await updateDoc(doc(db, "notifications", user.uid, "items", notification.id), { read: true });

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
                responderName: user.name || ""
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

            setAcrejBtn(false);

            await updateDoc(doc(db, "notifications", user.uid, "items", notification.id), { read: true });

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
                    right: '0',
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
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky',
                        top: '0',
                        backgroundColor: 'white',
                        zIndex: 10
                    }}>Notifications<div style={{ display: "flex", gap: "8px" }}>

                            {/* ✔ Mark All Read button */}
                            <button
                                onClick={markAllAsRead}
                                style={{
                                    fontSize: "8px",
                                    background: "#16a34a",
                                    color: "white",
                                    padding: "4px 6px",
                                    borderRadius: "4px",
                                    cursor: "pointer"
                                }}
                            >
                                Mark All Read
                            </button>

                            {/* 🗑 Delete all button */}
                            <button
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
                                    cursor: "pointer"
                                }}
                            >
                                Delete All
                            </button>


                            {/* X close */}
                            <p onClick={() => setOpen(!open)} style={{ cursor: "pointer" }} onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#cc5353b7';
                            }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = '';
                                }}>X</p>
                        </div>

                    </div>

                    {items.length === 0 && (
                        <div style={{
                            padding: '0.75rem',
                            fontSize: '0.875rem',
                            color: '#6b7280',
                            textAlign: 'center',
                        }}>No notifications
                            <p style={{ marginTop: "12px", fontSize: "0.875rem", color: "#64748b", cursor: "pointer" }} onClick={() => navigate("/cl-application")}>Apply For CL</p>

                        </div>

                    )}

                    {items.map((n) => (
                        <div
                            key={n.id + (n.createdAt?.toMillis?.() ?? "")}
                            style={{
                                padding: '0.75rem',
                                borderBottom: '1px solid #e5e7eb',
                                cursor: 'pointer',
                                backgroundColor: n.read ? 'white' : '#dbeafe',
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

                            {/* Inline actions for backup_request */}
                            {n.actionType === "backup_request" && (
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.5rem'
                                }}>
                                    {!!acrejBtn && (
                                        <button style={{
                                            paddingLeft: '0.5rem',
                                            paddingRight: '0.5rem',
                                            paddingTop: '0.25rem',
                                            paddingBottom: '0.25rem',
                                            backgroundColor: '#16a34a',
                                            color: 'white',
                                            fontSize: '0.75rem',
                                            borderRadius: '0.375rem'
                                        }} onClick={() => acceptBackup(n)}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#0285c7ff"}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#16a34a"}
                                        >
                                            Accept</button>
                                    )}

                                    {!!acrejBtn && (
                                        <button style={{
                                            paddingLeft: '0.5rem',
                                            paddingRight: '0.5rem',
                                            paddingTop: '0.25rem',
                                            paddingBottom: '0.25rem',
                                            backgroundColor: '#a31616ff',
                                            color: 'white',
                                            fontSize: '0.75rem',
                                            borderRadius: '0.375rem'
                                        }} onClick={() => rejectBackup(n)}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#0285c7ff"}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#a31616ff"}
                                        >Reject</button>
                                    )}
                                </div>
                            )}
                            {/* 🗑 Delete one notification */}
                            <button
                                onClick={() => deleteNotification(n.id)}
                                style={{
                                    position: "absolute",
                                    right: "0px",
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
                    <p style={{
                        marginTop: "12px",
                        fontSize: "0.875rem",
                        color: "#ffffffff",
                        cursor: "pointer",
                        position: "sticky",
                        bottom: "0",
                        background: "#1c4685ff"
                    }}
                        onClick={() => navigate("/cl-application")}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#447dd3ff"}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#1c4685ff"}
                    >Apply For CL</p>

                </div>
            )}
        </div>
    );
}
