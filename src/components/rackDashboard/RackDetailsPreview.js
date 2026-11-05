import React from "react";
import { Button, Modal, Tabs } from "antd";
import ActivityTab from "../RackTracker/tab/ActivityTab";
import "./RackDashboard.css";

const generalKeys = ["circle", "siteName", "equipmentLocation", "equipmentRackNo", "rackName", "powerType", "sourceType", "rackSize", "rackDescription", "rackOwnerName"];
const sourceAKeys = ["smpsRatingA", "smpsNameA", "dbNumberA", "incomerRatingA", "cableSizeA", "cableRunA", "equipmentRackNoA", "rackNameA", "rackIncomingCableSizeA", "rackCableRunA", "dbMcbNumberA", "dbMcbRatingA", "tempOnMcbA", "runningLoadA", "cableCapacityA", "pctLoadCableA", "pctLoadMcbA", "rackEndNoDbA", "rackEndDcdbNameA", "rackEndRunningLoadA", "rackEndMcbRatingA", "rackEndPctLoadMcbA", "remarksA", "dbVoltageA", "cableLengthA", "rackCableLengthA", "cableTaggingA", "rackEndVoltageA", "dbMcbLabelA"];
const sourceBKeys = ["smpsRatingB", "smpsNameB", "dbNumberB", "incomerRatingB", "cableSizeB", "cableRunB", "equipmentRackNoB", "rackNameB", "rackIncomingCableSizeB", "rackCableRunB", "dbMcbNumberB", "dbMcbRatingB", "tempOnMcbB", "runningLoadB", "cableCapacityB", "pctLoadCableB", "pctLoadMcbB", "rackEndNoDbB", "rackEndDcdbNameB", "rackEndRunningLoadB", "rackEndMcbRatingB", "rackEndPctLoadMcbB", "remarksB", "dbVoltageB", "cableLengthB", "rackCableLengthB", "cableTaggingB", "rackEndVoltageB", "dbMcbLabelB"];
const analysisKeys = ["totalLoadBoth", "bothCableCapacity", "bothPctLoadCable", "bothPctLoadMcb", "isBothMcbSame"];

const label = key => ({ dbMcbNumberA: 'DB MCB number A', dbMcbNumberB: 'DB MCB number B', totalLoadBoth: 'Total running load (A)', updatedAt: 'Last updated' }[key] || key.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').replace(/^./, c => c.toUpperCase()));
const display = value => {
    if (value === null || value === undefined || value === '') return 'Not provided';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value?.toDate === 'function') return value.toDate().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    if (Array.isArray(value)) return value.map(display).join(', ') || 'None';
    if (typeof value === 'object') return Object.entries(value).map(([key, item]) => `${label(key)}: ${display(item)}`).join('\n');
    return String(value);
};

const Fields = ({ rack, keys }) => (
    <dl className="rack-preview-fields">
        {keys.map(key => <div key={key}><dt>{label(key)}</dt><dd>{display(rack[key])}</dd></div>)}
    </dl>
);

export default function RackDetailsPreview({ rack, canEdit, onClose, onEdit, onDelete, onViewLayout }) {
    const general = [...new Set([...generalKeys, 'region', 'rfaiNo', 'rackPowerOnDate', 'rackType', 'rackStatus', 'switchedOffDate', 'rackDomainType', 'drTestStatus', 'drTestDate', 'frontTopTemp', 'frontMiddleTemp', 'frontBottomTemp', 'backTopTemp', 'backMiddleTemp', 'backBottomTemp'])];
    const known = [...general, ...sourceAKeys, ...sourceBKeys, ...analysisKeys, 'rackDimensions', 'rackEquipments', 'updatedBy', 'updatedAt', 'id', 'siteKey'];
    const other = Object.keys(rack).filter(key => !known.includes(key));
    const equipments = Array.isArray(rack.rackEquipments) ? rack.rackEquipments : [];
    const items = [
        { key: 'general', label: 'Overview', children: <><Fields rack={rack} keys={general} />{other.length > 0 && <><h3>Additional details</h3><Fields rack={rack} keys={other} /></>}</> },
        { key: 'a', label: 'Source A', children: <Fields rack={rack} keys={sourceAKeys} /> },
        { key: 'b', label: 'Source B', children: <Fields rack={rack} keys={sourceBKeys} /> },
        { key: 'capacity', label: 'Capacity analysis', children: <Fields rack={rack} keys={analysisKeys} /> },
        { key: 'equipment', label: `Equipment (${equipments.length})`, children: <>
            <div className="rack-preview-equipment-heading"><h3>Rack dimensions & equipment</h3><Button onClick={onViewLayout}>View 3D layout</Button></div>
            <Fields rack={{ height: rack.rackDimensions?.height ? `${rack.rackDimensions.height} mm` : null, width: rack.rackDimensions?.width ? `${rack.rackDimensions.width} mm` : null, depth: rack.rackDimensions?.depth ? `${rack.rackDimensions.depth} mm` : null, totalRackUSpace: rack.totalRackUSpace || 42 }} keys={['height', 'width', 'depth', 'totalRackUSpace']} />
            <div className="rack-table-scroll"><table className="rack-data-table rack-equipment-table"><thead><tr>{['Equipment', 'Start U', 'End U', 'Size U', 'Remarks'].map(text => <th scope="col" key={text}>{text}</th>)}</tr></thead><tbody>
                {equipments.length ? equipments.map((equipment, index) => <tr key={index}><td>{display(equipment.name)}</td><td>{display(equipment.startU)}</td><td>{display(equipment.endU)}</td><td>{display(equipment.sizeU)}</td><td>{display(equipment.remarks)}</td></tr>) : <tr><td colSpan={5}>No equipment recorded for this rack.</td></tr>}
            </tbody></table></div>
        </> },
        { key: 'activity', label: 'Activity', children: <><h3>Record information</h3><Fields rack={rack} keys={['updatedBy', 'updatedAt']} /><ActivityTab formData={rack} /></> },
    ];
    return <Modal open centered width={1120} zIndex={1200} className="rack-preview-modal" title="Rack details preview" onCancel={onClose} maskClosable={false} footer={
        <div className="rack-preview-footer"><Button onClick={onViewLayout}>View 3D layout</Button><div>{canEdit && <><Button danger onClick={onDelete}>Delete rack</Button><Button type="primary" onClick={onEdit}>Edit rack</Button></>}<Button onClick={onClose}>Close</Button></div></div>
    }>
        <div className="rack-preview-summary"><div><span className="rack-preview-eyebrow">{rack.siteName || 'Site not provided'} · {rack.equipmentLocation || 'Location not provided'}</span><h2>{rack.equipmentRackNo || 'Rack'} · {rack.rackName || 'Unnamed rack'}</h2><span>{rack.rackStatus || 'Status not provided'}</span></div><div className="rack-preview-load"><strong>{Number(rack.totalLoadBoth || 0).toFixed(2)} <small>A</small></strong><span>Total running load</span></div></div>
        <Tabs items={items} destroyOnHidden />
    </Modal>;
}
