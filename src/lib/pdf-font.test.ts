// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { letterPdf } from './letter-pdf';
import { regulatoryPackPdf } from './regulatory-pdf';
import { personalDataPdf } from './privacy-pdf';
import { PDF_FONT } from './pdf-font';

const font = readFileSync('public/fonts/privacy-sans.ttf').toString('base64');
const text = 'Szanowny Panie Łukaszu, odpowiedź na Pańską reklamację… ł ś ż ź ć ń ą ę ó. Réponse à votre réclamation : été, cœur, Noël. Ελληνικά Български';

describe('Unicode PDF embedding', () => {
  for (const [name, create] of [
    ['letter', () => letterPdf({ firm: 'Firma Łódź', address: 'ul. Żółta 12\nŁódź, Polska', date: '28/10/2026', subject: text, body: text }, font)],
    ['regulatory pack', () => regulatoryPackPdf('Société Łódź', '2026-10-01', '2026-10-28', [[text, 'EUR 1,240 · PLN 3,500']], font)],
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