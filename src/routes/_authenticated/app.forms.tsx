import { createFileRoute } from '@tanstack/react-router';
import { queryOptions, useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { Copy, ExternalLink, Upload, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { membershipQuery, useMembership } from '@/lib/org';
import { DEFAULT_PRIVACY_NOTICE, formShareLinks } from '@/lib/public-forms';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { PrivacyNoticeEditor, privacyNoticesQuery } from '@/components/privacy-notice-editor';
import { membersQuery } from '@/lib/complaints';

const formQuery = (orgId: string) => queryOptions({ queryKey: ['public-form-settings', orgId], queryFn: async () => {
  const { data, error } = await supabase.from('public_complaint_forms').select('*').eq('org_id', orgId).maybeSingle();
  if (error) throw error;
  return data;
} });
export const Route = createFileRoute('/_authenticated/app/forms')({
  loader: async ({ context }) => {
    const m = await context.queryClient.ensureQueryData(membershipQuery);
    if (!m?.org || m.role !== 'org_admin') return;
    const form = await context.queryClient.ensureQueryData(formQuery(m.org.id));
    if (form) await Promise.all([context.queryClient.ensureQueryData(privacyNoticesQuery(m.org.id, form.id)), context.queryClient.ensureQueryData(membersQuery(m.org.id))]);
  },
  head: () => ({ meta: [{ title: 'Public complaint form — Redress' }, { name: 'description', content: 'Manage your firm’s public complaint form, privacy notice, logo and sharing options.' }, { property: 'og:title', content: 'Public complaint form — Redress' }, { property: 'og:description', content: 'Manage your firm’s public complaint intake.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: FormSettings,
});
function FormSettings() {
  const m = useMembership();
  if (!m?.org || m.role !== 'org_admin') return <p className="text-muted-foreground">Only Org Admins can manage the public complaint form.</p>;
  return <Settings orgId={m.org.id} firmName={m.org.legal_name} />;
}
function Settings({ orgId, firmName }: { orgId: string; firmName: string }) {
  const { data: form } = useSuspenseQuery(formQuery(orgId));
  const qc = useQueryClient();
  const [notice, setNotice] = useState(form?.privacy_notice ?? DEFAULT_PRIVACY_NOTICE);
  const [enabled, setEnabled] = useState(form?.enabled ?? true);
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  useEffect(() => { setOrigin(window.location.origin); }, []);
  useEffect(() => {
    let active = true;
    if (!form?.logo_path) { setLogo(null); return; }
    void supabase.storage.from('firm-logos').createSignedUrl(form.logo_path, 3600).then(({ data }) => { if (active) setLogo(data?.signedUrl ?? null); });
    return () => { active = false; };
  }, [form?.logo_path]);
  const share = form && origin ? formShareLinks(origin, form.id, firmName) : null;
  async function save() {
    const parsed = z.string().trim().min(1, 'A privacy notice is required').max(10000).safeParse(notice);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message); return; }
    setBusy(true);
    try {
      const { error } = await supabase.from('public_complaint_forms').upsert({ org_id: orgId, privacy_notice: parsed.data, enabled, updated_at: new Date().toISOString() }, { onConflict: 'org_id' });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['public-form-settings', orgId] });
      toast.success('Public form saved.');
    } catch { toast.error('Could not save the public form. Please try again.'); }
    finally { setBusy(false); }
  }
  async function upload(file: File | undefined) {
    if (!file || !form) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) { toast.error('Choose a PNG, JPEG or WebP logo up to 2 MB.'); return; }
    setBusy(true);
    try {
      const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `${orgId}/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from('firm-logos').upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { error: updateError } = await supabase.from('public_complaint_forms').update({ logo_path: path, updated_at: new Date().toISOString() }).eq('id', form.id);
      if (updateError) { await supabase.storage.from('firm-logos').remove([path]); throw updateError; }
      if (form.logo_path) await supabase.storage.from('firm-logos').remove([form.logo_path]);
      await qc.invalidateQueries({ queryKey: ['public-form-settings', orgId] });
      toast.success('Firm logo saved.');
    } catch { toast.error('Could not upload the logo. Please try again.'); }
    finally { setBusy(false); }
  }
  async function removeLogo() {
    if (!form?.logo_path) return;
    setBusy(true);
    const { error } = await supabase.from('public_complaint_forms').update({ logo_path: null }).eq('id', form.id);
    if (error) toast.error('Could not remove the logo.');
    else { await supabase.storage.from('firm-logos').remove([form.logo_path]); await qc.invalidateQueries({ queryKey: ['public-form-settings', orgId] }); }
    setBusy(false);
  }
  async function copy(text: string) { try { await navigator.clipboard.writeText(text); toast.success('Copied.'); } catch { toast.error('Copy unavailable. Select and copy the text below.'); } }
  return <div className="mx-auto max-w-3xl">
    <h1 className="text-2xl font-semibold">Public complaint form</h1><p className="mt-1 break-words text-sm text-muted-foreground">{firmName}</p>
    <section className="mt-8 border-b pb-6"><div className="flex items-center justify-between gap-4"><Label htmlFor="public-enabled">Accept public submissions</Label><Switch id="public-enabled" checked={enabled} onCheckedChange={setEnabled} /></div></section>
    <section className="mt-6"><h2 className="text-lg font-semibold">Firm logo</h2><div className="mt-4 flex flex-wrap items-center gap-4">{logo && <img src={logo} alt={`${firmName} logo`} className="h-20 w-20 object-contain" />}<div><Input id="firm-logo" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy || !form} onChange={e => { void upload(e.target.files?.[0]); e.target.value = ''; }} className="hidden" /><Button asChild variant="outline" disabled={busy || !form}><label htmlFor="firm-logo" className={busy || !form ? 'pointer-events-none' : 'cursor-pointer'}><Upload aria-hidden="true" className="h-4 w-4" />Upload logo</label></Button><p className="mt-2 text-xs text-muted-foreground">PNG, JPEG or WebP · Up to 2 MB</p></div>{form?.logo_path && <Button type="button" variant="ghost" size="icon" aria-label="Remove logo" title="Remove logo" disabled={busy} onClick={removeLogo}><Trash2 aria-hidden="true" className="h-4 w-4" /></Button>}</div></section>
    <section className="mt-8 border-t pt-6"><h2 className="text-lg font-semibold">Privacy notice</h2>{form ? <PrivacyNoticeEditor orgId={orgId} formId={form.id} defaultNotice={notice} defaultEditor={<><Label htmlFor="privacy-notice">Default privacy notice</Label><Textarea id="privacy-notice" className="mt-3" rows={7} maxLength={10000} value={notice} onChange={e => setNotice(e.target.value)} /><p className="mt-2 text-xs text-muted-foreground">{Array.from(notice).length.toLocaleString('en-GB')} / 10,000 characters</p><p className="mt-2 text-sm text-muted-foreground">Replace the sample wording with your firm’s approved privacy notice before sharing.</p><Button className="mt-5" disabled={busy} onClick={save}><Save aria-hidden="true" className="h-4 w-4" />{busy ? 'Saving…' : 'Save form'}</Button></>} /> : <><Label htmlFor="privacy-notice">Default privacy notice</Label><Textarea id="privacy-notice" className="mt-3" rows={7} maxLength={10000} value={notice} onChange={e => setNotice(e.target.value)} /><Button className="mt-5" disabled={busy} onClick={save}><Save aria-hidden="true" className="h-4 w-4" />Save form</Button></>}</section>
    {share ? <section className="mt-8 border-t pt-6"><h2 className="text-lg font-semibold">Share form</h2>{form?.enabled === false && <p className="mt-2 text-sm text-warning">The form is not accepting submissions.</p>}<Label htmlFor="share-link" className="mt-4">Public link</Label><Input id="share-link" readOnly value={share.url} className="mt-2" /><div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" onClick={() => copy(share.url)}><Copy aria-hidden="true" className="h-4 w-4" />Copy link</Button><Button variant="ghost" asChild><a href={share.url} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true" className="h-4 w-4" />Open form</a></Button></div><Label htmlFor="embed-code" className="mt-6">Embed snippet</Label><Textarea id="embed-code" className="mt-2 font-mono text-xs" readOnly rows={5} value={share.embed} /><Button variant="outline" className="mt-3" onClick={() => copy(share.embed)}><Copy aria-hidden="true" className="h-4 w-4" />Copy snippet</Button><p className="mt-3 text-sm text-muted-foreground">Publish the app before sharing its link with customers.</p></section> : <p className="mt-8 text-sm text-muted-foreground">Save the form to create its public link and embed snippet.</p>}
  </div>;
}
