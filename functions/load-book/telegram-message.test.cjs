const {test} = require('node:test');
const assert = require('node:assert/strict');
const {formattedMessages} = require('./telegram-message.cjs');
const now = Date.parse('2026-11-04T12:30:00+05:30');
const plain = value => value.replace(/<\/?(?:b|i)>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

test('reports have a header, vertical DG metrics, bold labels and an IST footer', () => {
  const [message] = formattedMessages(['Asansol\n1. Today: 2026-11-04 (IST)\nDG-1: Opening fuel 100 L | Day consumption 20 L | Present fuel 80 L'], {kind:'summary',now});
  assert.match(message.text, /^<b>📊 Monthly site summary<\/b>/);
  assert.match(message.text, /<b>1\. Today: 2026-11-04 \(IST\)<\/b>/);
  assert.match(message.text, /<b>DG-1:<\/b>\n  • Opening fuel 100 L\n  • Day consumption 20 L\n  • Present fuel 80 L/);
  assert.match(message.text, /<i>WB Airtel MSC · .*12:30:00 IST<\/i>$/);
  assert.equal(message.parse_mode, 'HTML');
  assert.equal(message.link_preview_options.is_disabled, true);
});

test('untrusted HTML, entities and titles are displayed as literal text', () => {
  const input = 'Description: <a href="https://evil.test">Alert</a> & <b>DG</b> &lt;';
  const [message] = formattedMessages([input], {title:'<script>Unsafe & title</script>',now});
  assert.doesNotMatch(message.text, /<a |<script>|<b>DG<\/b>/);
  assert.ok(plain(message.text).includes(input));
  assert.match(message.text, /&amp;lt;/);
});

test('long pages retain text, balance markup and never split surrogate pairs or entities', () => {
  const input = ('<&🚨'.repeat(3000));
  const pages = formattedMessages([input], {kind:'incident',now});
  let recovered = '';
  pages.forEach((page,i) => {
    assert.match(page.text, new RegExp(`${i+1}/${pages.length}`));
    assert.ok(plain(page.text).length <= 4096);
    assert.equal((page.text.match(/<b>/g) || []).length,(page.text.match(/<\/b>/g) || []).length);
    const body = page.text.split('━━━━━━━━━━━━━━━━━━━━\n\n')[1].split('\n\n────────────────────')[0];
    assert.equal(body.isWellFormed(),true);
    recovered += plain(body);
  });
  assert.equal(recovered,input);
});

test('each report and continuation page carries its own context', () => {
  const pages = formattedMessages(['Site A\nDG-1: 12 L','Site B\nDG-1: 34 L'],{kind:'fuel',now});
  assert.equal(pages.length,2);
  assert.match(pages[0].text,/⛽ Present fuel · 1\/2/);
  assert.match(pages[1].text,/⛽ Present fuel · 2\/2/);
  assert.match(pages[1].text,/Site B/);
});


test('changeover timestamps remain intact and reading fields keep labels',()=>{
 const [page]=formattedMessages(['Asansol · DG-1 · 4/11/2026, 8:11:20 pm IST\nDG start register: 137000 kWh\n  Reading time: 4/11/2026, 8:11:12 pm IST\n  Reading quality: Captured'],{now});
 assert.ok(page.text.includes('Asansol · DG-1 · 4/11/2026, 8:11:20 pm IST'));
 assert.ok(!page.text.includes('8:</b>'));
 assert.ok(page.text.includes('<b>  Reading time:</b>'));
});


test('changeover themes retain escaped full detail and highlight important readings',()=>{
 for(const [actionType,stripe] of [['energy_dg_start','🟥'],['energy_mains_restored','🟩']]) {
  const pages=formattedMessages(['Asansol <site> & DG-1\nDG generation: 34.78 kWh\n'+('Full detail '.repeat(700))+'END'],{actionType,now});
  assert.ok(pages.every(page=>page.text.includes(stripe.repeat(10))));
  assert.ok(pages[0].text.includes('Asansol &lt;site&gt; &amp; DG-1'));
  assert.ok(pages[0].text.includes('<b>DG generation: 34.78 kWh</b>'));
  assert.ok(pages.at(-1).text.includes('END'));
  assert.ok(pages.every(page=>plain(page.text).length<=4096));
 }
});
