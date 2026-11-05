// Recover today's completed Asansol server runs into the existing pending history.
// Uses signed-in Firebase CLI credentials; does not send notifications.
const path=require('node:path');
const {serverRunHistoryEntry}=require('../functions/load-book/server-run-history.cjs');
const {istDate}=require('../functions/load-book/meter-history.cjs');
const load=name=>require(path.join(process.env.FIREBASE_TOOLS_LIB,name));
const decode=v=>'mapValue'in v?Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,decode(x)])):'integerValue'in v?Number(v.integerValue):'doubleValue'in v?v.doubleValue:'booleanValue'in v?v.booleanValue:'nullValue'in v?null:v.stringValue??v.timestampValue;
const fields=d=>Object.fromEntries(Object.entries(d.fields||{}).map(([k,v])=>[k,decode(v)]));
const encode=v=>v===null?{nullValue:null}:typeof v==='boolean'?{booleanValue:v}:typeof v==='number'?{integerValue:String(v)}:{stringValue:v};
async function main(){
 const project='wb-airtelmscs',siteId='N19106A',date=istDate(Date.now()),apply=process.argv[2]==='apply';
 const account=load('auth').getProjectDefaultAccount(process.cwd())||load('auth').getGlobalDefaultAccount();
 await load('requireAuth').requireAuth({project,...account});
 const client=new(load('apiv2').Client)({urlPrefix:'https://firestore.googleapis.com',apiVersion:'v1'});
 const root=`projects/${project}/databases/(default)/documents`;
 const list=async relative=>{
  const docs=[];let pageToken;
  do {const response=await client.get(`/${root}/${relative}`,{queryParams:{pageSize:1000,...(pageToken?{pageToken}:{})}});docs.push(...(response.body.documents||[]));pageToken=response.body.nextPageToken;}while(pageToken);
  return docs;
 };
 const sources=await list(`energyMonitor/${siteId}/serverChangeovers`);
 const histories=await list('dgRunLogs/Asansol/entries');
 const results=[];
 for(const source of sources){
  const run=fields(source),runId=source.name.split('/').at(-1);
  const entry=serverRunHistoryEntry(run,siteId,runId);
  if(!entry||entry.date!==date||run.historyEntryId)continue;
  const id=`server-${runId}`,target=`${root}/dgRunLogs/Asansol/entries/${id}`;
  const existing=histories.find(d=>d.name===target)||histories.find(d=>{const r=fields(d);return r.date===entry.date&&r.dgNumber===entry.dgNumber&&r.startTime===entry.startTime&&r.endTime===entry.endTime;});
  const linkedId=existing?existing.name.split('/').at(-1):id;
  if(apply){
   const writes=[];
   if(!existing)writes.push({update:{name:target,fields:Object.fromEntries(Object.entries(entry).map(([k,v])=>[k,encode(v)]))},currentDocument:{exists:false},updateTransforms:[{fieldPath:'createdAt',setToServerValue:'REQUEST_TIME'}]});
   else writes.push({verify:existing.name,currentDocument:{updateTime:existing.updateTime}});
   writes.push({update:{name:source.name,fields:{historyEntryId:{stringValue:linkedId}}},updateMask:{fieldPaths:['historyEntryId']},currentDocument:{updateTime:source.updateTime},updateTransforms:[{fieldPath:'historyLinkedAt',setToServerValue:'REQUEST_TIME'}]});
   await client.post(`/${root}:commit`,{writes});
  }
  results.push({runId,historyEntryId:linkedId,date:entry.date,startTime:entry.startTime,endTime:entry.endTime,runSeconds:entry.runSeconds,action:existing?'link-existing':'create-pending',applied:apply});
 }
 const verifiedHistory=histories.map(fields).filter(r=>r.source==='server-power-switch'&&r.date===date).map(r=>({serverRunId:r.serverRunId,date:r.date,startTime:r.startTime,endTime:r.endTime,runSeconds:r.runSeconds,dgLogAdded:r.dgLogAdded}));
 console.log(JSON.stringify({project,siteId,date,results,verifiedHistory},null,2));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
