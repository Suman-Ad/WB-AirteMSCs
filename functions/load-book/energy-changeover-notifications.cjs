const {createHash} = require('node:crypto');
const {istDate} = require('./meter-history.cjs');
const number = v => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const fmt = v => number(v) ? v.toLocaleString('en-IN',{maximumFractionDigits:2}) : 'Unavailable';
const time = v => number(v) && v > 0 ? new Date(v).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'}) + ' IST' : 'Unavailable';
function transition(before, after) {
  if (!after) return null;
  if (!before && after.status === 'Running') return 'start';
  if (after.status === 'Completed' && (!before || before.status === 'Running')) return 'restore';
  return null;
}
function reading(label, sample, beforeAt) {
  const current = number(sample?.kwh) && number(sample?.observedAtMs) && sample.observedAtMs > 0 && sample.observedAtMs <= beforeAt + 5000;
  const last = !current && number(sample?.lastKnownKwh) && number(sample?.lastKnownAtMs) && sample.lastKnownAtMs > 0 && sample.lastKnownAtMs <= beforeAt + 5000;
  const value = current ? sample.kwh : last ? sample.lastKnownKwh : null;
  const at = current ? sample.observedAtMs : last ? sample.lastKnownAtMs : null;
  return `${label}: ${fmt(value)} kWh | ${time(at)} | ${last ? 'Last known reading' : sample?.quality || 'Not captured'}`;
}
function changeoverNotification(run, phase, siteId) {
  const at = phase === 'start' ? run.startAtMs : run.endAtMs;
  const boundary = number(at) ? at : 0;
  const reset = run.counterReset === true || (number(run.opening?.kwh) && number(run.closing?.kwh) && run.closing.kwh < run.opening.kwh);
  const generated = phase === 'restore' && !reset && number(run.opening?.kwh) && number(run.closing?.kwh) ? run.closing.kwh - run.opening.kwh : null;
  const lines = [`${String(run.siteName || siteId).slice(0,100)} · ${run.dgNumber || 'DG'} · ${time(at)}`,
    `Source: ${run.trigger || 'Unknown'} changeover`];
  if (phase === 'start') lines.push(reading('Last mains register at failure',run.ebFailure,boundary),reading('DG start register',run.opening,boundary));
  else lines.push(reading('Mains restored register',run.ebRestoration,boundary),reading('DG start register',run.opening,boundary),reading('DG closing register',run.closing,boundary),
    `DG generation: ${fmt(generated)} kWh${reset ? ' (counter reset / decrease)' : ''}`,`Run duration: ${number(run.runSeconds) ? fmt(run.runSeconds / 60) + ' minutes' : 'Unavailable'}`);
  return {title:phase === 'start' ? `EB → ${run.dgNumber || 'DG'} · DG started` : `${run.dgNumber || 'DG'} → EB · Mains restored`,
    message:lines.join('\n'),actionType:phase === 'start' ? 'energy_dg_start' : 'energy_mains_restored',url:'/energy-monitor',read:false,
    date:number(at) && at > 0 ? istDate(at) : run.date || '',siteId,meterId:run.meterId || '',counterReset:reset};
}
const changeoverId=(siteId,runId,phase)=>'energy-changeover-'+createHash('sha256').update(JSON.stringify([siteId,runId,phase])).digest('hex');
module.exports={transition,reading,changeoverNotification,changeoverId};
