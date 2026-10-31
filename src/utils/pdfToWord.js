import JSZip from "jszip";

const xml = (value) => String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export function extractPageText(items) {
  let text = "", lastY;
  items.forEach(item => {
    if (typeof item.str !== "string") return;
    const y = item.transform?.[5];
    if (lastY !== undefined && Math.abs(y - lastY) > 3 && !text.endsWith("\n")) text += "\n";
    text += item.str;
    text += item.hasEOL ? "\n" : " ";
    lastY = y;
  });
  return text.trim();
}

export async function createWordDocument(pages, images = []) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("_rels/.rels", `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  let relationships = "";
  const body = pages.map((page, i) => {
    const pageBreak = i ? '<w:p><w:r><w:br w:type="page"/></w:r></w:p>' : '';
    if (images[i]) {
      const { data, width, height } = images[i];
      zip.file(`word/media/page${i}.png`, data);
      relationships += `<Relationship Id="image${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/page${i}.png"/>`;
      const scale = Math.min(5943600 / width, 8686800 / height);
      const cx = Math.round(width * scale), cy = Math.round(height * scale);
      return `${pageBreak}<w:p><w:r><w:drawing><wp:inline><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${i + 1}" name="Page ${i + 1}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${i + 1}" name="Page ${i + 1}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="image${i}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
    }
    return pageBreak + page.split("\n").map(line => `<w:p><w:r><w:t xml:space="preserve">${xml(line)}</w:t></w:r></w:p>`).join("");
  }).join("");
  zip.file("word/_rels/document.xml.rels", `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}</Relationships>`);
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="720" w:right="1440" w:bottom="720" w:left="1440"/></w:sectPr></w:body></w:document>`);
  return new Blob([await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" })], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}

