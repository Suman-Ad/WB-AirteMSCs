import React, { useState } from "react";
import { validateSLD, sampleSLD, downloadFile } from "./energyReportData";
import { connectorPoints, drawingBounds, linkedMeter, wrapDrawingLabel, connectionFlow } from "./energySLDData";
import useSiteSLD from "./useSiteSLD";
import EnergySLDMeterDetails from "./EnergySLDMeterDetails";
import EnergySLDMeterDial from "./EnergySLDMeterDial";
import { displayReading } from "./energyMeterData";

export default function EnergySLD({ siteId, meters, onSelect, statusOf, canEdit = false }) {
  const { graph, meterLinks, edgeLinks, update, save, remove, saving, status, storageError } = useSiteSLD(siteId, canEdit);
  const [error, setError] = useState(""), [zoom, setZoom] = useState(1);
  const [focused, setFocused] = useState("");
  const [focusedEdge, setFocusedEdge] = useState("");
  const [meterSearch, setMeterSearch] = useState("");
  const meterFor = (node) => Object.prototype.hasOwnProperty.call(meterLinks, node.id) ? meters.find((m) => m.id === meterLinks[node.id]) : linkedMeter(node, meters);
  const importFile = async (event) => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file || !canEdit) return;
    try {
      if (file.size > 1024 * 1024) throw new Error("Use a JSON file smaller than 1 MB.");
      const data = validateSLD(JSON.parse((await file.text()).replace(/^\uFEFF/, "")));
      update(data, {}, {}); setFocused(""); setFocusedEdge(""); setError(""); setZoom(1); await save();
    } catch (err) { setError(err.message || "Unable to import JSON."); }
  };
  const bounds = graph ? drawingBounds(graph) : null;
  const selectedNode = graph?.nodes.find((n) => n.id === focused);
  const selectedMeter = selectedNode ? meterFor(selectedNode) : null;
  const selectedEdge = graph?.edges.find((e) => e.id === focusedEdge);
  const changeEdge = (patch) => update(graph, meterLinks, { ...edgeLinks, [focusedEdge]: { meterId: "", polarity: 1, ...edgeLinks[focusedEdge], ...patch } });
  const powerText = (meter, key) => { const r = displayReading(meter, key); return `${r.value?.toLocaleString(undefined, { maximumFractionDigits: 2 }) ?? "—"} ${r.unit}`; };
  return <section className="energy-card energy-sld-console"><div className="energy-section-title"><div><h2>Electrical SLD</h2><p>Live distribution · Meter instruments · Power quality</p></div><details className="energy-sld-tools" open={canEdit || undefined}><summary>Drawing & settings</summary><div className="energy-detail-actions">{canEdit && <><label className="energy-file-button">Import .json<input type="file" accept=".json,application/json" onChange={importFile} /></label><button disabled={!graph || !siteId || saving} onClick={save}>{saving ? "Saving site SLD…" : "Save site SLD"}</button><button disabled={!graph || saving} onClick={remove}>Delete site SLD</button></>}<button onClick={() => downloadFile("energy-sld-sample.json", JSON.stringify(sampleSLD, null, 2), "application/json")}>Download sample</button></div></details></div>
    <p className="energy-muted" role="status">{status}</p>
    {storageError && <p role="alert" className="energy-notice">{storageError}</p>}
    {error && <p role="alert" className="energy-notice">{error}</p>}
    {!graph ? <div className="energy-empty">No shared SLD is available. An Admin or Super Admin can upload the site JSON once for all site users.<br />EnergyBook drawing exports (version 1, items) and nodes/edges graph JSON are supported. Original shapes, dimensions, connector ports and waypoints are preserved.</div> : <><div className="energy-section-title"><h3>{graph.title}</h3><div className="energy-detail-actions energy-sld-zoom"><button aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(.4, z - .2))}>−</button><span>{Math.round(zoom * 100)}%</span><button aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(3, z + .2))}>+</button><button onClick={() => setZoom(1)}>Fit width</button></div></div>
      <div className="energy-sld-health-strip"><span><i className="energy-status-light is-online" />{meters.filter((m) => statusOf(m) === "Live").length} live meters</span><span>{graph.nodes.filter((n) => meterFor(n)).length} linked points</span><span>{graph.edges.length} connections</span><span className="energy-muted">Select a point to inspect</span></div>
      <div className="energy-sld-workspace"><div className="energy-sld-scroll"><svg viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`} style={{ width: `${zoom * 100}%`, height: "auto", aspectRatio: `${bounds.width} / ${bounds.height}` }} role="img" aria-label="Imported electrical single-line diagram">
        {graph.edges.map((edge) => {
          const points = connectorPoints(edge, graph.nodes), center = points[Math.floor(points.length / 2)];
          const flow = connectionFlow(edgeLinks[edge.id], meters, statusOf), active = flow.direction !== 0;
          const connectionMeter = meters.find((m) => m.id === edgeLinks[edge.id]?.meterId);
          const attachedMeters = [edge.source, edge.target].map((id) => graph.nodes.find((node) => node.id === id)).filter(Boolean).map(meterFor).filter(Boolean);
          const hasConnectionMapping = Boolean(edgeLinks[edge.id]?.meterId);
          const online = hasConnectionMapping ? Boolean(connectionMeter && statusOf(connectionMeter) === "Live") : attachedMeters.some((m) => statusOf(m) === "Live");
          const glowStatus = hasConnectionMapping ? flow.state : online ? "Attached meter online · connection flow unverified" : flow.state;
          const choose = () => { setFocusedEdge(edge.id); setFocused(""); };
          return <g key={edge.id} role="button" tabIndex={0} aria-label={`Map connection ${graph.nodes.find((n) => n.id === edge.source)?.label} to ${graph.nodes.find((n) => n.id === edge.target)?.label}`} onClick={choose} onKeyDown={(e) => { if (["Enter", " "].includes(e.key)) { e.preventDefault(); choose(); } }} className={`energy-sld-connection ${online ? "is-online" : ""}`}>
            {online && [12, 6].map((width, i) => <polyline key={width} className="energy-sld-wire-halo" points={points.map((p) => p.join(",")).join(" ")} fill="none" stroke="#22c55e" strokeOpacity={i ? .23 : .1} strokeWidth={edge.lineWidth + width} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />)}
            <polyline points={points.map((p) => p.join(",")).join(" ")} fill="none" className="energy-sld-wire" stroke={online ? "#22c55e" : "var(--app-text-muted)"} strokeWidth={online ? Math.max(2.5, edge.lineWidth) : edge.lineWidth} strokeLinecap="round" strokeLinejoin="round"><title>{edge.label || `${edge.source} → ${edge.target}`} · {glowStatus}</title></polyline>
            {active && <polyline role="img" aria-label={`Measured power flow ${flow.direction > 0 ? "forward" : "reverse"}`} data-flow-direction={flow.direction > 0 ? "forward" : "reverse"} className={`energy-sld-flow ${flow.direction < 0 ? "is-reverse" : ""}`} points={points.map((p) => p.join(",")).join(" ")} fill="none" stroke="#16a34a" strokeWidth={edge.lineWidth + 2} strokeDasharray="7 12" />}
            <polyline points={points.map((p) => p.join(",")).join(" ")} fill="none" stroke={focusedEdge === edge.id ? "var(--theme-primary)" : "transparent"} strokeOpacity={focusedEdge === edge.id ? .18 : 0} strokeWidth="14" pointerEvents="stroke" />
            {edge.label && <text x={center[0] + 5} y={center[1] - 15} className="energy-sld-edge-label">{edge.label}</text>}
            {edgeLinks[edge.id]?.meterId && <text x={center[0] + 5} y={center[1] + 12} className="energy-sld-edge-label">{flow.value === null ? flow.state : `${flow.value.toFixed(2)} kW · ${flow.direction > 0 ? "source → target" : flow.direction < 0 ? "target → source" : "no load"}`}</text>}
          </g>;
        })}
        {graph.nodes.map((node) => {
          const m = meterFor(node), reading = displayReading(m, "active_power");
          const select = () => { setFocused(node.id); setFocusedEdge(""); }, original = graph.format === "EnergyBook drawing";
          const fill = !node.fill || /^#fff(fff)?$/i.test(node.fill) ? "var(--app-surface)" : node.fill;
          const shapeProps = { fill, stroke: focused === node.id ? "var(--theme-primary)" : "var(--app-border)", strokeWidth: node.lineWidth };
          const lines = wrapDrawingLabel(node.label, node.w, node.fontSize);
          return <g key={node.id} role="button" tabIndex={0} aria-label={`${node.label}${m ? `, ${statusOf(m)}` : ""}`} onClick={select} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(); } }} className={`energy-sld-node ${m && statusOf(m) === "Live" ? "is-online" : ""}`}>
            <title>{node.label}{node.pointId ? ` · EnergyBook point ${node.pointId}` : ""}</title>
            {node.type.toLowerCase() === "ellipse" ? <ellipse cx={node.x + node.w / 2} cy={node.y + node.h / 2} rx={node.w / 2} ry={node.h / 2} {...shapeProps} /> : <rect x={node.x} y={node.y} width={node.w} height={node.h} rx={node.type.toLowerCase() === "busbar" ? 0 : 5} {...shapeProps} />}
            {node.type.toLowerCase() === "busbar" && <line x1={node.x + 6} y1={node.y + node.h - 10} x2={node.x + node.w - 6} y2={node.y + node.h - 10} stroke="var(--theme-primary)" strokeWidth={node.lineWidth * 2} />}
            {original ? <text x={node.x + node.w / 2} textAnchor="middle" style={{ fontSize: node.fontSize }}>{lines.map((line, i) => <tspan key={i} x={node.x + node.w / 2} y={node.y + node.h / 2 - (m ? Math.min(25, node.h * .24) : 0) - (lines.length - 1) * node.fontSize * .65 + i * node.fontSize * 1.3}>{line}</tspan>)}</text> : <><text x={node.x + 12} y={node.y + (m ? 14 : 20)}>{node.type.toUpperCase()}</text><text x={node.x + 12} y={node.y + (m ? 30 : 43)}>{node.label.length > 23 ? node.label.slice(0, 21) + "…" : node.label}</text><text visibility={m ? "hidden" : undefined} x={node.x + 12} y={node.y + 67}>{m ? `${reading.value?.toFixed(2) ?? "—"} kW · ${statusOf(m)}` : node.meterId ? "Meter not connected" : "No linked meter"}</text></>}
            {m && <EnergySLDMeterDial node={node} meter={m} state={statusOf(m)} />}
            {m && <circle cx={node.x + node.w - 9} cy={node.y + 9} r="5" fill={statusOf(m) === "Live" ? "#16a34a" : /Cached|Waiting/.test(statusOf(m)) ? "#d97706" : "#dc2626"}><title>{m.name || m.id}: {statusOf(m)}</title></circle>}
          </g>;
        })}
      </svg></div><aside className="energy-sld-meter-rail" aria-label="SLD meter instruments"><div className="energy-section-title"><h3>Meter instruments</h3><span className="energy-muted">{graph.nodes.filter((n) => meterFor(n)).length}</span></div><input type="search" aria-label="Search SLD meters" placeholder="Find meter or equipment…" value={meterSearch} onChange={(e) => setMeterSearch(e.target.value)} /><div className="energy-sld-rail-list">{graph.nodes.filter((node) => meterFor(node) && `${node.label} ${meterFor(node).name || ""} ${meterFor(node).id}`.toLowerCase().includes(meterSearch.toLowerCase())).map((node) => { const m=meterFor(node); return <button key={node.id} className={`energy-sld-rail-meter ${focused === node.id ? "is-selected" : ""} ${statusOf(m) === "Live" ? "is-online" : ""}`} aria-label={`Inspect ${node.label}`} aria-pressed={focused === node.id} onClick={() => {setFocused(node.id);setFocusedEdge("");}}><span className="energy-sld-rail-title">{node.label}<small>{m.meterId || m.id} · {statusOf(m)}</small></span><svg viewBox="0 36 220 48" aria-hidden="true"><EnergySLDMeterDial node={{x:0,y:0,w:220,h:84}} meter={m} state={statusOf(m)} /></svg><span className="energy-sld-rail-values"><span>V L-L <b>{powerText(m,"voltage_ll")}</b></span><span>Current <b>{powerText(m,"current")}</b></span><span>PF <b>{powerText(m,"power_factor")}</b></span></span></button>; })}</div>{!graph.nodes.some((n) => meterFor(n)) && <p className="energy-muted">Select a drawing point to link a meter.</p>}</aside></div>
      {selectedNode && <div className="energy-notice energy-sld-selection"><strong>{selectedNode.label}</strong><p>{selectedNode.equipmentType || selectedNode.type} · {selectedMeter ? `${selectedMeter.name || selectedMeter.id} · ${statusOf(selectedMeter)} · ${displayReading(selectedMeter, "active_power").value?.toFixed(2) ?? "—"} kW` : selectedNode.pointId ? `EnergyBook point: ${selectedNode.pointId} · No matching live meter` : selectedNode.meterId ? `${selectedNode.meterId} · Meter not connected` : "No meter linked"}</p><div className="energy-detail-actions"><label htmlFor="energy-sld-meter-link">Linked live meter<select disabled={!canEdit} id="energy-sld-meter-link" value={selectedMeter?.id || ""} onChange={(event) => update(graph, { ...meterLinks, [selectedNode.id]: event.target.value }, edgeLinks)}><option value="">No linked meter</option>{meters.map((m) => <option value={m.id} key={m.id}>{m.name || m.id}</option>)}</select></label>{selectedMeter && <button onClick={() => onSelect(selectedMeter.id)}>Open meter readings →</button>}</div><small className="energy-muted">Admins can edit mappings and use Save site SLD to publish them for all site users.</small></div>}
      {selectedMeter && <EnergySLDMeterDetails key={`${siteId}:${selectedNode.id}:${selectedMeter.id}`} meter={selectedMeter} state={statusOf(selectedMeter)} onOpen={onSelect} />}
      {selectedEdge && <div className="energy-notice"><h3>Connection power-flow mapping</h3><p>{graph.nodes.find((n) => n.id === selectedEdge.source)?.label} → {graph.nodes.find((n) => n.id === selectedEdge.target)?.label}</p><div className="energy-detail-actions"><label htmlFor="energy-sld-edge-meter">Connection meter<select disabled={!canEdit} id="energy-sld-edge-meter" value={edgeLinks[focusedEdge]?.meterId || ""} onChange={(e) => changeEdge({ meterId: e.target.value })}><option value="">No mapped meter</option>{meters.map((m) => <option key={m.id} value={m.id}>{m.name || m.id}</option>)}</select></label><label htmlFor="energy-sld-edge-polarity">Meter positive power direction<select disabled={!canEdit} id="energy-sld-edge-polarity" value={edgeLinks[focusedEdge]?.polarity || 1} onChange={(e) => changeEdge({ polarity: Number(e.target.value) })}><option value={1}>Source → target</option><option value={-1}>Target → source</option></select></label></div><p>Map the meter that measures this connection and confirm its installed polarity. Positive or negative kW drives the animation; stale, offline, zero and unmapped connections remain still.</p></div>}
      <details className="energy-sld-help"><summary>Connection legend & drawing information</summary><p className="energy-muted">Flow legend: green glow = mapped connection meter online, or an attached meter online when no connection meter is mapped. Glow indicates meter connectivity, not verified line energization. Moving dashes require live mapped nonzero kW. No branch flow is inferred from a node mapping. Line movement does not verify breaker position.</p>
      <p className="energy-muted">Site: {siteId || "Unassigned"} · {graph.format} · {graph.nodes.length} shapes · {graph.edges.length} connections. Connections retain the imported drawing layout; live flow is based on explicitly mapped connection meters.</p></details>
    </>}
  </section>;
}
