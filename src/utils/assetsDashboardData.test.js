import {assetRecord,assetCatalogue,filterAssetRecords,assetSummary} from './assetsDashboardData';
const record = (id,values) => assetRecord({id,data:()=>values});

test('search and totals include matching assets beyond the first rendered page', () => {
  const rows=Array.from({length:125},(_,i)=>record(String(i),{
    Region:'East',Circle:'WB',SiteName:i%2 ? 'Asansol':'Globsyn',EquipmentCategory:i%3 ? 'DG':'UPS',EquipmentSerialNumber:`SERIAL-${i}`,Qty:0
  }));
  expect(rows.slice(0,50)).toHaveLength(50);
  expect(filterAssetRecords(rows,'East','WB','','SERIAL-124').map(r=>r.id)).toEqual(['124']);
  const filtered=filterAssetRecords(rows,'East','WB','','');
  expect(filtered).toHaveLength(125);
  expect(assetSummary(filtered).siteCount).toBe(2);
  expect(Object.values(assetSummary(filtered).categoryCounts).reduce((a,b)=>a+b,0)).toBe(125);
  expect(filterAssetRecords(rows,'East','WB','','0').length).toBe(125);
});

test('hierarchical options retain all sites and do not mix regions or circles', () => {
  const rows=[record('one',{Region:'East',Circle:'WB',SiteName:'Asansol'}),record('two',{Region:'East',Circle:'Odisha',SiteName:'Cuttack'}),record('three',{Region:'West',Circle:'Gujarat',SiteName:'Surat'})];
  const catalogue=assetCatalogue(rows);
  expect(catalogue.regions).toEqual(['East','West']);
  expect([...catalogue.circles.get('East')]).toEqual(['WB','Odisha']);
  expect([...catalogue.sites.get('East').get('WB')]).toEqual(['Asansol']);
  expect(filterAssetRecords(rows,'East','WB','Asansol','')).toEqual([rows[0]]);
});

test('search preserves case-insensitive matching across every saved field and tolerates missing categories', () => {
  const row=record('one',{EquipmentMake:'CuMMins',CustomNote:'Needs review',SiteName:'Site A'});
  expect(filterAssetRecords([row],'','','','CUMMINS')).toEqual([row]);
  expect(filterAssetRecords([row],'','','','review')).toEqual([row]);
  expect(filterAssetRecords([row],'','','','missing')).toEqual([]);
  expect(assetSummary([row]).categoryCounts.Unknown).toBe(1);
  expect(assetSummary([record('two',{EquipmentCategory:'__proto__'})]).categoryCounts.__proto__).toBe(1);
});
