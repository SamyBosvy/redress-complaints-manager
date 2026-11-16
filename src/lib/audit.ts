import { toCsv } from './csv';

export const AUDIT_PAGE_SIZE = 50;
export const AUDIT_EXPORT_LIMIT = 50_000;
export const AUDIT_AREAS: Record<string, string> = {
  complaints: 'Complaint', letters: 'Letter', qa_reviews: 'QA review', adr_cases: 'ADR case', complaint_reopenings: 'Reopening',
  template_versions: 'Template version', templates: 'Template', organisations: 'Organisation settings', org_members: 'Member',
  complaint_events: 'Case activity', org_countries: 'Countries and ADR bodies', holidays: 'Calendar', rule_sets: 'Rule set',
  rule_set_assignments: 'Rule assignment', root_causes: 'Root cause', org_root_causes: 'Root cause', org_invitations: 'Invitation',
  org_privacy_settings: 'Privacy settings', public_complaint_forms: 'Public complaint form', profiles: 'Profile',
};
export const AUDIT_ACTIONS: Record<string, string> = { insert: 'Created', update: 'Changed', delete: 'Deleted' };
export type AuditFilters = { from?: string; to?: string; actor?: string; action?: string; area?: string; reference?: string };
export type AuditCursor = { created_at: string; id: string };
export type AuditEntry = AuditCursor & { org_id: string; actor: string | null; table_name: string; row_id: string | null; action: string; before: unknown; after: unknown };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parseAuditSearch(raw: Record<string, unknown>): AuditFilters {
  const date = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v ? v : undefined;
  return { from: date(raw['from']), to: date(raw['to']), actor: typeof raw['actor'] === 'string' && UUID.test(raw['actor']) ? raw['actor'] : undefined,
    action: typeof raw['action'] === 'string' && ['insert', 'update', 'delete'].includes(raw['action']) ? raw['action'] : undefined,
    area: typeof raw['area'] === 'string' && /^[a-z][a-z0-9_]{0,63}$/.test(raw['area']) ? raw['area'] : undefined,
    reference: typeof raw['reference'] === 'string' && /^RDR-\d{4}-\d{6}$/i.test(raw['reference'].trim()) ? raw['reference'].trim().toUpperCase() : undefined };
}
export function encodeAuditCursor(cursor: AuditCursor): string { return encodeURIComponent(JSON.stringify(cursor)); }
export function decodeAuditCursor(value: string): AuditCursor | undefined {
  try { const c = JSON.parse(decodeURIComponent(value)); return typeof c.created_at === 'string' && /^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|\+00:00)$/.test(c.created_at) && Number.isFinite(Date.parse(c.created_at)) && typeof c.id === 'string' && /^\d+$/.test(c.id) ? c : undefined; } catch { return undefined; }
}
export function auditCursorOr(cursor: AuditCursor): string {
  const c = decodeAuditCursor(encodeAuditCursor(cursor));
  if (!c) throw new Error('Invalid audit cursor');
  return `created_at.lt.${c.created_at},and(created_at.eq.${c.created_at},id.lt.${c.id})`;
}
export function auditCaseOr(id: string): string {
  if (!UUID.test(id)) throw new Error('Invalid case identifier');
  return `row_id.eq.${id},after->>complaint_id.eq.${id},before->>complaint_id.eq.${id}`;
}
export function auditObject(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
export function auditCaseId(row: AuditEntry): string | undefined {
  const id = auditObject(row.after)['complaint_id'] ?? auditObject(row.before)['complaint_id'] ?? (row.table_name === 'complaints' ? row.row_id : undefined);
  return typeof id === 'string' && UUID.test(id) ? id : undefined;
}
const FIELD_LABELS: Record<string, string> = { ack_due: 'Acknowledgement due', final_due: 'Final response due', extended_due: 'Extended deadline', assigned_to: 'Assigned handler', complainant_email: 'Customer email', complainant_phone: 'Customer phone', complainant_name: 'Customer name', qa_required: 'Four-eyes QA required', adr_rights_given: 'ADR rights provided', root_cause_id: 'Root cause', received_at: 'Received', closed_at: 'Closed', reopened_at: 'Reopened', org_id: 'Organisation', complaint_id: 'Case', row_id: 'Record', time_zone: 'Time zone' };
export function auditLabel(key: string): string { return FIELD_LABELS[key] ?? (key.replace(/_/g, ' ').replace(/^./, s => s.toUpperCase())); }
const ENUMS: Record<string, string> = { under_investigation: 'Under investigation', pending_qa: 'Pending QA', final_response_sent: 'Final response sent', holding_response_sent: 'Holding response sent', escalated_to_adr: 'Escalated to ADR', partially_upheld: 'Partially upheld', not_upheld: 'Not upheld', org_admin: 'Org Admin', complaints_manager: 'Complaints Manager', qa_reviewer: 'QA Reviewer', read_only: 'Read-only', web_form: 'Web form', upheld_firm: 'Firm upheld', partially_overturned: 'Partially overturned', new_evidence: 'New evidence', customer_disagreed: 'Customer disagreed within time limit', handling_error: 'Error in handling', regulator_adr_request: 'Regulator / ADR request' };
export function maskAuditValue(value: unknown, field: string, admin: boolean): unknown {
  if (admin || value == null) return value;
  if (typeof value === 'object') return Array.isArray(value) ? value.map(v => maskAuditValue(v, field, false)) : Object.fromEntries(Object.entries(value).map(([k, v]) => [k, maskAuditValue(v, k, false)]));
  if (/email|phone|iban|account_number|telephone/i.test(field)) return '••••';
  if (typeof value !== 'string') return value;
  if (/^\d{4}-\d{2}-\d{2}(?:T[\d:.]+(?:Z|[+-]\d{2}:\d{2}))?$/.test(value) || UUID.test(value)) return value;
  return value.replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '••••').replace(/\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){11,30}\b/gi, '••••').replace(/\+?\d[\d ()-]{7,}\d/g, '••••');
}
export function auditFormat(value: unknown, field: string, zone: string, admin: boolean): string {
  const masked = maskAuditValue(value, field, admin);
  if (masked == null || masked === '') return '—';
  if (typeof masked === 'boolean') return masked ? 'Yes' : 'No';
  if (typeof masked === 'object') return JSON.stringify(masked);
  const text = String(masked);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return new Date(text + 'T12:00:00Z').toLocaleDateString('en-GB', { timeZone: 'UTC' });
  if (/^\d{4}-\d{2}-\d{2}T/.test(text) && Number.isFinite(Date.parse(text))) return new Date(text).toLocaleString('en-GB', { timeZone: zone });
  return ENUMS[text] ?? (/^[a-z]+(?:_[a-z]+)*$/.test(text) ? auditLabel(text) : text);
}
export function auditDiff(before: unknown, after: unknown): { field: string; before: unknown; after: unknown }[] {
  const b = auditObject(before), a = auditObject(after);
  return [...new Set([...Object.keys(b), ...Object.keys(a)])].filter(k => k !== 'updated_at' && JSON.stringify(b[k]) !== JSON.stringify(a[k])).map(field => ({ field, before: b[field], after: a[field] }));
}
/** Convert a firm's local midnight to UTC, including DST offset changes. */
export function auditDateBoundary(day: string, zone: string, next = false): string {
  const base = new Date(day + 'T00:00:00Z');
  if (next) base.setUTCDate(base.getUTCDate() + 1);
  const target = base.getTime(); let guess = target;
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  for (let i = 0; i < 4; i++) {
    const parts = Object.fromEntries(fmt.formatToParts(new Date(guess)).map(p => [p.type, p.value]));
    const represented = Date.UTC(Number(parts['year']), Number(parts['month']) - 1, Number(parts['day']), Number(parts['hour']), Number(parts['minute']), Number(parts['second']));
    const delta = target - represented; guess += delta; if (!delta) break;
  }
  return new Date(guess).toISOString();
}
export function auditFilterSummary(filters: AuditFilters, caseId?: string): string {
  return Object.entries(filters).filter(([, v]) => v).map(([k, v]) => `${auditLabel(k)}: ${k === 'area' ? AUDIT_AREAS[v ?? ''] ?? v : v}`).concat(caseId ? [`Case: ${caseId}`] : []).join('; ') || 'All entries';
}
export async function auditChecksum(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), v => v.toString(16).padStart(2, '0')).join('');
}
export const AUDIT_CSV_HEADER = toCsv([['Timestamp (ISO UTC)', 'Timestamp (firm local)', 'Actor', 'Area', 'Action', 'Case reference', 'Row id', 'Changed fields', 'Before', 'After']]);