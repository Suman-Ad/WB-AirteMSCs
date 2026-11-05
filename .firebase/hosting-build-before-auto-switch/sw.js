self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  let url = "/daily-activity-dashboard";
  const data = event.notification.data || {};

  if (event.action === "call") {
    url = `https://wa.me/${data.phone || "18001039090"}`;
  }

  // Use clients.matchAll to see if the tab is already open
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});