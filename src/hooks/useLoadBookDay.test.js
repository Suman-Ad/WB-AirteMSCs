/** @jest-environment node */
import {onSnapshot, collection} from 'firebase/firestore';
import {istDateKey, shiftDateKey, subscribeLoadBookDay, loadBookKW} from './useLoadBookDay';
jest.mock('../firebase', () => ({db:{}}));
jest.mock('firebase/firestore', () => ({collection:jest.fn((...args) => args.slice(1).join('/')),onSnapshot:jest.fn()}));
let listeners;
beforeEach(() => {listeners=[];jest.clearAllMocks();onSnapshot.mockImplementation((path, options, next, error) => {const stop=jest.fn();listeners.push({path,next,error,stop});return stop;});});
const saved = (date, equipmentId='LT Panel-1') => ({docs:[{id:`entry-${date}`, data:()=>({date,time:'08:00',equipmentType:'LT',equipmentId,powerFactor:'0.95',voltageRY:'415',voltageYB:'415',voltageBR:'415',currentR:'10',currentY:'10',currentB:'10'})}],metadata:{fromCache:false}});
test('opens previous date history at the exact saved Asansol collection',()=>{
 let state;
 const receive = next => {state=next;};
 const stop = subscribeLoadBookDay('N19106A','2026-10-23',receive);
 listeners[0].next({docs:[],metadata:{fromCache:false}});
 stop();
 const stopHistory = subscribeLoadBookDay('N19106A','2026-10-22',receive);
 expect(listeners[0].stop).toHaveBeenCalled();
 expect(collection).toHaveBeenLastCalledWith({},'loadData','N19106A','dailyData','2026-10-22','entries');
 listeners[1].next(saved('2026-10-22'));
 expect(state.data[0].equipmentId).toBe('LT Panel-1');
 expect(state.data[0].date).toBe('2026-10-22');
 listeners[0].next({docs:[],metadata:{fromCache:false}});
 expect(state.data).toHaveLength(1);
 stopHistory();
});
test('reports a failed history read instead of claiming no data',()=>{
 let state; const stop=subscribeLoadBookDay('N19106A','2026-10-22',next=>{state=next;});
 listeners[0].error({message:'Permission denied'});
 expect(state.error).toContain('Permission denied');expect(state.loading).toBe(false);stop();
});
test('identifies cached empty results',()=>{
 let state; const stop=subscribeLoadBookDay('N19106A','2026-10-22',next=>{state=next;});
 listeners[0].next({docs:[],metadata:{fromCache:true}});expect(state.cached).toBe(true);stop();
});
test('keeps date keys stable at midnight and across month boundaries',()=>{
 expect(istDateKey(new Date('2026-10-22T18:30:00Z'))).toBe('2026-10-23');
 expect(shiftDateKey('2026-11-01',-1)).toBe('2026-10-31');
 expect(loadBookKW({equipmentType:'LT',powerFactor:0,voltageRY:415,voltageYB:415,voltageBR:415,currentR:10,currentY:10,currentB:10})).toBe(0);
});
