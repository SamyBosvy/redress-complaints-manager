import { supabase } from '@/integrations/supabase/client';
import { auditCaseId, auditCaseOr, auditCursorOr, auditDateBoundary, AUDIT_PAGE_SIZE, type AuditCursor, type AuditEntry, type AuditFilters } from './audit';

export async function fetchAuditPage(orgId: string, filters: AuditFilters, zone: string, cursor?: AuditCursor, fixedCaseId?: string) {
  let caseId = fixedCaseId;
  if (filters.reference) {
    const { data, error } = await supabase.from('complaints').select('id').eq('org_id', orgId).eq('reference', filters.reference).maybeSingle();
    if (error) throw error;
    if (!data || (caseId && caseId !== data.id)) return { rows: [] as AuditEntry[], references: {} as Record<string, string>, next: undefined };
    caseId = data.id;
  }
  // Cast bigint on the wire: cursor comparisons must not lose precision above 2^53.
  let q = supabase.from('audit_log').select('id::text,org_id,actor,table_name,row_id,action,before,after,created_at').eq('org_id', orgId);
  if (filters.from) q = q.gte('created_at', auditDateBoundary(filters.from, zone));
  if (filters.to) q = q.lt('created_at', auditDateBoundary(filters.to, zone, true));
  if (filters.actor) q = q.eq('actor', filters.actor);
  if (filters.action) q = q.eq('action', filters.action);
  if (filters.area) q = q.eq('table_name', filters.area);
  // One AND-wrapped expression avoids competing PostgREST `or` parameters.
  const clauses = [caseId ? `or(${auditCaseOr(caseId)})` : '', cursor ? `or(${auditCursorOr(cursor)})` : ''].filter(Boolean);
  if (clauses.length) q = q.or(`and(${clauses.join(',')})`);
  const { data, error } = await q.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(AUDIT_PAGE_SIZE + 1);
  if (error) throw error;
  const all = data as unknown as AuditEntry[];
  const rows = all.slice(0, AUDIT_PAGE_SIZE);
  const ids = [...new Set(rows.map(auditCaseId).filter((v): v is string => Boolean(v)))];
  const references: Record<string, string> = {};
  if (ids.length) {
    const result = await supabase.from('complaints').select('id,reference').eq('org_id', orgId).in('id', ids);
    if (result.error) throw result.error;
    for (const row of result.data) references[row.id] = row.reference;
  }
  const last = rows.at(-1);
  return { rows, references, next: all.length > AUDIT_PAGE_SIZE && last ? { created_at: last.created_at, id: String(last.id) } : undefined };
}