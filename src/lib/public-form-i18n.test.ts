import { describe, expect, it } from 'vitest';
import { PUBLIC_FORM_I18N, PUBLIC_FORM_LANGUAGES, resolvePublicFormLanguage, publicFormIssueMessage, publicFormServerError } from './public-form-i18n';
import { PRODUCTS, CATEGORIES, LANGUAGES } from './complaints';
import { COUNTRIES } from './countries';
import { publicComplaintSchema } from './public-forms';

describe('Public form languages', () => {
  for (const lang of PUBLIC_FORM_LANGUAGES) {
    it(`${lang} has every dictionary and option key`, () => {
      const t = PUBLIC_FORM_I18N[lang];
      expect(Object.keys(t).sort()).toEqual(Object.keys(PUBLIC_FORM_I18N.en).sort());
      for (const [key, source] of Object.entries({ products: PRODUCTS, categories: CATEGORIES, countries: COUNTRIES, languages: LANGUAGES })) {
        expect(Object.keys(t[key as 'products']).sort()).toEqual(Object.keys(source).sort());
      }
      for (const value of Object.values(t)) {
        for (const text of typeof value === 'string' ? [value] : Object.values(value)) expect(text.trim().length).toBeGreaterThan(0);
      }
    });
    it(`${lang} maps all schema issues without leaking raw messages`, () => {
      const result = publicComplaintSchema.safeParse({ form_id: '', submission_id: '', complainant_name: '', complainant_email: 'bad', complainant_phone: 'x'.repeat(51), customer_ref: '', country_code: '', language: '', product: '', category: '', summary: '', desired_outcome: '', vulnerable: false, vulnerable_note: '', privacy_acknowledged: false, privacy_notice: '', website: 'spam' });
      expect(result.success).toBe(false);
      if (result.success) return;
      const mapped = result.error.issues.map(issue => publicFormIssueMessage(issue, lang));
      expect(mapped).toContain(PUBLIC_FORM_I18N[lang].nameRequired);
      expect(mapped).toContain(PUBLIC_FORM_I18N[lang].emailInvalid);
      expect(mapped).toContain(PUBLIC_FORM_I18N[lang].privacyRequired);
      expect(mapped).toContain(PUBLIC_FORM_I18N[lang].tooLong.replace('{max}', '50'));
      expect(mapped.every(message => message.length > 0)).toBe(true);
      expect(publicFormServerError(lang)).toBe(PUBLIC_FORM_I18N[lang].saveError);
    });
  }
  it.each([['fr-BE', 'fr'], ['pt-BR', 'pt'], ['de', 'en'], ['PL-pl', 'pl']])('detects %s as %s', (locale, expected) => {
    expect(resolvePublicFormLanguage(undefined, [locale])).toBe(expected);
  });
  it('uses the first supported browser language', () => expect(resolvePublicFormLanguage(undefined, ['de', 'nl-NL', 'fr'])).toBe('nl'));
  it('gives the URL precedence over the browser', () => expect(resolvePublicFormLanguage('es', ['fr-BE'])).toBe('es'));
  it('falls back to English for an invalid URL language', () => expect(resolvePublicFormLanguage('xx', ['fr-BE'])).toBe('en'));
  it('falls back to English without browser languages', () => expect(resolvePublicFormLanguage()).toBe('en'));
});