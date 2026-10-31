const {onCall, onRequest, HttpsError} = require('firebase-functions/v2/https');
const {onDocumentCreated} = require('firebase-functions/v2/firestore');
const {defineSecret, defineString} = require('firebase-functions/params');
const {getFirestore, FieldValue, Timestamp} = require('firebase-admin/firestore');
const {randomBytes, createHash, timingSafeEqual} = require('node:crypto');
const {notificationData} = require('./notification-functions.cjs');
const botToken = defineSecret('TELEGRAM_BOT_TOKEN');
const webhookSecret = defineSecret('TELEGRAM_WEBHOOK_SECRET');
const botUsername = defineString('TELEGRAM_BOT_USERNAME', {default: ''});
const hash = value => createHash('sha256').update(value).digest('hex');
const prefRef = (db, uid) => db.doc(`notificationPreferences/${uid}`);

async function telegram(method, body) {
  // Never log the request URL: Telegram embeds the bot token in it.
  let response;
  try {
    response = await fetch(`https://api.telegram.org/bot${botToken.value()}/${method}`, {
      method: 'POST', signal: AbortSignal.timeout(15000),
      headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      const error = new Error(`Telegram API error ${result.error_code || response.status}`);
      error.code = result.error_code || response.status;
      error.connectionRevoked = error.code === 403 && /bot was blocked by the user|user is deactivated/i.test(result.description || '');
      throw error;
    }
    return result.result;
  } catch (error) {
    if (error.code && Number.isInteger(error.code)) throw error;
    throw new Error('Telegram request failed or timed out');
  }
}

async function activeUser(db, uid) {
  const user = await db.doc(`users/${uid}`).get();
  return user.exists && user.data().isActive !== false;
}

exports.createTelegramLink = onCall(async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Please sign in.');
  const db = getFirestore();
  if (!(await activeUser(db, uid))) throw new HttpsError('permission-denied', 'Your account is inactive.');
  const username = botUsername.value().replace(/^@/, '');
  if (!/^[A-Za-z0-9_]{5,32}$/.test(username)) throw new HttpsError('failed-precondition', 'Telegram setup is awaiting the bot username.');
  const token = randomBytes(24).toString('hex');
  const key = hash(token);
  const expiresAt = Timestamp.fromMillis(Date.now() + 10 * 60 * 1000);
  await db.runTransaction(async tx => {
    const pref = await tx.get(prefRef(db, uid));
    if ((pref.data()?.linkRequestedAt?.toMillis?.() || 0) > Date.now() - 10000) {
      throw new HttpsError('resource-exhausted', 'Wait a few seconds before creating another link.');
    }
    const oldKey = pref.data()?.pendingLinkHash;
    if (oldKey) tx.delete(db.doc(`telegramLinks/${oldKey}`));
    tx.set(db.doc(`telegramLinks/${key}`), {uid, expiresAt});
    tx.set(prefRef(db, uid), {pendingLinkHash: key, linkRequestedAt: FieldValue.serverTimestamp()}, {merge: true});
  });
  return {url: `https://t.me/${username}?start=${token}`, expiresAt: expiresAt.toMillis()};
});

exports.disconnectTelegram = onCall(async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Please sign in.');
  const db = getFirestore();
  await db.runTransaction(async tx => {
    const pref = await tx.get(prefRef(db, uid));
    const data = pref.data() || {};
    if (data.telegramChatId) tx.delete(db.doc(`telegramChats/${data.telegramChatId}`));
    if (data.pendingLinkHash) tx.delete(db.doc(`telegramLinks/${data.pendingLinkHash}`));
    tx.set(prefRef(db, uid), {telegramEnabled: false, telegramDisconnectReason: 'app_disconnect', telegramChatId: FieldValue.delete(),
      pendingLinkHash: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp()}, {merge: true});
  });
  return {success: true};
});

async function connect(db, token, chatId) {
  if (!/^[a-f0-9]{48}$/.test(token)) return false;
  const key = hash(token);
  return db.runTransaction(async tx => {
    const linkRef = db.doc(`telegramLinks/${key}`);
    const link = (await tx.get(linkRef)).data();
    if (!link || link.expiresAt.toMillis() <= Date.now()) return false;
    const ref = prefRef(db, link.uid);
    const [pref, chat, user] = await Promise.all([tx.get(ref), tx.get(db.doc(`telegramChats/${chatId}`)), tx.get(db.doc(`users/${link.uid}`))]);
    if (!user.exists || user.data().isActive === false || pref.data()?.pendingLinkHash !== key) return false;
    if (chat.exists && chat.data().uid !== link.uid) return false;
    const oldChat = pref.data()?.telegramChatId;
    if (oldChat && oldChat !== chatId) tx.delete(db.doc(`telegramChats/${oldChat}`));
    tx.set(db.doc(`telegramChats/${chatId}`), {uid: link.uid});
    tx.set(ref, {telegramEnabled: true, telegramChatId: chatId, telegramDisconnectReason: FieldValue.delete(), pendingLinkHash: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp()}, {merge: true});
    tx.delete(linkRef);
    return true;
  });
}

