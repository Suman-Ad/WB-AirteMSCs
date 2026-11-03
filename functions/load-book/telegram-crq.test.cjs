const {test} = require('node:test');
const assert = require('node:assert/strict');
const {imageRows, updateCrqs} = require('./telegram-crq.cjs');
const vm = require('node:vm');
const fs = require('node:fs');

function importer(fetch, logs) {
  const module = {exports:{}};
  vm.runInNewContext(fs.readFileSync(__dirname + '/telegram-crq.cjs','utf8'), {
    module, Buffer, AbortSignal, fetch,
    console:{warn:(...args)=>logs.push(args)},
    require:name=>name === 'firebase-admin/app' ? {getApp:()=>({options:{credential:{getAccessToken:async()=>({access_token:'private-access'})}}})} : require(name)
  });
  return module.exports.importImage;
}

test('reports safe Vision service-disabled diagnostics without exposing secrets', async()=>{
  const app=harness([{...row}]);const logs=[];
  const run=importer(async url=>url.startsWith('https://api.telegram.org/file/')
    ? {ok:true,status:200,body:(async function*(){yield Buffer.from('image');})()}
    : {ok:false,status:403,json:async()=>({error:{code:403,message:'private-access sensitive URL',details:[{reason:'SERVICE_DISABLED'}]}})},logs);
  const reply=await run(app.db,'42',{photo:[{file_id:'file'}]},async()=>({file_path:'photos/a.jpg'}),'private-bot');
  assert.match(reply,/vision\/403\/SERVICE_DISABLED/);
  assert.match(reply,/Enable Cloud Vision API/);
  assert.doesNotMatch(JSON.stringify([reply,logs]),/private-access|private-bot|sensitive URL/);
  assert.equal(app.writes.length,0);
});

test('distinguishes database failures from Vision failures after successful OCR', async()=>{
  const app=harness([{...row}]);const logs=[];
  app.db.runTransaction=async()=>{const error=new Error('secret details');error.code=9;throw error;};
  const run=importer(async url=>url.startsWith('https://api.telegram.org/file/')
    ? {ok:true,status:200,body:(async function*(){yield Buffer.from('image');})()}
    : {ok:true,status:200,json:async()=>({responses:[{textAnnotations:[{}, {description:'13-Nov-26 Asansol MSC BMS HONEYWELL OEM PM ACTIVITY CRQ123456',boundingPoly:{vertices:[{x:0,y:0},{x:100,y:10}]}}]}]})},logs);
  const reply=await run(app.db,'42',{photo:[{file_id:'file'}]},async()=>({file_path:'a.jpg'}),'private-bot');
  assert.match(reply,/database\/9/);
  assert.match(reply,/database operation failed/);
  assert.doesNotMatch(JSON.stringify([reply,logs]),/secret details|private-bot/);
});

function harness(rows, role = 'Super User') {
  const records = {
    'telegramChats/42':{uid:'u'}, 'users/u':{role,isActive:true,siteId:'N19106A'},
    'notificationPreferences/u':{telegramEnabled:true,telegramChatId:'42'},
    sheet:{date:'2026-11-13',siteId:'N19106A',rows}
  };
  const writes = [];
  const snap = path => ({id:path,ref:{path},data:()=>structuredClone(records[path])});
  const db = {doc:path=>({path,get:async()=>snap(path)}), collection:()=>({where:(_f,_op,date)=>({date})}),runTransaction:async fn=>fn({
    get:async ref=>ref.path ? snap(ref.path) : {docs:ref.date === records.sheet.date ? [snap('sheet')] : []},
    update:(ref,data)=>{writes.push(data);records[ref.path]={...records[ref.path],...data};}
  })};
  return {db,records,writes};
}
const row = {rowId:'stable',nodeName:'BMS',activityDetails:'HONEYWELL OEM PM ACTIVITY',crqNo:'CRQ00000',pmStatus:'Pending',notes:'keep'};
const input = crq => ({date:'2026-11-13',text:'ASANSOLMSCBMSHONEYWELLOEMPMACTIVITYMINOR',crqs:[crq]});
test('combines CRQs in one existing row, preserves fields and is idempotent', async()=>{
  const app = harness([{...row}]);
  const inputs = [input('CRQ000007241779'),input('CRQ000007241989'),input('CRQ000007241779')];
  assert.match(await updateCrqs(app.db,'42',inputs), /1 existing activity row/);
  assert.deepEqual(app.records.sheet.rows,[{...row,crqNo:'CRQ000007241779, CRQ000007241989'}]);
  assert.deepEqual(Object.keys(app.writes[0]),['rows']);
  await updateCrqs(app.db,'42',inputs);
  assert.equal(app.writes.length,1);
});

