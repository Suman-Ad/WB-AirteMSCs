function stoppedAt(meter, now) {
 const at=meter?.observedAt?.toMillis?.();
 if(meter?.status !== 'OK' || /offline|disconnected/i.test(meter.communicationState || '') || !Number.isFinite(at) || at<=0 || at>now+5000 || now-at>Math.max(30,(Number(meter.uploadIntervalSeconds)||10)*3)*1000) return null;
 const valid=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
 const phases=['R','Y','B'].map(p=>meter[`${p}_voltage_ll`]);
 const volts=phases.every(valid)?phases:phases.some(v=>v!=null)?null:valid(meter.voltage_ll)?[meter.voltage_ll]:null;
 return volts?.every(v=>v===0)?at:null;
}
function cooldownPatch(run, meter, now, source) {
 if(run.status!=='Completed'||run.cooldownStatus!=='Cooling'||!Number.isFinite(run.cooldownStartAtMs)) return null;
 if(source==='DG') return {cooldownStatus:'Interrupted'};
 if(source!=='EB') return null;
 const at=stoppedAt(meter,now);
 if(at===null||at<run.cooldownStartAtMs) return null;
 return {cooldownStatus:'Completed',cooldownEndAtMs:at,cooldownSeconds:Math.floor((at-run.cooldownStartAtMs)/1000)};
}
module.exports={stoppedAt,cooldownPatch};
