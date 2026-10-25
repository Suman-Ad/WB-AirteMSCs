/** @jest-environment node */
import {currentEnergyMeters} from './currentEnergyMeters';
const now = 1000000;
const meter = (id, time, extra={}) => ({id,name:'LT Panel - 01',status:'OK',observedAt:{toMillis:()=>time},...extra});
test('changed IDs show newest named equipment once and preserve selection through aliases',()=>{
 const result = currentEnergyMeters([meter('meter-24',now-90000),meter('meter-40',now)],now);
 expect(result.meters.map(m=>m.id)).toEqual(['meter-40']);expect(result.aliases['meter-24']).toBe('meter-40');
});
test('stable point identity survives equipment renaming',()=>{
 const result=currentEnergyMeters([meter('old',now-1000,{pointId:'p1'}),meter('new',now,{point_id:'p1',name:'LT renamed'})],now);
 expect(result.meters.map(m=>m.id)).toEqual(['new']);
});
test('different point identities with identical names remain separate; ambiguous unnamed point records remain separate',()=>{
 expect(currentEnergyMeters([meter('a',now,{pointId:'p1'}),meter('b',now,{pointId:'p2'}),meter('c',now)],now).meters).toHaveLength(3);
});
test('new error reading remains visible instead of falling back to old good values',()=>{
 expect(currentEnergyMeters([meter('old',now-1000),meter('new',now,{status:'ERROR'})],now).meters[0].status).toBe('ERROR');
});
test('normalizes label formatting and does not merge separate panel numbers or unnamed meters',()=>{
 const result=currentEnergyMeters([meter('old',now-1000),meter('new',now,{name:' lt panel-1 '}),meter('other',now,{name:'LT Panel-2'}),meter('unnamed1',now,{name:''}),meter('unnamed2',now,{name:''})],now);
 expect(result.meters).toHaveLength(4);
});
test('retires only test-meter and keeps custom IDs alongside numeric IDs',()=>{
 const result=currentEnergyMeters([meter('test-meter',now,{name:'Test'}),meter('meter-2',now,{name:'Main'}),meter('custom-id',now,{name:'Other'})],now);
 expect(result.meters.map(m=>m.id)).toEqual(['custom-id','meter-2']);
 expect(currentEnergyMeters([meter('test-meter',now)],now).meters).toHaveLength(1);
});
test('missing or future timestamps cannot supersede a valid observation',()=>{
 expect(currentEnergyMeters([meter('valid',now),meter('future',now+6000),meter('missing',null)],now).meters[0].id).toBe('valid');
});
