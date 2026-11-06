// public/firebase-messaging-sw.js

importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDHCtwBnDhUrksjZwd9o1vDNGdvZB24rPs",
  authDomain: "wb-airtelmscs.firebaseapp.com",
  projectId: "wb-airtelmscs",
  messagingSenderId: "747029201509",
  appId: "1:747029201509:web:980d35fa5dc71e13927c8c",
});

// Register before Firebase's click handler.
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin);
  if (target.origin !== self.location.origin) return;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(async windows => {
    for (const client of windows) {
      if (new URL(client.url).origin === target.origin) {
        await client.navigate(target.href);
        return client.focus();
      }
    }
    return clients.openWindow(target.href);
  }));
});
const messaging = firebase.messaging();
messaging.onBackgroundMessage(payload => {
  const data = payload.data || {};
  return self.registration.showNotification(data.title || "WB Airtel MSC", {
    body: data.body || "You have a new notification", icon: "/nolini-icon-192.png",
    tag: data.notificationId, data: { url: data.url || "/" }
  });
});
