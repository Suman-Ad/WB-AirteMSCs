const {test}=require('node:test');
const assert=require('node:assert/strict');
const {reportDate,dailyNotification,dailyId}=require('./energy-daily-notifications.cjs');
const date='2026-11-01', at=t=>Date.parse(`${date}T${t}:00+05:30`);
const daily={date,meterId:'m',meterName:'Main',openingKwh:100,closingKwh:125,firstAtMs:at('00:01'),lastAtMs:at('23:59'),openingSource:'first-captured-reading'};
const notice=(data=daily,previous)=>dailyNotification(data,previous,{id:'m'},'A','Site A',date);
test('report date is previous IST day and scheduled time survives late retries',()=>{
 assert.equal(reportDate('2026-11-01T18:30:00Z',Date.parse('2026-11-04T00:00:00Z')),date);
 assert.equal(reportDate(undefined,Date.parse('2026-11-02T00:00:00+05:30')),date);
 assert.equal(reportDate('2026-12-31T18:30:00Z',0),'2026-12-31');
});
test('reports opening, closing and recorded consumption with observation times',()=>{
 const n=notice();assert.match(n.message,/Opening: 100 kWh/);assert.match(n.message,/Closing: 125 kWh/);assert.match(n.message,/Recorded consumption: 25 kWh/);
 assert.equal(n.incompleteCoverage,false);assert.equal(n.url,'/energy-monitor');assert.equal(n.date,date);
});
test('counter resets and decreases never produce negative consumption',()=>{
 for(const data of [{...daily,counterReset:true},{...daily,closingKwh:50}]){const n=notice(data);assert.equal(n.counterReset,true);assert.match(n.message,/consumption: Unavailable/);}
});
test('missing, wrong-day, partial and carried-old readings are clearly labeled',()=>{
 for(const data of [undefined,{...daily,date:'2026-10-31'},{...daily,firstAtMs:at('08:00')},{...daily,lastAtMs:at('18:00')}]) assert.equal(notice(data===undefined?null:data).incompleteCoverage,true);
 const carried=notice({...daily,openingSource:'previous-day-closing'},{date:'2026-10-31',lastAtMs:Date.parse('2026-10-31T12:00:00+05:30')});
 assert.equal(carried.incompleteCoverage,true);assert.match(carried.message,/previous-day closing/);
});
test('daily identity is stable and distinguishes site, meter and day',()=>{
 const id=dailyId('A','m',date);assert.equal(id,dailyId('A','m',date));for(const args of [['B','m',date],['A','n',date],['A','m','2026-11-02']])assert.notEqual(id,dailyId(...args));
});
