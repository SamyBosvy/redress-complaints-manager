import { ADJUSTMENTS } from '@/lib/vulnerability';
import { createFileRoute } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, ShieldCheck, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { getPublicForm, submitPublicComplaint } from '@/lib/public-forms.functions';
import { publicComplaintSchema } from '@/lib/public-forms';
import type { ZodIssue } from 'zod';
import { PUBLIC_FORM_I18N, NATIVE_LANGUAGE_NAMES, resolvePublicFormLanguage, isPublicFormLanguage, interpolate, INTAKE_CORRESPONDENCE_LANGUAGES, publicFormIssueMessage, publicFormServerError } from '@/lib/public-form-i18n';

export const Route = createFileRoute('/complain/$formId')({
  validateSearch: (search: Record<string, unknown>) => ({ embed: search['embed'] === '1' || search['embed'] === 1 ? '1' : undefined, lang: typeof search['lang'] === 'string' ? search['lang'] : search['lang'] === undefined ? undefined : '' }),
  loader: async ({ params }) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.formId)) return null;
    try { return await getPublicForm({ data: { id: params.formId } }); } catch { return null; }
  },
  head: ({ loaderData, matches }) => {
    const search = matches[matches.length - 1]?.search as { lang?: string } | undefined;
    const t = PUBLIC_FORM_I18N[resolvePublicFormLanguage(search?.lang)];
    const title = loaderData ? `${t.heading} — ${loaderData.firm_name} | Redress` : `${t.unavailable} — Redress`;
    const description = loaderData ? interpolate(t.description, loaderData.firm_name) : t.unavailableDescription;
    return { meta: [{ title }, { name: 'description', content: description }, { property: 'og:title', content: title }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' }] };
  },
  component: PublicComplaint,
});
// Keep correspondence aligned with supported public languages.
function correspondenceDefault(lang: string) { return (INTAKE_CORRESPONDENCE_LANGUAGES as readonly string[]).includes(lang) ? lang : 'en'; }
function PublicComplaint() {
  const firm = Route.useLoaderData();
  const { lang } = Route.useSearch();
  const navigate = Route.useNavigate();
  const uiLanguage = resolvePublicFormLanguage(lang);
  const t = PUBLIC_FORM_I18N[uiLanguage];
  const send = useServerFn(submitPublicComplaint);
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ZodIssue | 'server' | null>(null);
  const [correspondenceChanged, setCorrespondenceChanged] = useState(false);
  const [submissionId, setSubmissionId] = useState('');
  const [v, setV] = useState({ complainant_name: '', complainant_email: '', complainant_phone: '', customer_ref: '', country_code: firm?.countries.length === 1 ? firm.countries[0] ?? '' : '', language: correspondenceDefault(uiLanguage), product: '', category: '', summary: '', desired_outcome: '', vulnerable: false, adjustments: [] as string[], adjustments_note: '', customer_consented: false, privacy_acknowledged: false, website: '' });
  const set = (key: keyof typeof v, value: string | boolean | string[]) => setV(p => ({ ...p, [key]: value }));
  useEffect(() => {
    if (lang === undefined) {
      const detected = resolvePublicFormLanguage(undefined, navigator.languages);
      void navigate({ search: prev => ({ ...prev, lang: detected }), replace: true });
    }
  }, [lang, navigate]);
  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = uiLanguage;
    return () => { document.documentElement.lang = previous; };
  }, [uiLanguage]);
  useEffect(() => { if (!correspondenceChanged) setV(prev => ({ ...prev, language: correspondenceDefault(uiLanguage) })); }, [uiLanguage, correspondenceChanged]);
  const switcher = <Choice id="ui-language" label={t.uiLanguage} placeholder={t.select} options={NATIVE_LANGUAGE_NAMES} value={uiLanguage} onChange={value => { if (isPublicFormLanguage(value)) void navigate({ search: prev => ({ ...prev, lang: value }), replace: true }); }} />;
  if (!firm) return <main id="main-content" tabIndex={-1} className="mx-auto max-w-xl px-5 py-16"><div className="mb-8">{switcher}</div><h1 className="text-2xl font-semibold">{t.unavailable}</h1><p className="mt-3 text-muted-foreground">{t.contactFirm}</p></main>;
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!firm || busy) return;
    const id = submissionId || crypto.randomUUID(); setSubmissionId(id);
    const parsed = publicComplaintSchema.safeParse({ ...v, form_id: firm.id, submission_id: id, privacy_notice: firm.privacy_notice });
    if (!parsed.success) { setError(parsed.error.issues[0] ?? null); return; }
    setBusy(true); setError(null);
    try { const result = await send({ data: parsed.data }); setReference(result.reference); }
    catch { setError('server'); }
    finally { setBusy(false); }
  }
  const countries = Object.fromEntries(firm.countries.map(code => [code, (t.countries as Record<string, string>)[code] ?? code]));
  return <div className="min-h-screen bg-background">
    <header className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 border-b px-5 py-5">
      <div className="flex min-w-0 items-center gap-3">{firm.logo_url && <img src={firm.logo_url} alt={interpolate(t.logo, firm.firm_name)} className="h-14 w-14 shrink-0 object-contain" />}<p className="break-words text-lg font-semibold">{firm.firm_name}</p></div>
      <div className="w-full sm:w-64">{switcher}</div>
    </header>
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
      {reference ? <section aria-live="polite" className="py-8"><CheckCircle2 aria-hidden="true" className="h-10 w-10 text-success" /><h1 className="mt-5 font-display text-3xl font-semibold">{t.received}</h1><p className="mt-3">{interpolate(t.submittedTo, firm.firm_name)}</p><p className="mt-6 text-sm text-muted-foreground">{t.reference}</p><p className="mt-1 break-all font-mono text-2xl font-medium">{reference}</p><p className="mt-5 text-sm text-muted-foreground">{t.keepReference}</p></section> : <form onSubmit={submit} noValidate>
        <h1 className="font-display text-3xl font-semibold">{t.heading}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t.intro}</p>
        <fieldset className="mt-8"><legend className="mb-4 text-lg font-semibold">{t.details}</legend><div className="grid gap-5 sm:grid-cols-2">
          <Field id="name" label={t.name}><Input id="name" autoComplete="name" required maxLength={200} value={v.complainant_name} onChange={e => set('complainant_name', e.target.value)} /></Field>
          <Field id="customer-ref" label={t.customerRef}><Input id="customer-ref" maxLength={100} value={v.customer_ref} onChange={e => set('customer_ref', e.target.value)} /></Field>
          <Field id="email" label={t.email}><Input id="email" type="email" autoComplete="email" maxLength={255} value={v.complainant_email} onChange={e => set('complainant_email', e.target.value)} /></Field>
          <Field id="phone" label={t.phone}><Input id="phone" type="tel" autoComplete="tel" maxLength={50} value={v.complainant_phone} onChange={e => set('complainant_phone', e.target.value)} /></Field>
          <Choice placeholder={t.select} id="country" label={t.country} required options={countries} value={v.country_code} onChange={x => set('country_code', x)} />
          <Choice placeholder={t.select} id="language" label={t.language} options={Object.fromEntries(INTAKE_CORRESPONDENCE_LANGUAGES.map(code => [code, t.languages[code]]))} value={v.language} onChange={x => { setCorrespondenceChanged(true); set('language', x); }} />
        </div></fieldset>
        <fieldset className="mt-8 border-t pt-6"><legend className="pr-3 text-lg font-semibold">{t.complaint}</legend><div className="grid gap-5 sm:grid-cols-2">
          <Choice placeholder={t.select} id="product" label={t.product} required options={t.products} value={v.product} onChange={x => set('product', x)} />
          <Choice placeholder={t.select} id="category" label={t.category} required options={t.categories} value={v.category} onChange={x => set('category', x)} />
          <div className="sm:col-span-2"><Field id="summary" label={t.summary}><Textarea id="summary" required rows={5} maxLength={10000} value={v.summary} onChange={e => set('summary', e.target.value)} /></Field></div>
          <div className="sm:col-span-2"><Field id="outcome" label={t.outcome}><Textarea id="outcome" rows={3} maxLength={5000} value={v.desired_outcome} onChange={e => set('desired_outcome', e.target.value)} /></Field></div>
          <div className="sm:col-span-2"><label className="flex items-start gap-3 text-sm"><Checkbox checked={v.vulnerable} onCheckedChange={x => set('vulnerable', x === true)} className="mt-0.5" />{t.support}</label>{v.vulnerable && <div className="mt-4 space-y-4"><fieldset><legend className="mb-2 text-sm font-medium">{t.supportNeeds}</legend><div className="grid gap-3 sm:grid-cols-2">{(Object.keys(ADJUSTMENTS) as (keyof typeof ADJUSTMENTS)[]).map(key=><label key={key} className="flex items-start gap-3 text-sm"><Checkbox checked={v.adjustments.includes(key)} onCheckedChange={checked=>set('adjustments',checked?[...v.adjustments,key]:v.adjustments.filter(x=>x!==key))}/>{t[`adjustment.${key}`]}</label>)}</div></fieldset><Field id="support" label={t.supportNote}><Textarea id="support" maxLength={500} value={v.adjustments_note} onChange={e=>set('adjustments_note',e.target.value)} aria-describedby="support-hint"/></Field><p id="support-hint" className="text-xs text-muted-foreground">{t.supportHint}</p><label className="flex items-start gap-3 text-sm"><Checkbox checked={v.customer_consented} onCheckedChange={x=>set('customer_consented',x===true)}/>{t.supportConsent}</label></div>}</div>
        </div></fieldset>
        <section className="mt-8 border-t pt-6"><h2 className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck aria-hidden="true" className="h-5 w-5 text-primary" /> {t.privacy}</h2><p className="mt-3 whitespace-pre-wrap break-words text-sm text-muted-foreground">{firm.privacy_notice}</p><label className="mt-5 flex items-start gap-3 text-sm"><Checkbox checked={v.privacy_acknowledged} onCheckedChange={x => set('privacy_acknowledged', x === true)} className="mt-0.5" />{t.acknowledgement}</label></section>
        <div className="hidden" aria-hidden="true"><label htmlFor="website">{t.website}</label><input id="website" tabIndex={-1} autoComplete="off" value={v.website} onChange={e => set('website', e.target.value)} /></div>
        {error && <p role="alert" className="mt-5 break-words text-sm text-destructive">{error === 'server' ? publicFormServerError(uiLanguage) : publicFormIssueMessage(error, uiLanguage)}</p>}
        <Button className="mt-6 min-h-12 w-full sm:w-auto" type="submit" disabled={busy}>{busy ? t.submitting : <><Send aria-hidden="true" className="h-4 w-4" />{t.submit}</>}</Button>
      </form>}
      <footer className="mt-10 border-t pt-4 text-xs text-muted-foreground">{firm.firm_name} · {t.footer}</footer>
    </main>
  </div>;
}
function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) { return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div>; }
function Choice({ id, label, value, onChange, options, required, placeholder }: { id: string; label: string; value: string; onChange: (value: string) => void; options: Record<string, string>; required?: boolean; placeholder: string }) {
  return <Field id={id} label={label}><select id={id} required={required} value={value} onChange={e => onChange(e.target.value)} className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="">{placeholder}</option>{Object.entries(options).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></Field>;
}
