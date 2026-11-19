import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { BUILT_IN_KINDS, TEMPLATE_KINDS, validateLetterTypeName } from '@/lib/letters';
import type { Database } from '@/integrations/supabase/types';

type Row = Database['public']['Tables']['custom_letter_types']['Row'];
type Draft = { id?: string; name: string; description: string; requires_adr_block: boolean };

export function LetterTypes({ orgId, types, canEdit }: { orgId: string; types: Row[]; canEdit: boolean }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const active = types.filter(t => !t.archived_at).length;
  const nameError = draft ? validateLetterTypeName(draft.name, types, draft.id) : null;
  const refresh = () => qc.invalidateQueries({ queryKey: ['custom-letter-types', orgId] });
  async function save() {
    if (!draft || nameError || draft.description.length > 300) return;
    setBusy(true);
    const row = { name: draft.name.trim(), description: draft.description.trim() || null, requires_adr_block: draft.requires_adr_block };
    const { error } = draft.id ? await supabase.from('custom_letter_types').update(row).eq('id', draft.id).eq('org_id', orgId) : await supabase.from('custom_letter_types').insert({ ...row, org_id: orgId });
    setBusy(false);
    if (error) { toast.error(error.message.includes('custom_letter_types_org_name_key') ? 'A letter type with this name already exists.' : error.message); return; }
    setDraft(null); await refresh(); toast.success('Letter type saved.');
  }
  async function archive(t: Row, archived: boolean) {
    setBusy(true);
    const { error } = await supabase.from('custom_letter_types').update({ archived_at: archived ? new Date().toISOString() : null }).eq('id', t.id).eq('org_id', orgId);
    setBusy(false);
    if (error) toast.error(error.message); else { await refresh(); toast.success(archived ? 'Letter type archived.' : 'Letter type restored.'); }
  }
  return <section aria-labelledby="letter-types-title" className="mt-6 rounded-lg border bg-card p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="letter-types-title" className="font-semibold">Letter types</h2><p className="text-sm text-muted-foreground">Custom letters are informational only: they never change the complaint status, deadlines or QA. {active}/50 active.</p></div>
      {canEdit && !draft && <Button variant="outline" disabled={active >= 50} onClick={() => setDraft({ name: '', description: '', requires_adr_block: false })}>New letter type</Button>}</div>
    {draft && <div className="mt-4 grid gap-3 rounded-md border p-4">
      <div className="space-y-1.5"><Label htmlFor="letter-type-name">Name</Label><Input id="letter-type-name" maxLength={80} value={draft.name} aria-invalid={Boolean(nameError && draft.name)} onChange={e => setDraft({ ...draft, name: e.target.value })} />{nameError && draft.name && <p className="text-sm text-destructive">{nameError}</p>}</div>
      <div className="space-y-1.5"><Label htmlFor="letter-type-description">Description (optional)</Label><Textarea id="letter-type-description" rows={2} maxLength={300} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /><p className="text-xs text-muted-foreground">{draft.description.length}/300</p></div>
      <div className="flex items-center gap-2"><Switch id="letter-type-adr" checked={draft.requires_adr_block} onCheckedChange={v => setDraft({ ...draft, requires_adr_block: v })} /><Label htmlFor="letter-type-adr">Require the ADR referral block in templates</Label></div>
      <div className="flex gap-2"><Button disabled={busy || Boolean(nameError)} onClick={() => void save()}>Save letter type</Button><Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button></div>
    </div>}
    <ul className="mt-4 divide-y text-sm">
      {BUILT_IN_KINDS.map(k => <li key={k} className="flex flex-wrap items-center gap-2 py-2"><span className="flex-1">{TEMPLATE_KINDS[k]}</span><Badge variant="secondary">Built-in</Badge></li>)}
      {types.map(t => <li key={t.id} className="flex flex-wrap items-center gap-2 py-2"><span className="min-w-0 flex-1"><span className="block font-medium">{t.name}</span>{t.description && <span className="block break-words text-muted-foreground">{t.description}</span>}</span>
        {t.requires_adr_block && <Badge variant="outline">ADR block</Badge>}{t.archived_at ? <Badge variant="outline">Archived</Badge> : <Badge>Custom</Badge>}
        {canEdit && <>{!t.archived_at && <Button size="sm" variant="outline" disabled={busy} onClick={() => setDraft({ id: t.id, name: t.name, description: t.description ?? '', requires_adr_block: t.requires_adr_block })}>Edit</Button>}
          <Button size="sm" variant="ghost" disabled={busy || (Boolean(t.archived_at) && active >= 50)} onClick={() => void archive(t, !t.archived_at)}>{t.archived_at ? 'Restore' : 'Archive'}</Button></>}
      </li>)}
    </ul>
  </section>;
}
