const finite = (v) => typeof v === "number" && Number.isFinite(v);
const text = (v, length = 200) => String(v ?? "").slice(0, length);
const ports = ["auto", "top", "bottom", "left", "right"];
const coordinate = (v) => finite(v) && Math.abs(v) <= 10000;
export function validateSLD(input) {
  const drawing = input?.format === "EnergyBook drawing";
  if (drawing && input.version !== 1) throw new Error("Unsupported EnergyBook drawing version. Use version 1.");
  if (drawing && (!Array.isArray(input.items) || input.items.length > 700)) throw new Error("EnergyBook drawing must contain up to 700 items.");
  if (drawing) {
    const ids = new Set();
    input.items.forEach((item) => {
      if (!item || typeof item.id !== "string" || !item.id.trim() || ids.has(item.id)) throw new Error("Each drawing item needs a unique nonempty string id.");
      ids.add(item.id);
    });
  }
  const sourceNodes = drawing ? input.items.filter((i) => i.kind !== "Connector") : input?.nodes;
  const sourceEdges = drawing ? input.items.filter((i) => i.kind === "Connector") : input?.edges;
  if (!Array.isArray(sourceNodes) || !Array.isArray(sourceEdges)) throw new Error("Import an EnergyBook drawing export or JSON with nodes and edges arrays.");
  if (!sourceNodes.length || sourceNodes.length > 200 || sourceEdges.length > 500) throw new Error("Use 1–200 nodes and up to 500 connections.");
  const ids = new Set();
  const nodes = sourceNodes.map((node, index) => {
    if (!node || typeof node.id !== "string" || !node.id.trim() || ids.has(node.id)) throw new Error("Each node needs a unique nonempty string id.");
    ids.add(node.id);
    const x = node.x ?? node.position?.x ?? (index % 4) * 240 + 30;
    const y = node.y ?? node.position?.y ?? Math.floor(index / 4) * 150 + 30;
    const w = node.w ?? node.width ?? 180, h = node.h ?? node.height ?? 90;
    if (!coordinate(x) || !coordinate(y)) throw new Error("Node coordinates must be finite numbers between -10000 and 10000.");
    if (!finite(w) || !finite(h) || w <= 0 || h <= 0 || w > 5000 || h > 5000) throw new Error("Shape dimensions must be positive numbers up to 5000.");
    return { id: node.id, label: text(drawing ? node.title : node.label ?? node.data?.label ?? node.id), type: text(drawing ? node.kind : node.type || "equipment", 30),
      meterId: typeof (node.meterId ?? node.data?.meterId) === "string" ? (node.meterId ?? node.data?.meterId) : "",
      pointId: typeof (drawing ? node.point : node.pointId) === "string" ? (drawing ? node.point : node.pointId) : "", equipmentType: text(node.equipment_type ?? node.equipmentType),
      x, y, w, h, fontSize: finite(node.font_size ?? node.fontSize) ? Math.max(8, Math.min(24, node.font_size ?? node.fontSize)) : 12,
      lineWidth: finite(node.line_width ?? node.lineWidth) ? Math.max(1, Math.min(10, node.line_width ?? node.lineWidth)) : 2,
      fill: /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(node.fill || "") ? node.fill : null };
  });
  const edges = sourceEdges.map((edge, index) => {
    const source = edge?.source ?? edge?.from, target = edge?.target ?? edge?.to;
    if (!ids.has(source) || !ids.has(target)) throw new Error("Every connection must reference existing node ids.");
    const sourcePort = text(edge.source_port ?? edge.sourcePort ?? "Right").toLowerCase(), targetPort = text(edge.target_port ?? edge.targetPort ?? "Left").toLowerCase();
    if (!ports.includes(sourcePort) || !ports.includes(targetPort)) throw new Error("Connector ports must be Auto, Top, Bottom, Left or Right.");
    const sourceFraction = edge.source_fraction ?? edge.sourceFraction ?? .5, targetFraction = edge.target_fraction ?? edge.targetFraction ?? .5;
    if (![sourceFraction, targetFraction].every((v) => finite(v) && v >= 0 && v <= 1)) throw new Error("Port fractions must be numbers from 0 to 1.");
    const waypoints = edge.waypoints ?? [];
    if (!Array.isArray(waypoints) || waypoints.length > 100 || !waypoints.every((p) => Array.isArray(p) && p.length === 2 && p.every(coordinate))) throw new Error("Connector waypoints must be [x, y] coordinate pairs (up to 100).");
    return { id: `edge-${index}`, source, target, label: text(edge.label ?? edge.title), sourcePort, targetPort, sourceFraction, targetFraction, waypoints,
      lineWidth: finite(edge.line_width ?? edge.lineWidth) ? Math.max(1, Math.min(10, edge.line_width ?? edge.lineWidth)) : 2 };
  });
  return { title: text(drawing ? input.site || "EnergyBook drawing" : input.title || "Electrical single-line diagram"), format: drawing || input.drawingFormat === "EnergyBook drawing" ? "EnergyBook drawing" : "Graph", nodes, edges };
}
function endpoint(node, port, fraction, toward) {
  if (port === "auto") {
    const dx = toward[0] - (node.x + node.w / 2), dy = toward[1] - (node.y + node.h / 2);
    port = Math.abs(dx) / node.w > Math.abs(dy) / node.h ? (dx >= 0 ? "right" : "left") : (dy >= 0 ? "bottom" : "top");
  }
  if (port === "top" || port === "bottom") return [node.x + node.w * fraction, node.y + (port === "bottom" ? node.h : 0)];
  return [node.x + (port === "right" ? node.w : 0), node.y + node.h * fraction];
}
export function connectorPoints(edge, nodes) {
  const a = nodes.find((n) => n.id === edge.source), b = nodes.find((n) => n.id === edge.target);
  const start = endpoint(a, edge.sourcePort, edge.sourceFraction, edge.waypoints[0] || [b.x + b.w / 2, b.y + b.h / 2]);
  const end = endpoint(b, edge.targetPort, edge.targetFraction, edge.waypoints[edge.waypoints.length - 1] || [a.x + a.w / 2, a.y + a.h / 2]);
  if (edge.waypoints.length) return [start, ...edge.waypoints, end];
  if (start[0] === end[0] || start[1] === end[1]) return [start, end];
  return ["top", "bottom"].includes(edge.sourcePort) ? [start, [start[0], (start[1] + end[1]) / 2], [end[0], (start[1] + end[1]) / 2], end] : [start, [(start[0] + end[0]) / 2, start[1]], [(start[0] + end[0]) / 2, end[1]], end];
}
export function drawingBounds(graph) {
  const xs = graph.nodes.flatMap((n) => [n.x, n.x + n.w]);
  const ys = graph.nodes.flatMap((n) => [n.y, n.y + n.h]);
  graph.edges.forEach((e) => e.waypoints.forEach(([x, y]) => { xs.push(x); ys.push(y); }));
  const x = Math.min(...xs) - 30, y = Math.min(...ys) - 30;
  return { x, y, width: Math.max(...xs) - x + 30, height: Math.max(...ys) - y + 30 };
}
export function linkedMeter(node, meters) {
  if (node.meterId) return meters.find((m) => m.id === node.meterId);
  if (!node.pointId) return undefined;
  return meters.find((m) => [m.id, m.pointId, m.point_id, m.point, m.energyBookPointId].includes(node.pointId));
}
export function wrapDrawingLabel(label, width, fontSize) {
  const limit = Math.max(5, Math.floor((width - 12) / (fontSize * .6))), lines = [];
  for (const word of label.split(/\s+/)) {
    if (lines.length && (lines[lines.length - 1] + " " + word).length <= limit) lines[lines.length - 1] += " " + word;
    else lines.push(word.length > limit ? word.slice(0, limit - 1) + "…" : word);
  }
  return lines.slice(0, 4);
}

