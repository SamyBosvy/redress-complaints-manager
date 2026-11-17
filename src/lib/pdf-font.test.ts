// @vitest-environment node
import { readFileSync } from 'node:fs';
import { jsPDF } from 'jspdf';
import { describe, expect, it } from 'vitest';
import { letterPdf } from './letter-pdf';
import { regulatoryReport } from './reports';
import { regulatoryPackPdf } from './regulatory-pdf';
import { personalDataPdf } from './privacy-pdf';
import { PDF_FONT, embedPdfFont } from './pdf-font';

const font = {
  normal: readFileSync('public/fonts/privacy-sans.ttf').toString('base64'),
  bold: readFileSync('public/fonts/privacy-sans-bold.ttf').toString('base64'),
};
const text = 'Szanowny Panie Łukaszu, odpowiedź na Pańską reklamację… ł ś ż ź ć ń ą ę ó. Réponse à votre réclamation : été, cœur, Noël. Ελληνικά Български';

describe('Unicode PDF embedding', () => {
  it('embeds distinct regular and bold files and selects the bold face for bold text', () => {
    const doc = new jsPDF();
    embedPdfFont(doc, font);
    expect(font.normal).not.toBe(font.bold);
    expect(doc.getFileFromVFS('privacy-sans.ttf')).toBe(font.normal);
    expect(doc.getFileFromVFS('privacy-sans-bold.ttf')).toBe(font.bold);
    doc.text('Normal ł ś ż', 20, 20);
    const normalId = doc.getFont().id;
    doc.setFont(PDF_FONT, 'bold');
    expect(doc.getFont().postScriptName).toBe('privacy-sans-bold.ttf');
    expect(doc.getFont().id).not.toBe(normalId);
    doc.text('Bold ł ś ż', 20, 30);
    const pdf = doc.output();
    expect(pdf.match(/\/FontFile2 /g)).toHaveLength(2);
    expect(pdf).toContain(`/${doc.getFont().id} 16 Tf`);
  });
  for (const [name, create] of [
    ['letter', () => letterPdf({ firm: 'Firma Łódź', address: 'ul. Żółta 12\nŁódź, Polska', date: '28/10/2026', subject: text, body: text }, font)],
    ['regulatory pack', () => regulatoryPackPdf({ name: 'Société Łódź', address: text, generatedBy: 'Owner', generatedAt: '2026-10-28' }, regulatoryReport([], { from: '2026-10-01', to: '2026-10-28' }), font)],
    ['privacy pack', () => personalDataPdf({ firm: text, generatedAt: '2026-10-28', tables: {}, attachments: [] }, font)],
  ] as const) {
    it(`embeds a TrueType Unicode font and character map in the ${name}`, () => {
      const doc = create();
      expect(doc.getFont().fontName).toBe(PDF_FONT);
      expect(doc.getFontList()[PDF_FONT]).toEqual(['normal', 'bold']);
      const pdf = doc.output();
      expect(pdf).toContain('/FontFile2');
      expect(pdf).toContain('/ToUnicode');
      expect(pdf).toContain('/Subtype /Type0');
      // Polish ł and French œ mappings must be present in actual PDF output.
      expect(pdf).toMatch(/<0142>/i);
      expect(pdf).toMatch(/<0153>/i);
    });
  }
});
describe('New-language letter glyphs', () => {
  it('maps Lithuanian, Czech, Romanian comma-below, Nordic and Irish letters in a letter PDF', () => {
    const sample = 'Ąčęėįšųūž ěščřžýáíé șțăîâ æøå áéíóú';
    const pdf = letterPdf({ firm: 'Firm', address: null, date: '17/11/2026', subject: sample, body: sample }, font).output();
    for (const ch of new Set(sample.replace(/\s/g, ''))) {
      const hex = ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0');
      expect(pdf, `${ch} U+${hex}`).toMatch(new RegExp(`<${hex}>`, 'i'));
    }
    // Romanian must use comma-below ș ț (U+0219/U+021B), not cedilla ş ţ.
    expect(pdf).not.toMatch(/<015F>|<0163>/i);
  });
});
