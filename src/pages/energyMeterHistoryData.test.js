/** @jest-environment node */
import { historyDates, historyMeterKey, meterDailyRows, reportMeters, validHistoryDate } from "./energyMeterHistoryData";
const key=historyMeterKey({id:'m1',name:'Main'});
test('seven daily rows carry the previous closing, preserve zero and leave missing days empty',()=>{
 const rows=meterDailyRows(key,[{meterKey:key,date:'2026-10-24',closingKwh:0},{meterKey:key,date:'2026-10-25',openingKwh:99,closingKwh:5},{meterKey:key,date:'2026-10-27',openingKwh:20,closingKwh:25,openingSource:'first-captured-reading'}],'2026-10-31');
 expect(rows).toHaveLength(7);expect(rows[0]).toMatchObject({date:'2026-10-25',opening:0,closing:5,usage:5,carried:true});
 expect(rows[1]).toMatchObject({opening:5,closing:null,usage:null,record:undefined});
 expect(rows[2]).toMatchObject({opening:20,closing:25,usage:5,carried:false});
 expect(rows[2].quality).toContain('previous day unavailable');
 expect(rows[3]).toMatchObject({opening:25,closing:null,usage:null});
 expect(rows[4]).toMatchObject({opening:null,closing:null,usage:null});
});
test('preserves saved carried opening when retention removed the previous document, and never counts resets',()=>{
 const rows=meterDailyRows(key,[{meterKey:key,date:'2026-10-25',openingKwh:100,closingKwh:105,openingSource:'previous-day-closing'},{meterKey:key,date:'2026-10-26',openingKwh:105,closingKwh:2,counterReset:true},{meterKey:key,date:'2026-10-27',openingKwh:2,closingKwh:110,counterReset:true}],'2026-10-31');
 expect(rows[0]).toMatchObject({opening:100,usage:5,carried:true});expect(rows[1].usage).toBeNull();expect(rows[2].usage).toBeNull();
});
test('live equipment uses stable identity and retained meter history uses latest saved name and id',()=>{
 expect(historyMeterKey({name:'LT Panel - 01',id:'old'})).toBe(historyMeterKey({name:'lt panel_1',id:'new'}));
 const meters=reportMeters([{name:'Main',id:'new'}],[{date:'2026-10-25',meterKey:key,meterId:'old',meterName:'Main old'},{date:'2026-10-30',meterKey:'retired',meterId:'newer',meterName:'New label'},{date:'2026-10-26',meterKey:'retired',meterId:'older',meterName:'Old label'},{}],'2026-10-31');
 expect(meters).toHaveLength(2);expect(meters[0].meterId).toBe('new');expect(meters[1].meterId).toBe('newer');
});
test('dates are calendar-valid and seven-day ranges cross month and leap boundaries',()=>{
 for(const date of ['', 'bad','2026-99-99','2026-02-30'])expect(validHistoryDate(date)).toBe(false);
 expect(validHistoryDate('2024-02-29')).toBe(true);expect(historyDates('2026-11-01')[0]).toBe('2026-10-26');
});
