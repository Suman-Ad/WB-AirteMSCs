import React, { useEffect, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db } from "../firebase";
import { enableDeviceNotifications } from "../services/deviceNotifications";

export default function NotificationSettings({ uid }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [link, setLink] = useState(null);
  const stop = useRef(null);
  useEffect(() => {
    let disposed = false;
    const start = async () => {
      try {
        const unsubscribe = await enableDeviceNotifications(uid, false);
        if (disposed) unsubscribe(); else stop.current = unsubscribe;
      } catch (_) { /* User can enable explicitly below. */ }
    };
    if (window.Notification?.permission === "granted") start();
    const unsubscribe = onSnapshot(doc(db, "notificationPreferences", uid), snap => {
      const settings = snap.data();
      setEnabled(settings?.telegramEnabled === true);
      if (!settings?.pendingLinkHash) {
        setLink(null);
        if (settings?.telegramEnabled) setStatus("Telegram connected. Your new notifications will arrive in your bot chat.");
      }
    }, () => setStatus("Unable to load notification settings."));
    return () => { disposed = true; unsubscribe(); stop.current?.(); stop.current = null; };
  }, [uid]);
  async function enable() {
    setBusy(true);
    try {
      stop.current?.();
      stop.current = await enableDeviceNotifications(uid);
      setStatus("Device notifications enabled on this device.");
    } catch (error) { setStatus(error.message); }
    finally { setBusy(false); }
  }
  async function connectTelegram() {
    setBusy(true);
    setLink(null);
    try {
      const result = await httpsCallable(getFunctions(), "createTelegramLink")();
      if (!/^https:\/\/t\.me\/[A-Za-z0-9_]+\?start=[a-f0-9]{48}$/.test(result.data.url)) throw new Error("Invalid connection link.");
      setLink(result.data);
      setStatus("Open Telegram below and press Start to agree to receive your notifications. The link expires in 10 minutes; keep it private.");
    } catch (error) { setStatus(error.code === "functions/failed-precondition" ? error.message : "Unable to connect Telegram. Please check that the bot has been activated and try again."); }
    finally { setBusy(false); }
  }
  async function disconnectTelegram() {
    setBusy(true);
    try {
      await httpsCallable(getFunctions(), "disconnectTelegram")();
      setLink(null);
      setStatus("Telegram updates disconnected.");
    } catch (_) { setStatus("Unable to disconnect Telegram. Please retry or send /stop to the bot."); }
    finally { setBusy(false); }
  }
  return <div style={{ padding: 12, borderBottom: "1px solid #ddd", fontSize: 12 }}>
    <button disabled={busy} onClick={enable}>Enable device notifications</button>
    <p>On iPhone, install this app on your Home Screen, then enable alerts.</p>
    <p>Telegram updates: {enabled ? "Connected" : "Not connected"}</p>
    <button disabled={busy} onClick={connectTelegram}>{enabled ? "Reconnect Telegram" : "Connect Telegram"}</button>
    {(enabled || link) && <button disabled={busy} onClick={disconnectTelegram}>Disconnect Telegram</button>}
    {link && <p><a href={link.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" onClick={event => {
      if (Date.now() >= link.expiresAt) { event.preventDefault(); setLink(null); setStatus("Link expired. Choose Connect Telegram again."); }
    }}>Open Telegram and press Start</a></p>}
    <p role="status" style={{ whiteSpace: "normal" }}>{status}</p>
  </div>;
}
