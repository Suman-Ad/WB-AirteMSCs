/** @jest-environment node */
import JSZip from "jszip";
import { Blob } from "buffer";
global.Blob = Blob;
import { createWordDocument, extractPageText } from "./pdfToWord";

async function readZip(blob) {
  const buffer = await blob.arrayBuffer();
  return JSZip.loadAsync(buffer);
}

test("extracts line breaks and skips non-text PDF items", () => {
  expect(extractPageText([{ str: "First", transform: [1, 0, 0, 1, 0, 100] }, { type: "beginMarkedContent" }, { str: "Second", transform: [1, 0, 0, 1, 0, 80], hasEOL: true }])).toBe("First \nSecond");
});

test("creates a DOCX with escaped edited text and page breaks", async () => {
  const zip = await readZip(await createWordDocument(["Edited <text> & data\u0000", "Next page"]));
  const doc = await zip.file("word/document.xml").async("string");
  expect(doc).toContain("Edited &lt;text&gt; &amp; data");
  expect(doc).not.toContain("\u0000");
  expect(doc).toContain('w:type="page"');
  expect(zip.file("[Content_Types].xml")).toBeTruthy();
  expect(zip.file("_rels/.rels")).toBeTruthy();
});

test("packages scanned page images with matching drawing relationships", async () => {
  const zip = await readZip(await createWordDocument([""], [{ data: new Uint8Array([137, 80, 78, 71]), width: 600, height: 900 }]));
  expect(zip.file("word/media/page0.png")).toBeTruthy();
  expect(await zip.file("word/_rels/document.xml.rels").async("string")).toContain('Target="media/page0.png"');
  expect(await zip.file("word/document.xml").async("string")).toContain('r:embed="image0"');
});


