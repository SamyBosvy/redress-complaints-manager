import { useState, type ReactNode } from 'react';
import { queryOptions, useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Save, Trash2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { PUBLIC_FORM_LANGUAGES, NATIVE_LANGUAGE_NAMES, type PublicFormLanguage } from '@/lib/public-form-i18n';
import { membersQuery } from '@/lib/complaints';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export const privacyNoticesQuery = (orgId: string, formId: string) => queryOptions({
  queryKey: ['public-form-notices', orgId, formId],
  queryFn: async () => {
    const { data, error } = await supabase.from('public_form_privacy_notices').select('*').eq('org_id', orgId).eq('form_id', formId).order('language');
    if (error) throw error;
    return data;
  },
});

export function PrivacyNoticeEditor({ orgId, formId, defaultNotice, defaultEditor }: { orgId: string; formId: string; defaultNotice: string; defaultEditor: ReactNode }) {
  const { data: notices } = useSuspenseQuery(privacyNoticesQuery(orgId, formId));
  const { data: members } = useSuspenseQuery(membersQuery(orgId));
  const qc = useQueryClient();
  const [tab, setTab] = useState('default');
  const [drafts, setDrafts] = useState<Partial<Record<PublicFormLanguage, string>>>({});
  const [busy, setBusy] = useState(false);
  const saved = (language: PublicFormLanguage) => notices.find(n => n.language === language);
  const body = (language: PublicFormLanguage) => drafts[language] ?? saved(language)?.body ?? '';
  const edit = (language: PublicFormLanguage, value: string) => setDrafts(d => ({ ...d, [language]: value }));
  async function persist(language: PublicFormLanguage, remove = false) {
    const value = body(language);
    if (!remove && (Array.from(value).length < 50 || Array.from(value).length > 20000)) { toast.error('Use between 50 and 20,000 characters.'); return; }
    setBusy(true);
    try {
      const result = remove
        ? await supabase.from('public_form_privacy_notices').delete().eq('org_id', orgId).eq('form_id', formId).eq('language', language)
        : await supabase.from('public_form_privacy_notices').upsert({ org_id: orgId, form_id: formId, language, body: value }, { onConflict: 'form_id,language' });
      if (result.error) throw result.error;
      await qc.invalidateQueries({ queryKey: ['public-form-notices', orgId, formId] });
      setDrafts(d => { const next = { ...d }; delete next[language]; return next; });
      toast.success(remove ? 'Translation deleted. Customers will see the default notice.' : 'Privacy notice translation saved.');
    } catch { toast.error('Could not save the privacy notice. Please try again.'); }
    finally { setBusy(false); }
  }
  return <>
    <p className="mt-2 text-sm text-muted-foreground">Customers see the notice in their form language when available, otherwise the default.</p>
    <Tabs value={tab} onValueChange={setTab} className="mt-4">
      <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
        <TabsTrigger value="default" disabled={busy}>Default</TabsTrigger>
        {PUBLIC_FORM_LANGUAGES.map(language => <TabsTrigger key={language} value={language} disabled={busy} aria-label={`${NATIVE_LANGUAGE_NAMES[language]}${saved(language) ? ', translation saved' : ', no translation'}`}>
          {NATIVE_LANGUAGE_NAMES[language]}{saved(language) && <Check aria-hidden="true" className="ml-1 h-3 w-3" />}
        </TabsTrigger>)}
      </TabsList>
      <TabsContent value="default">{defaultEditor}</TabsContent>
      {PUBLIC_FORM_LANGUAGES.map(language => {
        const row = saved(language);
        const updater = members.find(m => m.user_id === row?.updated_by)?.name ?? 'Unknown user';
        return <TabsContent key={language} value={language}>
          <Label htmlFor={`notice-${language}`}>{NATIVE_LANGUAGE_NAMES[language]} privacy notice</Label>
          <Textarea id={`notice-${language}`} lang={language} className="mt-3" rows={8} maxLength={20000} value={body(language)} disabled={busy} onChange={e => edit(language, e.target.value)} aria-describedby={`notice-count-${language}`} />
          <p id={`notice-count-${language}`} className="mt-2 text-xs text-muted-foreground">{Array.from(body(language)).length.toLocaleString('en-GB')} / 20,000 characters · Minimum 50</p>
          {row && <p className="mt-2 text-xs text-muted-foreground">Last updated by {updater} · {new Date(row.updated_at).toLocaleString('en-GB')}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy} onClick={() => edit(language, defaultNotice)}><Copy aria-hidden="true" className="h-4 w-4" />Copy from default</Button>
            <Button disabled={busy} onClick={() => persist(language)}><Save aria-hidden="true" className="h-4 w-4" />{busy ? 'Saving…' : 'Save translation'}</Button>
            {row && <Button variant="ghost" disabled={busy} onClick={() => persist(language, true)}><Trash2 aria-hidden="true" className="h-4 w-4" />Delete translation</Button>}
          </div>
        </TabsContent>;
      })}
    </Tabs>
  </>;
}