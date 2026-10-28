import { jsPDF } from 'jspdf';
import { embedPdfFont } from './pdf-font';
type Pack = { firm: string; generatedAt: string; scope?: string; tables: Record<string, Record<string, unknown>[]>; attachments: { path: string; contentType: string }[] };
export function personalDataPdf(pack: Pack, fontBase64: string) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  embedPdfFont(doc,fontBase64);
  let y=22;
  const write = (text: string, size=10) => {
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text,170) as string[];
    for(const line of lines) { if(y>275) { doc.addPage(); y=22; } doc.text(line,20,y); y+=size===10?5:7; }
    y+=3;
  };
  write('Redress | Subject access review pack',16);
  write(pack.firm,12);
  write(`Generated: ${pack.generatedAt}`);
  write(pack.scope ?? 'Review pack — check identity, lawful disclosure and third-party information before sharing.');
  for(const [table,rows] of Object.entries(pack.tables)) {
    write(table.replaceAll('_',' '),12);
    if(!rows.length) write('No records.');
    for(const row of rows) { for(const [key,value] of Object.entries(row)) write(`${key.replaceAll('_',' ')}: ${value===null?'—':typeof value==='object'?JSON.stringify(value):String(value)}`); y+=4; }
  }
  write('Attachment inventory',12);
  for(const file of pack.attachments) write(`${file.path} (${file.contentType}) — file contents included in the JSON export.`);
  if(!pack.attachments.length) write('No attachments.');
  const pages=doc.getNumberOfPages();
  for(let i=1;i<=pages;i++) { doc.setPage(i); doc.setFontSize(8); doc.text(`Confidential | ${i} / ${pages}`,20,290); }
  return doc;
}