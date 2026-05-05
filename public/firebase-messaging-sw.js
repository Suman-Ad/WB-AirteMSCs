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

const messaging = firebase.messaging();

// This handles the message when the app is in the background or closed
messaging.onBackgroundMessage((payload) => {
  console.log("Received background message ", payload);

  const notificationTitle = payload.data.title || "CRQ Alert";
  const notificationOptions = {
    body: payload.data.body || "You have a pending CRQ task.",
    icon: "/vertiv192.png",
    data: payload.data, // Important for the click handler
    actions: [
      { action: "call", title: "📞 Call Now" },
      { action: "open", title: "📊 Open Dashboard" },
    ],
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});