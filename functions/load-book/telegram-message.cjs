const {alertTheme} = require('./telegram-alert-style.cjs');
// Format at delivery time so report calculations and app notifications stay independent.
const escapeHtml = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const titles = {
  dhr: '📋 Daily health report', summary: '📊 Monthly site summary', summaryAll: '🌐 All-site monthly summary', fuel: '⛽ Present fuel',
  meters: '⚡ Meter readings', load: '⚡ Site running load', pue: '📈 Power usage effectiveness',
  segr: '📈 DG generation efficiency', siteStatus: '🏢 Site power status',
  activity: '📋 Site activities', incident: '🚨 Open incidents',
  start: '🔗 Telegram connection', stop: '🔕 Telegram disconnected', status: '🔗 Connection status',
  help: '📖 Bot commands', import: '📷 Activity image import'
};

function styledLine(line, index) {
  const safe = escapeHtml(line);
  if (index === 0 && line.length <= 160 && !line.includes(':') && !line.startsWith('/')) return `<b>${safe}</b>`;
  if (/^(?:📊 Site reports|📋 Operations|🌐 Administrator reports|🔗 Your connection|⛽ Diesel stock|[12]\. (?:Today|Monthly summary):|.* — Site Summary$|.*Diesel stock|SEGR \(|Present fuel =)/.test(line)) {
    return `\n<b>${safe}</b>`;
  }
  if (/^\//.test(line)) {
    const separator = line.indexOf(' — ');
    if (separator > 0) return `<b>${escapeHtml(line.slice(0, separator))}</b>${escapeHtml(line.slice(separator))}`;
  }
  // Short field labels remain easy to scan, including labels containing untrusted text.
  const label = /^(\s*(?:• )?[^:\n]{1,70}:)(.*)$/.exec(line);
  if (label && /\d:$/.test(label[1]) && /^\d{2}/.test(label[2])) return safe;
  return label ? `<b>${escapeHtml(label[1])}</b>${escapeHtml(label[2])}` : safe;
}

function bodyLines(value, kind) {
  // Break metric rows into vertical lists that fit narrow phone screens.
  return String(value).replace(/\r\n?/g, '\n').split('\n').flatMap(line => {
    if (kind === 'siteStatus') {
      line = line.replace(/^Site Name:-/, '🏢 Site: ').replace(/^Site On (.+) Running\.$/, 'Power source: $1 · Running')
        .replace(/^Site On EB Supply\.$/, 'Power source: EB supply').replace(/^Diesel stock:-$/, '⛽ Diesel stock')
        .replace(/^External metal drum stock-/, 'External drum stock: ').replace(/^Total stock-/, 'Total stock: ')
        .replace(/^Diesel Backup :- /, 'Estimated backup: ');
    }
    if (!line.includes(' | ')) return [line];
    const segments = line.split(' | ');
    const dg = /^(DG-[1-4]):\s*(.*)$/.exec(segments[0]);
    return dg ? ['', `${dg[1]}:`, `  • ${dg[2]}`, ...segments.slice(1).map(s => `  • ${s}`)]
      : segments.map(s => `• ${s}`);
  });
}

function formattedMessages(messages, {kind = 'help', title, actionType, notification, now = Date.now()} = {}) {
  const theme = alertTheme(actionType, notification);
  const heading = theme ? `${theme.icon} ${theme.title}${theme.meter && (notification?.title || title) ? `\n${notification?.title || title}` : ''}` : title || titles[kind] || '📬 Site report';
  const pages = [];
  for (const message of messages) {
    let lines = [], length = 0;
    for (const original of bodyLines(message, kind)) {
      let remaining = original;
      // Split plain text first, then escape and add tags. Never split an HTML entity or tag.
      do {
        if (length >= 3000) { pages.push(lines); lines = []; length = 0; }
        const room = 3000 - length;
        let end = Math.min(room, remaining.length);
        if (end < remaining.length && end > 0 && /[\uD800-\uDBFF]/.test(remaining[end - 1])) end--;
        if (end === 0 && remaining.length) { pages.push(lines); lines = []; length = 0; continue; }
        lines.push(remaining.slice(0, end));
        length += end + 1;
        remaining = remaining.slice(end);
      } while (remaining.length);
    }
    if (lines.length) pages.push(lines);
  }
  const at = new Date(now).toLocaleString('en-IN', {timeZone:'Asia/Kolkata',hour12:false});
  return pages.map((lines, index) => {
    const part = pages.length > 1 ? ` · ${index + 1}/${pages.length}` : '';
    return {
      text: `<b>${escapeHtml(heading)}${part}</b>\n${theme ? theme.stripe.repeat(10) : '━━━━━━━━━━━━━━━━━━━━'}\n\n` +
        lines.map((line, lineIndex) => theme && (lineIndex === 0 || /^(?:DG generation:|Run duration:|Mains restored register:|DG start register:|DG closing register:|Last mains register at failure:)/.test(line)) ? `<b>${escapeHtml(line)}</b>` : styledLine(line, lineIndex)).join('\n').replace(/\n{3,}/g, '\n\n').trim() +
        `\n\n────────────────────\n<i>WB Airtel MSC · ${escapeHtml(at)} IST</i>`,
      parse_mode: 'HTML', link_preview_options: {is_disabled:true}
    };
  });
}
module.exports = {formattedMessages, escapeHtml};
