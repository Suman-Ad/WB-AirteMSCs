const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {serverRunHistoryEntry}=require('./server-run-history.cjs');
const run={siteId:'N19106A',status:'Completed',dgNumber:'DG-1',startAtMs:Date.parse('2026-11-04T20:11:20+05:30'),endAtMs:Date.parse('2026-11-04T20:18:28+05:30')};
function setup() {
 const source='energyMonitor/N19106A/serverChangeovers/r';
 const records=new Map([[source,{...run}]]);
 const snap=path=>({exists:records.has(path),data:()=>records.get(path)});
 const db={doc:path=>({path}),runTransaction:async fn=>{
   const staged=[];
   await fn({get:async ref=>snap(ref.path),create:(ref,data)=>{assert.ok(!records.has(ref.path));staged.push([ref.path,data]);},set:(ref,data)=>staged.push([ref.path,{...records.get(ref.path),...data}])});
   staged.forEach(([path,data])=>records.set(path,data));
 }};
 const exports={};
 vm.runInNewContext(fs.readFileSync(__dirname+'/server-run-history-functions.cjs','utf8'),{exports,require:name=>({
  'firebase-functions/v2/firestore':{onDocumentWritten:(options,fn)=>{assert.equal(options.retry,true);return fn;}},
  'firebase-admin/firestore':{getFirestore:()=>db,FieldValue:{serverTimestamp:()=> 'server-time'}},
  './server-run-history.cjs':{serverRunHistoryEntry}
 })[name]});
 return {records,source,send:()=>exports.syncServerDGRunHistory({params:{siteId:'N19106A',runId:'r'},data:{after:{exists:true,data:()=>records.get(source)}}})};
}
test('completed run uses the existing pending DG history schema and original IST times',()=>{
 const entry=serverRunHistoryEntry(run,'N19106A','r');
 assert.equal(entry.site,'Asansol');assert.equal(entry.date,'2026-11-04');
 assert.equal(entry.startTime,'20:11');assert.equal(entry.endTime,'20:18');assert.equal(entry.runSeconds,428);
 assert.equal(entry.dgLogAdded,false);assert.equal(entry.serverRunId,'r');
});
test('cross-midnight run preserves start date, end date and elapsed duration',()=>{
 const entry=serverRunHistoryEntry({...run,startAtMs:Date.parse('2026-11-04T23:55:00+05:30'),endAtMs:Date.parse('2026-11-05T00:10:00+05:30')},'N19106A','r');
 assert.equal(entry.date,'2026-11-04');assert.equal(entry.endDate,'2026-11-05');assert.equal(entry.runSeconds,900);
});
test('retry and source-link events create one history row without resetting user completion',async()=>{
 const app=setup();await app.send();
 const path='dgRunLogs/Asansol/entries/server-r';assert.equal(app.records.get(path).dgLogAdded,false);
 app.records.get(path).dgLogAdded=true;app.records.get(path).dgLogId='saved-log';await app.send();
 assert.equal(app.records.size,2);assert.equal(app.records.get(path).dgLogId,'saved-log');
 app.records.get(app.source).historyEntryId=null;await app.send();assert.equal(app.records.get(path).dgLogAdded,true);
});
test('running, deleted and invalid runs do not produce fabricated entries',async()=>{
 const app=setup();app.records.get(app.source).status='Running';await app.send();assert.equal(app.records.size,1);
 for(const patch of [{startAtMs:null},{endAtMs:1},{dgNumber:'bad'},{siteId:'other'}])assert.equal(serverRunHistoryEntry({...run,...patch},'N19106A','r'),null);
});
