const sites = require('./telegram-sites.cjs');
const normalize = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const dateOf = value => value?.toDate ? new Date(value.toDate().getTime() + 330 * 60000).toISOString().slice(0, 10) : value;

// Rebuild horizontal table lines rather than trusting OCR's column reading order.
function imageRows(annotation) {
  const words = (annotation.textAnnotations || []).slice(1).map(word => {
    const vertices = word.boundingPoly?.vertices || [];
    const ys = vertices.map(v => v.y || 0);
    return {text: word.description, x: Math.min(...vertices.map(v => v.x || 0)), y: (Math.min(...ys) + Math.max(...ys)) / 2, height: Math.max(...ys) - Math.min(...ys)};
  }).filter(w => Number.isFinite(w.y)).sort((a, b) => a.y - b.y);
  const lines = [];
  for (const word of words) {
    const last = lines.at(-1);
    if (last && Math.abs(last.y - word.y) < Math.max(3, Math.min(last.height, word.height) * 0.55)) last.words.push(word);
    else lines.push({...word, words: [word]});
  }
  const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  return lines.flatMap(line => {
    const text = line.words.sort((a,b) => a.x-b.x).map(w => w.text).join(' ');
    const iso = /\b(\d{4})\s*[-/]\s*(\d{1,2})\s*[-/]\s*(\d{1,2})\b/.exec(text);
    const match = iso || /\b(\d{1,2})\s*[-/]\s*([A-Za-z]{3})\s*[-/]\s*(\d{4}|\d{2})\b/.exec(text);
    const crqs = [...text.matchAll(/\bCRQ\s*(\d{6,20})\b/gi)].map(m => `CRQ${m[1]}`);
    if (!match || !crqs.length) return [];
    const month = iso ? Number(match[2]) : months.indexOf(match[2].toLowerCase()) + 1;
    const year = iso ? match[1] : match[3].length === 2 ? `20${match[3]}` : match[3];
    const day = iso ? match[3] : match[1];
    const date = `${year}-${String(month).padStart(2,'0')}-${day.padStart(2,'0')}`;
    const parsed = new Date(`${date}T00:00:00Z`);
    if (!month || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== date) return [];
    return [{date, text: normalize(text.slice(match.index + match[0].length).split(/\bCRQ/i)[0]), crqs}];
  });
}

async function authorized(db, chatId, tx) {
  const get = ref => tx ? tx.get(ref) : ref.get();
  const binding = (await get(db.doc(`telegramChats/${chatId}`))).data();
  if (!binding) return null;
  const user = (await get(db.doc(`users/${binding.uid}`))).data();
  const pref = (await get(db.doc(`notificationPreferences/${binding.uid}`))).data();
  if (!user || user.isActive !== true || !['Super User','Admin','Super Admin'].includes(user.role) || !pref?.telegramEnabled || pref.telegramChatId !== chatId) return null;
  return user;
}

function matches(sheet, row, input, user) {
  if (dateOf(sheet.date) !== input.date) return false;
  if (!['Admin','Super Admin'].includes(user.role) && (!user.siteId || sheet.siteId !== user.siteId)) return false;
  const name = Object.keys(sites).find(name => sites[name] === sheet.siteId) || sheet.siteName;
  const prefix = normalize(name);
  if (!prefix || !row.nodeName || !row.activityDetails) return false;
  let body = input.text.startsWith(prefix + 'MSC') ? input.text.slice(prefix.length + 3) : input.text.startsWith(prefix) ? input.text.slice(prefix.length) : '';
  // Exported tables may include siteId and Site Category before Node Name.
  const id = normalize(sheet.siteId);
  if (id && body.startsWith(id)) body = body.slice(id.length);
  const categories = [...new Set([normalize(row.siteCategory), 'NONCRITICAL', 'CRITICAL'])].filter(Boolean).sort((a,b)=>b.length-a.length);
  const category = categories.find(value => body.startsWith(value));
  if (category) body = body.slice(category.length);
  return body.startsWith(normalize(row.nodeName) + normalize(row.activityDetails));
}

