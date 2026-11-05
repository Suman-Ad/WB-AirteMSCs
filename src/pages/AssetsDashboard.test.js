import React, {useState} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import AssetsDashboard from './AssetsDashboard';
import {assetRecord} from '../utils/assetsDashboardData';

jest.mock('react',()=>{const actual=jest.requireActual('react');return {...actual,useState:jest.fn(actual.useState)};});
jest.mock('../firebase',()=>({db:{}}));
jest.mock('firebase/firestore',()=>({doc:jest.fn(),getDoc:jest.fn(),setDoc:jest.fn(),collection:jest.fn(),onSnapshot:jest.fn()}));
jest.mock('chart.js',()=>({Chart:{register:jest.fn()}}));
jest.mock('react-chartjs-2',()=>({Bar:({data})=> <div data-chart-total={data.datasets[0].data.reduce((a,b)=>a+b,0)} /> }));
jest.mock('react-router-dom',()=>({Link:({children})=><div>{children}</div>}),{virtual:true});

test('dashboard mounts only 50 rows while its chart and summary cover all 125 assets',()=>{
  const records=Array.from({length:125},(_,i)=>assetRecord({id:String(i),data:()=>({UniqueID:`ASSET-${i}`,Region:'East',Circle:'WB',SiteName:'Asansol',EquipmentCategory:'DG',Qty:0})}));
  const actualUseState=jest.requireActual('react').useState;
  useState.mockImplementation(actualUseState);
  useState.mockImplementationOnce(() => actualUseState(records));
  try {
    const view=renderToStaticMarkup(<AssetsDashboard userData={{}} />);
    expect((view.match(/<tr>/g)||[])).toHaveLength(51); // Header plus one page.
    expect(view).toContain('data-chart-total="125"');
    expect(view).toContain('1–50 of 125 assets');
    expect(view).toContain('Page 1 of 3');
    expect(view).toContain('ASSET-49');
    expect(view).not.toContain('ASSET-50');
    expect(view).toContain('<td>0</td>');
  } finally { useState.mockImplementation(actualUseState); }
});
