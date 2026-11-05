const {onCall, onRequest, HttpsError} = require('firebase-functions/v2/https');
const {onDocumentCreated} = require('firebase-functions/v2/firestore');
const {defineSecret, defineString} = require('firebase-functions/params');
const {getFirestore, FieldValue, Timestamp} = require('firebase-admin/firestore');
const {randomBytes, createHash, timingSafeEqual} = require('node:crypto');
const {notificationData} = require('./notification-functions.cjs');
const {help, reportCommand, siteReportCommand, reportMessages} = require('./telegram-reports.cjs');
const {formattedMessages} = require('./telegram-message.cjs');
const {alertHeader} = require('./telegram-alert-style.cjs');
const botToken = defineSecret('TELEGRAM_BOT_TOKEN');
const webhookSecret = defineSecret('TELEGRAM_WEBHOOK_SECRET');
const botUsername = defineString('TELEGRAM_BOT_USERNAME', {default: ''});
const hash = value => createHash('sha256').update(value).digest('hex');
const prefRef = (db, uid) => db.doc(`notificationPreferences/${uid}`);

async function telegram(method, body) {
  // Never log the request URL: Telegram embeds the bot token in it.
  let response;
  const multipart = typeof FormData !== 'undefined' && body instanceof FormData;
  try {
    response = await fetch(`https://api.telegram.org/bot${botToken.value()}/${method}`, {
      method: 'POST', signal: AbortSignal.timeout(15000),
      headers: multipart ? undefined : {'Content-Type': 'application/json'}, body: multipart ? body : JSON.stringify(body)
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

function headerUpload(chatId, notice) {
  const header=alertHeader(notice.actionType,notice);
  if (!header) return null;
  const upload=new FormData();
  upload.set('chat_id',chatId);
  upload.set('disable_notification','true');
  upload.set('caption',`${notice.title || 'Meter readings'}\n${String(notice.message || notice.body || '').split(/\r?\n/)[0]}`.slice(0,800));
  upload.set('photo',new Blob([header.bytes],{type:'image/png'}),header.filename);
  return upload;
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

exports.telegramWebhook = onRequest({secrets: [botToken, webhookSecret], maxInstances: 5, timeoutSeconds: 120}, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  const supplied = Buffer.from(req.get('X-Telegram-Bot-Api-Secret-Token') || '');
  const expected = Buffer.from(webhookSecret.value());
  if (!expected.length || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return res.status(403).send('Forbidden');
  const message = req.body?.message;
  if (message?.chat?.type !== 'private' || !Number.isSafeInteger(message.chat.id) || message.chat.id <= 0 || message.from?.id !== message.chat.id) return res.sendStatus(200);
  const chatId = String(message.chat.id);
  const [rawCommand, ...argumentsList] = (typeof message.text === 'string' ? message.text : '').trim().split(/\s+/);
  const command = rawCommand.split('@')[0].toLowerCase();
  const argument = argumentsList.join(' ');
  // Drain stale all-site retries from the previous revision without sending another report.
  if (command === '/summary' && argument.toLowerCase() === 'all' && Number.isFinite(message.date) && Date.now()-message.date*1000>120000) return res.sendStatus(200);
  const db = getFirestore();
  // Telegram retries webhook requests. A long report must never restart at site 1.
  const updateKey=Number.isSafeInteger(req.body?.update_id) && req.body.update_id>=0
    ? `update-${req.body.update_id}`
    : Number.isSafeInteger(message.message_id) ? `message-${chatId}-${message.message_id}` : null;
  const updateRef=updateKey ? db.doc(`notificationDeliveries/telegramWebhook/updates/${updateKey}`) : null;
  if (updateRef) {
    try {
      const claimed=await db.runTransaction(async tx=>{
        if ((await tx.get(updateRef)).exists) return false;
        tx.create(updateRef,{chatId,status:'processing',createdAt:FieldValue.serverTimestamp()});
        return true;
      });
      if (!claimed) return res.sendStatus(200);
    } catch (_) {
      console.error('Telegram update claim failed');
      return res.sendStatus(503);
    }
  }
  let text, messageKind = command.slice(1);
  try {
    const siteRequest = siteReportCommand(typeof message.text === 'string' ? message.text : '');
    if (message.photo?.length || /^image\/(jpeg|png)$/.test(message.document?.mime_type || '')) {
      messageKind = 'import';
      const {importImage} = require('./telegram-crq.cjs');
      text = await importImage(db, chatId, message, telegram, botToken.value());
    } else if (siteRequest) {
      messageKind = siteRequest.kind || 'help';
      text = siteRequest.kind
        ? await reportMessages(db, chatId, siteRequest.kind, Date.now(), siteRequest.site, {meterCards:true,summaryCards:true})
        : help;
    } else {
    switch (command) {
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
        const kind = reportCommand(command, argument.toLowerCase());
        messageKind = kind || 'help';
        text = kind ? await reportMessages(db, chatId, kind, Date.now(), null, {meterCards:true,summaryCards:true}) : help;
    }
    }
  } catch (_) {
    console.error('Telegram command processing failed');
    if (updateRef) {await updateRef.update({status:'failed',phase:'processing',updatedAt:FieldValue.serverTimestamp()});return res.sendStatus(200);}
    return res.sendStatus(500);
  }
  try {
    let sent=false;
    const pace=async()=>{if(sent) await new Promise(resolve=>setTimeout(resolve,1100));sent=true;};
    const replies=Array.isArray(text) ? text : [text];
    const batches=replies.some(reply=>reply && typeof reply==='object') ? replies : [replies];
    for (const reply of batches) {
      const notice=reply && typeof reply==='object' && !Array.isArray(reply) ? reply : null;
      const parts=formattedMessages(notice ? [notice.message] : Array.isArray(reply) ? reply : [reply],{kind:notice?.kind || messageKind,
        ...(notice ? {title:notice.title,actionType:notice.actionType,notification:notice} : {})});
      let deliveredAsCaption=false;
      if (notice) {
        try {
          const upload=headerUpload(chatId,notice);
          if (upload) {
            // A complete short reading fits in one photo caption, avoiding duplicate replies.
            const fits=parts.length===1 && parts[0].text.length<=1024;
            if (fits) {
              upload.set('caption',parts[0].text);
              upload.set('parse_mode','HTML');
              upload.delete('disable_notification');
            }
            await pace();await telegram('sendPhoto',upload);
            deliveredAsCaption=fits;
          }
        } catch(error) {
          if (error.connectionRevoked) throw error;
          console.warn('Telegram meter header unavailable; delivering text',{code:error.code || 'render-failed'});
        }
      }
      if (!deliveredAsCaption) for (const part of parts) {await pace();await telegram('sendMessage',{chat_id:chatId,...part});}
    }
  }
  catch (error) {
    console.warn('Telegram command reply failed', {code: error.code || 'network', connectionRevoked: !!error.connectionRevoked});
    // Acknowledge permanent recipient revocation; retry transient failures instead of silently dropping /start.
    if (updateRef) {await updateRef.update({status:'failed',phase:'delivery',updatedAt:FieldValue.serverTimestamp()});return res.sendStatus(200);}
    if (!error.connectionRevoked) return res.sendStatus(503);
  }
  if (updateRef) await updateRef.update({status:'completed',updatedAt:FieldValue.serverTimestamp()});
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
    const saved = event.data.data();
    const parts = formattedMessages([String(saved.message || saved.body || data.body)], {title:`📬 ${data.title}`,actionType:saved.actionType,notification:saved});
    const messageIds = [];
    let photoMessageId;
    try {
      const upload = headerUpload(pref.telegramChatId,{...saved,title:data.title});
      if (upload) {
        const photo = await telegram('sendPhoto', upload);
        photoMessageId = photo.message_id;
        await new Promise(resolve => setTimeout(resolve, 1100));
      }
    } catch (error) {
      // An optional visual must never prevent delivery of the full text details.
      if (error.connectionRevoked) throw error;
      console.warn('Telegram alert header unavailable; delivering text', {uid, id, code:error.code || 'render-failed'});
    }
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) await new Promise(resolve => setTimeout(resolve, 1100));
      const result = await telegram('sendMessage', {chat_id: pref.telegramChatId, ...parts[i]});
      messageIds.push(result.message_id);
    }
    await delivery.update({status: 'sent', messageId:messageIds[0], messageIds, ...(photoMessageId ? {photoMessageId} : {}), updatedAt: FieldValue.serverTimestamp()});
  } catch (error) {
    await delivery.update({status: 'failed', error: error.message, updatedAt: FieldValue.serverTimestamp()});
    // Only an explicit block/deactivated account revokes the connection; generic failures do not.
    if (error.connectionRevoked) await stopUpdates(db, pref.telegramChatId, 'telegram_blocked_or_deactivated', uid);
    console.warn('Telegram notification failed', {uid, id, code: error.code || 'network', connectionRevoked: !!error.connectionRevoked});
  }
});
