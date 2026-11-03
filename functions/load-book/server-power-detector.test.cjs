const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const backend = require('./server-power-detector.cjs');

// Run the existing browser's detection tests against the independent backend copy.
// This catches drift while the two implementations intentionally coexist.
test('backend preserves all existing browser detection scenarios', () => {
  const source = fs.readFileSync(__dirname + '/../../src/components/headerPowerTrigger.test.js', 'utf8')
    .replace(/^import .*;\r?$/gm, '');
  let count = 0;
  const partial = (actual, expected) => {
    for (const [key, value] of Object.entries(expected)) assert.deepEqual(actual[key], value);
  };
  const expect = actual => ({
    toBe: expected => assert.equal(actual, expected),
    toContain: expected => assert.ok(actual.includes(expected)),
    toEqual: expected => assert.deepEqual(JSON.parse(JSON.stringify(actual)), JSON.parse(JSON.stringify(expected))),
    toMatchObject: expected => partial(actual, expected),
    not: {toBe: expected => assert.notEqual(actual, expected), toContain: expected => assert.ok(!actual.includes(expected))},
  });
  vm.runInNewContext(source, {...backend, expect, test: (name, fn) => {fn(); count++;}});
  assert.ok(count >= 10, `Ran ${count} browser scenarios`);
});
