const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const base = 'energyMonitor/A';
const stamp = time => ({toMillis: () => time});
function setup() {
  let now = 100000;
  const store = new Map([[`${base}/config/serverPowerSwitch`, {enabled: true, mainMeterId: 'main', dg1MeterId: 'dg'}]]);
  const snapshot = path => ({exists: store.has(path), data: () => store.get(path)});
  const mergeMaps = (old, patch) => Object.fromEntries(Object.entries({...old, ...patch}).map(([key,value]) => [key, patch[key] && typeof patch[key] === 'object' && !patch[key].toMillis && !Array.isArray(patch[key]) ? mergeMaps(old?.[key] || {}, patch[key]) : value]));
  let queue = Promise.resolve();
  const db = {doc: path => ({path}), runTransaction: fn => {
    const task = queue.then(async () => {
      const staged = [];
      const result = await fn({get: async ref => snapshot(ref.path), set: (ref, value, options) => staged.push([ref.path, value, options])});
      for (const [path, value, options] of staged) store.set(path, options?.merge ? mergeMaps(store.get(path),value) : options?.mergeFields ? {...store.get(path), ...value} : value);
      return result;
    });
    queue = task.catch(() => {});
    return task;
  }};
  const exports = {};
  vm.runInNewContext(fs.readFileSync(__dirname + '/server-power-functions.cjs', 'utf8'), {
    exports, Date: class extends Date {static now() {return now;}},
    require: name => ({'firebase-functions/v2/firestore': {onDocumentWritten: (opts, fn) => {
      assert.equal(opts.retry, true); return fn;
    }}, 'firebase-admin/firestore': {getFirestore: () => db, FieldValue: {serverTimestamp: () => 'server-time'}},
    './server-power-detector.cjs': require('./server-power-detector.cjs')})[name],
  });
  const meter = (id, voltage, current, time = now, extra = {}) => store.set(`${base}/meters/${id}`, {
    status: 'OK', voltage_ll: voltage, current, observedAt: stamp(time), fwd_Wh: 100000, ...extra,
  });
  const run = (id = 'dg', exists = true) => exports.detectServerPowerSource({params: {siteId: 'A', meterId: id}, data: {after: {exists}}});
  const status = () => store.get(`${base}/runtime/serverPowerSource`);
  const runs = () => [...store.entries()].filter(([path]) => path.startsWith(`${base}/serverChangeovers/`)).map(([, value]) => value);
  const tick = time => {now = time;};
  return {store, meter, run, status, runs, tick};
}

