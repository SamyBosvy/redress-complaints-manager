import { z } from 'zod';

export type PrivacyValue = string | number | boolean | null | PrivacyValue[] | { [key: string]: PrivacyValue };
export type PrivacyRow = Record<string, PrivacyValue>;

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
export function privacyHead(title: string, description: string, origin?: string) {
  const image = origin ? `${origin}/og-image.png` : undefined;
  return { meta: [{ title: `${title} — Redress` }, { name: 'description', content: description }, { property: 'og:title', content: `${title} — Redress` }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, ...(image ? [{ property: 'og:image', content: image }, { property: 'og:image:width', content: '1200' }, { property: 'og:image:height', content: '630' }, { property: 'og:image:alt', content: 'Redress — every complaint answered fairly, and on time.' }, { name: 'twitter:image', content: image }] : []), { name: 'twitter:card', content: image ? 'summary_large_image' : 'summary' }] };
}
/** Exports name each letter's custom type (null for built-in letters). */
export function withLetterTypeNames(letters: PrivacyRow[], types: PrivacyRow[]): PrivacyRow[] {
  const names = new Map(types.map(t => [String(t['id']), String(t['name'])]));
  return letters.map(l => ({ ...l, custom_type_name: l['custom_type_id'] ? names.get(String(l['custom_type_id'])) ?? null : null }));
}