export function storedSLD(graph) {
  return { format: "EnergyMonitor SLD", version: 1, drawingFormat: graph.format, title: graph.title, nodes: graph.nodes, edges: graph.edges };
}
export function restoreSiteSLD(payload) {
  if (!payload || payload.version !== 1) throw new Error("Unsupported saved SLD version.");
  const graph = validateSLD(payload.drawing);
  const ids = new Set(graph.nodes.map((n) => n.id));
  const edgeIds = new Set(graph.edges.map((e) => e.id));
  const meterLinks = Object.fromEntries(Object.entries(payload.meterLinks || {}).filter(([key, value]) => ids.has(key) && typeof value === "string"));
  const edgeLinks = Object.fromEntries(Object.entries(payload.edgeLinks || {}).filter(([key, value]) => edgeIds.has(key) && value && typeof value.meterId === "string" && [1, -1].includes(value.polarity)).map(([key, value]) => [key, { meterId: value.meterId, polarity: value.polarity }]));
  return { version: 1, drawing: storedSLD(graph), meterLinks, edgeLinks, modifiedAt: typeof payload.modifiedAt === "string" ? payload.modifiedAt : "", dirty: payload.dirty === true };
}
export function connectionFlow(link, meters, statusOf) {
  const meter = link?.meterId ? meters.find((m) => m.id === link.meterId) : null;
  if (!meter) return { state: "Unmapped", value: null, direction: 0 };
  if (statusOf(meter) !== "Live") return { state: statusOf(meter), value: null, direction: 0 };
  if (!["base", "kilo"].includes(meter.powerUnits) || !finite(meter.active_power)) return { state: "Units / reading unavailable", value: null, direction: 0 };
  const value = meter.active_power / (meter.powerUnits === "base" ? 1000 : 1) * (link.polarity === -1 ? -1 : 1);
  return { state: value === 0 ? "No measured load" : "Live", value, direction: Math.sign(value) };
}
