import JSZip from "jszip";

export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const escapeXml = value => String(value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
export const clamp = (n, min, max) => Math.min(Math.max(n, min), Math.max(min, max));

export function textComponents(content, viewport, transform) {
  const blocks = [];
  content.items.forEach(item => {
    if (!item.str?.trim()) return;
    const matrix = transform(viewport.transform, item.transform);
    const size = Math.max(5, Math.hypot(matrix[2], matrix[3]));
    const style = content.styles[item.fontName] || {};
    const ascent = style.ascent || (style.descent ? 1 + style.descent : .8);
    const x = matrix[4], y = matrix[5] - size * ascent;
    const previous = blocks[blocks.length - 1];
    const width = Math.max(item.width * viewport.scale, size * .4);
    const family = /serif/i.test(style.fontFamily) && !/sans/i.test(style.fontFamily) ? "Times New Roman" : /mono/i.test(style.fontFamily) ? "Courier New" : "Arial";
    // Combine adjacent runs on the same baseline into a useful editable text box.
    if (previous && Math.abs(previous.y - y) < 2 && Math.abs(previous.fontSize - size) < 1 && previous.fontFamily === family && x >= previous.x && x - (previous.x + previous.width) < size && x - (previous.x + previous.width) > -2) {
      previous.text += `${x - (previous.x + previous.width) > size * .15 ? " " : ""}${item.str}`;
      previous.width = Math.max(previous.width, x + width - previous.x);
    } else {
      blocks.push({ id: newId(), type: "text", text: item.str, x, y, width, height: size * 1.25, fontSize: size, fontFamily: family, bold: /bold/i.test(item.fontName), italic: /italic|oblique/i.test(item.fontName), color: "#000000", align: "left", rotation: Math.atan2(matrix[1], matrix[0]) * 180 / Math.PI });
    }
  });
  return blocks;
}

export async function svgToPng(svg, width, height) {
  const source = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(source);
  try {
    const image = await new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = url; });
    const canvas = document.createElement("canvas");
    const scale = Math.min(2, 2400 / Math.max(width, height));
    canvas.width = Math.max(1, Math.ceil(width * scale)); canvas.height = Math.max(1, Math.ceil(height * scale));
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally { URL.revokeObjectURL(url); }
}

// PDF.js supplies an SVG display tree; split its painted graphics while preserving
// ancestor transforms, clipping and definitions. PDF paths are artwork, not semantic tables.
export async function graphicComponents(svg, viewport) {
  svg.setAttribute("width", viewport.width); svg.setAttribute("height", viewport.height);
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:0;top:0;opacity:0;pointer-events:none;z-index:-1";
  host.appendChild(svg); document.body.appendChild(host);
  try {
    const nodes = [...svg.querySelectorAll("image,path,rect,line,polyline,polygon,circle,ellipse")].filter(node => !node.closest("defs,clipPath,mask,pattern,marker"));
    const pageRect = svg.getBoundingClientRect();
    const boxes = nodes.map(node => {
      const rect = node.getBoundingClientRect();
      return { x: Math.max(0, rect.left - pageRect.left - 1), y: Math.max(0, rect.top - pageRect.top - 1), right: Math.min(viewport.width, rect.right - pageRect.left + 1), bottom: Math.min(viewport.height, rect.bottom - pageRect.top + 1) };
    });
    const template = svg.cloneNode(true);
    template.querySelectorAll("text").forEach(node => node.remove());
    const graphics = [...template.querySelectorAll("image,path,rect,line,polyline,polygon,circle,ellipse")].filter(node => !node.closest("defs,clipPath,mask,pattern,marker"));
    graphics.forEach((node, i) => node.setAttribute("data-editor-graphic", i));
    const components = [];
    // Large technical drawings are kept as a single artwork component to avoid
    // thousands of canvas renders. Text remains independently editable.
    if (nodes.length > 150) {
      return [{ id: newId(), type: "image", label: "Grouped page artwork", x: 0, y: 0, width: viewport.width, height: viewport.height, src: await svgToPng(template, viewport.width, viewport.height), rotation: 0 }];
    }
    for (let i = 0; i < graphics.length; i++) {
      const box = boxes[i], width = box.right - box.x, height = box.bottom - box.y;
      if (width <= 0 || height <= 0) continue;
      const layer = template.cloneNode(true);
      layer.querySelectorAll("[data-editor-graphic]").forEach(node => { if (Number(node.getAttribute("data-editor-graphic")) !== i) node.remove(); });
      layer.setAttribute("viewBox", `${box.x} ${box.y} ${width} ${height}`);
      layer.setAttribute("width", width); layer.setAttribute("height", height);
      components.push({ id: newId(), type: "image", label: nodes[i].localName === "image" ? "PDF image" : "PDF artwork", x: box.x, y: box.y, width, height, src: await svgToPng(layer, width, height), rotation: 0 });
    }
    return components;
  } finally { host.remove(); }
}

