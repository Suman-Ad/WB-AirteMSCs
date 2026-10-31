import React, { useEffect, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db } from "../firebase";
import { enableDeviceNotifications } from "../services/deviceNotifications";

export default function NotificationSettings({ uid, onSetupRequired }) {
  const [status, setStatus] = useState("");
  const [deviceStatus, setDeviceStatus] = useState("");
  const [deviceEnabled, setDeviceEnabled] = useState(false);
  const [deviceBusy, setDeviceBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(null);
  const [link, setLink] = useState(null);
  const stop = useRef(null);
  useEffect(() => {
    let disposed = false;
    setEnabled(null);
    setLink(null);
    setDeviceEnabled(false);
    setDeviceStatus("");
    const start = async () => {
      try {
        const unsubscribe = await enableDeviceNotifications(uid, false);
        if (disposed) unsubscribe(); else {
          stop.current = unsubscribe;
          setDeviceEnabled(true);
          setDeviceStatus("Device notifications enabled on this device.");
        }
      } catch (error) {
        if (!disposed) {
          setDeviceStatus(error.message);
          onSetupRequired?.();
        }
      }
    };
    if (window.Notification?.permission === "granted") start();
    else onSetupRequired?.();
    const unsubscribe = onSnapshot(doc(db, "notificationPreferences", uid), snap => {
      // An empty offline cache is not proof that the saved connection was removed.
      if (snap.metadata?.fromCache && !snap.exists()) return;
      const settings = snap.data();
      setEnabled(settings?.telegramEnabled === true);
      if (!settings?.telegramEnabled) onSetupRequired?.();
      if (!settings?.pendingLinkHash) {
        setLink(null);
        if (settings?.telegramEnabled) setStatus("Telegram connected. Your new notifications will arrive in your bot chat.");
        else if (settings?.telegramDisconnectReason === "telegram_blocked_or_deactivated") setStatus("Telegram disconnected because the bot was blocked or the Telegram account was deactivated. Unblock the bot and connect again.");
        else if (settings?.telegramDisconnectReason === "bot_stop") setStatus("Telegram updates were stopped using /stop. Connect again to resume.");
        else if (settings?.telegramDisconnectReason === "app_disconnect") setStatus("Telegram was disconnected from the app. Connect again to resume.");
      }
    }, () => setStatus("Unable to load notification settings."));
    return () => { disposed = true; unsubscribe(); stop.current?.(); stop.current = null; };
  }, [uid, onSetupRequired]);
  async function enable() {
    setDeviceBusy(true);
    setDeviceStatus("Setting up device notifications…");
    try {
      stop.current?.();
      stop.current = await enableDeviceNotifications(uid);
      setDeviceEnabled(true);
      setDeviceStatus("Device notifications enabled on this device.");
    } catch (error) { setDeviceEnabled(false); setDeviceStatus(error.message); }
    finally { setDeviceBusy(false); }
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
    <strong>Set up your notification updates</strong>
    <p>Enable device alerts and connect your Telegram account once. Device alerts reconnect automatically after you allow permission.</p>
    <button disabled={deviceBusy} onClick={enable}>{deviceBusy ? "Enabling device notifications…" : deviceEnabled ? "Refresh device notifications" : "Enable device notifications"}</button>
    <p role="status" style={{ whiteSpace: "normal" }}>{deviceStatus}</p>
    <p>On iPhone, install this app on your Home Screen, then enable alerts.</p>
    <p>Telegram updates: {enabled === null ? "Checking connection…" : enabled ? "Connected" : "Not connected"}</p>
    <button disabled={busy || enabled === null} onClick={connectTelegram}>{enabled ? "Reconnect Telegram" : "Connect Telegram"}</button>
    {(enabled || link) && <button disabled={busy} onClick={disconnectTelegram}>Disconnect Telegram</button>}
    {link && <p><a href={link.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" onClick={event => {
      if (Date.now() >= link.expiresAt) { event.preventDefault(); setLink(null); setStatus("Link expired. Choose Connect Telegram again."); }
    }}>Open Telegram and press Start</a></p>}
    <p role="status" style={{ whiteSpace: "normal" }}>{status}</p>
  </div>;
}
