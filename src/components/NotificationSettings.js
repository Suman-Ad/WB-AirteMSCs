import React, { useEffect, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db } from "../firebase";
import "./NotificationBell.css";
import { enableDeviceNotifications, disableDeviceNotifications } from "../services/deviceNotifications";

export default function NotificationSettings({ uid, onSetupRequired }) {
  const [status, setStatus] = useState("");
  const [deviceStatus, setDeviceStatus] = useState("");
  const [deviceEnabled, setDeviceEnabled] = useState(false);
  const [deviceChecking, setDeviceChecking] = useState(true);
  const [deviceBusy, setDeviceBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(null);
  const [link, setLink] = useState(null);
  const [feedbackChannel, setFeedbackChannel] = useState(null);
  const stop = useRef(null);
  useEffect(() => {
    let disposed = false;
    setEnabled(null);
    setLink(null);
    setDeviceEnabled(false);
    setDeviceStatus("");
    setStatus("");
    setDeviceChecking(true);
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
      } finally { if (!disposed) setDeviceChecking(false); }
    };
    let paused = false;
    try { paused = localStorage.getItem(`deviceNotificationsDisabled:${uid}`) === "1"; } catch (_) {}
    if (!paused && window.Notification?.permission === "granted") start();
    else { setDeviceChecking(false); if (!paused) onSetupRequired?.(); }
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
      try { localStorage.removeItem(`deviceNotificationsDisabled:${uid}`); } catch (_) {}
      setDeviceStatus("Device notifications enabled on this device.");
    } catch (error) { setDeviceEnabled(false); setDeviceStatus(error.message); }
    finally { setDeviceBusy(false); }
  }
  async function disable() {
    setDeviceBusy(true);
    try {
      if (await disableDeviceNotifications() === false) throw new Error("Unable to disable alerts. Please retry.");
      stop.current?.();
      stop.current = null;
      localStorage.setItem(`deviceNotificationsDisabled:${uid}`, "1");
      setDeviceEnabled(false);
      setDeviceStatus("Device alerts disabled on this browser.");
    } catch (error) { setDeviceStatus(error.message); }
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
      setEnabled(false);
      setStatus("Telegram updates disconnected.");
    } catch (_) { setStatus("Unable to disconnect Telegram. Please retry or send /stop to the bot."); }
    finally { setBusy(false); }
  }
  const feedback = feedbackChannel === "device" ? deviceStatus : status;
  return <div className="notification-delivery" role="group" aria-label="Notification delivery channels">
    {[
      {key: "device", name: "Device", active: deviceEnabled, checking: deviceChecking, busy: deviceBusy,
        state: deviceEnabled ? "Enabled" : "Disabled", action: deviceEnabled ? "Disable" : "Enable", run: deviceEnabled ? disable : enable,
        confirmation: deviceEnabled ? "Disable device notifications on this browser?" : "Enable device notifications on this browser?"},
      {key: "telegram", name: "Telegram", active: enabled, checking: enabled === null, busy, pending: !!link,
        state: enabled ? "Connected" : link ? "Awaiting Start" : "Disconnected", action: enabled ? "Disconnect" : link ? "Cancel connection" : "Connect", run: enabled || link ? disconnectTelegram : connectTelegram,
        confirmation: enabled ? "Disconnect Telegram notifications for your account?" : link ? "Cancel the pending Telegram connection?" : "Connect Telegram to receive your personal notifications?"}
    ].map(channel => <button key={channel.key}
      className={`notification-delivery-indicator notification-state ${channel.checking || channel.busy || channel.pending ? "is-pending" : channel.active ? "is-on" : "is-off"}`}
      disabled={channel.busy || channel.checking}
      title={`${channel.name}: ${channel.checking ? "Checking" : channel.state}. ${channel.action}`}
      aria-label={`${channel.name}: ${channel.checking ? "Checking" : channel.state}. ${channel.action}`}
      onClick={() => {
        if (window.confirm(channel.confirmation)) { setFeedbackChannel(channel.key); channel.run(); }
      }}>
      <i aria-hidden="true" />{channel.name}
    </button>)}
    {feedbackChannel && feedback && <div className="notification-delivery-feedback">
      <button className="notification-feedback-close" aria-label="Dismiss delivery message" onClick={() => setFeedbackChannel(null)}>×</button>
      <p role="status">{feedback}</p>
      {link && feedbackChannel === "telegram" && !enabled && <a className="notification-telegram-link" href={link.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" onClick={event => {
        if (Date.now() >= link.expiresAt) { event.preventDefault(); setLink(null); setStatus("Link expired. Choose Connect again."); }
      }}>Open Telegram and press Start</a>}
    </div>}
  </div>;
}
