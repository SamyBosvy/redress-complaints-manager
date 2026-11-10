import type { jsPDF } from 'jspdf';

export const PDF_FONT = 'RedressSans';
export type PdfFonts = { normal: string; bold: string };
let fontPromise: Promise<PdfFonts> | undefined;

/** Fetch once locally; a failed request can be retried. */
export function loadPdfFont(): Promise<PdfFonts> {
  const load = async (path: string) => {
    const response = await fetch(path);
    if (!response.ok) throw new Error('PDF font unavailable.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  };
  fontPromise ??= Promise.all([load('/fonts/privacy-sans.ttf'), load('/fonts/privacy-sans-bold.ttf')])
    .then(([normal, bold]) => ({ normal, bold }))
    .catch((error) => { fontPromise = undefined; throw error; });
  return fontPromise;
}

export function embedPdfFont(doc: jsPDF, fonts: PdfFonts) {
  doc.addFileToVFS('privacy-sans.ttf', fonts.normal);
  doc.addFileToVFS('privacy-sans-bold.ttf', fonts.bold);
  doc.addFont('privacy-sans.ttf', PDF_FONT, 'normal');
  doc.addFont('privacy-sans-bold.ttf', PDF_FONT, 'bold');
  doc.setFont(PDF_FONT, 'normal');
}