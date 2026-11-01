import { getMessaging, getToken, deleteToken, isSupported, onMessage } from "firebase/messaging";
import { doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";

let currentToken;
function withTimeout(operation, milliseconds, message) {
  let timer;
  return Promise.race([
    operation,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), milliseconds); })
  ]).finally(() => clearTimeout(timer));
}

function pushConfigurationKey() {
  const key = (process.env.REACT_APP_FIREBASE_VAPID_KEY || "").trim();
  if (!key) throw new Error("Setup required: add the Firebase public Web Push certificate key as REACT_APP_FIREBASE_VAPID_KEY in .env.local, then restart or rebuild the app.");
  try {
    const bytes = atob(key.replace(/-/g, "+").replace(/_/g, "/"));
    if (bytes.length !== 65 || bytes.charCodeAt(0) !== 4) throw new Error();
  } catch (_) {
    throw new Error("The Firebase Web Push key is invalid. Use the public key from Project settings → Cloud Messaging → Web Push certificates, not the Firebase API key or a bot token.");
  }
  return key;
}

function registrationError(error, stage) {
  if (error.code === "permission-denied") return new Error("Device registration was rejected by Firestore. Sign in again and ask the administrator to deploy the notificationDevices security rules.");
  if (error.code === "messaging/token-subscribe-failed" || error.code === "messaging/token-subscribe-no-token") return new Error("Firebase could not register this device. Check the project's Web Push certificate key and enable the FCM Registration API, then retry.");
  if (error.code === "messaging/permission-blocked" || error.name === "NotAllowedError") return new Error("Notifications are blocked. Allow notifications for this website in browser settings and check device notification settings.");
  return new Error(`${stage}: ${error.message || "Please check your connection and retry."}`);
}
export async function disableDeviceNotifications() {
  if (currentToken && auth.currentUser) {
    const results = await Promise.allSettled([
      deleteDoc(doc(db, "notificationDevices", currentToken)),
      deleteToken(getMessaging())
    ]);
    if (results.some(result => result.status === "rejected")) {
      console.error("Unable to fully remove device notification registration.");
      return false;
    }
    currentToken = null;
  }
  return true;
}

export async function enableDeviceNotifications(uid, requestPermission = true) {
  if (!window.isSecureContext || !("Notification" in window) || !("serviceWorker" in navigator)) {
    throw new Error("Device notifications need HTTPS and a supported browser. On iPhone, add this app to your Home Screen first.");
  }
  const key = pushConfigurationKey();
  if (Notification.permission === "denied") throw new Error("Notifications are blocked. Open this website's browser settings, set Notifications to Allow, and retry.");
  // Keep the permission prompt in the click gesture, before any async work.
  const permission = requestPermission && Notification.permission !== "granted" ? await Notification.requestPermission() : Notification.permission;
  if (permission !== "granted") throw new Error("Allow notifications in your browser's site settings to enable device alerts.");
  if (!(await isSupported())) throw new Error("Push notifications are not supported by this browser.");
  let registration, token;
  const messaging = getMessaging();
  try {
    registration = await withTimeout(navigator.serviceWorker.register("/firebase-messaging-sw.js"), 15000, "Service worker registration timed out. Check your connection and retry.");
    await withTimeout(navigator.serviceWorker.ready, 15000, "The notification service worker did not start. Refresh the app and retry; check that /firebase-messaging-sw.js is deployed.");
  } catch (error) { throw registrationError(error, "Notification service worker failed"); }
  try {
    token = await withTimeout(getToken(messaging, { vapidKey: key, serviceWorkerRegistration: registration }), 30000, "Firebase device registration timed out. Check your connection and retry.");
  } catch (error) { throw registrationError(error, "Device registration failed"); }
  if (!token || auth.currentUser?.uid !== uid) throw new Error("Please sign in again and retry.");
  try {
    await withTimeout(setDoc(doc(db, "notificationDevices", token), { uid, token, updatedAt: serverTimestamp() }), 15000, "Could not confirm the device registration was saved. Check your connection and retry.");
  } catch (error) { throw registrationError(error, "Saving device registration failed"); }
  currentToken = token;
  return onMessage(messaging, async ({ data = {} }) => {
    if (auth.currentUser?.uid !== uid || data.uid !== uid) return;
    await registration.showNotification(data.title || "WB Airtel MSC", {
      body: data.body || "You have a new notification", icon: "/logo192.png",
      tag: data.notificationId, data: { url: data.url || "/" }
    });
  });
}
