/* src/pages/SLDEditor.js */
import React, { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { PDFDocument } from "pdf-lib";
import "../assets/SLDEditor.css";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

const uid = () => Math.random().toString(36).slice(2, 9);

// deep copy helper for history snapshots
const deepCopy = (v) => JSON.parse(JSON.stringify(v));

export default function SLDEditor() {
  // core state
  const [fileName, setFileName] = useState("");
  const [pdfBuffer, setPdfBuffer] = useState(null);
  const [pages, setPages] = useState([]); // each: {displayWidth,displayHeight,renderWidth,renderHeight,dataUrl,elements,svgRef}
  const [currentPage, setCurrentPage] = useState(0);
  const [tool, setTool] = useState("select"); // select,line,rect,circle,arrow,freehand,text,highlighter,eraser
  const [zoom, setZoom] = useState(1);
  const [selectedId, setSelectedId] = useState(null);

  // drag & draw refs
  const drawState = useRef({ drawing: false, id: null, start: null });
  const dragState = useRef({ dragging: false, id: null, startClient: null, startEl: null, mode: null }); // mode: move|resize
  // undo / redo
  const historyRef = useRef({ stack: [], idx: -1, capacity: 60 });

  // --- History helpers ---
  const pushHistory = (label = "") => {
    const snapshot = deepCopy(pages);
    const st = historyRef.current;
    // truncate future
    if (st.idx < st.stack.length - 1) st.stack = st.stack.slice(0, st.idx + 1);
    st.stack.push({ snapshot, label });
    if (st.stack.length > st.capacity) st.stack.shift();
    st.idx = st.stack.length - 1;
  };

  const undo = () => {
    const st = historyRef.current;
    if (st.idx <= 0) return;
    st.idx -= 1;
    setPages(deepCopy(st.stack[st.idx].snapshot));
    setSelectedId(null);
  };

  const redo = () => {
    const st = historyRef.current;
    if (st.idx >= st.stack.length - 1) return;
    st.idx += 1;
    setPages(deepCopy(st.stack[st.idx].snapshot));
    setSelectedId(null);
  };

  // --- Load PDF (render at high internal resolution for crisp export) ---
  const onFile = async (file) => {
    const buf = await file.arrayBuffer();
    setPdfBuffer(buf);
    setFileName(file.name);

    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const pageEntries = [];
    const baseScale = 1;
    const devicePixelRatio = Math.max(1, window.devicePixelRatio || 1);
    const renderScale = devicePixelRatio * 2; // boost for crispness

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      // base viewport (logical/display units)
      const baseViewport = page.getViewport({ scale: baseScale });
      const displayWidth = Math.round(baseViewport.width);
      const displayHeight = Math.round(baseViewport.height);

      // render viewport (high-res for export)
      const renderViewport = page.getViewport({ scale: renderScale });
      const renderWidth = Math.round(renderViewport.width);
      const renderHeight = Math.round(renderViewport.height);

      // create high-res canvas and render
      const canvas = document.createElement("canvas");
      canvas.width = renderWidth;
      canvas.height = renderHeight;
      const ctx = canvas.getContext("2d");
      // optional: scale context? pdfjs render uses viewport so OK
      await page.render({ canvasContext: ctx, viewport: renderViewport }).promise;

      // store high-res PNG dataUrl (we will draw it at render size when exporting)
      const dataUrl = canvas.toDataURL("image/png");

      pageEntries.push({
        displayWidth,
        displayHeight,
        renderWidth,
        renderHeight,
        renderScale,
        dataUrl,
        elements: [],
        svgRef: React.createRef(),
      });
    }

    setPages(pageEntries);
    setCurrentPage(0);
    setSelectedId(null);

    // init history
    historyRef.current = { stack: [], idx: -1, capacity: 60 };
    pushHistory("load");
  };

  // --- Element helpers (add/update/remove) ---
  const addElement = (el) => {
    setPages((prev) => {
      const cp = [...prev];
      cp[currentPage] = { ...cp[currentPage], elements: [...cp[currentPage].elements, el] };
      return cp;
    });
    setSelectedId(el.id);
    pushHistory("add");
  };

  const updateElement = (id, patch) => {
    setPages((prev) => {
      const cp = [...prev];
      const p = cp[currentPage];
      cp[currentPage] = { ...p, elements: p.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)) };
      return cp;
    });
    pushHistory("update");
  };

  const removeElementById = (id) => {
    setPages((prev) => {
      const cp = [...prev];
      cp[currentPage] = { ...cp[currentPage], elements: cp[currentPage].elements.filter((e) => e.id !== id) };
      return cp;
    });
    setSelectedId(null);
    pushHistory("remove");
  };

  const clearPage = () => {
    if (!window.confirm("Clear all drawing on this page?")) return;
    setPages((prev) => {
      const cp = [...prev];
      cp[currentPage] = { ...cp[currentPage], elements: [] };
      return cp;
    });
    setSelectedId(null);
    pushHistory("clear");
  };

  // utility: convert client coords to SVG local coords (display units)
  const clientToSvgPoint = (svgEl, clientX, clientY) => {
    const pt = svgEl.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const inv = svgEl.getScreenCTM().inverse();
    return pt.matrixTransform(inv);
  };

  // hit test (return element or null)
  const hitTest = (x, y, elements) => {
    if (!elements) return null;
    for (let i = elements.length - 1; i >= 0; i--) {
      const e = elements[i];
      if (e.type === "rect") {
        const x0 = e.x, x1 = e.x + (e.w || 0), y0 = e.y, y1 = e.y + (e.h || 0);
        if (x >= Math.min(x0, x1) && x <= Math.max(x0, x1) && y >= Math.min(y0, y1) && y <= Math.max(y0, y1)) return e;
      } else if (e.type === "circle") {
        const d = Math.hypot(x - e.cx, y - e.cy);
        if (d <= (e.r || 0) + 6) return e;
      } else if (e.type === "line") {
        const d = distToSeg({ x, y }, { x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 });
        if (d < 6) return e;
      } else if (e.type === "path") {
        const bbox = pathBBox(e.d);
        if (bbox && x >= bbox.x && x <= bbox.x + bbox.w && y >= bbox.y && y <= bbox.y + bbox.h) return e;
      } else if (e.type === "text") {
        const w = (e.text?.length || 0) * 7;
        if (x >= e.x && x <= e.x + w && y >= e.y - 14 && y <= e.y + 6) return e;
      }
    }
    return null;
  };

  const distToSeg = (p, v, w) => {
    const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const proj = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
    return Math.hypot(p.x - proj.x, p.y - proj.y);
  };

  const pathBBox = (d) => {
    if (!d) return null;
    const nums = d.match(/-?\d+(\.\d+)?/g)?.map(Number);
    if (!nums || nums.length < 2) return null;
    const xs = [], ys = [];
    for (let i = 0; i < nums.length; i += 2) { xs.push(nums[i]); ys.push(nums[i + 1]); }
    const x = Math.min(...xs), X = Math.max(...xs), y = Math.min(...ys), Y = Math.max(...ys);
    return { x, y, w: X - x, h: Y - y };
  };

  // --- Mouse handlers for overlay (drawing / selecting / drag / resize) ---
  const onOverlayDown = (ev) => {
    // ignore right click
    if (ev.button === 2) return;
    const svg = pages[currentPage]?.svgRef.current;
    if (!svg) return;
    const local = clientToSvgPoint(svg, ev.clientX, ev.clientY);

    // If select tool and click on an element -> start move or start resize if clicked on a handle
    if (tool === "select") {
      const hit = hitTest(local.x, local.y, pages[currentPage].elements);
      if (hit) {
        setSelectedId(hit.id);
        // start dragging move
        dragState.current = {
          dragging: true,
          id: hit.id,
          startClient: { x: ev.clientX, y: ev.clientY },
          startEl: deepCopy(hit),
          mode: "move"
        };
        // attach window listeners for move/up
        window.addEventListener("mousemove", onWindowDragMove);
        window.addEventListener("mouseup", onWindowDragUp);
        ev.preventDefault();
        return;
      } else {
        setSelectedId(null);
      }
    }

    // Eraser: delete clicked
    if (tool === "eraser") {
      const hit = hitTest(local.x, local.y, pages[currentPage].elements);
      if (hit) removeElementById(hit.id);
      return;
    }

    // Drawing tools
    if (tool === "line" || tool === "arrow") {
      const id = uid();
      drawState.current = { drawing: true, id, start: { x: local.x, y: local.y } };
      addElement({ id, type: "line", x1: local.x, y1: local.y, x2: local.x, y2: local.y, stroke: "#e53e3e", strokeWidth: 2, arrow: tool === "arrow" });
    } else if (tool === "rect" || tool === "highlighter") {
      const id = uid();
      drawState.current = { drawing: true, id, start: { x: local.x, y: local.y } };
      const el = {
        id, type: "rect", x: local.x, y: local.y, w: 1, h: 1,
        stroke: tool === "rect" ? "#2b6cb0" : "rgba(245,158,11,0.6)",
        strokeWidth: tool === "rect" ? 2 : 0,
        fill: tool === "rect" ? "none" : "rgba(245,158,11,0.25)"
      };
      addElement(el);
    } else if (tool === "circle") {
      const id = uid();
      drawState.current = { drawing: true, id, start: { x: local.x, y: local.y } };
      addElement({ id, type: "circle", cx: local.x, cy: local.y, r: 1, stroke: "#276749", strokeWidth: 2, fill: "none" });
    } else if (tool === "freehand") {
      const id = uid();
      drawState.current = { drawing: true, id, start: { x: local.x, y: local.y } };
      addElement({ id, type: "path", d: `M ${local.x} ${local.y}`, stroke: "#9b2c2c", strokeWidth: 2, fill: "none" });
    } else if (tool === "text") {
      const text = window.prompt("Enter text:");
      if (text) {
        addElement({ id: uid(), type: "text", x: local.x, y: local.y, text, fontSize: 14, fill: "#111" });
      }
    }
  };

  const onOverlayMove = (ev) => {
    // drawing update
    if (drawState.current.drawing) {
      const svg = pages[currentPage]?.svgRef.current;
      if (!svg) return;
      const local = clientToSvgPoint(svg, ev.clientX, ev.clientY);
      const state = drawState.current;
      const el = pages[currentPage].elements.find(x => x.id === state.id);
      if (!el) return;
      if (el.type === "line") updateElement(el.id, { x2: local.x, y2: local.y });
      else if (el.type === "rect") updateElement(el.id, { w: local.x - state.start.x, h: local.y - state.start.y });
      else if (el.type === "circle") {
        const dx = local.x - state.start.x, dy = local.y - state.start.y;
        updateElement(el.id, { r: Math.sqrt(dx*dx + dy*dy) });
      } else if (el.type === "path") {
        const nextD = `${el.d} L ${local.x} ${local.y}`;
        updateElement(el.id, { d: nextD });
      }
      return;
    }

    // dragging (move/resize) handled by global window mousemove (onWindowDragMove)
  };

  const onOverlayUp = () => {
    if (drawState.current.drawing) {
      drawState.current = { drawing: false, id: null, start: null };
      pushHistory("draw-end");
    }
  };

  // --- global drag handlers for move/resize started in onOverlayDown ---
  const onWindowDragMove = (ev) => {
    const ds = dragState.current;
    if (!ds.dragging) return;
    const svg = pages[currentPage]?.svgRef.current;
    if (!svg) return;
    const currentClient = { x: ev.clientX, y: ev.clientY };
    const dx = (currentClient.x - ds.startClient.x);
    const dy = (currentClient.y - ds.startClient.y);

    // convert pixel delta to SVG coordinate delta by using screen CTM scale
    const ctm = svg.getScreenCTM();
    const scaleX = ctm.a; // approximate scale
    const scaleY = ctm.d;
    const sx = dx / scaleX;
    const sy = dy / scaleY;

    const el = ds.startEl;
    if (!el) return;

    if (ds.mode === "move") {
      if (el.type === "rect") {
        updateElement(el.id, { x: el.x + sx, y: el.y + sy });
      } else if (el.type === "circle") {
        updateElement(el.id, { cx: el.cx + sx, cy: el.cy + sy });
      } else if (el.type === "line") {
        updateElement(el.id, { x1: el.x1 + sx, y1: el.y1 + sy, x2: el.x2 + sx, y2: el.y2 + sy });
      } else if (el.type === "path") {
        // translate path by adding dx to each coordinate (simple parser)
        const nums = el.d.match(/-?\d+(\.\d+)?/g)?.map(Number);
        if (nums) {
          for (let i = 0; i < nums.length; i += 2) { nums[i] += sx; nums[i+1] += sy; }
          const pts = [];
          let idx = 0;
          el.d.replace(/([A-Za-z])|(-?\d+(\.\d+)?)/g, (m, letter, num) => {
            if (letter) pts.push(letter); else { pts.push(nums[idx++]); }
            return m;
          });
          // reconstruct naive (we'll just build 'M x y L x y ...')
          let d = "";
          for (let i = 0; i < nums.length; i += 2) { if (i === 0) d += `M ${nums[i]} ${nums[i+1]}`; else d += ` L ${nums[i]} ${nums[i+1]}`; }
          updateElement(el.id, { d });
        }
      } else if (el.type === "text") {
        updateElement(el.id, { x: el.x + sx, y: el.y + sy });
      }
    }

    // resize mode (future: implement corners). For now we only moved elements. (we add handles below)
  };

  const onWindowDragUp = (ev) => {
    if (dragState.current.dragging) {
      dragState.current = { dragging: false, id: null, startClient: null, startEl: null, mode: null };
      window.removeEventListener("mousemove", onWindowDragMove);
      window.removeEventListener("mouseup", onWindowDragUp);
      pushHistory("move");
    }
  };

  // --- Resize handles rendering and behavior ---
  // For simplicity: when element is selected and is rect/circle, we render corner handles.
  // Clicking and dragging a handle will resize. We'll implement drag-mode based on handle name.
  const startResize = (ev, handle, el) => {
    ev.stopPropagation();
    const svg = pages[currentPage]?.svgRef.current;
    if (!svg) return;
    const local = clientToSvgPoint(svg, ev.clientX, ev.clientY);
    dragState.current = {
      dragging: true,
      id: el.id,
      startClient: { x: ev.clientX, y: ev.clientY },
      startEl: deepCopy(el),
      mode: `resize-${handle}` // e.g., resize-tl, resize-br
    };
    window.addEventListener("mousemove", onResizeMove);
    window.addEventListener("mouseup", onResizeUp);
  };

  const onResizeMove = (ev) => {
    const ds = dragState.current;
    if (!ds.dragging || !ds.mode?.startsWith("resize")) return;
    const svg = pages[currentPage]?.svgRef.current;
    if (!svg) return;
    const local = clientToSvgPoint(svg, ev.clientX, ev.clientY);
    const elStart = ds.startEl;
    if (!elStart) return;
    const handle = ds.mode.replace("resize-", "");
    if (elStart.type === "rect") {
      let x = elStart.x, y = elStart.y, w = elStart.w, h = elStart.h;
      if (handle === "br") {
        w = local.x - x; h = local.y - y;
      } else if (handle === "bl") {
        const newX = local.x;
        w = (elStart.x + elStart.w) - newX;
        x = newX;
        h = local.y - elStart.y;
      } else if (handle === "tr") {
        const newY = local.y;
        h = (elStart.y + elStart.h) - newY;
        y = newY;
        w = local.x - elStart.x;
      } else if (handle === "tl") {
        const newX = local.x, newY = local.y;
        w = (elStart.x + elStart.w) - newX;
        h = (elStart.y + elStart.h) - newY;
        x = newX; y = newY;
      }
      updateElement(elStart.id, { x, y, w, h });
    } else if (elStart.type === "circle") {
      const dx = local.x - elStart.cx; const dy = local.y - elStart.cy;
      const r = Math.sqrt(dx*dx + dy*dy);
      updateElement(elStart.id, { r });
    }
  };

  const onResizeUp = () => {
    if (dragState.current.dragging && dragState.current.mode?.startsWith("resize")) {
      dragState.current = { dragging: false, id: null, startClient: null, startEl: null, mode: null };
      window.removeEventListener("mousemove", onResizeMove);
      window.removeEventListener("mouseup", onResizeUp);
      pushHistory("resize");
    }
  };

  // --- Export: rasterize page and overlay at render resolution, embed into PDF ---
  const exportPdf = async () => {
    if (!pdfBuffer) return alert("Upload an SLD PDF first.");
    const pdfDoc = await PDFDocument.load(pdfBuffer);

    for (let i = 0; i < pages.length; i++) {
      const page = pdfDoc.getPages()[i];
      const pg = pages[i];
      if (!pg) continue;

      // Offscreen canvas: use renderWidth/renderHeight (high-res)
      const can = document.createElement("canvas");
      can.width = pg.renderWidth;
      can.height = pg.renderHeight;
      const ctx = can.getContext("2d");

      // draw original rendered page (stored at render resolution)
      const base = new Image();
      base.src = pg.dataUrl;
      await base.decode();
      ctx.drawImage(base, 0, 0, pg.renderWidth, pg.renderHeight);

      // prepare SVG clone scaled up: set viewBox to display dimensions and set width/height to render dims
      const svgEl = pg.svgRef.current;
      if (svgEl) {
        const clone = svgEl.cloneNode(true);
        clone.setAttribute("viewBox", `0 0 ${pg.displayWidth} ${pg.displayHeight}`);
        clone.setAttribute("width", pg.renderWidth);
        clone.setAttribute("height", pg.renderHeight);
        const xml = new XMLSerializer().serializeToString(clone);
        const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const overlayImg = new Image();
        overlayImg.src = url;
        await overlayImg.decode();
        ctx.drawImage(overlayImg, 0, 0, pg.renderWidth, pg.renderHeight);
        URL.revokeObjectURL(url);
      }

      // convert to PNG bytes and embed
      const pngDataUrl = can.toDataURL("image/png");
      const png = await pdfDoc.embedPng(pngDataUrl);
      const { width, height } = page.getSize();
      page.drawImage(png, { x: 0, y: 0, width, height });
    }

    const out = await pdfDoc.save();
    const blob = new Blob([out], { type: "application/pdf" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const base = fileName?.replace(/\.pdf$/i, "") || "sld";
    a.download = `${base}-edited.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // small UI helpers and element renderers
  const ToolButton = ({ t, label, title }) => (
    <button onClick={() => setTool(t)} className={`btn ${tool === t ? "btn-active" : ""}`} title={title || label}>{label}</button>
  );

  const SvgElement = ({ e }) => {
    const common = {
      onMouseDown: (ev) => {
        // select element when clicked (unless drawing)
        ev.stopPropagation();
        if (tool === "select") {
          setSelectedId(e.id);
          // prevent starting overlay drag here; move handled globally on overlay down
        } else if (tool === "eraser") {
          removeElementById(e.id);
        }
      },
      style: { cursor: tool === "eraser" ? "not-allowed" : "pointer" }
    };

    if (e.type === "line") {
      return (
        <g {...common}>
          <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke={e.stroke} strokeWidth={e.strokeWidth} strokeLinecap="round" />
          {e.arrow && <path d={arrowHeadPath(e.x1, e.y1, e.x2, e.y2)} fill={e.stroke} />}
        </g>
      );
    } else if (e.type === "rect") {
      const w = e.w || 0, h = e.h || 0;
      return <rect {...common} x={e.x} y={e.y} width={w} height={h} stroke={e.stroke} strokeWidth={e.strokeWidth || 1} fill={e.fill || "none"} />;
    } else if (e.type === "circle") {
      return <circle {...common} cx={e.cx} cy={e.cy} r={e.r} stroke={e.stroke} strokeWidth={e.strokeWidth || 1} fill={e.fill || "none"} />;
    } else if (e.type === "path") {
      return <path {...common} d={e.d} stroke={e.stroke} strokeWidth={e.strokeWidth || 2} fill={e.fill || "none"} strokeLinecap="round" strokeLinejoin="round" />;
    } else if (e.type === "text") {
      return <text {...common} x={e.x} y={e.y} fontSize={e.fontSize || 14} fill={e.fill || "#111"}>{e.text}</text>;
    }
    return null;
  };

  // arrow head path (triangle) at end of line
  const arrowHeadPath = (x1, y1, x2, y2) => {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const len = 10, back = 6;
    const ax = x2 - back * Math.cos(angle), ay = y2 - back * Math.sin(angle);
    const leftx = ax - len * Math.cos(angle - Math.PI / 6);
    const lefty = ay - len * Math.sin(angle - Math.PI / 6);
    const rightx = ax - len * Math.cos(angle + Math.PI / 6);
    const righty = ay - len * Math.sin(angle + Math.PI / 6);
    return `M ${x2} ${y2} L ${leftx} ${lefty} L ${rightx} ${righty} Z`;
  };

  // Handle rendering of resize handles when element selected
  const renderHandles = () => {
    const pg = pages[currentPage];
    if (!pg) return null;
    const el = pg.elements.find(x => x.id === selectedId);
    if (!el) return null;
    if (el.type === "rect") {
      const x = el.x, y = el.y, w = el.w || 0, h = el.h || 0;
      const corners = [
        { cx: x, cy: y, name: "tl" },
        { cx: x + w, cy: y, name: "tr" },
        { cx: x, cy: y + h, name: "bl" },
        { cx: x + w, cy: y + h, name: "br" }
      ];
      return corners.map(c => (
        <rect key={c.name} className="handle" x={c.cx - 6} y={c.cy - 6} width={12} height={12}
          onMouseDown={(ev) => startResize(ev, c.name, el)} />
      ));
    } else if (el.type === "circle") {
      // single handle at rightmost point
      const cx = el.cx, cy = el.cy, r = el.r || 0;
      return <rect className="handle" x={cx + r - 6} y={cy - 6} width={12} height={12} onMouseDown={(ev) => startResize(ev, "r", el)} />;
    }
    return null;
  };

  // remove selected helper
  const removeSelected = () => {
    if (!selectedId) return alert("No element selected");
    removeElementById(selectedId);
  };

  // initialize keyboard for undo/redo (Ctrl+Z / Ctrl+Y)
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { undo(); e.preventDefault(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "Z"))) { redo(); e.preventDefault(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ensure history snapshot exists whenever pages change externally (avoid double push from internal pushes)
  useEffect(() => {
    // no-op: we manage history manually inside mutations
  }, [pages]);

  return (
    <div className="sld-editor-root">
      <header className="toolbar">
        <input type="file" accept="application/pdf" onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
        <div className="tool-row">
          <ToolButton t="select" label="Select" />
          <ToolButton t="line" label="Line" />
          <ToolButton t="arrow" label="Arrow" />
          <ToolButton t="rect" label="Rect" />
          <ToolButton t="circle" label="Circle" />
          <ToolButton t="freehand" label="Pen" />
          <ToolButton t="text" label="Text" />
          <ToolButton t="highlighter" label="Highlighter" />
          <ToolButton t="eraser" label="Eraser" />
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn" onClick={removeSelected}>Delete</button>
          <button className="btn" onClick={clearPage}>Clear</button>
          <button className="btn" onClick={undo}>Undo</button>
          <button className="btn" onClick={redo}>Redo</button>
          <label style={{ fontSize: 13 }}>Zoom</label>
          <input type="range" min="0.25" max="2" step="0.05" value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} />
          <button className="btn btn-active" onClick={exportPdf}>Export PDF</button>
        </div>
      </header>

      <main className="editor-main">
        {!pdfBuffer && <div className="empty">No PDF loaded — choose a file above.</div>}

        {pdfBuffer && pages[currentPage] && (
          <div className="page-wrapper" style={{ transform: `scale(${zoom})` }}>
            <div className="page-container" style={{ width: pages[currentPage].displayWidth, height: pages[currentPage].displayHeight }}>
              <img src={pages[currentPage].dataUrl} alt={`page-${currentPage+1}`} draggable={false}
                style={{ width: pages[currentPage].displayWidth, height: pages[currentPage].displayHeight }} />
              <svg
                ref={pages[currentPage].svgRef}
                width={pages[currentPage].displayWidth}
                height={pages[currentPage].displayHeight}
                onMouseDown={onOverlayDown}
                onMouseMove={onOverlayMove}
                onMouseUp={onOverlayUp}
                className={`overlay-svg tool-${tool}`}
              >
                {/* elements */}
                {pages[currentPage].elements.map(e => <SvgElement key={e.id} e={e} />)}
                {/* handles */}
                {renderHandles()}
              </svg>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
