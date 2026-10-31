/** @jest-environment node */
import JSZip from "jszip";
import { Blob } from "buffer";
import { createLayoutWordDocument, fitComponent, textComponents } from "./pdfEditor";
global.Blob = Blob;

const transform = (a, b) => [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];

test("imports separate table cells and joins adjacent text runs at PDF positions", () => {
  const blocks = textComponents({ styles: { f: { fontFamily: "sans-serif", ascent: .8 } }, items: [
    { str: "Account", fontName: "f", transform: [12,0,0,12,40,700], width: 45 },
    { str: "name", fontName: "f", transform: [12,0,0,12,88,700], width: 28 },
    { str: "Amount", fontName: "f", transform: [12,0,0,12,300,700], width: 50 },
    { str: "Next row", fontName: "f", transform: [12,0,0,12,40,670], width: 52 }
  ] }, { transform: [1,0,0,-1,0,842], scale: 1 }, transform);
  expect(blocks).toHaveLength(3);
  expect(blocks[0].text).toBe("Account name");
  expect(blocks[0].x).toBe(40);
  expect(blocks[0].y).toBeCloseTo(132.4);
  expect(blocks[0].fontFamily).toBe("Arial");
  expect(blocks[1].x).toBe(300);
});

test("keeps moved and resized components inside page boundaries", () => {
  expect(fitComponent({ x: -10, y: 900, width: 900, height: -1 }, { width: 595, height: 842 })).toMatchObject({ x: 0, y: 838, width: 595, height: 4 });
});

test("exports editable formatted text boxes, artwork, page sizes and layer visibility", async () => {
  const blob = await createLayoutWordDocument([
    { width: 595, height: 842, components: [
      { type: "text", x: 40, y: 70, width: 200, height: 80, rotation: 15, text: 'Edited <cell> & "value"\nSecond line', fontSize: 18, fontFamily: "Arial", bold: true, italic: true, underline: true, color: "#ff0000", align: "center" },
      { type: "image", x: 20, y: 200, width: 100, height: 60, src: "data:image/png;base64,iVBORw==", label: 'Logo & mark' },
      { type: "rect", x: 10, y: 10, width: 50, height: 30, fill: "#ffffff", color: "#000000", strokeWidth: 2 },
      { type: "text", hidden: true, text: "SHOULD NOT EXPORT" }
    ] },
    { width: 842, height: 595, components: [] }
  ]);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const doc = await zip.file("word/document.xml").async("string");
  expect(doc).toContain("<w:txbxContent>");
  expect(doc).toContain("Edited &lt;cell&gt; &amp; &quot;value&quot;");
  expect(doc).toContain("margin-left:40pt;margin-top:70pt;width:200pt;height:80pt;rotation:15");
  expect(doc).toContain('<w:color w:val="ff0000"/>');
  expect(doc).toContain('<w:b/><w:i/><w:u w:val="single"/>');
  expect(doc).toContain('w:w="16840" w:h="11900"');
  expect(doc).not.toContain("SHOULD NOT EXPORT");
  expect(doc).toContain('fillcolor="#ffffff"');
  expect(await zip.file("word/media/image0.png").async("uint8array")).toEqual(new Uint8Array([137,80,78,71]));
  expect(await zip.file("word/_rels/document.xml.rels").async("string")).toContain('Id="image0"');
});
