/** @jest-environment node */
import {applyActivityChartTheme} from './activityChartTheme';
const {_createResolver,_attachContext}=require('chart.js/helpers');
test('updates chart text and grid colors without changing activity datasets',()=>{
  const data={datasets:[{data:[1,2],backgroundColor:['green','red']}]};
  const chart={data,options:{plugins:{legend:{labels:{boxWidth:10}},title:{text:'Site performance'}},scales:{x:{ticks:{maxRotation:0}},y:{beginAtZero:true}}},update:jest.fn()};
  chart.config={options:chart.options};
  applyActivityChartTheme(chart,{text:'#eee',muted:'#aaa',border:'#333'});
  expect(chart.options.plugins.title).toEqual({text:'Site performance',color:'#eee'});
  expect(chart.options.plugins.legend.labels).toEqual({boxWidth:10,color:'#aaa'});
  expect(chart.options.scales.y.beginAtZero).toBe(true);
  expect(chart.options.scales.x.ticks).toEqual({maxRotation:0,color:'#aaa'});
  expect(chart.data).toBe(data);expect(chart.update).toHaveBeenCalledWith('none');
});

test('real Chart.js option resolvers remain readable across repeated theme changes',()=>{
  const raw={plugins:{title:{display:true,text:'Activity trend'},legend:{labels:{boxWidth:10}}},scales:{y:{ticks:{precision:0},grid:{display:true}}}};
  const plugins=raw.plugins, ticks=raw.scales.y.ticks;
  const chart={config:{options:raw},options:_attachContext(_createResolver([raw]),{}),update:jest.fn()};
  // Chart.update rebuilds its cached option resolvers from config.options.
  chart.update.mockImplementation(()=>{chart.options=_attachContext(_createResolver([raw]),{});});
  for(const text of ['#eeeeee','#111111','#eeeeee']) {
    expect(()=>applyActivityChartTheme(chart,{text,muted:text,border:'#888888'})).not.toThrow();
    expect(chart.options.plugins.title.color).toBe(text);
    expect(chart.options.scales.y.ticks.color).toBe(text);
  }
  expect(raw.plugins).toBe(plugins);expect(raw.scales.y.ticks).toBe(ticks);
  expect(chart.update).toHaveBeenCalledTimes(3);
});

test('disabled legend/plugins remain disabled and missing defaults are initialized',()=>{
  for(const plugins of [false,{legend:false},undefined]) {
    const chart={config:{options:{plugins}},update:jest.fn()};
    applyActivityChartTheme(chart,{text:'white',muted:'gray',border:'black'});
    if(plugins === false) expect(chart.config.options.plugins).toBe(false);
    else if(plugins?.legend === false) expect(chart.config.options.plugins.legend).toBe(false);
    else expect(chart.config.options.plugins.legend.labels.color).toBe('gray');
  }
});
