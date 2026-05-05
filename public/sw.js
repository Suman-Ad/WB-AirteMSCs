self.addEventListener("notificationclick", function (event) {
  const data = event.notification.data || {};

  event.notification.close();

  if (event.action === "call") {
    // 📞 CALL BUTTON CLICK
    clients.openWindow(`tel:${data.phone || "18001039090"}`);
  } else {
    // default click (open dashboard)
    clients.openWindow("/");
  }
});