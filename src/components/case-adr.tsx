import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ADR_DECISIONS, canManageAdr } from '@/lib/adr';
import type { AppRole } from '@/lib/org';
import type { Database } from '@/integrations/supabase/types';
import { CURRENCIES } from '@/lib/currencies';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { AccessibleField } from './accessible-field';
import { toast } from 'sonner';
type Adr = Database['public']['Tables']['adr_cases']['Row'];
type Props = { orgId: string; id: string; role: AppRole | null; userId: string; body: string; currency: string; c: { status?: string | null; received_at?: string | null; assigned_to?: string | null; legal_hold?: boolean | null; privacy_processing?: boolean; anonymised_at?: string | null }; onSaved: () => Promise<unknown> };
export function CaseAdr(props: Props) {
  const q = useQuery({ queryKey: ['adr', props.orgId, props.id], queryFn: async () => { const { data, error } = await supabase.from('adr_cases').select('*').eq('org_id', props.orgId).eq('complaint_id', props.id).maybeSingle(); if (error) throw error; return data; } });
  return <section className="border-t pt-5"><h2 className="mb-4 text-sm font-semibold">ADR</h2>{q.isPending ? <p role="status">Loading ADR…</p> : q.isError ? <p role="alert" className="text-destructive">Could not load ADR records.</p> : <AdrForm key={q.data?.updated_at ?? 'new'} {...props} record={q.data ?? null} />}</section>;
}
function AdrForm({ record, ...p }: Props & { record: Adr | null }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(!!record);
  const [busy, setBusy] = useState(false);
  const [v, setV] = useState({ adr_reference: record?.adr_reference ?? '', escalated_on: record?.escalated_on ?? new Date().toISOString().slice(0, 10), firm_notified_on: record?.firm_notified_on ?? '', firm_response_due: record?.firm_response_due ?? '', firm_response_sent_on: record?.firm_response_sent_on ?? '', decision: record?.decision ?? 'pending', decision_on: record?.decision_on ?? '', award_amount: record?.award_amount?.toString() ?? '', award_currency: record?.award_currency ?? p.currency, notes: record?.notes ?? '' });
  const editable = canManageAdr(p.role, p.userId, p.c) && (record ? p.c.status === 'escalated_to_adr' : ['final_response_sent', 'closed'].includes(p.c.status ?? ''));
  const award = ['overturned', 'partially_overturned', 'settled'].includes(v.decision);
  const today = new Date().toISOString().slice(0, 10);
  const days = record?.firm_response_due ? Math.ceil((Date.parse(record.firm_response_due) - Date.parse(today)) / 86400000) : null;
  if (!open) return <>{editable ? <Button variant="outline" onClick={() => setOpen(true)}>Record ADR escalation</Button> : <p className="text-sm text-muted-foreground">No ADR escalation recorded.</p>}</>;
  async function save() {
    setBusy(true);
    try {
      const payload = { ...v, decision_on: v.decision === 'pending' ? null : v.decision_on || null, firm_notified_on: v.firm_notified_on || null, firm_response_due: v.firm_response_due || null, firm_response_sent_on: v.firm_response_sent_on || null, award_amount: award && v.award_amount !== '' ? Number(v.award_amount) : null, award_currency: award && v.award_amount !== '' ? v.award_currency : null, adr_reference: v.adr_reference || null, notes: v.notes || null };
      const { error } = record ? await supabase.from('adr_cases').update(payload).eq('org_id', p.orgId).eq('id', record.id) : await supabase.from('adr_cases').insert({ ...payload, org_id: p.orgId, complaint_id: p.id, adr_body_name: p.body });
      if (error) { toast.error(error.message); return; }
      await Promise.all([qc.invalidateQueries({ queryKey: ['adr'] }), qc.invalidateQueries({ queryKey: ['regulatory-report'] }), p.onSaved()]);
      toast.success('ADR record saved.');
    } finally { setBusy(false); }
  }
  return <div className="space-y-4"><p className="text-sm font-medium">{record?.adr_body_name || p.body || 'ADR body not configured'}</p>{days !== null && !record?.firm_response_sent_on && <p className={days < 0 ? 'text-destructive text-sm' : 'text-sm'}>{days < 0 ? `${-days} days overdue` : `${days} days until firm response due`}</p>}
    <div className="grid gap-4 sm:grid-cols-2"><AccessibleField label="ADR reference"><Input disabled={!editable || busy} maxLength={500} value={v.adr_reference} onChange={e => setV({ ...v, adr_reference: e.target.value })} /></AccessibleField>
    {(['escalated_on', 'firm_notified_on', 'firm_response_due', 'firm_response_sent_on'] as const).map(k => <AccessibleField key={k} label={{ escalated_on: 'Escalated on', firm_notified_on: 'Firm notified on', firm_response_due: 'Firm response due', firm_response_sent_on: 'Firm response sent on' }[k]}><Input type="date" required={k === 'escalated_on'} disabled={!editable || busy} min={k === 'escalated_on' ? p.c.received_at?.slice(0, 10) : v.escalated_on} max={k === 'firm_response_due' ? undefined : today} value={v[k]} onChange={e => setV({ ...v, [k]: e.target.value })} /></AccessibleField>)}
    <AccessibleField label="ADR decision"><Select disabled={!editable || busy} value={v.decision} onValueChange={decision => setV({ ...v, decision })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(ADR_DECISIONS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select></AccessibleField>
    {v.decision !== 'pending' && <AccessibleField label="Decision on"><Input type="date" min={v.escalated_on} max={today} disabled={!editable || busy} value={v.decision_on} onChange={e => setV({ ...v, decision_on: e.target.value })} /></AccessibleField>}
    {award && <><AccessibleField label="ADR award amount"><Input type="number" min={0} step="0.01" disabled={!editable || busy} value={v.award_amount} onChange={e => setV({ ...v, award_amount: e.target.value })} /></AccessibleField><AccessibleField label="ADR award currency"><Select disabled={!editable || busy} value={v.award_currency} onValueChange={award_currency => setV({ ...v, award_currency })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CURRENCIES.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent></Select></AccessibleField></>}
    </div><AccessibleField label="ADR notes"><Textarea disabled={!editable || busy} maxLength={2000} value={v.notes} onChange={e => setV({ ...v, notes: e.target.value })} /></AccessibleField>
    {editable && <div className="flex gap-2"><Button disabled={busy || !v.escalated_on || (v.decision !== 'pending' && !v.decision_on)} onClick={save}>{busy ? 'Saving…' : record ? 'Save ADR record' : 'Record ADR escalation'}</Button>{!record && <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>}</div>}
  </div>;
}