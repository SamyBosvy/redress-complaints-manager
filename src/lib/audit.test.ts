import { describe, expect, it } from 'vitest';
import { AUDIT_EXPORT_LIMIT, AUDIT_PAGE_SIZE, auditCaseId, auditCaseOr, auditChecksum, auditCursorOr, auditDateBoundary, auditDiff, auditFormat, decodeAuditCursor, encodeAuditCursor, maskAuditValue, parseAuditSearch } from './audit';

const id = '11111111-1111-4111-8111-111111111111';
describe('audit rules', () => {
  it('pages 50 at a time', () => expect(AUDIT_PAGE_SIZE).toBe(50));
  it('caps export at 50,000', () => expect(AUDIT_EXPORT_LIMIT).toBe(50_000));
  it('shows only changed fields, including deletions', () => {
    expect(auditDiff({ status: 'received', stable: 1, removed: 2, updated_at: 'old' }, { status: 'closed', stable: 1, updated_at: 'new' }).map(d => d.field)).toEqual(['status', 'removed']);
    expect(auditDiff(null, { status: 'received' })).toEqual([{ field: 'status', before: undefined, after: 'received' }]);
  });
  it('formats enum and firm dates independently of session zone', () => {
    expect(auditFormat('pending_qa', 'status', 'Europe/Paris', false)).toBe('Pending QA');
    expect(auditFormat('2026-01-01', 'final_due', 'Europe/Paris', false)).toBe('01/01/2026');
    expect(auditFormat('2025-12-31T23:30:00Z', 'received_at', 'Europe/Paris', false)).toBe('01/01/2026, 00:30:00');
  });
  it('masks sensitive structured and embedded data unless admin', () => {
    const data = { email: 'person@example.com', phone: '+33123456789', text: 'Contact person@example.com or FR1420041010050500013M02606', nested: { iban: 'IE29AIBK93115212345678' } };
    expect(maskAuditValue(data, '', false)).toEqual({ email: '••••', phone: '••••', text: 'Contact •••• or ••••', nested: { iban: '••••' } });
    expect(maskAuditValue(data, '', true)).toEqual(data);
    expect(maskAuditValue(id, 'complaint_id', false)).toBe(id);
  });
  it('cursors preserve bigint precision and reject injection', () => {
    const c = { created_at: '2026-11-16T21:53:00.123456+00:00', id: '9007199254740993' };
    expect(decodeAuditCursor(encodeAuditCursor(c))).toEqual(c);
    expect(auditCursorOr(c)).toBe(`created_at.lt.${c.created_at},and(created_at.eq.${c.created_at},id.lt.9007199254740993)`);
    expect(decodeAuditCursor('%invalid')).toBeUndefined();
    expect(decodeAuditCursor(encodeURIComponent(JSON.stringify({ ...c, id: '1),org_id.neq.x' })))).toBeUndefined();
  });
  it('keyset tie-breaker has no duplicates or gaps', () => {
    const fixture = Array.from({ length: 153 }, (_, n) => ({ created_at: `2026-11-${String(16 - Math.floor(n / 60)).padStart(2, '0')}T00:00:00Z`, id: String(9007199254741200n - BigInt(n)) }));
    let cursor: typeof fixture[number] | undefined; const collected: string[] = [];
    do {
      const page = fixture.filter(r => !cursor || r.created_at < cursor.created_at || (r.created_at === cursor.created_at && BigInt(r.id) < BigInt(cursor.id))).slice(0, AUDIT_PAGE_SIZE);
      collected.push(...page.map(r => r.id)); cursor = page.length ? decodeAuditCursor(encodeAuditCursor(page[page.length - 1])) : undefined;
    } while (cursor);
    expect(collected).toEqual(fixture.map(r => r.id)); expect(new Set(collected).size).toBe(153);
  });
  it('case predicate includes both child snapshots and direct row id', () => {
    expect(auditCaseOr(id)).toBe(`row_id.eq.${id},after->>complaint_id.eq.${id},before->>complaint_id.eq.${id}`);
    expect(() => auditCaseOr('unsafe,value')).toThrow();
    expect(auditCaseId({ id: '1', created_at: '', org_id: id, actor: null, row_id: '2', action: 'delete', table_name: 'letters', after: null, before: { complaint_id: id } })).toBe(id);
  });
  it('validates URL filters and retains valid future table areas', () => {
    expect(parseAuditSearch({ from: '2026-02-30', to: 'bad', actor: 'invalid', action: 'drop', area: 'x),bad', reference: 'abc' })).toEqual({ from: undefined, to: undefined, actor: undefined, action: undefined, area: undefined, reference: undefined });
    expect(parseAuditSearch({ from: '2026-01-01', actor: id, area: 'complaint_reopenings', action: 'update', reference: ' rdr-2026-000001 ' })).toMatchObject({ from: '2026-01-01', actor: id, area: 'complaint_reopenings', action: 'update', reference: 'RDR-2026-000001' });
  });
  it('local day bounds use exclusive next midnight across DST', () => {
    expect(auditDateBoundary('2026-01-01', 'Europe/Paris')).toBe('2025-12-31T23:00:00.000Z');
    expect(auditDateBoundary('2026-03-29', 'Europe/Paris', true)).toBe('2026-03-29T22:00:00.000Z');
    expect(auditDateBoundary('2026-03-29', 'Europe/Paris')).toBe('2026-03-28T23:00:00.000Z');
  });
  it('checksums exact known CSV bytes', async () => {
    expect(await auditChecksum(new TextEncoder().encode('a,b\r\n1,2'))).toBe('PLACEHOLDER');
  });
});