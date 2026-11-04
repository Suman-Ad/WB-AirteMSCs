// Integration checks use only the local emulator and a demo project.
const assert = require("node:assert/strict");
const host = process.env.FIRESTORE_EMULATOR_HOST;
const project = process.env.GCLOUD_PROJECT || "demo-wb-airtel-msc";
if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host || "") || !project.startsWith("demo-")) throw new Error("Run via firebase emulators:exec with a demo project.");
const root = `http://${host}/v1/projects/${project}/databases/(default)/documents`;
const collector = "n89Dopqa4ybdE8VX6B5zUwJYMcx1";
const field = (value) => value === null ? { nullValue: null } : typeof value === "boolean" ? { booleanValue: value } : typeof value === "number" ? { integerValue: String(value) } : typeof value === "object" ? { mapValue: { fields: fields(value) } } : { stringValue: value };
const fields = (value) => Object.fromEntries(Object.entries(value).map(([key, v]) => [key, field(v)]));
const token = (uid) => {
  const now = Math.floor(Date.now() / 1000);
  const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({ aud: project, iss: `https://securetoken.google.com/${project}`, sub: uid, user_id: uid, auth_time: now, iat: now, exp: now + 3600, firebase: { sign_in_provider: "custom", identities: {} } })}.`;
};
async function call(path, uid, method = "GET", body) {
  return fetch(root + path, { method, headers: { "Content-Type": "application/json", ...(uid ? { Authorization: `Bearer ${uid === "owner" ? "owner" : token(uid)}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
}
async function seed(path, data) { const response = await call("/" + path, "owner", "PATCH", { fields: fields(data) }); assert.equal(response.status, 200, await response.text()); }
const sldWrite = (siteId, extra = {}) => ({ writes: [{ update: { name: `projects/${project}/databases/(default)/documents/energyMonitor/${siteId}/config/sld`, fields: fields({ version: 1, payloadJson: "{}", ...extra }) }, updateTransforms: [{ fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }] }] });
const meterWrite = (siteId, meterId) => ({ fields: { ...fields({ siteId, meterId, status: "OK", powerUnits: "base" }), observedAt: { timestampValue: new Date().toISOString() } } });
const powerSwitchWrite = (siteId, uid, extra = {}) => ({ writes: [{ update: {
  name: `projects/${project}/databases/(default)/documents/energyMonitor/${siteId}/config/powerSwitch`,
  fields: fields({ enabled:true, mainMeterId:'meter-2', htMeterId:'', dg1MeterId:'meter-26', dg2MeterId:'meter-27', updatedBy:uid, ...extra })
}, updateTransforms:[{fieldPath:'updatedAt',setToServerValue:'REQUEST_TIME'}] }] });
async function main() {
  await seed("users/human", { isActive: true, siteId: "N19106A", role: "User" });
  await seed("users/admin", { isActive: true, siteId: "N19106A", role: "Admin" });
  await seed("users/superadmin", { isActive: true, siteId: "N19106A", role: "Super Admin" });
  await seed("users/other", { isActive: true, siteId: "OTHER" });
  await seed("users/inactive", { isActive: false, siteId: "N19106A" });
  await seed("dailyDGLogs/Asansol/2026-10/day1", { Date: "2026-10-22" });
  await seed("dgLogs/Asansol/Oct-2026/2026-10-22/runs/run1", { dgNumber: "DG-1" });
  await seed("ebBillDetails/Asansol/MonthlyBills/2026-10", { Amount: 100 });
  await seed("energyMonitor/N19106A/meters/meter-1", { active_power: 100 });
  await seed("energyMonitor/OTHER/meters/meter-1", { active_power: 200 });
  await seed("users/site-superuser", {isActive:true,siteId:"N19106A",role:"Super User"});
  await seed("users/inactive-admin", {isActive:false,siteId:"N19106A",role:"Admin"});
  let passed = 0;
  async function check(name, promise, expected) {
    const response = await promise;
    assert.equal(response.status, expected, `${name}: ${await response.text()}`);
    passed++; console.log(`PASS ${name}`);
  }
  const query = (collectionId, allDescendants = false) => ({ structuredQuery: { from: [{ collectionId, allDescendants }] } });
  await check("human explicit daily-log query", call("/dailyDGLogs/Asansol:runQuery", "human", "POST", query("2026-10")), 200);
  await check("human explicit DG-run query", call("/dgLogs/Asansol/Oct-2026/2026-10-22:runQuery", "human", "POST", query("runs")), 200);
  await check("human explicit EB bill read", call("/ebBillDetails/Asansol/MonthlyBills/2026-10", "human"), 200);
  await check("unscoped monthly group remains denied", call(":runQuery", "human", "POST", query("2026-10", true)), 403);
  await check("anonymous reports denied", call("/dailyDGLogs/Asansol/2026-10/day1"), 403);
  await check("collector cannot read DG logs", call("/dailyDGLogs/Asansol/2026-10/day1", collector), 403);
  await check("active User can read another site's live meter", call("/energyMonitor/OTHER/meters/meter-1", "human"), 200);
  await check("active Super User can read another site's live meter", call("/energyMonitor/OTHER/meters/meter-1", "site-superuser"), 200);
  await check("active User can list another site's live meters", call("/energyMonitor/OTHER/meters", "human"), 200);
  await check("cross-site meter write stays denied", call("/energyMonitor/OTHER/meters/meter-1", "human", "PATCH", meterWrite("OTHER","meter-1")), 403);
  await check("cross-site automatic settings remain private", call("/energyMonitor/OTHER/config/powerSwitch", "human"), 403);
  await check("inactive users cannot view another site's meters", call("/energyMonitor/OTHER/meters/meter-1", "inactive"), 403);
  await check("anonymous users cannot view live meters", call("/energyMonitor/OTHER/meters/meter-1", null), 403);
  await check("same-site meter read allowed", call("/energyMonitor/N19106A/meters/meter-1", "human"), 200);
  await check("unrecognized cross-site role cannot read meters", call("/energyMonitor/N19106A/meters/meter-1", "other"), 403);
  await check("inactive meter read denied", call("/energyMonitor/N19106A/meters/meter-1", "inactive"), 403);
  await check("collector valid meter upload", call("/energyMonitor/N19106A/meters/meter-2", collector, "PATCH", meterWrite("N19106A", "meter-2")), 200);
  await check("collector cross-site upload denied", call("/energyMonitor/OTHER/meters/meter-2", collector, "PATCH", meterWrite("OTHER", "meter-2")), 403);
  await check("collector profile write denied", call("/users/collector-new", collector, "PATCH", { fields: fields({ isActive: true }) }), 403);
  await check("human meter write denied", call("/energyMonitor/N19106A/meters/meter-2", "human", "PATCH", meterWrite("N19106A", "meter-2")), 403);
  await check("same-site Admin SLD save allowed", call(":commit", "admin", "POST", sldWrite("N19106A")), 200);
  await check("same-site SLD read allowed", call("/energyMonitor/N19106A/config/sld", "human"), 200);
  await check("cross-site SLD read denied", call("/energyMonitor/N19106A/config/sld", "other"), 403);
  await check("cross-site SLD save denied", call(":commit", "other", "POST", sldWrite("N19106A")), 403);
  await check("collector SLD save denied", call(":commit", collector, "POST", sldWrite("N19106A")), 403);
  await check("extra SLD fields rejected", call(":commit", "admin", "POST", sldWrite("N19106A", { unexpected: "value" })), 403);
  await check("SLD deletion denied", call("/energyMonitor/N19106A/config/sld", "human", "DELETE"), 403);
  await check("ordinary site user SLD write denied", call(":commit", "human", "POST", sldWrite("N19106A")), 403);
  await check("Super Admin SLD write allowed", call(":commit", "superadmin", "POST", sldWrite("N19106A")), 200);
  await check("Admin SLD deletion allowed", call("/energyMonitor/N19106A/config/sld", "admin", "DELETE"), 200);
  await seed("energyChangeovers/N19106A/runs/r1", { siteId: "N19106A", status: "Running", createdBy: "human" });
  await check("site user changeover history read", call("/energyChangeovers/N19106A/runs/r1", "human"), 200);
  await check("cross-site changeover history read denied", call("/energyChangeovers/N19106A/runs/r1", "other"), 403);
  await check("collector changeover history denied", call("/energyChangeovers/N19106A/runs/r1", collector), 403);
  await check("cross-site changeover history write denied", call("/energyChangeovers/N19106A/runs/new", "other", "PATCH", { fields: fields({ siteId: "N19106A", status: "Running" }) }), 403);
  const runPath = `projects/${project}/databases/(default)/documents/energyChangeovers/N19106A/runs/valid`;
  const initialRun = fields({ siteId: "N19106A", siteName: "Asansol", dgNumber: "DG-1", meterId: "meter-2", mainMeterId: "meter-1", status: "Running", startAtMs: 100000, endAtMs: null, date: "2026-10-22", opening: { kwh: 10 }, latest: { kwh: 10 }, closing: null, ebFailure: null, ebRestoration: null, generationKwh: null, trigger: "Automatic", createdBy: "human", updatedBy: "human" });
  await check("Admin can save shared automatic switch settings", call(":commit", "admin", "POST", powerSwitchWrite("N19106A","admin")), 200);
  await check("same-site Super User can save switch settings", call(":commit", "site-superuser", "POST", powerSwitchWrite("N19106A","site-superuser")), 200);
  await check("site users can read shared switch settings", call("/energyMonitor/N19106A/config/powerSwitch", "human"), 200);
  await check("ordinary users cannot edit switch settings", call(":commit", "human", "POST", powerSwitchWrite("N19106A","human")), 403);
  await check("Admin can edit another site's switch settings", call(":commit", "admin", "POST", powerSwitchWrite("OTHER","admin")), 200);
  await check("Super Admin can edit another site's switch settings", call(":commit", "superadmin", "POST", powerSwitchWrite("OTHER","superadmin")), 200);
  await check("Admin can read another site's switch settings", call("/energyMonitor/OTHER/config/powerSwitch", "admin"), 200);
  await check("Admin can read another site's meters for mapping", call("/energyMonitor/OTHER/meters/meter-1", "admin"), 200);
  await check("inactive Admin cannot edit switch settings", call(":commit", "inactive-admin", "POST", powerSwitchWrite("OTHER","inactive-admin")), 403);
  await check("inactive Admin cannot read other site meters", call("/energyMonitor/OTHER/meters/meter-1", "inactive-admin"), 403);
  await check("cross-site Super User cannot edit switch settings", call(":commit", "site-superuser", "POST", powerSwitchWrite("OTHER","site-superuser")), 403);
  await check("cross-site users cannot read switch settings", call("/energyMonitor/N19106A/config/powerSwitch", "other"), 403);
  await check("inactive users cannot edit switch settings", call(":commit", "inactive", "POST", powerSwitchWrite("N19106A","inactive")), 403);
  await check("switch settings reject duplicate meter IDs", call(":commit", "admin", "POST", powerSwitchWrite("N19106A","admin",{dg1MeterId:'meter-2'})), 403);
  await check("switch settings reject extra fields", call(":commit", "admin", "POST", powerSwitchWrite("N19106A","admin",{extra:'bad'})), 403);
  await check("switch settings reject spoofed editor", call(":commit", "admin", "POST", powerSwitchWrite("N19106A","human")), 403);
  await check("site user can create changeover run", call(":commit", "human", "POST", { writes: [{ update: { name: runPath, fields: initialRun }, updateTransforms: [{ fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" }, { fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }] }] }), 200);
  const savedRun = (await (await call("/energyChangeovers/N19106A/runs/valid", "human")).json()).fields;
  const commitRun = (patch) => call(":commit", "human", "POST", { writes: [{ update: { name: runPath, fields: { ...savedRun, ...fields(patch) } }, updateTransforms: [{ fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }] }] });
  await check("running checkpoint is allowed", commitRun({ latest: { kwh: 15 } }), 200);
  await check("restoration completes recorded run", commitRun({ status: "Completed", closing: { kwh: 15 }, endAtMs: 160000, generationKwh: 5 }), 200);
  await check("completed meter history cannot be rewritten", commitRun({ status: "Completed", closing: { kwh: 99 } }), 403);
  await check("changeover history delete denied", call("/energyChangeovers/N19106A/runs/valid", "human", "DELETE"), 403);
  await seed("energyMonitor/N19106A/dailyReadings/2026-10-31__meter", { date: "2026-10-31", openingKwh: 100, closingKwh: 120 });
  await seed("energyMonitor/N19106A/historyMeters/meter/samples/2026-10-31_0", { date: "2026-10-31", observedAtMs: 1000, kwh: 120 });
  const historySettingsWrite = (uid, extra = {}) => ({ writes: [{ update: {
    name: `projects/${project}/databases/(default)/documents/energyMonitor/N19106A/config/meterHistory`,
    fields: fields({ enabled: true, retentionDays: 7, updatedBy: uid, ...extra })
  }, updateTransforms: [{ fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }] }] });
  await check("site user reads daily meter registers", call("/energyMonitor/N19106A/dailyReadings/2026-10-31__meter", "human"), 200);
  await check("site user queries daily meter history", call("/energyMonitor/N19106A:runQuery", "human", "POST", query("dailyReadings")), 200);
  await check("site user reads retained samples", call("/energyMonitor/N19106A/historyMeters/meter/samples/2026-10-31_0", "human"), 200);
  await check("Admin saves meter backup retention", call(":commit", "admin", "POST", historySettingsWrite("admin")), 200);
  await check("site user reads backup settings", call("/energyMonitor/N19106A/config/meterHistory", "human"), 200);
  await check("ordinary user cannot change retention", call(":commit", "human", "POST", historySettingsWrite("human")), 403);
  await check("Super User cannot change retention", call(":commit", "site-superuser", "POST", historySettingsWrite("site-superuser")), 403);
  await check("retention cannot be shorter than seven days", call(":commit", "admin", "POST", historySettingsWrite("admin", { retentionDays: 6 })), 403);
  await check("retention cannot exceed 365 days", call(":commit", "admin", "POST", historySettingsWrite("admin", { retentionDays: 366 })), 403);
  await check("retention settings reject unexpected fields", call(":commit", "admin", "POST", historySettingsWrite("admin", { unexpected: true })), 403);
  await check("retention settings reject a forged author", call(":commit", "admin", "POST", historySettingsWrite("human")), 403);
  await check("cross-site user cannot read meter history", call("/energyMonitor/N19106A/dailyReadings/2026-10-31__meter", "other"), 403);
  await check("inactive user cannot read meter samples", call("/energyMonitor/N19106A/historyMeters/meter/samples/2026-10-31_0", "inactive"), 403);
  await check("browser cannot fabricate daily meter history", call("/energyMonitor/N19106A/dailyReadings/fake", "admin", "PATCH", { fields: fields({ date: "2026-10-31", closingKwh: 999 }) }), 403);
  await check("collector cannot fabricate meter samples", call("/energyMonitor/N19106A/historyMeters/meter/samples/fake", collector, "PATCH", { fields: fields({ kwh: 999 }) }), 403);
  await check("browser cannot delete saved meter history", call("/energyMonitor/N19106A/dailyReadings/2026-10-31__meter", "admin", "DELETE"), 403);
  const serverConfig = (uid, extra = {}) => ({writes: [{update: {
    name: `projects/${project}/databases/(default)/documents/energyMonitor/N19106A/config/serverPowerSwitch`,
    fields: fields({enabled:true,mainMeterId:'meter-2',dg1MeterId:'meter-26',dg2MeterId:'',updatedBy:uid,...extra})
  }, updateTransforms:[{fieldPath:'updatedAt',setToServerValue:'REQUEST_TIME'}]}]});
  await check("admin configures isolated server detector", call(":commit", "admin", "POST", serverConfig("admin")), 200);
  await check("ordinary user cannot enable server detector", call(":commit", "human", "POST", serverConfig("human")), 403);
  await check("Super User cannot enable server detector", call(":commit", "site-superuser", "POST", serverConfig("site-superuser")), 403);
  await check("server mapping cannot duplicate main and DG", call(":commit", "admin", "POST", serverConfig("admin", {dg1MeterId:'meter-2'})), 403);
  await check("server mapping rejects unexpected fields", call(":commit", "admin", "POST", serverConfig("admin", {powerSource:'DG'})), 403);
  await check("server mapping rejects forged author", call(":commit", "admin", "POST", serverConfig("human")), 403);
  await seed("energyMonitor/N19106A/runtime/serverPowerSource", {powerSource:"DG"});
  await seed("energyMonitor/N19106A/serverChangeovers/run1", {status:"Running"});
  for (const path of ["config/serverPowerSwitch", "runtime/serverPowerSource", "serverChangeovers/run1"]) {
    await check(`site user reads isolated ${path}`, call(`/energyMonitor/N19106A/${path}`, "human"), 200);
    await check(`cross-site user denied isolated ${path}`, call(`/energyMonitor/N19106A/${path}`, "other"), 403);
    await check(`inactive admin denied isolated ${path}`, call(`/energyMonitor/N19106A/${path}`, "inactive-admin"), 403);
    await check(`anonymous denied isolated ${path}`, call(`/energyMonitor/N19106A/${path}`, null), 403);
  }
  for (const path of ["runtime/serverPowerSource", "serverChangeovers/run1"]) {
    await check(`admin cannot forge isolated ${path}`, call(`/energyMonitor/N19106A/${path}`, "admin", "PATCH", {fields:fields({powerSource:"EB"})}), 403);
    await check(`admin cannot delete isolated ${path}`, call(`/energyMonitor/N19106A/${path}`, "admin", "DELETE"), 403);
    await check(`collector cannot forge isolated ${path}`, call(`/energyMonitor/N19106A/${path}`, collector, "PATCH", {fields:fields({powerSource:"EB"})}), 403);
  }
  const functionControls=(uid,extra={})=>({writes:[{update:{
    name:`projects/${project}/databases/(default)/documents/energyMonitor/N19106A/config/notifications`,
    fields:fields({enabled:true,dailyEnabled:true,changeoverEnabled:true,intervalMinutes:120,healthAlertsEnabled:false,recoveryAlertsEnabled:true,crqRemindersEnabled:false,telegramIncidentEnabled:false,telegramSummaryEnabled:true,telegramDhrEnabled:true,telegramActivityEnabled:true,telegramCrqImportEnabled:false,updatedBy:uid,...extra})
  },updateTransforms:[{fieldPath:'updatedAt',setToServerValue:'REQUEST_TIME'}]}]});
  await check('admin saves site function controls',call(':commit','admin','POST',functionControls('admin')),200);
  for(const uid of ['human','site-superuser','inactive-admin']) await check(`${uid} cannot change function controls`,call(':commit',uid,'POST',functionControls(uid)),403);
  await check('function controls reject non-boolean flags',call(':commit','admin','POST',functionControls('admin',{healthAlertsEnabled:'false'})),403);
  await check('DHR control rejects non-boolean flag',call(':commit','admin','POST',functionControls('admin',{telegramDhrEnabled:'true'})),403);
  await check('summary control rejects non-boolean flag',call(':commit','admin','POST',functionControls('admin',{telegramSummaryEnabled:'true'})),403);
  await check('function controls reject unknown flags',call(':commit','admin','POST',functionControls('admin',{unexpected:true})),403);
  await check('function controls reject forged authors',call(':commit','admin','POST',functionControls('human')),403);
  console.log(`${passed} Firestore rules integration checks passed.`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
