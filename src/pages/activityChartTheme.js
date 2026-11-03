export function applyActivityChartTheme(chart, {text, muted, border}) {
  // chart.options contains Chart.js resolver proxies. Assigning those proxies
  // back into their own source creates recursive setters. Edit raw config only.
  const options=chart.config.options;
  options.color=text;
  if (!options.plugins) {
    if (options.plugins !== false) options.plugins={};
  }
  for(const name of ['title','subtitle']) {
    if(options.plugins?.[name] && typeof options.plugins[name] === 'object') options.plugins[name].color=text;
  }
  if(options.plugins && options.plugins.legend !== false) {
    if (!options.plugins.legend) options.plugins.legend={};
    if (!options.plugins.legend.labels) options.plugins.legend.labels={};
    options.plugins.legend.labels.color=muted;
  }
  for(const scale of Object.values(options.scales || {})) {
    if (!scale.ticks) scale.ticks={};
    if (!scale.grid) scale.grid={};
    scale.ticks.color=muted;
    scale.grid.color=border;
    if(scale.title) scale.title.color=muted;
  }
  chart.update('none');
}
