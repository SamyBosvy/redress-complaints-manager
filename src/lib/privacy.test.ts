import { describe, it, expect } from 'vitest';
import { retentionDate, retentionState, deletionDate, erasureSchema } from './privacy';
const closed = { status: 'closed', closed_at: '2020-10-18T12:00:00Z', legal_hold: false, anonymised_at: null };
describe('privacy rules', () => {
  it('retains records for six years after closure', () => expect(retentionDate(closed.closed_at, 6)).toBe('2026-10-18T12:00:00.000Z'));
  it('shows upcoming anonymisation thirty days ahead', () => expect(retentionState(closed, 6, new Date('2026-09-18T12:00:00Z'))).toBe('upcoming'));
  it('does not show it thirty-one days ahead', () => expect(retentionState(closed, 6, new Date('2026-09-17T12:00:00Z'))).toBe('retained'));
  it('becomes due at the retention boundary', () => expect(retentionState(closed, 6, new Date('2026-10-18T12:00:00Z'))).toBe('due'));
  it('excludes legal holds', () => expect(retentionState({ ...closed, legal_hold: true }, 6, new Date('2027-01-01'))).toBe('held'));
  it('does not anonymise open complaints', () => expect(retentionState({ ...closed, status: 'reopened' }, 6, new Date('2027-01-01'))).toBe('open'));
  it('provides a thirty-day organisation deletion grace period', () => expect(deletionDate('2026-10-18T12:00:00Z')).toBe('2026-11-17T12:00:00.000Z'));
  it('requires lawful-basis review and explicit audit acknowledgement', () => expect(erasureSchema.safeParse({ caseId: '5f000000-0000-4000-8000-000000000001', reference: 'RDR-2026-000001', lawfulBasis: 'Valid legal basis', reviewed: true, auditAcknowledged: false }).success).toBe(false));
  it('handles leap-year anniversaries without shifting to March', () => expect(retentionDate('2020-02-29T12:00:00Z', 6)).toBe('2026-02-28T12:00:00.000Z'));
});