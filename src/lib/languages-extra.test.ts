import { describe, expect, it } from 'vitest';
import { EXTRA_LANGUAGES, NATIVE_LANGUAGE_NAMES, PUBLIC_FORM_I18N, PUBLIC_FORM_KEYS, PUBLIC_FORM_LANGUAGES, displayNames, resolvePublicFormLanguage } from './public-form-i18n';
import { EXTRA_FORM_TRANSLATIONS } from './public-form-i18n-extra';
import { LANGUAGES } from './complaints';
import { matchImportValue } from './import';
import { englishStarter, letterTemplateFor } from './template-language';
import { publicComplaintSchema } from './public-forms';

describe('Extra public form languages', () => {
  it('has 14 form languages and 14 case languages', () => {
    expect(PUBLIC_FORM_LANGUAGES).toHaveLength(14);
    expect(Object.keys(LANGUAGES).sort()).toEqual([...PUBLIC_FORM_LANGUAGES].sort());
    expect(NATIVE_LANGUAGE_NAMES.ga).toBe('Gaeilge');
    expect(LANGUAGES.ga).toBe('Irish');
  });
  for (const lang of EXTRA_LANGUAGES) it(`${lang} has all keys, 7 products, 9 categories and placeholders`, () => {
    const src = EXTRA_FORM_TRANSLATIONS[lang];
    expect(Object.keys(src.strings).sort()).toEqual([...PUBLIC_FORM_KEYS].sort());
    expect(src.products.split('|')).toHaveLength(7);
    expect(src.categories.split('|')).toHaveLength(9);
    for (const k of ['description', 'submittedTo', 'logo'] as const) expect(src.strings[k]).toContain('{firm}');
    expect(src.strings.tooLong).toContain('{max}');
    const t = PUBLIC_FORM_I18N[lang];
    expect(t.heading).toBe(src.strings.heading);
    expect(Object.keys(t.languages)).toHaveLength(14);
    expect(Object.keys(t.countries)).toHaveLength(32);
  });
  it('every dictionary names all 14 languages', () => {
    for (const lang of PUBLIC_FORM_LANGUAGES) expect(Object.values(PUBLIC_FORM_I18N[lang].languages).every(Boolean) && Object.keys(PUBLIC_FORM_I18N[lang].languages).length).toBe(14);
  });
  it('resolves regional browser codes and ?lang=', () => {
    expect(resolvePublicFormLanguage(undefined, ['de-AT'])).toBe('de');
    expect(resolvePublicFormLanguage(undefined, ['ga-IE'])).toBe('ga');
    expect(resolvePublicFormLanguage(undefined, ['xx', 'ro-MD'])).toBe('ro');
    expect(resolvePublicFormLanguage('lt')).toBe('lt');
    expect(resolvePublicFormLanguage('xx')).toBe('en');
  });
  it('falls back to English names when Intl.DisplayNames is unavailable or throws', () => {
    expect(displayNames('de', 'language', ['de'] as const, { de: 'German' }, null)).toEqual({ de: 'German' });
    const Broken = class { constructor() { throw new Error('no'); } } as unknown as Parameters<typeof displayNames>[4];
    expect(displayNames('de', 'region', ['DE'] as const, { DE: 'Germany' }, Broken)).toEqual({ DE: 'Germany' });
    expect(displayNames('de', 'region', ['DE'] as const, { DE: 'Germany' })).toEqual({ DE: 'Deutschland' });
  });
  it('import matches native and English names', () => {
    expect(matchImportValue('language', 'Deutsch')).toBe('de');
    expect(matchImportValue('language', 'svenska')).toBe('sv');
    expect(matchImportValue('language', 'Gaeilge')).toBe('ga');
    expect(matchImportValue('language', 'Czech')).toBe('cs');
  });
  it('public intake accepts all 14 supported languages and rejects xx', () => {
    for(const language of PUBLIC_FORM_LANGUAGES)expect(publicComplaintSchema.shape.language.safeParse(language).success).toBe(true);
    expect(publicComplaintSchema.shape.language.safeParse('xx').success).toBe(false);
    expect(publicComplaintSchema.shape.language.safeParse('pl').success).toBe(true);
  });
});

describe('Template language fallback', () => {
  const templates = [{ id: '1', kind: 'acknowledgement', language: 'en', subject: 'Re {complaint_reference}', body: 'Dear {customer_name}' }];
  it('Start from English copies text with merge fields and no save', () => {
    const before = JSON.stringify(templates);
    expect(englishStarter(templates, 'acknowledgement')).toEqual({ subject: 'Re {complaint_reference}', body: 'Dear {customer_name}' });
    expect(JSON.stringify(templates)).toBe(before);
    expect(englishStarter(templates, 'final_response')).toBeNull();
  });
  it('case letters fall back to English with a warning', () => {
    expect(letterTemplateFor(templates, 'acknowledgement', 'de')).toEqual({ template: templates[0], warning: 'No German template — English used' });
    expect(letterTemplateFor(templates, 'acknowledgement', 'en').warning).toBeNull();
  });
});
