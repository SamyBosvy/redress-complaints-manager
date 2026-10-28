import type { jsPDF } from 'jspdf';

export const PDF_FONT = 'RedressSans';
let fontPromise: Promise<string> | undefined;

/** Fetch once locally; a failed request can be retried. */
export function loadPdfFont(): Promise<string> {
  fontPromise ??= fetch('/fonts/privacy-sans.ttf').then(async (response) => {
    if (!response.ok) throw new Error('PDF font unavailable.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }).catch((error) => { fontPromise = undefined; throw error; });
  return fontPromise;
}

export function embedPdfFont(doc: jsPDF, base64: string) {
  doc.addFileToVFS('privacy-sans.ttf', base64);
  // The bundled regular face is deliberately registered for both styles:
  // bold sections must never fall back to a non-Unicode standard font.
  doc.addFont('privacy-sans.ttf', PDF_FONT, 'normal');
  doc.addFont('privacy-sans.ttf', PDF_FONT, 'bold');
  doc.setFont(PDF_FONT, 'normal');
}