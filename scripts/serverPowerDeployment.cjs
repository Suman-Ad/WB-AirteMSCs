// Narrow deployment helper using the already signed-in Firebase CLI account.
// Never prints or persists authentication tokens.
const fs = require('node:fs');
const path = require('node:path');
const lib = process.env.FIREBASE_TOOLS_LIB;
if (!lib) throw new Error('Set FIREBASE_TOOLS_LIB to the installed Firebase CLI lib directory.');
const load = name => require(path.join(lib, name));
const project = 'wb-airtelmscs', site = 'N19106A';
const root = `projects/${project}/databases/(default)/documents`;
const {Client} = load('apiv2');
const client = new Client({urlPrefix: 'https://firestore.googleapis.com', apiVersion: 'v1'});
const decode = value => {
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  return undefined;
};
const fields = doc => Object.fromEntries(Object.entries(doc.fields || {}).map(([key, value]) => [key, decode(value)]));
async function getDoc(relative) {
  const response = await client.get(`/${root}/${relative}`, {resolveOnHTTPError: true});
  if (response.status === 404) return null;
  if (response.status !== 200) throw new Error(`Firestore read failed: ${response.status}`);
  return response.body;
}
async function main() {
  const account = load('auth').getProjectDefaultAccount(process.cwd()) || load('auth').getGlobalDefaultAccount();
  if (!account) throw new Error('Firebase CLI sign-in required');
  await load('requireAuth').requireAuth({project, ...account});
  const mode = process.argv[2] || 'inspect';
  if (mode === 'enable' || mode === 'verify') {
    const functionsClient = new Client({urlPrefix: 'https://cloudfunctions.googleapis.com', apiVersion: 'v2'});
    const deployed = (await functionsClient.get(`/projects/${project}/locations/us-central1/functions/detectServerPowerSource`)).body;
    if (deployed.state !== 'ACTIVE') throw new Error(`Detector is not active: ${deployed.state}`);
    const browserDoc = await getDoc(`energyMonitor/${site}/config/powerSwitch`);
    if (!browserDoc) throw new Error('No saved browser mapping to validate');
    const browser = fields(browserDoc);
    const mapping = Object.fromEntries(['mainMeterId', 'dg1MeterId', 'dg2MeterId'].map(key => [key, browser[key] || '']));
    const ids = Object.values(mapping).filter(Boolean);
    if (!mapping.mainMeterId || ids.length < 2 || new Set(ids).size !== ids.length) throw new Error('Invalid existing site mapping');
    const meterSummaries = [];
    for (const id of ids) {
      const doc = await getDoc(`energyMonitor/${site}/meters/${id}`);
      if (!doc) throw new Error(`Mapped meter does not exist: ${id}`);
      const data = fields(doc);
      meterSummaries.push({id, name: data.name, status: data.status, observedAt: data.observedAt, uploadedAt: doc.updateTime});
    }
    const configPath = `energyMonitor/${site}/config/serverPowerSwitch`;
    let configDoc = await getDoc(configPath);
    if (mode === 'enable') {
      if (configDoc) {
        const saved = fields(configDoc);
        if (!saved.enabled || Object.entries(mapping).some(([key, value]) => saved[key] !== value)) {
          throw new Error('Independent configuration already exists with different settings; refusing to overwrite it');
        }
      } else {
        const configFields = Object.fromEntries(Object.entries(mapping).map(([key, value]) => [key, {stringValue: value}]));
        await client.post(`/${root}:commit`, {writes: [
          {verify: browserDoc.name, currentDocument: {updateTime: browserDoc.updateTime}},
          {update: {name: `${root}/${configPath}`, fields: {...configFields,
            enabled: {booleanValue: true}, updatedBy: {stringValue: 'system:server-detector-deployment'}}},
          currentDocument: {exists: false}, updateTransforms: [{fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME'}]},
        ]});
        configDoc = await getDoc(configPath);
      }
    }
    const runtime = await getDoc(`energyMonitor/${site}/runtime/serverPowerSource`);
    const afterBrowser = await getDoc(`energyMonitor/${site}/config/powerSwitch`);
    if (afterBrowser.updateTime !== browserDoc.updateTime) throw new Error('Browser configuration changed during operation');
    console.log(JSON.stringify({project, site, mode, functionState: deployed.state, browserUnchanged: true,
      browserConfig: browser, independentConfig: configDoc ? fields(configDoc) : null,
      runtime: runtime ? fields(runtime) : null, meters: meterSummaries}, null, 2));
    return;
  }
  if (mode !== 'inspect') throw new Error('Use inspect, enable or verify');
  const rules = load('gcp/rules');
  const releases = await rules.listAllReleases(project);
  const release = releases.find(item => item.name === `projects/${project}/releases/cloud.firestore`);
  if (!release) throw new Error('Cannot locate the active Firestore rules release');
  const files = await rules.getRulesetContent(release.rulesetName);
  if (files.length !== 1) throw new Error('Expected a single active Firestore rules file');
  const local = fs.readFileSync('firestore.rules', 'utf8');
  const start = local.indexOf('    // Independent server detector.');
  const end = local.indexOf('    match /energyMonitor/{siteId}/config/powerSwitch', start);
  if (start < 0 || end < 0) throw new Error('Cannot find isolated detector rules block');
  const addition = local.slice(start, end);
  const live = files[0].content;
  const anchor = '    match /energyMonitor/{siteId}/config/powerSwitch';
  if (!live.includes(anchor)) throw new Error('Live rules do not contain expected insertion anchor');
  const candidate = live.includes('config/serverPowerSwitch') ? live : live.replace(anchor, addition + anchor);
  fs.mkdirSync('.firebase', {recursive: true});
  fs.writeFileSync('.firebase/server-power-live.rules', live);
  fs.writeFileSync('.firebase/server-power-candidate.rules', candidate);
  const configDoc = await getDoc(`energyMonitor/${site}/config/powerSwitch`);
  const metersResponse = await client.get(`/${root}/energyMonitor/${site}/meters`, {queryParams: {pageSize: 300}});
  if (metersResponse.body.nextPageToken) throw new Error('Meter listing requires pagination');
  const meters = (metersResponse.body.documents || []).map(doc => ({id: doc.name.split('/').at(-1), ...fields(doc)}));
  const summary = {project, site, liveRuleset: release.rulesetName, candidateMatchesLocal: candidate.replace(/\r/g, '').trim() === local.replace(/\r/g, '').trim(),
    browserConfig: configDoc ? fields(configDoc) : null,
    meters: meters.map(meter => ({id: meter.id, name: meter.name, status: meter.status, observedAt: meter.observedAt}))};
  fs.writeFileSync('.firebase/server-power-inspection.json', JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}
main().catch(error => {console.error(error.message); process.exitCode = 1;});
