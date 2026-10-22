import { validateSLD, connectorPoints, drawingBounds, linkedMeter, storedSLD, restoreSiteSLD, connectionFlow } from "./energySLDData";
const drawing = { format: "EnergyBook drawing", version: 1, site: "Sample site", items: [
  { id: "source", kind: "Ellipse", title: "Generator", x: 50, y: 10, w: 200, h: 140, point: "point-a", font_size: 10, line_width: 3, fill: "#ffffff" },
  { id: "breaker", kind: "Breaker", title: "Main breaker", x: 100, y: 250, w: 120, h: 160 },
  { id: "bus", kind: "Busbar", title: "Distribution bus", x: 20, y: 500, w: 600, h: 50 },
  { id: "c1", kind: "Connector", source: "source", target: "breaker", source_port: "Bottom", target_port: "Top", source_fraction: .5, target_fraction: .25, waypoints: [[150, 200], [130, 200]] },
  { id: "c2", kind: "Connector", source: "breaker", target: "bus", source_port: "Bottom", target_port: "Top", waypoints: [] },
] };
test("EnergyBook items preserve shapes, dimensions, port fractions, waypoints and point ids", () => {
  const graph = validateSLD(drawing);
  expect(graph).toMatchObject({ title: "Sample site", format: "EnergyBook drawing" });
  expect(graph.nodes).toHaveLength(3); expect(graph.edges).toHaveLength(2);
  expect(graph.nodes[0]).toMatchObject({ type: "Ellipse", w: 200, h: 140, pointId: "point-a", meterId: "", fontSize: 10, lineWidth: 3 });
  expect(connectorPoints(graph.edges[0], graph.nodes)).toEqual([[150, 150], [150, 200], [130, 200], [130, 250]]);
  expect(drawingBounds(graph)).toEqual({ x: -10, y: -20, width: 660, height: 600 });
});
test("bounds include remote waypoints and connection endpoints stay on shape edges", () => {
  const graph = validateSLD({ ...drawing, items: drawing.items.map((item) => item.id === "c1" ? { ...item, waypoints: [[-100, -100]] } : item) });
  expect(drawingBounds(graph).x).toBe(-130);
  const points = connectorPoints(graph.edges[1], graph.nodes);
  expect(points[0]).toEqual([160, 410]); expect(points[points.length - 1]).toEqual([320, 500]);
});
test("point ids link by explicit identity only, never by equipment title", () => {
  const node = validateSLD(drawing).nodes[0];
  const meter = { id: "meter-7", pointId: "point-a" };
  expect(linkedMeter(node, [meter])).toBe(meter);
  expect(linkedMeter(node, [{ id: "meter-1", name: "Generator" }])).toBeUndefined();
});
test("unsupported versions and invalid connector data are rejected", () => {
  expect(() => validateSLD({ ...drawing, version: 2 })).toThrow(/version/);
  expect(() => validateSLD({ ...drawing, items: [...drawing.items, drawing.items[0]] })).toThrow(/unique/);
  expect(() => validateSLD({ ...drawing, items: drawing.items.map((i) => i.id === "c1" ? { ...i, waypoints: [["bad", 2]] } : i) })).toThrow(/waypoints/);
  expect(() => validateSLD({ ...drawing, items: drawing.items.map((i) => i.id === "c1" ? { ...i, source_port: "Missing" } : i) })).toThrow(/ports/);
});

test("saved EnergyBook drawings preserve dimensions, points and connector routes", () => {
  const original = validateSLD(drawing);
  const saved = restoreSiteSLD({ version: 1, drawing: storedSLD(original), meterLinks: { source: "meter-1" }, edgeLinks: { "edge-0": { meterId: "meter-1", polarity: -1 } } });
  const restored = validateSLD(saved.drawing);
  expect(restored.format).toBe("EnergyBook drawing");
  expect(restored.nodes[0]).toEqual(original.nodes[0]);
  expect(restored.edges).toEqual(original.edges);
  expect(saved.meterLinks).toEqual({ source: "meter-1" });
});
test("power flow uses explicit connection mapping and installed polarity only for fresh valid readings", () => {
  const meter = { id: "m1", powerUnits: "base", active_power: 2500 };
  expect(connectionFlow({ meterId: "m1", polarity: 1 }, [meter], () => "Live")).toMatchObject({ value: 2.5, direction: 1 });
  expect(connectionFlow({ meterId: "m1", polarity: -1 }, [meter], () => "Live")).toMatchObject({ value: -2.5, direction: -1 });
  expect(connectionFlow({ meterId: "m1", polarity: 1 }, [{ ...meter, active_power: -2500 }], () => "Live").direction).toBe(-1);
  expect(connectionFlow({ meterId: "m1" }, [meter], () => "Stale / offline").direction).toBe(0);
  expect(connectionFlow({}, [meter], () => "Live").direction).toBe(0);
  expect(connectionFlow({ meterId: "m1" }, [{ ...meter, active_power: 0 }], () => "Live").direction).toBe(0);
  expect(connectionFlow({ meterId: "m1" }, [{ ...meter, powerUnits: "unknown" }], () => "Live").value).toBeNull();
});
