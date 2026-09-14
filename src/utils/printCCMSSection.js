// Use a separate document so application layouts and print styles cannot leak in.
export async function printCCMSSection(section) {
    if (!section) return;
    document.getElementById('ccms-print-frame')?.remove();
    const frame = document.createElement('iframe');
    frame.id = 'ccms-print-frame';
    frame.title = 'CCMS print document';
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;';
    document.body.appendChild(frame);

    const printWindow = frame.contentWindow;
    const printDocument = frame.contentDocument;
    printDocument.title = 'Bill Forwarding Sheet';
    const style = printDocument.createElement('style');
    style.textContent = `
        @page { size: A4 portrait; margin: 12mm; }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: white; color: black;
            font: 13px/1.4 Arial, sans-serif; color-scheme: light; }
        section { width: 100%; }
        h2, h3, p { margin: 0; }
        .ccms-header { text-align: center; text-decoration: underline; margin-bottom: 20px; }
        .ccms-table-container { width: 100%; overflow: visible; }
        .ccms-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 20px; }
        .ccms-table th, .ccms-table td { border: 1px solid #777; padding: 6px 8px;
            text-align: left; overflow-wrap: anywhere; }
        tr, .ccms-signatures { break-inside: avoid; }
        .ccms-signatures { display: flex; justify-content: space-between; margin: 10px 0 30px; }
        .signature-block { width: 45%; text-align: center; }
        .signature-space { height: 60px; margin: 10px 0; border-bottom: 1px solid black;
            display: flex; align-items: center; justify-content: center; }
        .signature-img { max-height: 50px; max-width: 150px; object-fit: contain; }
    `;
    printDocument.head.appendChild(style);
    printDocument.body.appendChild(printDocument.importNode(section, true));

    // Wait for signatures before opening the print preview.
    await Promise.all(Array.from(printDocument.images, img =>
        img.decode ? img.decode().catch(() => {}) : Promise.resolve()
    ));
    printWindow.addEventListener('afterprint', () => frame.remove(), { once: true });
    printWindow.focus();
    printWindow.print();
}
