import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, UserRound, Flag, X } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { bulkBatches, bulkPermissions, resultSummary, splitClosed, type BulkResult } from '@/lib/bulk-actions';
import { supabase } from '@/integrations/supabase/client';
import { downloadFile, toCsv } from '@/lib/csv';
import { CATEGORIES, STATUSES, type Status } from '@/lib/complaints';
import type { QueueItem } from '@/lib/queue';
import type { AppRole } from '@/lib/org';

type Handler = { user_id: string; name: string };
type Action = 'reassign' | 'priority' | 'rebalance';
export function QueueBulkActions({ rows, orgId, role, handlers, members, clear, onBusy }: {
  rows: QueueItem[]; orgId: string; role: AppRole | null; handlers: Handler[]; members: Handler[];
  clear: () => void; onBusy: (busy: boolean) => void;
}) {
  const qc = useQueryClient();
  const permissions = bulkPermissions(role);
  const [action, setAction] = useState<Action | null>(null);
  const [value, setValue] = useState('standard');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<BulkResult | null>(null);
  const label = action === 'priority' ? (value === 'high' ? 'High' : 'Standard') : value === 'none' ? 'Unassign' : handlers.find(h => h.user_id === value)?.name ?? 'Unknown';
  const mutation = useMutation({
    mutationFn: async () => {
      if (!action || !(action !== 'priority' ? permissions.reassign : permissions.priority)) throw new Error('You do not have permission to make this change.');
      if (action === 'reassign' && value !== 'none' && !handlers.some(h => h.user_id === value)) throw new Error('Choose an active handler.');
      const { eligible, skipped } = splitClosed(rows);
      const outcome: BulkResult = { updated: 0, failed: [], skipped: skipped.map(r => r.reference ?? r.id ?? 'Unknown') };
      const patch = action === 'reassign' ? { assigned_to: value === 'none' ? null : value } : { priority: value as 'standard' | 'high' };
      let completed = skipped.length;
      let firstError: string | undefined;
      for (const batch of bulkBatches(eligible)) {
        await Promise.all(batch.map(async row => {
          if (!row.id) return;
          const reference = row.reference ?? row.id;
          try {
            if(action==='rebalance'){
              if(row.assigned_to!==null)throw new Error('Only unassigned cases can be rebalanced.');
              const {data,error}=await supabase.rpc('rebalance_complaint',{_org:orgId,_complaint:row.id});if(error)throw error;
              if(!data)throw new Error('No eligible agent, assignment disabled, or case no longer unassigned.');outcome.updated++;return;
            }
            // Same RLS update and trigger-written activity/audit path as a single case.
            const { data, error } = await supabase.from('complaints').update(patch)
              .eq('org_id', orgId).eq('id', row.id).neq('status', 'closed').select('id');
            if (error) throw error;
            if (data.length) outcome.updated++;
            else {
              const current = await supabase.from('complaints').select('status').eq('org_id', orgId).eq('id', row.id).single();
              if (!current.error && current.data.status === 'closed') outcome.skipped.push(reference);
              else throw new Error('Complaint could not be updated.');
            }
          } catch (error) {
            outcome.failed.push(reference);
            firstError ??= error instanceof Error ? error.message : (error as {message?: string})?.message ?? 'Complaint could not be updated.';
          } finally { completed++; setProgress(completed); }
        }));
      }
      if (firstError) toast.error(firstError);
      return outcome;
    },
    onMutate: () => { onBusy(true); setProgress(0); setResult(null); },
    onSuccess: async outcome => {
      setResult(outcome);
      setAction(null);
      if (outcome.updated) await Promise.all([
        qc.invalidateQueries({ queryKey: ['queue', orgId] }), qc.invalidateQueries({ queryKey: ['queue-counts', orgId] }),
        qc.invalidateQueries({queryKey:['workload',orgId]}),qc.invalidateQueries({queryKey:['timeline',orgId]}),
        ...rows.filter(r => r.id).map(r => qc.invalidateQueries({ queryKey: ['case', r.id] })),
      ]);
    },
    onError: error => toast.error(error.message),
    onSettled: () => onBusy(false),
  });
  function exportSelected() {
    const nameOf = (id: string | null) => id ? members.find(m => m.user_id === id)?.name ?? 'Unknown user' : 'Unassigned';
    downloadFile(`complaints-selected-${new Date().toISOString().slice(0,10)}.csv`, toCsv([
      ['Reference','Customer','Category','Status','Agent','Time left'],
      ...rows.map(r => [r.reference,r.complainant_name,r.category ? CATEGORIES[r.category] : '',r.status ? STATUSES[r.status as Status] : '',nameOf(r.assigned_to),r.days_left]),
    ]));
  }
  if (!rows.length) return null;
  return <>
    <div className="sticky top-2 z-20 mt-4 border bg-card p-3 shadow-sm" aria-label="Bulk actions">
      <div className="flex flex-wrap items-center gap-2">
        <strong className="w-full text-sm tabular sm:w-auto sm:mr-auto">{rows.length} selected</strong>
        {permissions.reassign && <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => {setValue('none'); setAction('reassign');}}><UserRound aria-hidden="true" className="h-4 w-4"/>Reassign</Button>}
        {permissions.reassign && rows.every(row=>row.assigned_to===null)&&<Button size="sm" variant="outline" disabled={mutation.isPending} onClick={()=>setAction('rebalance')}><UserRound aria-hidden="true" className="h-4 w-4"/>Rebalance</Button>}
        {permissions.priority && <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => {setValue('standard'); setAction('priority');}}><Flag aria-hidden="true" className="h-4 w-4"/>Change priority</Button>}
        <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={exportSelected}><Download aria-hidden="true" className="h-4 w-4"/>Export</Button>
        <Button size="sm" variant="ghost" disabled={mutation.isPending} onClick={clear}><X aria-hidden="true" className="h-4 w-4"/>Clear</Button>
      </div>
      <div role="status" aria-live="polite" className="max-h-32 overflow-y-auto break-words text-sm">
        {mutation.isPending && <p className="mt-2">Updating {progress} of {rows.length}…</p>}
        {result && <><p className="mt-2">{resultSummary(result)}</p>{result.failed.length > 0 && <p className="text-destructive">Failed: {result.failed.join(', ')}</p>}{result.skipped.length > 0 && <p className="text-muted-foreground">Closed: {result.skipped.join(', ')}</p>}</>}
      </div>
    </div>
    <Dialog open={action !== null} onOpenChange={open => { if (!open && !mutation.isPending) setAction(null); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{action === 'rebalance'?'Rebalance unassigned complaints':action === 'reassign' ? 'Reassign complaints' : 'Change priority'}</DialogTitle><DialogDescription>{rows.length} selected. Closed cases will be skipped.</DialogDescription></DialogHeader>
        {action!=='rebalance'&&<Select value={value} onValueChange={setValue} disabled={mutation.isPending}>
          <SelectTrigger aria-label={action === 'reassign' ? 'Active handler' : 'Priority'}><SelectValue/></SelectTrigger>
          <SelectContent>{action === 'reassign' ? <><SelectItem value="none">Unassign</SelectItem>{handlers.map(h => <SelectItem key={h.user_id} value={h.user_id}>{h.name}</SelectItem>)}</> : <><SelectItem value="standard">Standard</SelectItem><SelectItem value="high">High</SelectItem></>}</SelectContent>
        </Select>}
        <p className="break-words text-sm">{action==='rebalance'?'Assign using the configured auto-assignment mode and current agent availability.':`Confirm ${action === 'reassign' ? 'assignment' : 'priority'}: ${label} for ${rows.length} complaints.`}</p>
        <DialogFooter className="gap-2"><Button variant="outline" disabled={mutation.isPending} onClick={() => setAction(null)}>Cancel</Button><Button className="min-h-12" disabled={mutation.isPending} onClick={() => mutation.mutate()}>Confirm change</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}