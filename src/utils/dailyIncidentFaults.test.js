import { buildIncidentFaultRows } from "./dailyIncidentFaults";
import { buildDailyAutofill, mergeDailyAutofill } from "./dailyDashboardAutofill";
const scope = { site: "Asansol", siteId: "A1", date: "2026-11-05", now: Date.parse("2026-11-05T16:00:00+05:30") };
const incident = { id: "incident-1", siteName: "ASANSOL", siteId: "A1", dateKey: "2026-11-05", timeOfIncident: "10:00", status: "Open",
  incidentTitle: "DG fault", incidentDescription: "Starting issue", equipmentCategory: "Diesel Generator", ttDocketNo: "TT-1", ompPartner: "OEM", effect: "Outage" };

test("maps incident dashboard fields and calculates age without inventing equipment data", () => {
  const [row] = buildIncidentFaultRows({ ...scope, incidents: [incident] });
  expect(row).toMatchObject({ SlNo: 1, Site_Name: "ASANSOL", Complaint_ID: "TT-1", Equipment_Type: "Diesel Generator", Service_Provider: "OEM",
    Issue_Details: "DG fault — Starting issue", Status_Open_Close: "Open", Open_Complaint: "Y", Ageing_In_Hours: 6, Outage_Duration_In_Min: 360,
    Severity_Major_Minor: "", __dailyIncidentSource: "incident-1" });
  expect(row.Equipment_Sl_No).toBeUndefined();
});

test("matches site ID first and includes carried open faults and closures within the window", () => {
  const incidents = [incident,
    { ...incident, id: "carried", dateKey: "2026-11-01" },
    { ...incident, id: "closed", dateKey: "2026-11-01", status: "Closed", closureDate: "2026-11-04", closureTime: "17:00" },
    { ...incident, id: "old", status: "Closed", closureDate: "2026-11-04", closureTime: "15:59" },
    { ...incident, id: "future", timeOfIncident: "16:00" },
    { ...incident, id: "other", siteId: "OTHER" }];
  expect(buildIncidentFaultRows({ ...scope, incidents }).map(row => row.__dailyIncidentSource).sort()).toEqual(["carried", "closed", "incident-1"]);
});

test("historical report does not show future closure and missing times stay blank", () => {
  const [row] = buildIncidentFaultRows({ ...scope, incidents: [{ ...incident, status: "Closed", closureDate: "2026-11-06", closureTime: "10:00", timeOfIncident: "" }] });
  expect(row).toMatchObject({ Status_Open_Close: "Open", Closure_Date: "", Ageing_In_Hours: "", Outage_Duration_In_Min: "" });
});

test("incident sync updates and removes imported rows while retaining manual faults", () => {
  const manual = { Complaint_ID: "MANUAL", Issue_Details: "Manual fault" };
  const data = { Fault_Details: [manual] };
  const patch = buildDailyAutofill({ site: scope.site, date: scope.date, config: { siteId: "A1" }, incidents: [incident] });
  const once = mergeDailyAutofill(data, patch);
  expect(once.Fault_Details).toHaveLength(2);
  expect(mergeDailyAutofill(once, patch)).toEqual(once);
  expect(mergeDailyAutofill(once, { Fault_Details: [] }).Fault_Details).toEqual([{ ...manual, SlNo: 1 }]);
  expect(buildDailyAutofill({ site: scope.site, date: scope.date }).Fault_Details).toBeUndefined();
});
