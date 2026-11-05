import { describe, expect, it } from 'vitest';
import { customerFilter, eligibleCustomerHistory, normaliseCustomer, openCount } from './customer-history';

describe('customer matching', () => {
  it('trims IDs without changing their case and lowercases email', () => {
    expect(normaliseCustomer({ customerRef: ' AbC ', email: ' USER@Example.EU ' })).toEqual({ customerRef: 'AbC', email: 'user@example.eu' });
  });
  it('never matches empty identifiers or names', () => {
    expect(customerFilter({})).toBeNull();
    expect(customerFilter({ customerRef: '  ', email: '\t' })).toBeNull();
  });
  it('matches exact ID or case-insensitive email only', () => {
    expect(customerFilter({ customerRef: 'ABC', email: 'A@B.EU' })).toBe('customer_ref.eq."ABC",complainant_email.imatch."^a@b\\\\.eu$"');
  });
  it('quotes separators so they cannot become filter clauses', () => {
    expect(customerFilter({ customerRef: 'x),org_id.neq.secret,(x' })).toBe('customer_ref.eq."x),org_id.neq.secret,(x"');
  });
  it('escapes embedded quotes and backslashes', () => {
    expect(customerFilter({ customerRef: 'a"\\b' })).toBe('customer_ref.eq."a\\"\\\\b"');
  });
  it('escapes email pattern wildcards to avoid broad matches', () => {
    expect(customerFilter({ email: 'A%_*@b.eu' })).toBe('complainant_email.imatch."^a%_\\\\*@b\\\\.eu$"');
  });
  it('excludes the current case and anonymised cases', () => {
    expect(eligibleCustomerHistory({ id: 'current', anonymised_at: null }, 'current')).toBe(false);
    expect(eligibleCustomerHistory({ id: 'other', anonymised_at: '2026-11-01' }, 'current')).toBe(false);
    expect(eligibleCustomerHistory({ id: 'other', anonymised_at: null }, 'current')).toBe(true);
  });
  it('counts all non-closed statuses as open, including final responses and ADR', () => {
    expect(openCount([{ status: 'received' }, { status: 'final_response_sent' }, { status: 'escalated_to_adr' }, { status: 'closed' }])).toBe(3);
    expect(openCount([])).toBe(0);
  });
});