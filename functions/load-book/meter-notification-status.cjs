function meterNotificationStatus(meter, now = Date.now()) {
  const at=meter?.observedAt?.toMillis?.();
  const valid=typeof at==='number' && Number.isFinite(at) && at>0 && at<=now+5000;
  const staleAfter=Math.max(30,(Number(meter?.uploadIntervalSeconds)||10)*3)*1000;
  const status=String(meter?.status || '').toLowerCase();
  const communication=String(meter?.communicationState || '').toLowerCase();
  let meterState,readingState;
  if (!meter || /offline|disconnected/.test(communication+' '+status)) {meterState='offline';readingState='Offline';}
  else if (valid && now-at>staleAfter) {meterState='offline';readingState='Stale reading';}
  else if (/retry|reconnect|connecting/.test(communication+' '+status)) {meterState='retry';readingState='Retrying';}
  else if (status && status!=='ok') {meterState='offline';readingState='Meter error';}
  else if (!valid) {meterState='retry';readingState='Timestamp unavailable';}
  else if (status==='ok') {meterState='live';readingState='Live';}
  else {meterState='retry';readingState='Waiting for data';}
  return {meterState,readingState,statusObservedAtMs:valid?at:null,statusAssessedAtMs:now};
}
const meterStatusIcon = state => ({live:'🟢',retry:'🟠',offline:'🔴'})[state] || '🟠';
module.exports={meterNotificationStatus,meterStatusIcon};
