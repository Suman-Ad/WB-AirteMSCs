const normalize = value => String(value || "").trim().toLowerCase();
const stamp = (date, time) => date && /^\d{2}:\d{2}/.test(time || "") ? `${date}T${time.slice(0, 5)}` : null;
const minutesBetween = (start, end) => Math.max(0, (Date.parse(`${end}:00+05:30`) - Date.parse(`${start}:00+05:30`)) / 60000);

export function buildIncidentFaultRows({ incidents, site, siteId, date, now = Date.now() }) {
  const previous = new Date(Date.parse(`${date}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);
  const start = `${previous}T16:00`, end = `${date}T16:00`;
  const endMs = Math.min(now, Date.parse(`${end}:00+05:30`));
  return incidents.filter(incident => {
    const matches = siteId && incident.siteId ? normalize(siteId) === normalize(incident.siteId) : normalize(site) === normalize(incident.siteName);
    if (!matches) return false;
    const openedDate = incident.dateKey || incident.dateOfIncident;
    if (!openedDate || openedDate > date) return false;
    const opened = stamp(openedDate, incident.timeOfIncident);
    if (opened && (opened >= end || Date.parse(`${opened}:00+05:30`) > now)) return false;
    const closed = stamp(incident.closureDate, incident.closureTime);
    if (normalize(incident.status) === "closed") {
      if (closed) return closed >= start;
      return incident.closureDate ? incident.closureDate >= previous : openedDate === date;
    }
    return true;
  }).sort((a, b) => `${a.dateKey || a.dateOfIncident} ${a.timeOfIncident || ""} ${a.id}`.localeCompare(`${b.dateKey || b.dateOfIncident} ${b.timeOfIncident || ""} ${b.id}`))
    .map((incident, index) => {
      const openedDate = incident.dateKey || incident.dateOfIncident;
      const opened = stamp(openedDate, incident.timeOfIncident);
      const closed = stamp(incident.closureDate, incident.closureTime);
      const isClosed = normalize(incident.status) === "closed" && (closed ? closed < end : Boolean(incident.closureDate && incident.closureDate <= date));
      const duration = opened && closed && isClosed ? minutesBetween(opened, closed) : null;
      const age = duration ?? (opened ? Math.max(0, (endMs - Date.parse(`${opened}:00+05:30`)) / 60000) : null);
      return {
        SlNo: index + 1, Region: incident.region || "", Circle: incident.circle || "", Date: date,
        Complaint_Reg_by: incident.uploadedBy?.name || "", Site_Name: incident.siteName || site,
        Site_ID: incident.siteId || siteId || "", Location: incident.location || "",
        Equipment_Type: incident.equipmentCategory || "", Equipment_Name: incident.effectedEquipmentDetails || "",
        Complaint_ID: incident.ttDocketNo || "", Complaint_Open_Date: openedDate,
        Complaint_Open_Time: incident.timeOfIncident || "",
        Severity_Major_Minor: incident.severity || (["major", "minor"].includes(normalize(incident.type)) ? incident.type : ""),
        Service_Provider: incident.ompPartner || "", Issue_Details: [incident.incidentTitle, incident.incidentDescription].filter(Boolean).join(" — "),
        Reason_Category: incident.reasonCategory || "", Real_Reason_of_Incident: incident.realReason || "",
        Status_Open_Close: isClosed ? "Closed" : "Open", Open_Complaint: isClosed ? "N" : "Y",
        Closure_Date: isClosed ? incident.closureDate || "" : "", Closure_Time: isClosed ? incident.closureTime || "" : "",
        Ageing_In_Hours: age === null ? "" : Number((age / 60).toFixed(2)),
        Outage_Duration_In_Min: normalize(incident.effect) === "non-outage" ? 0 : normalize(incident.effect) === "outage" && age !== null ? Number(age.toFixed(2)) : "",
        Action_Taken_for_clouser: incident.actionsTaken || "", Remarks: [incident.remarks, isClosed && incident.closureRemarks].filter(Boolean).join(" — "),
        __dailyIncidentSource: incident.id,
      };
    });
}
