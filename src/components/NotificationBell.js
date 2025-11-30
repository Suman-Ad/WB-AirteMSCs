import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, orderBy, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";

export default function NotificationBell({ user }) {
    const [items, setItems] = useState([]);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!user?.uid) return;

        const q = query(
            collection(db, "notifications", user.uid, "items"),
            orderBy("createdAt", "desc")
        );

        const unsub = onSnapshot(q, (snap) => {
            const arr = [];
            snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
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

    return (
        <div style={{position:"relative"}}>
            {/* Bell icon */}
            <button
                onClick={() => setOpen(!open)}
                style={{
                    position: 'fixed',
                    padding: '0.5rem',
                    borderRadius: '0.375rem',
                    transition: 'background-color 0.2s ease-in-out'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '';
                }}
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
                        fontWeight: '600'
                    }}>Notifications</div>

                    {items.length === 0 && (
                        <div style={{
                            padding: '0.75rem',
                            fontSize: '0.875rem',
                            color: '#6b7280',
                            textAlign: 'center'
                        }}>No notifications</div>
                    )}

                    {items.map((n) => (
                        <div
                            key={n.id}
                            style={{
                                padding: '0.75rem',
                                borderBottom: '1px solid #e5e7eb',
                                cursor: 'pointer',
                                backgroundColor: n.read ? 'white' : '#dbeafe'
                            }}
                            onClick={() => markAsRead(n.id)}
                        >
                            <div style={{
                                fontWeight: '500',
                                fontSize: '0.875rem'
                            }}>{n.title}</div>
                            <div style={{
                                fontSize: '0.75rem',
                                color: '#4b5563'
                            }}>{n.message}</div>
                            <div style={{
                                fontSize: '10px',
                                color: '#9ca3af',
                                marginTop: '0.25rem'
                            }}>{n.date}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
