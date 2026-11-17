import { LANGUAGES } from './complaints';

type Tpl = { kind: string; language: string; subject: string; body: string };
export function languageLabel(code: string) { return LANGUAGES[code as keyof typeof LANGUAGES] ?? code; }
/** English subject/body for the editor; the caller loads it as unsaved text and never saves it automatically. */
export function englishStarter<T extends Tpl>(templates: readonly T[], kind: string): { subject: string; body: string } | null {
  const en = templates.find(t => t.kind === kind && t.language === 'en' && t.body.trim());
  return en ? { subject: en.subject, body: en.body } : null;
}
/** Case letters use the case-language template, else English with a visible warning. */
export function letterTemplateFor<T extends Tpl>(templates: readonly T[], kind: string, lang: string): { template: T | undefined; warning: string | null } {
  const own = templates.find(t => t.kind === kind && t.language === lang);
  if (own) return { template: own, warning: null };
  return { template: templates.find(t => t.kind === kind && t.language === 'en'), warning: lang === 'en' ? null : `No ${languageLabel(lang)} template — English used` };
}