test('imports ISO dates and exported siteId/category columns from the reported image layout', async()=>{
  const word=(description,x,y)=>({description,boundingPoly:{vertices:[{x,y},{x:x+30,y},{x:x+30,y:y+12},{x,y:y+12}]}});
  const annotation={textAnnotations:[{description:'all'},
    word('2026 - 11 - 03',80,40),word('Asansol',210,40),word('N19106A',330,40),word('Critical',440,40),word('SMPS BB',600,40),word('SMPS BB Preventive Maintenance(In-House)',750,40),word('10nos Amararaja and 1nos HBL In-House PM Activity',1200,40),word('CRQ000007235311',1740,40),
    word('2026-11-03',80,70),word('Asansol',210,70),word('N19106A',330,70),word('Critical',440,70),word('SMPS',600,70),word('SMPS Preventive maintenance (In House)',750,70),word('3nos SMPS-2 to SMPS-4 In-House PM Activity',1200,70),word('CRQ 000007235311',1740,70)]};
  const inputs=imageRows(annotation);
  assert.equal(inputs.length,2);
  assert.equal(inputs[0].date,'2026-11-03');
  const savedRows=[{...row,nodeName:'SMPS BB',activityDetails:'SMPS BB Preventive Maintenance(In-House)'},{...row,nodeName:'SMPS',activityDetails:'SMPS Preventive maintenance (In House)'}];
  const app=harness(savedRows);
  app.records.sheet.date='2026-11-03';
  assert.match(await updateCrqs(app.db,'42',inputs),/2 existing activity row\(s\) updated/);
  assert.deepEqual(app.records.sheet.rows,savedRows.map(r=>({...r,crqNo:'CRQ000007235311'})));
  const wrongSite=harness(savedRows);wrongSite.records.sheet.date='2026-11-03';
  await updateCrqs(wrongSite.db,'42',inputs.map(r=>({...r,text:r.text.replace('N19106A','N19103A')})));
  assert.equal(wrongSite.writes.length,0);
});

test('invalid calendar dates do not import',()=>{
  const make=text=>({textAnnotations:[{}, {description:text,boundingPoly:{vertices:[{x:0,y:0},{x:100,y:0},{x:100,y:10},{x:0,y:10}]}}]});
  for (const date of ['2026-02-30','2026-13-03','31-Nov-26']) assert.deepEqual(imageRows(make(`${date} Asansol BMS CRQ123456`)),[]);
});
test('skips duplicate database matches, other sites, dates and unauthorized roles', async()=>{
  for (const change of [a=>a.records.sheet.rows.push({...row}),a=>a.records.sheet.siteId='other',a=>a.records.sheet.date='2026-11-14',a=>a.records['users/u'].role='User',a=>a.records['users/u'].isActive=false,a=>a.records['notificationPreferences/u'].telegramEnabled=false]) {
    const app=harness([{...row}]);change(app);
    await updateCrqs(app.db,'42',[input('CRQ123456')]);
    assert.equal(app.writes.length,0);
  }
});

test('paused CRQ imports never modify site sheets',async()=>{
  const app=harness([{...row}]);
  app.records['energyMonitor/N19106A/config/notifications']={telegramCrqImportEnabled:false};
  assert.match(await updateCrqs(app.db,'42',[input('CRQ123456')]),/paused image row/);
  assert.equal(app.writes.length,0);
});
test('reconstructs table rows from column-ordered OCR words',()=>{
  const word=(description,x,y)=>({description,boundingPoly:{vertices:[{x,y},{x:x+30,y},{x:x+30,y:y+10},{x,y:y+10}]}});
  const result=imageRows({textAnnotations:[{description:'all'},word('13-Nov-26',40,40),word('13-Nov-26',40,60),word('Asansol MSC',110,40),word('BMS HONEYWELL OEM PM ACTIVITY',200,40),word('CRQ000007241779',900,40),word('Asansol MSC',110,60),word('BMS HONEYWELL OEM PM ACTIVITY',200,60),word('CRQ000007241989',900,60)]});
  assert.equal(result.length,2);
  assert.equal(result[0].date,'2026-11-13');
  assert.deepEqual(result[1].crqs,['CRQ000007241989']);
});
