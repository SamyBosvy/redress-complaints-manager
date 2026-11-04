import { createFileRoute } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useState, type ReactNode } from 'react';
import { CheckCircle2, ShieldCheck, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { getPublicForm, submitPublicComplaint } from '@/lib/public-forms.functions';
import { publicComplaintSchema } from '@/lib/public-forms';
import { COUNTRIES } from '@/lib/countries';
import { CATEGORIES, PRODUCTS, LANGUAGES } from '@/lib/complaints';

export const Route = createFileRoute('/complain/$formId')({
  validateSearch: (search: Record<string, unknown>) => ({ embed: search['embed'] === '1' || search['embed'] === 1 ? '1' : undefined }),
  loader: async ({ params }) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.formId)) return null;
    return getPublicForm({ data: { id: params.formId } });
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `Submit a complaint — ${loaderData.firm_name} | Redress` : 'Complaint form unavailable — Redress';
    const description = loaderData ? `Submit a customer complaint to ${loaderData.firm_name}.` : 'This complaint form is currently unavailable.';
    return { meta: [{ title }, { name: 'description', content: description }, { property: 'og:title', content: title }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex' }] };
  },
  component: PublicComplaint,
});
function PublicComplaint() {
  const firm = Route.useLoaderData();
  const { embed } = Route.useSearch();
  const send = useServerFn(submitPublicComplaint);
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submissionId, setSubmissionId] = useState('');
  const [v, setV] = useState({ complainant_name: '', complainant_email: '', complainant_phone: '', customer_ref: '', country_code: firm?.countries.length === 1 ? firm.countries[0] ?? '' : '', language: 'en', product: '', category: '', summary: '', desired_outcome: '', vulnerable: false, vulnerable_note: '', privacy_acknowledged: false, website: '' });
  const set = (key: keyof typeof v, value: string | boolean) => setV(p => ({ ...p, [key]: value }));
  if (!firm) return <main className="mx-auto max-w-xl px-5 py-16"><h1 className="text-2xl font-semibold">Complaint form unavailable</h1><p className="mt-3 text-muted-foreground">Please contact the firm directly to submit your complaint.</p></main>;
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!firm || busy) return;
    const id = submissionId || crypto.randomUUID(); setSubmissionId(id);
    const parsed = publicComplaintSchema.safeParse({ ...v, form_id: firm.id, submission_id: id, privacy_notice: firm.privacy_notice });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Check your details.'); return; }
    setBusy(true); setError('');
    try { const result = await send({ data: parsed.data }); setReference(result.reference); }
    catch (e) { setError(e instanceof Error ? e.message : 'Your complaint could not be saved. Please try again.'); }
    finally { setBusy(false); }
  }
  const countries = Object.fromEntries(firm.countries.map(code => [code, COUNTRIES[code] ?? code]));
  return <div className="min-h-screen bg-background">
    <header className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 border-b px-5 py-5">
      <div className="flex min-w-0 items-center gap-3">{firm.logo_url && <img src={firm.logo_url} alt={`${firm.firm_name} logo`} className="h-14 w-14 shrink-0 object-contain" />}<p className="break-words text-lg font-semibold">{firm.firm_name}</p></div>
    </header>
    <main className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
      {reference ? <section aria-live="polite" className="py-8"><CheckCircle2 aria-hidden="true" className="h-10 w-10 text-success" /><h1 className="mt-5 font-display text-3xl font-semibold">Complaint received</h1><p className="mt-3">Your complaint has been submitted to {firm.firm_name}.</p><p className="mt-6 text-sm text-muted-foreground">Your reference number</p><p className="mt-1 break-all font-mono text-2xl font-medium">{reference}</p><p className="mt-5 text-sm text-muted-foreground">Keep this reference for any correspondence with the firm.</p></section> : <form onSubmit={submit}>
        <h1 className="font-display text-3xl font-semibold">Submit a complaint</h1>
        <p className="mt-2 text-sm text-muted-foreground">Fields marked * are required. Do not include passwords, PINs or full card numbers.</p>
        <fieldset className="mt-8"><legend className="mb-4 text-lg font-semibold">Your details</legend><div className="grid gap-5 sm:grid-cols-2">
          <Field id="name" label="Your name *"><Input id="name" autoComplete="name" required maxLength={200} value={v.complainant_name} onChange={e => set('complainant_name', e.target.value)} /></Field>
          <Field id="customer-ref" label="Customer / account ID"><Input id="customer-ref" maxLength={100} value={v.customer_ref} onChange={e => set('customer_ref', e.target.value)} /></Field>
          <Field id="email" label="Email"><Input id="email" type="email" autoComplete="email" maxLength={255} value={v.complainant_email} onChange={e => set('complainant_email', e.target.value)} /></Field>
          <Field id="phone" label="Phone"><Input id="phone" type="tel" autoComplete="tel" maxLength={50} value={v.complainant_phone} onChange={e => set('complainant_phone', e.target.value)} /></Field>
          <Choice id="country" label="Your country *" required options={countries} value={v.country_code} onChange={x => set('country_code', x)} />
          <Choice id="language" label="Preferred correspondence language" options={LANGUAGES} value={v.language} onChange={x => set('language', x)} />
        </div></fieldset>
        <fieldset className="mt-8 border-t pt-6"><legend className="pr-3 text-lg font-semibold">Your complaint</legend><div className="grid gap-5 sm:grid-cols-2">
          <Choice id="product" label="Product *" required options={PRODUCTS} value={v.product} onChange={x => set('product', x)} />
          <Choice id="category" label="Category *" required options={CATEGORIES} value={v.category} onChange={x => set('category', x)} />
          <div className="sm:col-span-2"><Field id="summary" label="What happened? *"><Textarea id="summary" required rows={5} maxLength={10000} value={v.summary} onChange={e => set('summary', e.target.value)} /></Field></div>
          <div className="sm:col-span-2"><Field id="outcome" label="How would you like this resolved?"><Textarea id="outcome" rows={3} maxLength={5000} value={v.desired_outcome} onChange={e => set('desired_outcome', e.target.value)} /></Field></div>
          <div className="sm:col-span-2"><label className="flex items-start gap-3 text-sm"><Checkbox checked={v.vulnerable} onCheckedChange={x => set('vulnerable', x === true)} className="mt-0.5" />I need additional support due to my personal circumstances</label>{v.vulnerable && <div className="mt-4"><Field id="support" label="Additional support needed (optional)"><Textarea id="support" maxLength={1000} value={v.vulnerable_note} onChange={e => set('vulnerable_note', e.target.value)} /></Field></div>}</div>
        </div></fieldset>
        <section className="mt-8 border-t pt-6"><h2 className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck aria-hidden="true" className="h-5 w-5 text-primary" /> Privacy notice</h2><p className="mt-3 whitespace-pre-wrap break-words text-sm text-muted-foreground">{firm.privacy_notice}</p><label className="mt-5 flex items-start gap-3 text-sm"><Checkbox checked={v.privacy_acknowledged} onCheckedChange={x => set('privacy_acknowledged', x === true)} className="mt-0.5" />I have read the privacy notice. *</label></section>
        <div className="hidden" aria-hidden="true"><label htmlFor="website">Website</label><input id="website" tabIndex={-1} autoComplete="off" value={v.website} onChange={e => set('website', e.target.value)} /></div>
        {error && <p role="alert" className="mt-5 break-words text-sm text-destructive">{error}</p>}
        <Button className="mt-6 min-h-12 w-full sm:w-auto" type="submit" disabled={busy}>{busy ? 'Submitting…' : <><Send aria-hidden="true" className="h-4 w-4" />Submit complaint</>}</Button>
      </form>}
      <footer className="mt-10 border-t pt-4 text-xs text-muted-foreground">{firm.firm_name} · Complaints handled using Redress</footer>
    </main>
  </div>;
}
function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) { return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div>; }
function Choice({ id, label, value, onChange, options, required }: { id: string; label: string; value: string; onChange: (value: string) => void; options: Record<string, string>; required?: boolean }) {
  return <Field id={id} label={label}><select id={id} required={required} value={value} onChange={e => onChange(e.target.value)} className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="">Select</option>{Object.entries(options).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></Field>;
}
