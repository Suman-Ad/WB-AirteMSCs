/** @jest-environment node */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SourceTab from './SourceTab';

const render = (source, powerType, values = {}) => renderToStaticMarkup(<SourceTab source={source} formData={{ powerType, ...values }} siteConfig={{ smpsCount: 2, upsCount: 1, smpsConfigs: { 'SMPS-1': { capacityAmp: 500 }, 'SMPS-2': { active: false } }, upsConfigs: { 'UPS-1': { capacityKva: 60 } } }} handleChange={() => {}} />);

test.each(['A', 'B'])('source %s retains its editable and calculated field names', source => {
  const html = render(source, 'DC');
  const fields = ['smpsName', 'smpsRating', 'dbNumber', 'dbVoltage', 'incomerRating', 'cableSize', 'cableRun', 'cableLength', 'rackCableTagging', 'equipmentRackNo', 'rackName', 'rackIncomingCableSize', 'rackCableLength', 'rackCableRun', 'dbMcbNumber', 'dbMcbLabel', 'dbMcbRating', 'tempOnMcb', 'runningLoad', 'cableCapacity', 'pctLoadCable', 'pctLoadMcb', 'rackEndVoltage', 'rackEndNoDb', 'rackEndDcdbName', 'rackEndRunningLoad', 'rackEndMcbRating', 'rackEndPctLoadMcb', 'remarks'];
  fields.forEach(field => expect(html).toContain(`name="${field}${source}"`));
  ['cableCapacity', 'pctLoadCable', 'pctLoadMcb', 'rackEndPctLoadMcb'].forEach(field => {
    const control = html.match(new RegExp(`<input[^>]+name="${field}${source}"[^>]*>`))[0];
    expect(control).toContain('disabled=""');
  });
});

test('source options and default ratings follow power type and active equipment', () => {
  const dc = render('A', 'DC', { smpsNameA: 'SMPS-1' });
  expect(dc).toContain('value="500"');
  expect(dc).not.toContain('value="SMPS-2"');
  const ac = render('B', 'AC', { smpsNameB: 'UPS-1' });
  expect(ac).toContain('value="60"');
  expect(ac).toContain('value="UPS-1"');
  expect(render('A', 'AC+DC')).toContain('placeholder="Enter source name"');
});
