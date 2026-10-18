import { z } from 'zod';

export const retentionYearsSchema = z.number().int().min(1).max(50);
export const erasureSchema = z.object({ caseId: z.string().uuid(), reference: z.string().min(1), lawfulBasis: z.string().trim().min(10).max(1000), reviewed: z.literal(true), auditAcknowledged: z.literal(true) });
export function retentionDate(closedAt: string, years: number) {
  const d = new Date(closedAt);
  const month = d.getUTCMonth();
  d.setUTCFullYear(d.getUTCFullYear() + years);
  if (d.getUTCMonth() !== month) d.setUTCDate(0);
  return d.toISOString();
}
export function retentionState(c: { status: string; closed_at: string | null; legal_hold: boolean; anonymised_at: string | null }, years: number, now = new Date()) {
  if (c.anonymised_at) return 'anonymised';
  if (c.legal_hold) return 'held';
  if (c.status !== 'closed' || !c.closed_at) return 'open';
  const due = new Date(retentionDate(c.closed_at, years)).getTime();
  if (due <= now.getTime()) return 'due';
  return due <= now.getTime() + 30 * 86400000 ? 'upcoming' : 'retained';
}
export function deletionDate(requestedAt: string) { return new Date(new Date(requestedAt).getTime() + 30 * 86400000).toISOString(); }
export const PRIVACY_WARNING = 'Working-record erasure removes customer details, correspondence, internal notes and attachments. Historical immutable audit records and backups may still contain personal data. This is not a complete GDPR erasure; legal review is required.';
export function privacyHead(title: string, description: string) {
  return { meta: [{ title: `${title} — Redress` }, { name: 'description', content: description }, { property: 'og:title', content: `${title} — Redress` }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] };
}