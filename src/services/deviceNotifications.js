import { getMessaging, getToken, deleteToken, isSupported, onMessage } from "firebase/messaging";
import { doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";

let currentToken;
export async function disableDeviceNotifications() {
  if (currentToken && auth.currentUser) {
    const results = await Promise.allSettled([
      deleteDoc(doc(db, "notificationDevices", currentToken)),
      deleteToken(getMessaging())
    ]);
    if (results.some(result => result.status === "rejected")) console.error("Unable to fully remove device notification registration.");
    currentToken = null;
  }
}

export async function enableDeviceNotifications(uid, requestPermission = true) {
  if (!window.isSecureContext || !("Notification" in window) || !("serviceWorker" in navigator)) {
    throw new Error("Device notifications need HTTPS and a supported browser. On iPhone, add this app to your Home Screen first.");
  }
  const key = process.env.REACT_APP_FIREBASE_VAPID_KEY;
  if (!key) throw new Error("Device notifications are awaiting the Firebase web-push key configuration.");
  const permission = requestPermission ? await Notification.requestPermission() : Notification.permission;
  if (permission !== "granted") throw new Error("Allow notifications in your browser's site settings to enable device alerts.");
  if (!(await isSupported())) throw new Error("Push notifications are not supported by this browser.");
  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  await navigator.serviceWorker.ready;
  const messaging = getMessaging();
  const token = await getToken(messaging, { vapidKey: key, serviceWorkerRegistration: registration });
  if (!token || auth.currentUser?.uid !== uid) throw new Error("Please sign in again and retry.");
  await setDoc(doc(db, "notificationDevices", token), { uid, token, updatedAt: serverTimestamp() });
  currentToken = token;
  return onMessage(messaging, async ({ data = {} }) => {
    if (auth.currentUser?.uid !== uid || data.uid !== uid) return;
    await registration.showNotification(data.title || "WB Airtel MSC", {
      body: data.body || "You have a new notification", icon: "/logo192.png",
      tag: data.notificationId, data: { url: data.url || "/" }
    });
  });
}
