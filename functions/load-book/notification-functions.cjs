const {onDocumentCreated} = require('firebase-functions/v2/firestore');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const {getMessaging} = require('firebase-admin/messaging');
function notificationData(n, uid, id) {
  const routes = {backup_request: '/backup-approvals', registration_request: '/admin',
    change_power_source: '/daily-dashboard', change_dg_select: '/daily-dashboard',
    crq_open_reminder: '/daily-activity-dashboard', crq_close_reminder: '/daily-activity-dashboard'};
  const url = typeof n.url === 'string' && n.url.startsWith('/') && !n.url.startsWith('//') && !n.url.includes('\\') ? n.url : routes[n.actionType] || '/';
  return {title: String(n.title || 'WB Airtel MSC').slice(0, 200),
    body: String(n.message || n.body || 'You have a new notification').slice(0, 1000),
    url, uid, notificationId: id};
}

exports.pushBellNotification = onDocumentCreated({document: 'notifications/{uid}/items/{id}'}, async event => {
  const db = getFirestore();
  const {uid, id} = event.params;
  const user = await db.doc(`users/${uid}`).get();
  if (!user.exists || user.data().isActive === false || event.data.data().read) return;
  const data = notificationData(event.data.data(), uid, id);
  const devices = await db.collection('notificationDevices').where('uid', '==', uid).get();
  for (let i = 0; i < devices.docs.length; i += 500) {
    const batch = devices.docs.slice(i, i + 500);
    const result = await getMessaging().sendEachForMulticast({tokens: batch.map(d => d.data().token), data,
      webpush: {headers: {Urgency: 'high', TTL: '86400'}}});
    await Promise.all(result.responses.map((r, j) =>
      ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(r.error?.code) ? batch[j].ref.delete() : Promise.resolve()));
    if (result.failureCount) console.warn('Push delivery failures', {uid, id, count: result.failureCount});
  }
});

exports.notificationData = notificationData;
