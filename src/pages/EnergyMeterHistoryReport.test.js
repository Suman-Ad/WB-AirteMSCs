/** @jest-environment node */
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import EnergyMeterHistoryReport from './EnergyMeterHistoryReport';
import {historyMeterKey} from './energyMeterHistoryData';
import {useMeterDailyHistory,useMeterHistorySettings,useMeterSamples} from '../hooks/useMeterHistory';
jest.mock('../firebase',()=>({db:{}}));
jest.mock('firebase/firestore',()=>({doc:jest.fn(),setDoc:jest.fn(),serverTimestamp:jest.fn()}));
jest.mock('../hooks/useMeterHistory',()=>({useMeterDailyHistory:jest.fn(),useMeterHistorySettings:jest.fn(),useMeterSamples:jest.fn()}));
const meter={id:'meter-1',name:'Main'};
const render=userData=>renderToStaticMarkup(<EnergyMeterHistoryReport siteId="site" date="2026-10-31" meters={[meter]} userData={userData}/>);
beforeEach(()=>{
 useMeterDailyHistory.mockReturnValue({records:[{meterKey:historyMeterKey(meter),date:'2026-10-30',closingKwh:0},{meterKey:historyMeterKey(meter),date:'2026-10-31',openingKwh:99,closingKwh:12,openingSource:'previous-day-closing',firstAtMs:Date.parse('2026-10-31T00:01:00+05:30'),lastAtMs:Date.parse('2026-10-31T23:59:00+05:30')}],loading:false,cached:false,error:''});
 useMeterHistorySettings.mockReturnValue({settings:{enabled:true,retentionDays:30},loading:false,cached:false,error:''});
 useMeterSamples.mockReturnValue({records:[{id:'s',meterName:'Main',meterId:'meter-1',kwh:12,observedAtMs:Date.parse('2026-10-31T12:00:00+05:30'),powerUnits:'base',readings:{active_power:2500,R_current:0,power_factor:.95}}],loading:false,cached:false,error:''});
});
test('renders per-meter seven-day tables and sampled live readings without writing them',()=>{
 const html=render({role:'User',uid:'u'});
 expect(html).toContain('Live meter daily opening / closing');expect(html).toContain('Last 7 days');expect(html).toContain('2/7 days captured');expect(html).toContain('Previous day closing');expect(html).toContain('<td>2.5</td>');expect(html).toContain('Inspect readings');expect(html).not.toContain('Save backup settings');
 expect(useMeterSamples).toHaveBeenCalledWith('site',historyMeterKey(meter),'2026-10-31');
});
test('administrators get a 7-to-365-day retention control that is disabled when cached',()=>{
 let html=render({role:'Admin',uid:'admin'});expect(html).toContain('Save backup settings');expect(html).toContain('min="7" max="365"');expect(html).toContain('value="30"');
 useMeterHistorySettings.mockReturnValue({settings:{enabled:false,retentionDays:7},loading:false,cached:true,error:''});html=render({role:'Admin',uid:'admin'});expect(html).toContain('<fieldset disabled=""');expect(html).toContain('Automatic backup paused');
});
test('read failures and pending results do not claim an empty backup history',()=>{
 useMeterDailyHistory.mockReturnValue({records:[],loading:false,cached:false,error:'Permission denied'});
 const html=render({role:'User'});expect(html).toContain('Permission denied');expect(html).not.toContain('No meter daily backups are saved');
});
