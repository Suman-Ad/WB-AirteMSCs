import React from 'react';
import {render,screen} from '@testing-library/react';
import {collection,onSnapshot} from 'firebase/firestore';
import AllSitesDGLogs from './AllSitesDGLogs';
jest.mock('../firebase',()=>({db:{}}));
jest.mock('react-router-dom',()=>({useNavigate:()=>jest.fn()}),{virtual:true});
jest.mock('xlsx',()=>({}));
jest.mock('firebase/firestore',()=>({collection:jest.fn((db,...parts)=>parts.join('/')),onSnapshot:jest.fn()}));
jest.mock('../services/allSitesDGSubscriptions',()=>({configuredDGSitePaths:()=>['Asansol'],siteDataPaths:()=>[],subscribeSiteData:jest.fn(()=>jest.fn())}));
test('live meter section remains usable while monthly logs are still loading',()=>{
 collection.mockImplementation((db,...parts)=>parts.join('/'));
 onSnapshot.mockImplementation((ref,options,next)=>{
  const receive=typeof options==='function' ? options : next;
  if(ref==='siteConfigs') receive({forEach:fn=>fn({id:'ASANSOL',data:()=>({siteName:'Asansol',siteId:'N19106A'})})});
  else if(ref==='energyMonitor/N19106A/meters') receive({docs:[{id:'meter-24',data:()=>({name:'LT Panel - 01',status:'OK',powerUnits:'base',active_power:12500,observedAt:{toMillis:()=>Date.now()}})}],metadata:{fromCache:false}});
  else receive({forEach:()=>{}});
  return jest.fn();
 });
 render(<AllSitesDGLogs userData={{siteId:'N19106A',site:'Asansol',role:'User'}}/>);
 expect(screen.getByRole('heading',{name:'Live Meter Readings · All Sites'})).toBeInTheDocument();
 expect(screen.getByRole('table',{name:'Asansol live meter readings'})).toBeInTheDocument();
 expect(screen.getByText('12.50')).toBeInTheDocument();
 expect(screen.getByText('⏳Loading all site logs…')).toBeInTheDocument();
});
