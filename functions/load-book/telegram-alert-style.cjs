const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const themes = {
  energy_dg_start: {icon:'🔴',title:'DG START · EB → DG',stripe:'🟥',file:'telegram-dg-start.png'},
  energy_mains_restored: {icon:'🟢',title:'EB RESTORED · DG → EB',stripe:'🟩',file:'telegram-eb-restored.png'},
};
function alertTheme(actionType, notification = {}) {
  if (['energy_meter_update','energy_daily_kwh'].includes(actionType)) {
    const state=['live','retry','offline'].includes(notification.meterState) ? notification.meterState : /live/i.test(notification.readingState || '') ? 'live' : /error|stale|offline/i.test(notification.readingState || '') ? 'offline' : 'retry';
    const colors={live:{icon:'🟢',stripe:'🟩',label:'LIVE'},retry:{icon:'🟠',stripe:'🟧',label:'RETRY / WAITING'},offline:{icon:'🔴',stripe:'🟥',label:'OFFLINE'}};
    const color=colors[state];
    return {...color,meter:true,title:`${actionType==='energy_daily_kwh' ? 'DAILY kWh' : 'METER UPDATE'} · ${color.label}`,file:`telegram-meter-${state}.png`};
  }
  return themes[actionType] || null;
}
function alertHeader(actionType, notification) {
  const theme=alertTheme(actionType, notification);
  return theme ? {filename:theme.file,bytes:readFileSync(join(__dirname,'assets',theme.file))} : null;
}
module.exports={alertTheme,alertHeader};
