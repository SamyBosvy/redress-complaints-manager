import { LANGUAGES } from './complaints';

type Tpl = { kind: string; language: string; subject: string; body: string; custom_type_id?: string | null };
const same = (t: Tpl, kind: string, custom: string | null) => t.kind === kind && (t.custom_type_id ?? null) === custom;
export function languageLabel(code: string) { return LANGUAGES[code as keyof typeof LANGUAGES] ?? code; }
/** English subject/body for the editor; the caller loads it as unsaved text and never saves it automatically. */
export function englishStarter<T extends Tpl>(templates: readonly T[], kind: string, custom: string | null = null): { subject: string; body: string } | null {
  const en = templates.find(t => same(t, kind, custom) && t.language === 'en' && t.body.trim());
  return en ? { subject: en.subject, body: en.body } : null;
}
/** Case letters use the case-language template, else English with a visible warning. */
export function letterTemplateFor<T extends Tpl>(templates: readonly T[], kind: string, lang: string, custom: string | null = null): { template: T | undefined; warning: string | null } {
  const own = templates.find(t => same(t, kind, custom) && t.language === lang);
  if (own) return { template: own, warning: null };
  return { template: templates.find(t => same(t, kind, custom) && t.language === 'en'), warning: lang === 'en' ? null : `No ${languageLabel(lang)} template — English used` };
}