export function fitComponent(component, page) {
  const width = clamp(component.width, 4, page.width), height = clamp(component.height, 4, page.height);
  return { ...component, width, height, x: clamp(component.x, 0, page.width - width), y: clamp(component.y, 0, page.height - height) };
}

export async function createLayoutWordDocument(pages) {
  const zip = new JSZip();
  const relationships = [];
  let imageIndex = 0;
  const body = pages.map((page, pageIndex) => {
    const shapes = page.components.filter(c => !c.hidden).map((c, index) => {
      const id = `shape${pageIndex}_${index}`;
      const style = `position:absolute;margin-left:${c.x}pt;margin-top:${c.y}pt;width:${c.width}pt;height:${c.height}pt;rotation:${c.rotation || 0};z-index:${index + 1};mso-position-horizontal-relative:page;mso-position-vertical-relative:page`;
      if (c.type === "image") {
        const imageId = `image${imageIndex++}`;
        zip.file(`word/media/${imageId}.png`, c.src.split(",")[1], { base64: true });
        relationships.push(`<Relationship Id="${imageId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${imageId}.png"/>`);
        return `<w:r><w:pict><v:rect id="${id}" style="${style}" stroked="f"><v:imagedata r:id="${imageId}" o:title="${escapeXml(c.label || "Image")}"/></v:rect></w:pict></w:r>`;
      }
      if (c.type === "rect") return `<w:r><w:pict><v:rect id="${id}" style="${style}" fillcolor="${escapeXml(c.fill)}" strokecolor="${escapeXml(c.color)}" strokeweight="${c.strokeWidth || 1}pt"/></w:pict></w:r>`;
      const props = `<w:rPr><w:rFonts w:ascii="${escapeXml(c.fontFamily)}" w:hAnsi="${escapeXml(c.fontFamily)}"/><w:sz w:val="${Math.round(c.fontSize * 2)}"/><w:szCs w:val="${Math.round(c.fontSize * 2)}"/><w:color w:val="${c.color.replace("#", "")}"/>${c.bold ? "<w:b/>" : ""}${c.italic ? "<w:i/>" : ""}${c.underline ? '<w:u w:val="single"/>' : ""}</w:rPr>`;
      const paragraphs = c.text.split("\n").map(line => `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="${c.align || "left"}"/></w:pPr><w:r>${props}<w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`).join("");
      return `<w:r><w:pict><v:rect id="${id}" style="${style}" filled="f" stroked="f"><v:textbox inset="0,0,0,0"><w:txbxContent>${paragraphs}</w:txbxContent></v:textbox></v:rect></w:pict></w:r>`;
    }).join("");
    const section = `<w:sectPr><w:type w:val="nextPage"/><w:pgSz w:w="${Math.round(page.width * 20)}" w:h="${Math.round(page.height * 20)}"/><w:pgMar w:top="0" w:right="0" w:bottom="0" w:left="0" w:header="0" w:footer="0"/></w:sectPr>`;
    const paragraph = `<w:p><w:pPr><w:spacing w:before="0" w:after="0"/>${pageIndex < pages.length - 1 ? section : ""}</w:pPr>${shapes}</w:p>`;
    return paragraph + (pageIndex === pages.length - 1 ? section : "");
  }).join("");
  zip.file("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file("_rels/.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file("word/_rels/document.xml.rels", `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships.join("")}</Relationships>`);
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><w:body>${body}</w:body></w:document>`);
  return new Blob([await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" })], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}