async function updateCrqs(db, chatId, inputs) {
  if (!await authorized(db, chatId)) return 'CRQ image updates require a connected, active Super User, Admin or Super Admin account.';
  if (!inputs.length) return 'No readable dated CRQ rows found. Send a clear table image with Date, Site Name, Node Name, Activity Details and CRQ columns.';
  if (inputs.length > 100) return 'Send at most 100 image rows at a time.';
  // All reads and writes share a transaction: concurrent dashboard edits are preserved.
  return db.runTransaction(async tx => {
    const user = await authorized(db, chatId, tx);
    if (!user) return 'Your account is no longer authorized to update CRQs.';
    const paused = new Set();
    const docs = [];
    for (const date of new Set(inputs.map(r => r.date))) {
      for (const value of [date, new Date(`${date}T00:00:00+05:30`)]) {
        const result = await tx.get(db.collection('daily_activity_sheets').where('date', '==', value));
        docs.push(...result.docs);
      }
    }
    const sheets = [...new Map(docs.map(d => [d.id, {ref:d.ref, data:d.data()}])).values()];
    for (const siteId of new Set(sheets.map(sheet=>sheet.data.siteId))) {
      if (typeof siteId !== 'string' || !siteId || siteId.includes('/')) continue;
      const config = (await tx.get(db.doc(`energyMonitor/${siteId}/config/notifications`))).data();
      if (config?.telegramCrqImportEnabled === false) paused.add(siteId);
    }
    const changes = new Map();
    let skipped = 0;
    for (const input of inputs) {
      const candidates = sheets.flatMap((sheet, s) => paused.has(sheet.data.siteId) ? [] : (sheet.data.rows || []).flatMap((row, r) => matches(sheet.data, row, input, user) ? [{s,r,row}] : []));
      if (candidates.length !== 1) { skipped++; continue; }
      const {s,r,row} = candidates[0], key = `${s}:${r}`;
      const change = changes.get(key) || {s,r,values:new Set((String(row.crqNo || '').toUpperCase().match(/CRQ\d+/g) || []).filter(v => !/^CRQ0+$/.test(v)))};
      input.crqs.forEach(crq => change.values.add(crq));
      changes.set(key, change);
    }
    let updated = 0;
    const changedSheets = new Set();
    for (const {s,r,values} of changes.values()) {
      const crqNo = [...values].join(', ');
      if (crqNo !== sheets[s].data.rows[r].crqNo) {
        sheets[s].data.rows[r] = {...sheets[s].data.rows[r], crqNo};
        changedSheets.add(s); updated++;
      }
    }
    for (const s of changedSheets) tx.update(sheets[s].ref, {rows:sheets[s].data.rows});
    return `CRQ import: ${updated} existing activity row(s) updated; ${changes.size - updated} already current; ${skipped} unmatched, ambiguous or paused image row(s) skipped. No rows created.`;
  });
}

async function importImage(db, chatId, message, telegram, token) {
  if (!await authorized(db, chatId)) return 'CRQ image updates require a connected, active Super User, Admin or Super Admin account.';
  const file = message.photo?.at(-1) || message.document;
  const maxBytes = 8 * 1024 * 1024;
  if (!file || (file.file_size || 0) > maxBytes) return 'Send a JPG or PNG table image under 8 MB.';
  let stage = 'telegram-file';
  let status;
  let reason;
  try {
    const meta = await telegram('getFile', {file_id:file.file_id});
    if (!meta.file_path || meta.file_size > maxBytes) return 'Send an image under 8 MB.';
    stage = 'download';
    const response = await fetch(`https://api.telegram.org/file/bot${token}/${meta.file_path}`, {signal:AbortSignal.timeout(20000)});
    status = response.status;
    if (!response.ok) throw new Error('download');
    const parts = []; let size = 0;
    for await (const part of response.body) {
      size += part.length;
      if (size > maxBytes) { await response.body.cancel?.().catch(() => {}); return 'Send an image under 8 MB.'; }
      parts.push(part);
    }
    stage = 'credentials'; status = undefined;
    const {getApp} = require('firebase-admin/app');
    const access = await getApp().options.credential.getAccessToken();
    stage = 'vision';
    const ocr = await fetch('https://vision.googleapis.com/v1/images:annotate', {
      method:'POST', signal:AbortSignal.timeout(40000),
      headers:{Authorization:`Bearer ${access.access_token}`, 'Content-Type':'application/json'},
      body:JSON.stringify({requests:[{image:{content:Buffer.concat(parts).toString('base64')}, features:[{type:'DOCUMENT_TEXT_DETECTION'}]}]})
    });
    status = ocr.status;
    const result = await ocr.json();
    const error = result.error || result.responses?.[0]?.error;
    const reasons = (error?.details || []).map(detail => detail.reason);
    reason = ['SERVICE_DISABLED','BILLING_DISABLED','USER_PROJECT_DENIED','ACCESS_TOKEN_SCOPE_INSUFFICIENT','IAM_PERMISSION_DENIED'].find(value => reasons.includes(value));
    if (error?.code) status = error.code;
    if (!ocr.ok || result.responses?.[0]?.error) throw new Error('ocr');
    stage = 'parse'; status = undefined;
    const rows = imageRows(result.responses?.[0] || {});
    stage = 'database';
    return await updateCrqs(db, chatId, rows);
  } catch (error) {
    // Do not log Telegram URLs, bot tokens, image data or credential responses.
    const code = typeof error.code === 'number' ? error.code : undefined;
    console.warn('CRQ image import failed', {stage, status, reason, code});
    const diagnostic = [stage, status, reason, code].filter(value => value !== undefined).join('/');
    let advice = 'Resend the image. If this repeats, check the function logs using this diagnostic code.';
    if (stage === 'vision') {
      advice = reason === 'SERVICE_DISABLED' ? 'Enable Cloud Vision API in project wb-airtelmscs.'
        : reason === 'BILLING_DISABLED' ? 'Check the billing account linked to project wb-airtelmscs.'
        : status === 403 || status === 7 ? 'Check the runtime service account permissions, API access and billing in project wb-airtelmscs.'
        : status === 429 || status === 8 ? 'Cloud Vision quota was exceeded. Retry later or check API quotas.'
        : 'Cloud Vision could not process the image. Check API logs and resend a clear JPG/PNG.';
    }
    if (stage === 'database') advice = 'The database operation failed. Check telegramWebhook logs for the database error code; enabling Vision will not resolve this stage.';
    if (stage === 'credentials') advice = 'The function could not obtain its service account credential. Check the runtime service account configuration.';
    return `CRQ image import failed (${diagnostic}). ${advice} No new rows are created.`;
  }
}
module.exports = {imageRows, matches, updateCrqs, importImage};
