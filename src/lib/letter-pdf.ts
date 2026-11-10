import { jsPDF } from 'jspdf';
import { embedPdfFont, PDF_FONT, type PdfFonts } from './pdf-font';

export function letterPdf(letter: { firm: string; address?: string | null; date: string; subject: string; body: string }, fontBase64: PdfFonts) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  embedPdfFont(doc, fontBase64);
  let y = 20;
  const write = (text: string, width = 170) => {
    for (const line of doc.splitTextToSize(text, width) as string[]) {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(line, 20, y);
      y += 5.5;
    }
  };
  doc.setFontSize(11);
  doc.text(letter.date, 190, y, { align: 'right' });
  write(letter.firm, 125);
  if (letter.address?.trim()) write(letter.address, 125);
  y += 10;
  doc.setFont(PDF_FONT, 'bold');
  write(letter.subject);
  y += 5;
  doc.setFont(PDF_FONT, 'normal');
  write(letter.body);
  return doc;
}