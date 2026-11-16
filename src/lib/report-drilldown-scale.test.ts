import { describe, expect, it } from 'vitest';
import { buildDrillDownSearch, buildReportLink, drillDownRows, evalFilterOps, matchesReportFilters, reportFilterOps, resolvedWithinDeadline, SNAPSHOT_CAP, type ReportRow } from './reports';
import { parseQueueSearch } from './queue';

const RC = '50000000-0000-4000-8000-000000000001';
const row = (i: number, o: Partial<ReportRow> = {}): ReportRow => ({ id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, reference: `R${i}`, status: 'closed', category: 'fees_and_charges', product: 'card', country_code: 'FR', channel: 'email', assigned_to: null, vulnerable: false, outcome: 'upheld', redress_amount: null, redress_currency: null, goodwill_amount: null, goodwill_currency: null, root_cause_category: 'Pricing', root_cause_id: RC, received_at: '2026-03-05T10:00:00Z', closed_at: '2026-03-20T09:00:00Z', final_due: '2026-03-25', extended_due: '2026-04-20', holding_sent_at: null, ...o });
const fixture: ReportRow[] = [row(1), row(2, { closed_at: '2026-03-30T23:30:00Z', outcome: 'not_upheld' }), row(3, { closed_at: null, outcome: null, status: 'under_investigation', root_cause_id: null, root_cause_category: null }), row(4, { closed_at: '2026-04-10T00:00:00Z', root_cause_id: null, root_cause_category: 'Legacy text', channel: 'phone' }), row(5, { received_at: '2026-02-27T08:00:00Z', closed_at: null, outcome: null, status: 'received' }), row(6, { holding_sent_at: '2026-03-15T00:00:00Z', closed_at: '2026-04-15T12:00:00Z', outcome: 'withdrawn' })];
const asQueue = (r: ReportRow) => ({ ...r, resolved_within_deadline: resolvedWithinDeadline(r) });
const range = { from: '2026-03-01', to: '2026-03-31' };
const metrics: [string, string | undefined][] = [['Complaints received', undefined], ['Resolved', undefined], ['Open at period end', undefined], ['Resolved within deadline', undefined], ['Upheld', undefined], ['Not upheld', undefined], ['Withdrawn', undefined], ['Median days to resolve', undefined], ['By root cause', 'Pricing'], ['By root cause', 'Legacy text'], ['By root cause', 'Not recorded'], ['By channel', 'Phone'], ['By product', 'Card']];

describe('server-side drill-down filters', () => {
  it.each(metrics)('%s %s: SQL-equivalent predicate equals report membership', (metric, group) => {
    const s = buildReportLink(fixture, metric, group, range, '2026-04-01');
    const expected = drillDownRows(fixture, metric, group, range).map(r => r.id);
    const viaOps = fixture.filter(r => evalFilterOps(asQueue(r), reportFilterOps(s))).filter(r => (!s.product || r.product === s.product) && (!s.status || r.status === s.status)).map(r => r.id);
    expect(viaOps).toEqual(fixture.filter(r => matchesReportFilters(r, s)).map(r => r.id));
    if (!s.report_ids) expect(viaOps).toEqual(expected);
  });
  it('passes managed root cause ids and keeps legacy text', () => {
    expect(buildReportLink(fixture, 'By root cause', 'Pricing', range).root_cause).toBe(RC);
    expect(buildReportLink(fixture, 'By root cause', 'Legacy text', range).root_cause).toBe('Legacy text');
  });
  it('keeps links short and filter-only for 5,000 complaints', () => {
    const big = Array.from({ length: 5000 }, (_, i) => row(i, { closed_at: null, status: 'received', outcome: null }));
    for (const [m, g] of metrics) {
      const s = buildReportLink(big, m, g, range, '2026-04-01');
      const url = '/app?' + new URLSearchParams(Object.entries(s).flatMap(([k, v]) => v === undefined ? [] : [[k, String(v)]])).toString();
      expect(url.length).toBeLessThan(2000);
    }
    expect(buildReportLink(big, 'Open at period end', undefined, range, '2026-04-01')).toMatchObject({ report_basis: 'current' });
  });
  it('uses snapshot ids only for historical open counts under the cap', () => {
    expect(buildReportLink(fixture, 'Open at period end', undefined, range, '2026-04-01').report_ids?.split(',')).toHaveLength(drillDownRows(fixture, 'Open at period end', undefined, range).length);
    expect(buildReportLink(fixture, 'Open at period end', undefined, range, '2026-03-31').report_ids).toBeUndefined();
    expect(buildReportLink(fixture, 'Resolved', undefined, range, '2026-04-01').report_ids).toBeUndefined();
    const capped = Array.from({ length: SNAPSHOT_CAP }, (_, i) => row(i, { closed_at: null, status: 'received' }));
    expect(buildReportLink(capped, 'Open at period end', undefined, range, '2026-04-01').report_ids?.split(',')).toHaveLength(SNAPSHOT_CAP);
    expect(buildDrillDownSearch('Resolved', undefined, range).report_ids).toBeUndefined();
  });
  it('validates report_basis', () => {
    expect(parseQueueSearch({ report_basis: 'current' }).report_basis).toBe('current');
    expect(parseQueueSearch({ report_basis: 'x' }).report_basis).toBeUndefined();
  });
});