async function stopUpdates(db, chatId, reason = 'bot_stop', expectedUid) {
  await db.runTransaction(async tx => {
    const chatRef = db.doc(`telegramChats/${chatId}`);
    const chat = (await tx.get(chatRef)).data();
    if (!chat || (expectedUid && chat.uid !== expectedUid)) return;
    const ref = prefRef(db, chat.uid);
    const pref = (await tx.get(ref)).data();
    if (pref?.telegramChatId === chatId) {
      if (pref.pendingLinkHash) tx.delete(db.doc(`telegramLinks/${pref.pendingLinkHash}`));
      tx.set(ref, {telegramEnabled: false, telegramDisconnectReason: reason, telegramChatId: FieldValue.delete(), pendingLinkHash: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp()}, {merge: true});
    }
    tx.delete(chatRef);
  });
}

exports.telegramWebhook = onRequest({secrets: [botToken, webhookSecret], maxInstances: 5}, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  const supplied = Buffer.from(req.get('X-Telegram-Bot-Api-Secret-Token') || '');
  const expected = Buffer.from(webhookSecret.value());
  if (!expected.length || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return res.status(403).send('Forbidden');
  const message = req.body?.message;
  if (message?.chat?.type !== 'private' || !Number.isSafeInteger(message.chat.id) || message.chat.id <= 0 || message.from?.id !== message.chat.id) return res.sendStatus(200);
  const chatId = String(message.chat.id);
  const [command, argument] = (typeof message.text === 'string' ? message.text : '').trim().split(/\s+/);
  const db = getFirestore();
  let text;
  try {
    switch (command?.split('@')[0].toLowerCase()) {
      case '/start':
        text = argument && await connect(db, argument, chatId)
          ? 'Connected! Your new WB Airtel MSC notifications will arrive here. Send /stop to disconnect.'
          : 'To connect, sign in to WB Airtel MSC, open the notification bell and choose Connect Telegram. Links expire after 10 minutes and work once.';
        break;
      case '/stop':
        await stopUpdates(db, chatId);
        text = 'Telegram updates stopped. Reconnect from the app notification bell anytime.';
        break;
      case '/status': {
        const binding = (await db.doc(`telegramChats/${chatId}`).get()).data();
        const pref = binding && (await prefRef(db, binding.uid).get()).data();
        text = pref?.telegramEnabled && pref.telegramChatId === chatId && await activeUser(db, binding.uid) ? 'Connected. Notification updates are enabled.' : 'Not connected. Connect Telegram from the app notification bell.';
        break;
      }
      default:
        text = 'WB Airtel MSC notification bot\n/status — connection status\n/stop — stop updates\nConnect your account using the notification bell in the app.';
    }
  } catch (_) {
    console.error('Telegram command processing failed');
    return res.sendStatus(500);
  }
  try { await telegram('sendMessage', {chat_id: chatId, text}); }
  catch (_) { console.warn('Telegram command reply failed'); }
  return res.sendStatus(200);
});

exports.telegramBellNotification = onDocumentCreated({document: 'notifications/{uid}/items/{id}', secrets: [botToken]}, async event => {
  const db = getFirestore();
  const {uid, id} = event.params;
  if (event.data.data().read || !(await activeUser(db, uid))) return;
  const pref = (await prefRef(db, uid).get()).data();
  if (!pref?.telegramEnabled || !/^\d+$/.test(pref.telegramChatId || '')) return;
  const chat = (await db.doc(`telegramChats/${pref.telegramChatId}`).get()).data();
  if (chat?.uid !== uid) return;
  const delivery = db.doc(`notificationDeliveries/${uid}/telegramItems/${id}`);
  const claimed = await db.runTransaction(async tx => {
    if ((await tx.get(delivery)).exists) return false;
    tx.create(delivery, {status: 'sending', createdAt: FieldValue.serverTimestamp()});
    return true;
  });
  if (!claimed) return;
  const data = notificationData(event.data.data(), uid, id);
  try {
    const result = await telegram('sendMessage', {chat_id: pref.telegramChatId, text: `${data.title}\n\n${data.body}`});
    await delivery.update({status: 'sent', messageId: result.message_id, updatedAt: FieldValue.serverTimestamp()});
  } catch (error) {
    await delivery.update({status: 'failed', error: error.message, updatedAt: FieldValue.serverTimestamp()});
    // Only an explicit block/deactivated account revokes the connection; generic failures do not.
    if (error.connectionRevoked) await stopUpdates(db, pref.telegramChatId, 'telegram_blocked_or_deactivated', uid);
    console.warn('Telegram notification failed', {uid, id, code: error.code || 'network', connectionRevoked: !!error.connectionRevoked});
  }
});
