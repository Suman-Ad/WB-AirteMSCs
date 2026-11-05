const sites = require('./telegram-sites.cjs');
const {istDate} = require('./meter-history.cjs');
function serverRunHistoryEntry(run, siteId, runId) {
  const site = Object.keys(sites).find(name => sites[name] === siteId);
  if (!site || run?.siteId !== siteId || run.status !== 'Completed' ||
      !Number.isFinite(run.startAtMs) || !Number.isFinite(run.endAtMs) ||
      run.startAtMs <= 0 || run.endAtMs < run.startAtMs || !/^DG-[12]$/.test(run.dgNumber || '')) return null;
  const clock = ms => new Date(ms).toLocaleTimeString('en-GB', {timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',hour12:false});
  const runSeconds = Math.floor((run.endAtMs - run.startAtMs) / 1000);
  return {site, siteId, dgNumber:run.dgNumber, startTime:clock(run.startAtMs), endTime:clock(run.endAtMs),
    date:istDate(run.startAtMs), endDate:istDate(run.endAtMs), startAtMs:run.startAtMs, endAtMs:run.endAtMs,
    runSeconds, runMinutes:Math.ceil(runSeconds/60), startedBy:'Server automatic', empId:'', designation:'System',
    dgLogAdded:false, source:'server-power-switch', serverRunId:runId};
}
module.exports={serverRunHistoryEntry};
