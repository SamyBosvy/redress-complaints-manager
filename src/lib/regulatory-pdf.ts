import { jsPDF } from 'jspdf';
import { embedPdfFont, PDF_FONT } from './pdf-font';

export function regulatoryPackPdf(firm: string, from: string, to: string, rows: (string | number)[][], fontBase64: string) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  embedPdfFont(doc, fontBase64);
  let y = 20;
  const write = (text: string, size: number) => {
    doc.setFontSize(size);
    for (const line of doc.splitTextToSize(text, 182) as string[]) {
      if (y > 278) { doc.addPage(); y = 20; }
      doc.text(line, 14, y);
      y += size === 8 ? 4.5 : 6;
    }
    y += 3;
  };
  doc.setFont(PDF_FONT, 'bold');
  write('Regulatory reporting pack', 16);
  doc.setFont(PDF_FONT, 'normal');
  write(`${firm} — ${from} to ${to}`, 10);
  for (const row of rows) write(row.map(String).join('  |  '), 8);
  return doc;
}