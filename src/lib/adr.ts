import type { AppRole } from './org';
export const ADR_DECISIONS = { pending: 'Pending', upheld_firm: 'Upheld firm', overturned: 'Overturned', partially_overturned: 'Partially overturned', settled: 'Settled', withdrawn: 'Withdrawn' } as const;
export type AdrDecision = keyof typeof ADR_DECISIONS;
export interface AdrReportRow { complaint_id: string; escalated_on: string; decision: string; decision_on: string | null; award_amount: number | null; award_currency: string | null }
export function canManageAdr(role: AppRole | null, user: string, c: { assigned_to?: string | null; legal_hold?: boolean | null; privacy_processing?: boolean; anonymised_at?: string | null }) {
  return !c.legal_hold && !c.privacy_processing && !c.anonymised_at && (role === 'org_admin' || role === 'complaints_manager' || (role === 'agent' && c.assigned_to === user));
}
export function adrMetrics(rows: AdrReportRow[], range: { from: string; to: string }) {
  const inPeriod = (date: string | null) => !!date && date >= range.from && date <= range.to;
  const escalated = rows.filter(r => inPeriod(r.escalated_on));
  const decided = rows.filter(r => r.decision !== 'pending' && inPeriod(r.decision_on));
  const overturned = decided.filter(r => ['overturned', 'partially_overturned'].includes(r.decision));
  const cents: Record<string, number> = {};
  for (const r of decided) if (r.award_amount !== null && r.award_currency) cents[r.award_currency] = (cents[r.award_currency] ?? 0) + Math.round(r.award_amount * 100);
  return { escalated, decided, overturned, overturnRate: decided.length ? Math.round(overturned.length / decided.length * 1000) / 10 : null, awards: Object.fromEntries(Object.entries(cents).sort().map(([k, v]) => [k, v / 100])) };
}