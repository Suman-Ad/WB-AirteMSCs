/** @jest-environment node */
import { collection, onSnapshot, where, orderBy, limit } from "firebase/firestore";
import { subscribeMeterDailyHistory, subscribeMeterSamples } from "./useMeterHistory";
jest.mock('../firebase',()=>({db:{}}));
jest.mock('firebase/firestore',()=>({collection:jest.fn((db,...path)=>path.join('/')),query:jest.fn(ref=>ref),where:jest.fn(),orderBy:jest.fn(),limit:jest.fn(),onSnapshot:jest.fn(),doc:jest.fn()}));
let listeners;
beforeEach(()=>{jest.clearAllMocks();listeners=[];onSnapshot.mockImplementation((ref,options,next,error)=>{const stop=jest.fn();listeners.push({ref,next,error,stop});return stop;});});
test('daily query includes prior-day anchor and rejects stale callbacks after date/site changes',()=>{
 let state;const stop=subscribeMeterDailyHistory('site-a','2026-11-01',next=>state=next);
 expect(collection).toHaveBeenCalledWith({},'energyMonitor','site-a','dailyReadings');
 expect(where).toHaveBeenCalledWith('date','>=','2026-10-25');expect(where).toHaveBeenCalledWith('date','<=','2026-11-01');
 listeners[0].next({docs:[{id:'saved',data:()=>({date:'2026-11-01',closingKwh:20})}],metadata:{fromCache:false,hasPendingWrites:false}});expect(state.records[0].closingKwh).toBe(20);
 stop();expect(listeners[0].stop).toHaveBeenCalled();
 subscribeMeterDailyHistory('site-b','2026-10-31',next=>state=next);
 listeners[1].next({docs:[],metadata:{fromCache:false}});listeners[0].next({docs:[{id:'stale',data:()=>({})}],metadata:{fromCache:false}});
 expect(state.key).toBe('site-b/2026-10-31');expect(state.records).toHaveLength(0);
});
test('sample history is scoped to one meter and exactly seven IST calendar days',()=>{
 let state;subscribeMeterSamples('site','name%3Amain','2026-11-01',next=>state=next);
 expect(collection).toHaveBeenCalledWith({},'energyMonitor','site','historyMeters','name%3Amain','samples');
 expect(where).toHaveBeenCalledWith('observedAtMs','>=',Date.parse('2026-10-26T00:00:00+05:30'));
 expect(where).toHaveBeenCalledWith('observedAtMs','<',Date.parse('2026-11-02T00:00:00+05:30'));
 expect(orderBy).toHaveBeenCalledWith('observedAtMs','desc');expect(limit).toHaveBeenCalledWith(1000);
 listeners[0].next({docs:[],metadata:{fromCache:true}});expect(state.cached).toBe(true);
 listeners[0].error({});expect(state.loading).toBe(false);expect(state.error).toContain('could not be loaded');
});
test('unassigned meters and invalid dates create no listeners',()=>{
 const receive=jest.fn();subscribeMeterDailyHistory('site','2026-99-99',receive);subscribeMeterSamples('site','','2026-11-01',receive);expect(onSnapshot).not.toHaveBeenCalled();
});