test('two distinct pairs start once; duplicate, concurrent and delayed event deliveries do not restart', async () => {
  const app = setup();
  app.meter('main', 0, 0); app.meter('dg', 415, 100);
  await Promise.all([app.run(), app.run(), app.run('main')]);
  assert.equal(app.status().detector.count, 1); assert.equal(app.runs().length, 0);
  app.tick(110000); app.meter('main', 0, 0); app.meter('dg', 415, 100);
  await Promise.all([app.run(), app.run('main'), app.run()]);
  assert.equal(app.status().powerSource, 'DG'); assert.equal(app.runs().length, 1);
  assert.equal(app.runs()[0].opening.kwh, 100);
  assert.equal([...app.store.keys()].some(path => /^(sitePowerStatus|energyChangeovers|notifications)\//.test(path)), false);
});

test('restores while DG has cooldown voltage; checkpoints and saves generation once', async () => {
  const app = setup();
  for (const time of [100000, 110000]) {
    app.tick(time); app.meter('main', 0, 0); app.meter('dg', 415, 100); await app.run();
  }
  app.tick(120000); app.meter('dg', 415, 100, 120000, {fwd_Wh: 101000}); await app.run();
  assert.equal(app.runs()[0].latest.kwh, 101);
  for (const time of [130000, 140000]) {
    app.tick(time); app.meter('main', 415, 100); app.meter('dg', 415, 3.4, time, {fwd_Wh: 102000}); await app.run();
  }
  await app.run();
  assert.equal(app.status().powerSource, 'EB'); assert.equal(app.runs().length, 1);
  assert.equal(app.runs()[0].generationKwh, 2); assert.equal(app.runs()[0].loadTransferAtMs, 130000);
  assert.equal(app.runs()[0].status, 'Completed');
});

test('disabled, deleted and unrelated meter events do not activate the detector', async () => {
  const app = setup();
  await app.run('other'); await app.run('dg', false); assert.equal(app.status(), undefined);
  app.store.get(`${base}/config/serverPowerSwitch`).enabled = false;
  await app.run(); assert.equal(app.status(), undefined);
});

test('disabling and re-enabling clears confirmations while retaining historical source', async () => {
  const app = setup();
  app.meter('main', 0, 0); app.meter('dg', 415, 100); await app.run();
  assert.equal(app.status().detector.count, 1);
  app.store.get(`${base}/config/serverPowerSwitch`).enabled = false;
  await app.run(); assert.equal(app.status().enabled, false); assert.equal(app.status().detector.count, 0);
  app.store.get(`${base}/config/serverPowerSwitch`).enabled = true;
  app.tick(110000); app.meter('main', 0, 0); app.meter('dg', 415, 100); await app.run();
  assert.equal(app.runs().length, 0); assert.equal(app.status().detector.count, 1);
});

test('configuration saves with unchanged mappings reset confirmation without freezing a running DG', async () => {
  const app = setup();
  for (const time of [100000, 110000]) {
    app.tick(time); app.meter('main', 0, 0); app.meter('dg', 415, 100); await app.run();
  }
  assert.equal(app.status().sourceObservedAtMs, 110000);
  app.store.get(`${base}/config/serverPowerSwitch`).updatedAt = stamp(120000);
  for (const time of [120000, 130000]) {
    app.tick(time); app.meter('main', 415, 100); app.meter('dg', 415, 0); await app.run();
  }
  assert.equal(app.status().powerSource, 'EB'); assert.equal(app.status().sourceMeterId, 'main');
  assert.equal(app.status().assessment, 'confirmed');
});

test('unknown supply stays unknown with missing, stale, partial or unloaded DG readings', async () => {
  const app = setup();
  await app.run(); assert.equal(app.status().powerSource, 'Unknown');
  app.meter('main', 0, 0);
  for (const extra of [{status: 'ERROR'}, {R_voltage_ll: 415}, {current: 0}, {observedAt: stamp(1)}]) {
    app.meter('dg', 415, 100, 100000, extra); await app.run();
    assert.equal(app.runs().length, 0); assert.equal(app.status().detector.count, 0);
  }
});

test('healthy mains establishes EB; gap or configuration revision discards old confirmation', async () => {
  const app = setup(); app.meter('main', 415, 100); await app.run();
  assert.equal(app.status().powerSource, 'EB');
  app.meter('main', 0, 0); app.meter('dg', 415, 100); await app.run();
  app.tick(200000); app.meter('main', 0, 0); app.meter('dg', 415, 100); await app.run();
  assert.equal(app.runs().length, 0); assert.equal(app.status().detector.count, 1);
  app.store.get(`${base}/config/serverPowerSwitch`).updatedAt = stamp(200001);
  app.tick(210000); app.meter('main', 0, 0); app.meter('dg', 415, 100); await app.run();
  assert.equal(app.runs().length, 0); assert.equal(app.status().detector.count, 1);
});

test('active run mapping changes pause detection instead of closing against another DG', async () => {
  const app = setup();
  for (const time of [100000, 110000]) {
    app.tick(time); app.meter('main', 0, 0); app.meter('dg', 415, 100); await app.run();
  }
  app.store.get(`${base}/config/serverPowerSwitch`).dg1MeterId = 'replacement';
  app.tick(120000); app.meter('main', 415, 100); app.meter('replacement', 415, 0); await app.run('replacement');
  assert.equal(app.status().assessment, 'waiting'); assert.equal(app.runs()[0].status, 'Running');
});

test('persisted idle evidence permits two fresh mains observations after DG becomes unavailable', async () => {
  const app = setup();
  for (const time of [100000, 110000]) {
    app.tick(time); app.meter('main', 0, 0); app.meter('dg', 415, 100); await app.run();
  }
  app.tick(120000); app.meter('main', 415, 100); app.meter('dg', 415, 0); await app.run();
  for (const time of [130000, 140000]) {
    app.tick(time); app.meter('main', 415, 100); app.meter('dg', 0, 0, time, {status: 'ERROR'}); await app.run('main');
  }
  assert.equal(app.status().powerSource, 'EB');
  assert.equal(app.runs()[0].closing.quality, 'Last valid reading before restoration');
});


test('existing Auto Switch controls override independent activation settings', async () => {
  const app = setup();
  app.store.set(`${base}/config/powerSwitch`, {enabled:false,mainMeterId:'main',dg1MeterId:'dg'});
  for (const time of [100000,110000]) {
    app.tick(time);app.meter('main',0,0);app.meter('dg',415,100);await app.run();
  }
  assert.equal(app.runs().length,0);
  app.store.get(`${base}/config/powerSwitch`).enabled=true;
  for (const time of [120000,130000]) {
    app.tick(time);app.meter('main',0,0);app.meter('dg',415,100);await app.run();
  }
  assert.equal(app.status().powerSource,'DG');assert.equal(app.runs().length,1);
});


test('restoration evidence keys cannot keep a subsequent outage at one confirmation', async () => {
  const app=setup();
  app.store.set(`${base}/runtime/serverPowerSource`, {enabled:true,powerSource:'EB',mappingKey:JSON.stringify(['main','dg']),configRevision:null,evaluatedAtMs:100000,detector:{dg:'DG-1',count:1,evidenceMode:'live',transferAtMs:1}});
  for (const time of [100000,110000]) {
    app.tick(time);app.meter('main',0,0);app.meter('dg',415,100);await app.run();
  }
  assert.equal(app.status().powerSource,'DG');assert.equal(app.runs().length,1);
  assert.equal(app.status().detector.evidenceMode,undefined);
});


test('offline mains retains the last valid observed register for the start alert',async()=>{
 const app=setup();app.meter('main',415,100,100000,{fwd_Wh:250000});await app.run('main');
 for(const time of [110000,120000]){
   app.tick(time);app.meter('main',0,0,time,{status:'ERROR',fwd_Wh:0});app.meter('dg',415,100);await app.run();
 }
 assert.equal(app.runs()[0].ebFailure.kwh,null);
 assert.equal(app.runs()[0].ebFailure.lastKnownKwh,250);
 assert.equal(app.runs()[0].ebFailure.lastKnownAtMs,100000);
});
