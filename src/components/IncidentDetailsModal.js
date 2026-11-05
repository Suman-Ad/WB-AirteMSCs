import React from 'react';
import { Button, Modal } from 'antd';
import './IncidentDetailsModal.css';

const displayValue = value => value === null || value === undefined || String(value).trim() === ''
  ? 'Not provided' : value;

const displayDate = value => {
  if (!value) return 'Not provided';
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  return `${match[3]} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(match[2]) - 1] || match[2]} ${match[1]}`;
};

const Detail = ({ label, value, wide = false }) => (
  <div className={`incident-detail-field${wide ? ' incident-detail-field-wide' : ''}`}>
    <dt>{label}</dt>
    <dd>{displayValue(value)}</dd>
  </div>
);

const Section = ({ title, children }) => (
  <section className="incident-detail-section" aria-label={title}>
    <h3>{title}</h3>
    <dl>{children}</dl>
  </section>
);

export default function IncidentDetailsModal({ incident, canEdit, onClose, onEdit }) {
  if (!incident) return null;
  const status = String(incident.status || '').toLowerCase();
  const statusClass = status === 'closed' ? 'closed' : status === 'open' ? 'open' : 'neutral';

  return (
    <Modal
      open
      centered
      width={920}
      className="incident-details-modal"
      title="Incident details"
      onCancel={onClose}
      maskClosable={false}
      footer={
        <div className="incident-detail-footer">
          <span>Incident record · {displayValue(incident.siteId)}</span>
          <div>
            <Button onClick={onClose}>Close</Button>
            {canEdit && <Button type="primary" onClick={onEdit}>Edit incident</Button>}
          </div>
        </div>
      }
    >
      <div className="incident-detail-summary">
        <div className="incident-detail-reference">
          <span>Docket no. <strong>{incident.ttDocketNo ? `#${incident.ttDocketNo}` : 'Pending assignment'}</strong></span>
          <span className={`incident-detail-status incident-detail-status-${statusClass}`}>{incident.status || 'Status not provided'}</span>
        </div>
        <h2>{incident.incidentTitle || 'Untitled incident'}</h2>
        <p>{incident.siteName || 'Site not provided'} · {displayDate(incident.dateKey || incident.dateOfIncident)}{incident.timeOfIncident ? ` at ${incident.timeOfIncident}` : ''}</p>
      </div>

      <Section title="Site & incident classification">
        <Detail label="Circle" value={incident.circle} />
        <Detail label="Site ID" value={incident.siteId} />
        <Detail label="Site name" value={incident.siteName} />
        <Detail label="OEM / partner" value={incident.ompPartner} />
        <Detail label="Incident date" value={displayDate(incident.dateKey || incident.dateOfIncident)} />
        <Detail label="Incident time" value={incident.timeOfIncident} />
        <Detail label="Service classification (SA / NSA)" value={incident.saNsa} />
        <Detail label="Incident type" value={incident.type} />
        <Detail label="Equipment category" value={incident.equipmentCategory} />
        <Detail label="Impact type" value={incident.impactType} />
      </Section>

      <Section title="Incident description & response">
        <Detail label="Description" value={incident.incidentDescription} wide />
        <Detail label="Affected equipment details" value={incident.effectedEquipmentDetails} wide />
        <Detail label="Actions taken" value={incident.actionsTaken} wide />
      </Section>

      <Section title="Investigation & ownership">
        <Detail label="RCA status" value={incident.rcaStatus} />
        <Detail label="Ownership" value={incident.ownership} />
        <Detail label="Root cause / reason" value={incident.realReason} wide />
        <Detail label="Remarks" value={incident.remarks} wide />
      </Section>

      <Section title="Closure details">
        <Detail label="Closure date" value={displayDate(incident.closureDate)} />
        <Detail label="Closure time" value={incident.closureTime} />
        <Detail label="Closure remarks" value={incident.closureRemarks} wide />
      </Section>

      <section className="incident-detail-document" aria-label="RCA document">
        <div><h3>RCA document</h3><p>{incident.rcaFileUrl ? 'Supporting root cause analysis report' : 'No RCA document attached'}</p></div>
        {incident.rcaFileUrl && <a href={incident.rcaFileUrl} target="_blank" rel="noopener noreferrer">View document ↗</a>}
      </section>
    </Modal>
  );
}
