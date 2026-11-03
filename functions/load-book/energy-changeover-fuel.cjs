const {istDate} = require('./meter-history.cjs');
const numeric = value => value != null && String(value).trim() !== '' && !Array.isArray(value) && ['number','string'].includes(typeof value) && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
function consumption(row, dg) {
  const read = field => numeric(row[`${dg} ${field}`]);
  const opening=read('Fuel Opening'), closing=read('Fuel Closing'), filling=read('Fuel Filling') ?? 0;
  const hourOpen=read('Hour Opening'), hourClose=read('Hour Closing');
  const offFuel=read('Off Load Fuel Consumption') ?? 0, offHours=read('Off Load Hour') ?? 0;
  if ([opening,closing,hourOpen,hourClose].some(value=>value===null)) return null;
  const fuel=opening-closing+filling-offFuel, hours=hourClose-hourOpen-offHours;
  return fuel>0 && hours>0 ? {fuel,hours} : null;
}
function fuelSnapshot(config, rows, asOfDate, runningDG) {
  const valid=rows.filter(row=>/^\d{4}-\d{2}-\d{2}$/.test(row.Date || '') && row.Date<=asOfDate).sort((a,b)=>b.Date.localeCompare(a.Date));
  const latest=valid[0];
  const count=Number.isInteger(Number(config.dgCount)) ? Math.max(0,Math.min(4,Number(config.dgCount))) : 0;
  const ids=new Set(Array.from({length:count},(_,i)=>`DG-${i+1}`));
  if (/^DG-[1-4]$/.test(runningDG || '')) ids.add(runningDG);
  for (const key of Object.keys(latest || {})) {const match=/^(DG-[1-4]) Fuel Closing$/.exec(key);if(match && numeric(latest[key])!==null) ids.add(match[1]);}
  const generators=[...ids].sort().map(dg=>{
    const dayLitres=numeric(latest?.[`${dg} Fuel Closing`]);
    const savedExternal=numeric(latest?.[`${dg} External Fuel Stock`]);
    const externalLitres=savedExternal ?? (numeric(config.dgConfigs?.[dg]?.externalTankLtrs)===0 ? 0 : null);
    let fuel=0,hours=0;
    for (const row of valid) {const sample=consumption(row,dg);if(sample){fuel+=sample.fuel;hours+=sample.hours;}}
    const actual=hours>0 ? fuel/hours : null;
    const design=numeric(config.designCph?.[dg]);
    const litresPerHour=actual ?? (design>0 ? design : null);
    const total=dayLitres!==null && externalLitres!==null ? dayLitres+externalLitres : null;
    return {dg,dayLitres,externalLitres,litresPerHour,rateSource:actual!==null?'Recorded on-load':design>0?'Design':'Unavailable',
      backupHours:total!==null && litresPerHour>0 ? total/litresPerHour : null};
  });
  return {stockDate:latest?.Date || null,asOfDate,generators};
}
async function loadFuelSnapshot(db, run, phase, siteId) {
  const at=phase==='start'?run.startAtMs:run.endAtMs;
  const date=Number.isFinite(at) && at>0 ? istDate(at) : run.date;
  const name=typeof run.siteName==='string' ? run.siteName.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !name || name.includes('/')) return fuelSnapshot({},[],date || '',run.dgNumber);
  // Daily DG Logs use the site name; Site Config uses its uppercase key.
  const config=(await db.doc(`siteConfigs/${name.toUpperCase()}`).get()).data() || {};
  const previous=new Date(`${date.slice(0,7)}-01T12:00:00Z`);previous.setUTCMonth(previous.getUTCMonth()-1);
  const months=[date.slice(0,7),previous.toISOString().slice(0,7)];
  const snapshots=await Promise.all(months.map(month=>db.collection(`dailyDGLogs/${name}/${month}`).get()));
  const rows=snapshots.flatMap(snapshot=>snapshot.docs.map(doc=>({...doc.data(),Date:doc.data().Date || doc.id})));
  return fuelSnapshot(config,rows,date,run.dgNumber);
}
module.exports={numeric,consumption,fuelSnapshot,loadFuelSnapshot};
