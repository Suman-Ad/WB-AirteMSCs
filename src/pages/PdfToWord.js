import React, { useEffect, useRef, useState } from "react";
import { saveAs } from "file-saver";
import { clamp, createLayoutWordDocument, fitComponent, graphicComponents, newId, textComponents } from "../utils/pdfEditor";
import "../assets/PdfToWord.css";

const blankPage = () => ({ id: newId(), width: 595, height: 842, components: [] });
const fontFamilies = ["Arial", "Times New Roman", "Courier New"];

export default function PdfToWord() {
  const [pages, setPages] = useState([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState("document");
  const [zoom, setZoom] = useState(100);
  const [compare, setCompare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState([]);
  const history = useRef({ undo: [], redo: [] });
  const documentRef = useRef(null);
  const drag = useRef(null);
  const imageInput = useRef(null);
  const replaceImage = useRef(false);
  const alive = useRef(true);
  const page = pages[pageIndex];
  const selected = page?.components.find(c => c.id === selectedId);
  const scale = zoom / 100;
  useEffect(() => { alive.current = true; return () => { alive.current = false; documentRef.current?.destroy(); }; }, []);

  function commit(next, record = true) {
    if (record) { history.current.undo = [...history.current.undo.slice(-39), pages]; history.current.redo = []; }
    setPages(next);
  }
  function restore(direction) {
    const source = history.current[direction];
    if (!source.length) return;
    const next = source.pop();
    history.current[direction === "undo" ? "redo" : "undo"].push(pages);
    setPages(next); setSelectedId(null); setPageIndex(i => Math.min(i, next.length - 1));
  }
  function changeComponent(patch, record = true) {
    if (!selected || busy || compare) return;
    commit(pages.map((p, i) => i === pageIndex ? { ...p, components: p.components.map(c => c.id === selectedId ? fitComponent({ ...c, ...patch }, p) : c) } : p), record);
  }
  function addComponent(component) {
    commit(pages.map((p, i) => i === pageIndex ? { ...p, components: [...p.components, fitComponent(component, p)] } : p));
    setSelectedId(component.id); setCompare(false);
  }
  function removeSelected() {
    if (!selected || busy || compare) return;
    commit(pages.map((p, i) => i === pageIndex ? { ...p, components: p.components.filter(c => c.id !== selectedId) } : p)); setSelectedId(null);
  }
  function changeOrder(delta) {
    const components = [...page.components], index = components.findIndex(c => c.id === selectedId), next = clamp(index + delta, 0, components.length - 1);
    [components[index], components[next]] = [components[next], components[index]];
    commit(pages.map((p, i) => i === pageIndex ? { ...p, components } : p));
  }
  function movePage(delta) {
    const next = [...pages], target = pageIndex + delta;
    [next[pageIndex], next[target]] = [next[target], next[pageIndex]];
    commit(next); setPageIndex(target);
  }
  function addText() { addComponent({ id: newId(), type: "text", text: "New text", x: 40, y: 40, width: 220, height: 50, fontSize: 18, fontFamily: "Arial", color: "#111827", align: "left", rotation: 0 }); }

  async function upload(file) {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name) || file.size > 50 * 1024 * 1024) { setError("Choose a PDF smaller than 50 MB."); return; }
    setBusy(true); setError(""); setStatus("Opening PDF…");
    let task;
    try {
      await documentRef.current?.destroy(); documentRef.current = null;
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.min.js`;
      task = pdfjs.getDocument({ data: await file.arrayBuffer(), isOffscreenCanvasSupported: false });
      task.onPassword = () => { task.destroy(); };
      const pdf = await task.promise;
      documentRef.current = pdf;
      const imported = [], notices = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        if (!alive.current) return;
        setStatus(`Building editable components: page ${i} of ${pdf.numPages}…`);
        const pdfPage = await pdf.getPage(i), viewport = pdfPage.getViewport({ scale: 1 });
        const canvas = document.createElement("canvas");
        const previewViewport = pdfPage.getViewport({ scale: Math.min(1.2, 1600 / Math.max(viewport.width, viewport.height)) });
        canvas.width = Math.ceil(previewViewport.width); canvas.height = Math.ceil(previewViewport.height);
        await pdfPage.render({ canvasContext: canvas.getContext("2d"), viewport: previewViewport }).promise;
        const preview = canvas.toDataURL("image/png"); canvas.width = 0; canvas.height = 0;
        const content = await pdfPage.getTextContent();
        let components = textComponents(content, viewport, pdfjs.Util.transform);
        if (!components.length) notices.push(`Page ${i}: no extractable text. Scanned text remains part of its image; OCR is not included.`);
        try {
          const svg = await new pdfjs.SVGGraphics(pdfPage.commonObjs, pdfPage.objs, true).getSVG(await pdfPage.getOperatorList(), viewport);
          const graphics = await graphicComponents(svg, viewport);
          if (graphics.some(c => c.label === "Grouped page artwork")) notices.push(`Page ${i}: complex artwork is grouped as one movable image.`);
          components = [...graphics, ...components];
        } catch (e) {
          components = [{ id: newId(), type: "image", label: "Original page image", x: 0, y: 0, width: viewport.width, height: viewport.height, src: preview, rotation: 0 }];
          notices.push(`Page ${i}: this PDF's graphics could not be separated. Its page is imported as one image; add text boxes to edit over it.`);
        }
        imported.push({ id: newId(), width: viewport.width, height: viewport.height, components, preview });
        pdfPage.cleanup();
      }
      if (!alive.current) return;
      commit(imported); setPageIndex(0); setSelectedId(null); setCompare(false); setWarnings(notices); setName(file.name.replace(/\.pdf$/i, ""));
      setStatus(`${imported.length} pages imported. Select a component to edit it.`);
    } catch (e) { setError("Could not read this PDF. Unlock password-protected files and try again."); setStatus(""); }
    finally { await task?.destroy(); documentRef.current = null; if (alive.current) setBusy(false); }
  }

  async function insertImage(file) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 15 * 1024 * 1024) { setError("Choose a PNG, JPEG, or WebP image smaller than 15 MB."); return; }
    setBusy(true); setError("");
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = url; });
      const factor = Math.min(1, 2400 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas"); canvas.width = Math.ceil(image.width * factor); canvas.height = Math.ceil(image.height * factor);
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      const src = canvas.toDataURL("image/png");
      if (replaceImage.current && selected?.type === "image") {
        commit(pages.map((p, i) => i === pageIndex ? { ...p, components: p.components.map(c => c.id === selectedId ? { ...c, src, label: file.name } : c) } : p));
      } else {
        const width = Math.min(250, page.width - 40), height = Math.min(page.height - 40, width * image.height / image.width);
        addComponent({ id: newId(), type: "image", label: file.name, src, x: 20, y: 20, width, height, rotation: 0 });
      }
    } catch (e) { setError("Could not open this image."); }
    finally { URL.revokeObjectURL(url); setBusy(false); replaceImage.current = false; }
  }

  function startDrag(event, component, action) {
    if (busy || compare || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); setSelectedId(component.id);
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: component.id, action, x: event.clientX, y: event.clientY, component, original: pages, moved: false };
  }
  function moveDrag(event) {
    const gesture = drag.current;
    if (!gesture) return;
    const dx = (event.clientX - gesture.x) / scale, dy = (event.clientY - gesture.y) / scale;
    if (!gesture.moved && Math.abs(dx) + Math.abs(dy) < 2) return;
    gesture.moved = true;
    const patch = gesture.action === "resize" ? { width: gesture.component.width + dx, height: gesture.component.height + dy } : { x: gesture.component.x + dx, y: gesture.component.y + dy };
    const next = gesture.original.map((p, i) => i === pageIndex ? { ...p, components: p.components.map(c => c.id === gesture.id ? fitComponent({ ...gesture.component, ...patch }, p) : c) } : p);
    setPages(next);
  }
  function endDrag() {
    if (drag.current?.moved) { history.current.undo = [...history.current.undo.slice(-39), drag.current.original]; history.current.redo = []; setPages(current => [...current]); }
    drag.current = null;
  }

  async function download(format) {
    setBusy(true); setError(""); setStatus(`Creating ${format.toUpperCase()}…`);
    try {
      const filename = name.trim().replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_") || "document";
      if (format === "docx") saveAs(await createLayoutWordDocument(pages), `${filename}.docx`);
      else {
        const { jsPDF } = await import("jspdf");
        const pdf = new jsPDF({ unit: "pt", format: [pages[0].width, pages[0].height], orientation: pages[0].width > pages[0].height ? "landscape" : "portrait" });
        pages.forEach((p, i) => {
          if (i) pdf.addPage([p.width, p.height], p.width > p.height ? "landscape" : "portrait");
          p.components.filter(c => !c.hidden).forEach(c => {
            if (c.type === "image") pdf.addImage(c.src, "PNG", c.x, c.y, c.width, c.height, undefined, "FAST", -(c.rotation || 0));
            else if (c.type === "rect") { pdf.setFillColor(c.fill); pdf.setDrawColor(c.color); pdf.setLineWidth(c.strokeWidth || 1); pdf.rect(c.x, c.y, c.width, c.height, "FD"); }
            else {
              pdf.setFont(c.fontFamily === "Times New Roman" ? "times" : c.fontFamily === "Courier New" ? "courier" : "helvetica", c.bold && c.italic ? "bolditalic" : c.bold ? "bold" : c.italic ? "italic" : "normal");
              pdf.setFontSize(c.fontSize); pdf.setTextColor(c.color);
              const lines = pdf.splitTextToSize(c.text, c.width).slice(0, Math.max(1, Math.floor(c.height / (c.fontSize * 1.15))));
              pdf.text(lines, c.x + (c.align === "center" ? c.width / 2 : c.align === "right" ? c.width : 0), c.y + c.fontSize * .8, { align: c.align || "left", angle: -(c.rotation || 0), lineHeightFactor: 1.15 });
            }
          });
        });
        pdf.save(`${filename}.pdf`);
      }
      setStatus(`${format.toUpperCase()} downloaded with your edits.`);
    } catch (e) { setError("Export failed. Try a smaller document."); setStatus(""); }
    finally { setBusy(false); }
  }

  function keyboard(event) {
    if (busy || compare || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); restore(event.shiftKey ? "redo" : "undo"); }
    else if (selected && (event.key === "Delete" || event.key === "Backspace")) { event.preventDefault(); removeSelected(); }
    else if (selected && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
      event.preventDefault(); const step = event.shiftKey ? 10 : 1;
      changeComponent({ x: selected.x + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0), y: selected.y + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0) });
    }
  }
  const numeric = (key, label, min = 0, max = 2000) => <label>{label}<input type="number" aria-label={label} min={min} max={max} step="0.5" value={Math.round((selected[key] || 0) * 10) / 10} onChange={e => { if (e.target.value !== "") changeComponent({ [key]: clamp(Number(e.target.value), min, max) }); }} /></label>;

  return <main className="pdf-editor" onKeyDown={keyboard}>
    <header className="pde-header"><div><span className="pde-eyebrow">DOCUMENT STUDIO</span><h1>PDF editor & Word converter</h1><p>Edit text, images, and layout directly on the page.</p></div><div className="pde-upload"><label className="pde-button">{busy ? "Processing…" : "Open PDF"}<input aria-label="Open PDF" type="file" accept=".pdf,application/pdf" disabled={busy} onChange={e => { upload(e.target.files[0]); e.target.value = ""; }} /></label><button disabled={busy} onClick={() => { commit([blankPage()]); setPageIndex(0); setSelectedId(null); setWarnings([]); setCompare(false); setStatus("Blank document ready."); }}>New document</button></div></header>
    <div className="pde-status" role="status" aria-live="polite">{status || "Open a PDF or start with a blank document. Files stay in your browser. Maximum PDF size: 50 MB."}</div>
    {error && <p className="pde-error" role="alert">{error}</p>}
    {!!warnings.length && <details className="pde-notice"><summary>Import notes ({warnings.length})</summary>{warnings.map((w, i) => <p key={i}>{w}</p>)}</details>}
    {!pages.length ? <section className="pde-empty"><span>PDF → DOCX</span><h2>A workspace for every element</h2><p>Select text to rewrite it. Adjust fonts, colors, and alignment. Move images, resize objects, and arrange your pages.</p><p>PDF text and graphics are reconstructed where possible. Scans remain images. Complex artwork may be grouped; fonts and table structure may need adjustment.</p></section> : <>
      <div className="pde-toolbar"><div><button disabled={busy || !history.current.undo.length} onClick={() => restore("undo")}>↶ Undo</button><button disabled={busy || !history.current.redo.length} onClick={() => restore("redo")}>↷ Redo</button></div><div><button disabled={busy || compare} onClick={addText}>＋ Text</button><button disabled={busy || compare} onClick={() => { replaceImage.current = false; imageInput.current.click(); }}>＋ Image</button><button disabled={busy || compare} onClick={() => addComponent({ id: newId(), type: "rect", x: 40, y: 100, width: 160, height: 80, fill: "#ffffff", color: "#2563eb", strokeWidth: 1, rotation: 0 })}>＋ Rectangle</button></div><div><label>Zoom <select aria-label="Zoom" value={zoom} onChange={e => setZoom(Number(e.target.value))}>{[50, 75, 100, 125, 150, 200].map(z => <option key={z} value={z}>{z}%</option>)}</select></label>{page?.preview && <button className={compare ? "is-active" : ""} disabled={busy} onClick={() => setCompare(!compare)}>{compare ? "Back to editing" : "Compare original"}</button>}</div></div>
      <input ref={imageInput} hidden type="file" accept="image/png,image/jpeg,image/webp" aria-label="Choose image" onChange={e => { insertImage(e.target.files[0]); e.target.value = ""; }} />
      <div className="pde-workspace">
        <aside className="pde-pages"><h2>Pages <span>{pages.length}</span></h2><button disabled={busy || pageIndex === 0} onClick={() => movePage(-1)}>Move page ↑</button><button disabled={busy || pageIndex === pages.length - 1} onClick={() => movePage(1)}>Move page ↓</button>{pages.map((p, i) => <button key={p.id} className={`pde-page-tab ${i === pageIndex ? "is-active" : ""}`} disabled={busy} onClick={() => { setPageIndex(i); setSelectedId(null); setCompare(false); }}><span className="pde-mini-page">{p.preview ? <img src={p.preview} alt="" /> : <span>Aa</span>}</span>Page {i + 1}<small>{p.components.length} objects</small></button>)}<button disabled={busy} onClick={() => { commit([...pages, blankPage()]); setPageIndex(pages.length); setSelectedId(null); setCompare(false); }}>＋ Add page</button>{pages.length > 1 && <button disabled={busy} onClick={() => { commit(pages.filter((p, i) => i !== pageIndex)); setPageIndex(Math.max(0, pageIndex - 1)); setSelectedId(null); }}>Delete page</button>}</aside>
        <section className="pde-canvas-area" aria-label="Document canvas"><div className="pde-canvas-caption">Page {pageIndex + 1} · {Math.round(page.width)} × {Math.round(page.height)} pt · {compare ? "Original PDF preview" : "Select an object · drag its handle to move · double-click text to type · drag corner to resize"}</div><div className="pde-paper-space" style={{ width: page.width * scale, height: page.height * scale }}><div className="pde-paper" style={{ width: page.width, height: page.height, transform: `scale(${scale})` }} onPointerDown={e => { if (e.target === e.currentTarget) setSelectedId(null); }}>
          {compare ? <img className="pde-original" src={page.preview} alt="Original PDF page" /> : page.components.filter(c => !c.hidden).map(c => <div key={c.id} role="button" tabIndex={busy ? -1 : 0} aria-label={`${c.type === "text" ? c.text.slice(0, 60) || "Empty text" : c.label || "Rectangle"}`} aria-pressed={c.id === selectedId} className={`pde-object ${c.id === selectedId ? "is-selected" : ""}`} style={{ left: c.x, top: c.y, width: c.width, height: c.height, transform: `rotate(${c.rotation || 0}deg)` }} onClick={e => { e.stopPropagation(); if (!busy) setSelectedId(c.id); }} onFocus={() => { if (!busy) setSelectedId(c.id); }} onDoubleClick={() => { if (c.type === "text" && !busy) setEditingId(c.id); }} onPointerDown={e => startDrag(e, c, "move")} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
            {c.type === "text" ? <div className="pde-text-render" style={{ fontSize: c.fontSize, fontFamily: c.fontFamily, color: c.color, fontWeight: c.bold ? 700 : 400, fontStyle: c.italic ? "italic" : "normal", textDecoration: c.underline ? "underline" : "none", textAlign: c.align }}>{editingId === c.id ? <textarea className="pde-inline-text" aria-label="Edit text on page" autoFocus value={c.text} onChange={e => changeComponent({ text: e.target.value })} onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()} onBlur={() => setEditingId(null)} /> : c.text}</div> : c.type === "image" ? <img src={c.src} alt={c.label || "Document image"} draggable={false} /> : <div className="pde-rectangle" style={{ background: c.fill, border: `${c.strokeWidth || 1}px solid ${c.color}` }} />}
            {c.id === selectedId && !busy && <><span className="pde-move-handle" aria-hidden="true">⠿ {c.type}</span><button className="pde-resize-handle" aria-label="Resize selected object" onPointerDown={e => startDrag(e, c, "resize")} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} /></>}
          </div>)}
        </div></div></section>
        <aside className="pde-inspector"><h2>Object properties</h2>{selected && !compare ? <fieldset disabled={busy}><legend className="pde-sr-only">Selected object properties</legend><div className="pde-selection-label">{selected.type === "text" ? "Text box" : selected.type === "rect" ? "Rectangle" : selected.label || "Image"}</div>
          {selected.type === "text" && <><label>Text content<textarea id="pde-text-content" aria-label="Text content" value={selected.text} onChange={e => changeComponent({ text: e.target.value })} /></label><label>Font family<select value={selected.fontFamily} onChange={e => changeComponent({ fontFamily: e.target.value })}>{fontFamilies.map(f => <option key={f}>{f}</option>)}</select></label><div className="pde-property-grid">{numeric("fontSize", "Font size", 5, 300)}<label>Text color<input type="color" value={selected.color} onChange={e => changeComponent({ color: e.target.value })} /></label></div><div className="pde-format">{[["bold", "B"], ["italic", "I"], ["underline", "U"]].map(([key, title]) => <button key={key} aria-label={key} aria-pressed={!!selected[key]} className={selected[key] ? "is-active" : ""} onClick={() => changeComponent({ [key]: !selected[key] })}>{title}</button>)}<select aria-label="Text alignment" value={selected.align} onChange={e => changeComponent({ align: e.target.value })}>{["left", "center", "right"].map(a => <option key={a}>{a}</option>)}</select></div></>}
          <h3>Position & size</h3><div className="pde-property-grid">{numeric("x", "X", 0, page.width)}{numeric("y", "Y", 0, page.height)}{numeric("width", "Width", 4, page.width)}{numeric("height", "Height", 4, page.height)}{selected.type !== "rect" && numeric("rotation", "Rotation", -180, 180)}</div>
          {selected.type === "rect" && <div className="pde-property-grid"><label>Fill<input type="color" value={selected.fill} onChange={e => changeComponent({ fill: e.target.value })} /></label><label>Border<input type="color" value={selected.color} onChange={e => changeComponent({ color: e.target.value })} /></label>{numeric("strokeWidth", "Border width", .5, 20)}</div>}
          {selected.type === "image" && <button onClick={() => { replaceImage.current = true; imageInput.current.click(); }}>Replace image</button>}
          <div className="pde-object-actions"><button onClick={() => changeOrder(1)}>Bring forward</button><button onClick={() => changeOrder(-1)}>Send backward</button><button onClick={() => addComponent({ ...selected, id: newId(), x: selected.x + 12, y: selected.y + 12 })}>Duplicate</button><button className="pde-danger" onClick={removeSelected}>Delete object</button></div></fieldset> : <p className="pde-hint">{compare ? "Original preview is read-only. Return to editing to change objects." : "Select a text box, image, or shape on the page or in the list below."}</p>}
          <h3>Page components</h3><div className="pde-layers">{[...page.components].reverse().map(c => <div key={c.id} className={`pde-layer ${c.id === selectedId ? "is-active" : ""}`}><button disabled={busy || compare} onClick={() => setSelectedId(c.id)} title={c.type === "text" ? c.text : c.label}>{c.type === "text" ? "T " : c.type === "rect" ? "▢ " : "▧ "}{c.type === "text" ? c.text || "Empty text" : c.label || "Rectangle"}</button><button aria-label={`${c.hidden ? "Show" : "Hide"} ${c.type === "text" ? c.text.slice(0, 20) : c.label || "rectangle"}`} disabled={busy || compare} onClick={() => commit(pages.map((p, i) => i === pageIndex ? { ...p, components: p.components.map(item => item.id === c.id ? { ...item, hidden: !item.hidden } : item) } : p))}>{c.hidden ? "○" : "●"}</button></div>)}</div>
        </aside>
      </div>
      <footer className="pde-export"><label>Filename<input value={name} disabled={busy} onChange={e => setName(e.target.value)} /></label><p>Word export keeps text boxes editable. Images and PDF artwork remain images. Review layout in Microsoft Word; PDF export uses standard fonts.</p><button disabled={busy} onClick={() => download("pdf")}>Download edited PDF</button><button className="pde-primary" disabled={busy} onClick={() => download("docx")}>Download Word (.docx)</button></footer>
    </>}
  </main>;
}

