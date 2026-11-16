import { Fragment, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useInfiniteQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Download, History, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/empty-state';
import { TableSkeletonRows } from '@/components/table-skeleton';
import { membersQuery } from '@/lib/complaints';
import { toCsv } from '@/lib/csv';
import { fetchAuditPage } from '@/lib/audit-query';
import { AUDIT_ACTIONS, AUDIT_AREAS, AUDIT_CSV_HEADER, AUDIT_EXPORT_LIMIT, auditCaseId, auditChecksum, auditDiff, auditFilterSummary, auditFormat, auditLabel, maskAuditValue, type AuditCursor, type AuditFilters } from '@/lib/audit';

export function AuditHistory({ orgId, role, zone, filters, onFilters, caseId }: { orgId: string; role: string | null; zone: string; filters: AuditFilters; onFilters?: (f: AuditFilters) => void; caseId?: string }) {
  const allowed = ['org_admin', 'complaints_manager', 'read_only'].includes(role ?? '');
  const admin = role === 'org_admin';
  const { data: members } = useSuspenseQuery(membersQuery(orgId));
  const actorName = (id: string | null) => {
    if (!id) return 'System';
    const member = members.find(m => m.user_id === id);
    return member && member.name !== 'Unknown' ? String(maskAuditValue(member.name, member.name === member.email ? 'email' : 'name', admin)) : 'Former member';
  };
  const result = useInfiniteQuery({ queryKey: ['audit-history', orgId, zone, filters, caseId, role], enabled: allowed,
    initialPageParam: undefined as AuditCursor | undefined,
    queryFn: ({ pageParam }) => fetchAuditPage(orgId, filters, zone, pageParam, caseId), getNextPageParam: page => page.next });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [receipt, setReceipt] = useState<{ checksum: string; count: number; summary: string; format: string }>();
  const rows = result.data?.pages.flatMap(p => p.rows) ?? [];
  const references = Object.assign({}, ...(result.data?.pages.map(p => p.references) ?? [])) as Record<string, string>;

  async function exportAudit(format: 'csv' | 'json') {
    if (busy || !allowed) return;
    setBusy(true); setProgress(0); setReceipt(undefined);
    try {
      const summary = auditFilterSummary(filters, caseId);
      const chunks: string[] = [format === 'csv' ? '\ufeff' + AUDIT_CSV_HEADER : '{"entries":['];
      let cursor: AuditCursor | undefined; let count = 0;
      do {
        const page = await fetchAuditPage(orgId, filters, zone, cursor, caseId);
        if (count + page.rows.length > AUDIT_EXPORT_LIMIT || (count + page.rows.length === AUDIT_EXPORT_LIMIT && page.next)) {
          throw new Error('More than 50,000 entries match. Narrow the filters before exporting; no incomplete file was downloaded.');
        }
        for (const row of page.rows) {
          const id = auditCaseId(row);
          const item = { timestamp_utc: new Date(row.created_at).toISOString(), timestamp_local: new Date(row.created_at).toLocaleString('en-GB', { timeZone: zone }) + ` (${zone})`, actor: actorName(row.actor), area: AUDIT_AREAS[row.table_name] ?? auditLabel(row.table_name), action: AUDIT_ACTIONS[row.action] ?? auditLabel(row.action), case_reference: (id ? page.references[id] : undefined) ?? '', row_id: row.row_id ?? '', changed_fields: auditDiff(row.before, row.after).map(d => auditLabel(d.field)), before: maskAuditValue(row.before, '', admin), after: maskAuditValue(row.after, '', admin) };
          chunks.push(format === 'csv' ? '\r\n' + toCsv([[item.timestamp_utc, item.timestamp_local, item.actor, item.area, item.action, item.case_reference, item.row_id, item.changed_fields.join('; '), JSON.stringify(item.before), JSON.stringify(item.after)]]) : (count ? ',' : '') + JSON.stringify(item));
          count++;
        }
        cursor = page.next; setProgress(count);
      } while (cursor);
      const footer = { row_count: count, filters: summary, time_zone: zone, exported_at: new Date().toISOString() };
      chunks.push(format === 'csv' ? '\r\n' + toCsv([['EXPORT FOOTER', footer.exported_at, '', '', '', '', '', `Rows: ${count}`, summary, `Time zone: ${zone}`]]) : '],"footer":' + JSON.stringify(footer) + '}');
      const blob = new Blob(chunks, { type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8' });
      const checksum = await auditChecksum(new Uint8Array(await blob.arrayBuffer()));
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.${format}`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setReceipt({ checksum, count, summary, format: format.toUpperCase() });
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Audit export failed. Please try again.'); }
    finally { setBusy(false); }
  }
  if (!allowed) return null;
  const set = (key: keyof AuditFilters, value: string) => onFilters?.({ ...filters, [key]: value || undefined });
  return <section aria-label={caseId ? 'Case audit history' : 'Audit history'} className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{caseId ? 'Audit' : 'Entries'}</h2><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy || result.isPending || result.isError} onClick={() => void exportAudit('csv')}><Download className="h-4 w-4" aria-hidden="true" />CSV</Button><Button variant="outline" disabled={busy || result.isPending || result.isError} onClick={() => void exportAudit('json')}><Download className="h-4 w-4" aria-hidden="true" />JSON</Button></div></div>
    {onFilters && <div className="flex flex-wrap items-end gap-3">
      <Pick label="Area" value={filters.area} options={AUDIT_AREAS} onChange={v => set('area', v)} />
      <Pick label="Action" value={filters.action} options={AUDIT_ACTIONS} onChange={v => set('action', v)} />
      <Pick label="User" value={filters.actor} options={Object.fromEntries(members.map(m => [m.user_id, actorName(m.user_id)]))} onChange={v => set('actor', v)} />
      {(['from', 'to'] as const).map(k => <div key={k} className="space-y-1"><Label htmlFor={`audit-${k}`}>{auditLabel(k)}</Label><Input id={`audit-${k}`} type="date" value={filters[k] ?? ''} onChange={e => set(k, e.target.value)} /></div>)}
      <div className="space-y-1"><Label htmlFor="audit-reference">Case reference</Label><Input id="audit-reference" placeholder="RDR-2026-000001" defaultValue={filters.reference ?? ''} key={filters.reference ?? ''} onBlur={e => { if (!e.target.value || /^RDR-\d{4}-\d{6}$/i.test(e.target.value.trim())) set('reference', e.target.value.trim().toUpperCase()); else toast.error('Enter a full case reference, such as RDR-2026-000001.'); }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} /></div>
    </div>}
    {onFilters && Object.values(filters).some(Boolean) && <div className="flex flex-wrap gap-2">{Object.entries(filters).filter(([, v]) => v).map(([k, v]) => <Button key={k} size="sm" variant="outline" onClick={() => onFilters({ ...filters, [k]: undefined })} aria-label={`Remove ${auditLabel(k)} filter`}>{auditLabel(k)}: {k === 'actor' ? actorName(v ?? null) : k === 'area' ? AUDIT_AREAS[v ?? ''] ?? v : v}<X className="h-3 w-3" aria-hidden="true" /></Button>)}<Button size="sm" variant="ghost" onClick={() => onFilters({})}>Clear all</Button></div>}
    {busy && <p role="status" className="text-sm text-muted-foreground">Exporting · {progress.toLocaleString()} rows</p>}
    {receipt && <div role="status" className="space-y-1 border-l-2 border-primary pl-3 text-sm"><p>{receipt.format} · {receipt.count.toLocaleString()} rows · {receipt.summary}</p><p className="break-all font-mono text-xs">SHA-256: {receipt.checksum}</p></div>}
    <p className="text-xs text-muted-foreground">{rows.length}{result.hasNextPage ? '+' : ''} entries · {zone}</p>
    {result.isError && <p role="alert" className="text-sm text-destructive">Could not load audit entries. <Button variant="link" onClick={() => void result.refetch()}>Try again</Button></p>}
    <div className="overflow-x-auto border"><table className="w-full text-left text-sm"><thead className="bg-muted/50"><tr>{['When', 'User', 'Area', 'Action', 'Detail'].map(h => <th scope="col" key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead><tbody>
      {result.isPending && <TableSkeletonRows columns={5} />}
      {rows.map(row => { const id = auditCaseId(row); const ref = (id ? references[id] : undefined) ?? String((row.after as Record<string, unknown> | null)?.['reference'] ?? (row.before as Record<string, unknown> | null)?.['reference'] ?? ''); const diffs = auditDiff(row.before, row.after); return <Fragment key={row.id}><tr className="border-t align-top"><td className="whitespace-nowrap px-3 py-3 text-xs tabular">{new Date(row.created_at).toLocaleString('en-GB', { timeZone: zone })}</td><td className="px-3 py-3">{actorName(row.actor)}</td><td className="px-3 py-3">{AUDIT_AREAS[row.table_name] ?? auditLabel(row.table_name)}</td><td className="px-3 py-3">{AUDIT_ACTIONS[row.action] ?? auditLabel(row.action)}</td><td className="min-w-52 px-3 py-3">{id && <Link to="/app/c/$id" params={{ id }} className="text-primary hover:underline">{ref || 'View case'}</Link>}<details className="mt-1"><summary className="cursor-pointer text-muted-foreground">{diffs.length} changed fields</summary><dl className="mt-3 space-y-3">{diffs.map(d => <div key={d.field}><dt className="font-medium">{auditLabel(d.field)}</dt><dd className="break-words whitespace-pre-wrap text-xs"><Value text={auditFormat(d.before, d.field, zone, admin)} /> → <Value text={auditFormat(d.after, d.field, zone, admin)} /></dd></div>)}</dl></details></td></tr></Fragment>; })}
      {!result.isPending && !result.isError && !rows.length && <tr><td colSpan={5}><EmptyState icon={History} title="No audit entries" description="No entries match this view." /></td></tr>}
    </tbody></table></div>
    {result.hasNextPage && <Button variant="outline" onClick={() => void result.fetchNextPage()} disabled={result.isFetchingNextPage}>{result.isFetchingNextPage ? 'Loading…' : 'Load more'}</Button>}
  </section>;
}
function Value({ text }: { text: string }) { const [expanded, setExpanded] = useState(false); return <span>{expanded || text.length <= 180 ? text : text.slice(0, 180) + '…'}{text.length > 180 && <Button variant="link" size="sm" onClick={() => setExpanded(!expanded)}>{expanded ? 'Show less' : 'Show more'}</Button>}</span>; }
function Pick({ label, value, options, onChange }: { label: string; value?: string | undefined; options: Record<string, string>; onChange: (v: string) => void }) { return <div className="space-y-1"><Label htmlFor={`audit-${label}`}>{label}</Label><Select value={value ?? '__all'} onValueChange={v => onChange(v === '__all' ? '' : v)}><SelectTrigger id={`audit-${label}`} className="min-w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__all">All</SelectItem>{value && !options[value] && <SelectItem value={value}>{auditLabel(value)}</SelectItem>}{Object.entries(options).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>; }