const {test}=require('node:test');
const assert=require('node:assert/strict');
const {numeric,fuelSnapshot,loadFuelSnapshot}=require('./energy-changeover-fuel.cjs');
const {changeoverNotification}=require('./energy-changeover-notifications.cjs');
const date='2026-11-02';
const config={dgCount:2,designCph:{'DG-2':20}};
const row={Date:'2026-11-01','DG-1 Fuel Opening':'500','DG-1 Fuel Closing':'400','DG-1 Fuel Filling':'0','DG-1 Hour Opening':'100','DG-1 Hour Closing':'102','DG-1 Off Load Fuel Consumption':'20','DG-1 Off Load Hour':'0.5','DG-1 External Fuel Stock':'600','DG-2 Fuel Closing':'100','DG-2 External Fuel Stock':'300'};
test('each DG uses its own tanks and weighted on-load CPH, with labeled design fallback',()=>{
 const snapshot=fuelSnapshot(config,[row],date,'DG-1');
 assert.equal(snapshot.stockDate,'2026-11-01');
 const [one,two]=snapshot.generators;
 assert.equal(one.dayLitres,400);assert.equal(one.externalLitres,600);
 assert.equal(one.litresPerHour,80/1.5);assert.equal(one.backupHours,18.75);
 assert.equal(one.rateSource,'Recorded on-load');assert.equal(two.backupHours,20);assert.equal(two.rateSource,'Design');
});
test('future rows are excluded and zero stock differs from missing or invalid stock',()=>{
 const snapshot=fuelSnapshot(config,[row,{...row,Date:'2026-11-03','DG-1 Fuel Closing':9999}],date,'DG-1');
 assert.equal(snapshot.generators[0].dayLitres,400);
 const missing=fuelSnapshot(config,[{Date:date,'DG-1 Fuel Closing':0}],date,'DG-1');
 assert.equal(missing.generators[0].dayLitres,0);assert.equal(missing.generators[0].externalLitres,null);assert.equal(missing.generators[0].backupHours,null);
 for(const value of ['', ' ', 'bad', -1, Infinity, null])assert.equal(numeric(value),null);
 const zero=fuelSnapshot({dgCount:1,designCph:{'DG-1':20},dgConfigs:{'DG-1':{externalTankLtrs:0}}},[{Date:date,'DG-1 Fuel Closing':0}],date,'DG-1');
 assert.equal(zero.generators[0].backupHours,0);
});
test('invalid consumption or zero CPH cannot produce infinite backup',()=>{
 const invalid={...row,'DG-1 Hour Closing':99,'DG-1 Fuel Closing':600};
 const snapshot=fuelSnapshot({dgCount:1,designCph:{'DG-1':0}},[invalid],date,'DG-1');
 assert.equal(snapshot.generators[0].backupHours,null);
});
test('start and restoration messages include each DG and stock date',()=>{
 const fuel=fuelSnapshot(config,[row],date,'DG-1');
 for(const phase of ['start','restore']){
  const message=changeoverNotification({siteName:'Asansol',dgNumber:'DG-1',fuelSnapshot:fuel},phase,'ASL').message;
  assert.match(message,/2026-11-01/);assert.match(message,/not a live tank reading/);
  assert.match(message,/DG-1: Day tank 400 L \| External tank 600 L \| Est. backup 18.75 h/);
  assert.match(message,/DG-2: Day tank 100 L \| External tank 300 L \| Est. backup 20 h/);
 }
});
test('lookup loads the correct site and both months at the month boundary',async()=>{
 const paths=[];
 const db={doc:path=>({get:async()=>{paths.push(path);return {data:()=>config};}}),collection:path=>({get:async()=>{paths.push(path);return {docs:path.endsWith('2026-10')?[{id:'2026-10-31',data:()=>({...row,Date:'2026-10-31'})}]:[]};}})};
 const snapshot=await loadFuelSnapshot(db,{siteName:'Asansol',dgNumber:'DG-1',startAtMs:Date.parse('2026-11-01T00:01:00+05:30')},'start','ASL');
 assert.deepEqual(paths,['siteConfigs/ASANSOL','dailyDGLogs/Asansol/2026-11','dailyDGLogs/Asansol/2026-10']);
 assert.equal(snapshot.stockDate,'2026-10-31');
});


test('server runs resolve the site ID to the name used by fuel logs',async()=>{
 const paths=[];
 const db={doc:path=>({get:async()=>{paths.push(path);return {data:()=>config};}}),collection:path=>({get:async()=>{paths.push(path);return {docs:[{id:date,data:()=>({...row,Date:date})}]};}})};
 const snapshot=await loadFuelSnapshot(db,{dgNumber:'DG-1',startAtMs:Date.parse(date+'T12:00:00+05:30')},'start','N19106A');
 assert.equal(paths[0],'siteConfigs/ASANSOL');assert.ok(paths.includes('dailyDGLogs/Asansol/2026-11'));
 assert.equal(snapshot.generators[0].dayLitres,400);
});
