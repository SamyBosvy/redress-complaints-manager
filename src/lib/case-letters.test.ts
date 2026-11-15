import { describe, expect, it } from 'vitest';
import { newestLetters, letterSender, letterFilename, matchLetterEvent, type CaseLetter } from './case-letters';

const letter = (id: string, sent_at: string, kind: CaseLetter['kind'] = 'holding'): CaseLetter => ({ id, sent_at, kind, org_id: 'org', complaint_id: 'case', language: 'en', subject: 'Subject', body: 'Body', sent_by: 'sender', status: 'sent', approved_by: null });

describe('case letters', () => {
  it('orders every letter newest first without mutating input', () => {
    const rows = [letter('old', '2026-10-01T12:00:00Z'), letter('new', '2026-11-01T12:00:00Z')];
    expect(newestLetters(rows).map(row => row.id)).toEqual(['new', 'old']);
    expect(rows[0]?.id).toBe('old');
  });
  it('uses the member name and falls back to Former user when unavailable', () => {
    expect(letterSender('sender', [{ user_id: 'sender', name: 'Łukasz' }])).toBe('Łukasz');
    expect(letterSender('sender', [])).toBe('Former user');
    expect(letterSender('sender', [{ user_id: 'sender', name: 'Unknown' }])).toBe('Former user');
  });
  it('uses the original sent date in the PDF filename', () => {
    expect(letterFilename('RDR-2026-000123', 'holding', '2026-10-04T23:30:00Z')).toBe('RDR-2026-000123-holding-2026-10-04.pdf');
    expect(() => letterFilename('ref', 'holding', 'invalid')).toThrow();
  });
  it('matches the kind and nearest sent timestamp to event created_at', () => {
    const rows = [letter('far', '2026-11-01T10:00:00Z'), letter('near', '2026-11-01T12:00:00Z'), letter('wrong-kind', '2026-11-01T12:00:01Z', 'closure')];
    expect(matchLetterEvent({ kind: 'letter_sent', created_at: '2026-11-01T12:00:01Z', detail: { template: 'holding' } }, rows)).toBe('near');
  });
  it('leaves unmatched or malformed timeline events as text', () => {
    const event = { kind: 'letter_sent', created_at: '2026-11-01T12:00:00Z', detail: { template: 'holding' } };
    expect(matchLetterEvent(event, [])).toBeUndefined();
    expect(matchLetterEvent(event, [letter('other', event.created_at, 'closure')])).toBeUndefined();
    expect(matchLetterEvent({ ...event, kind: 'note' }, [letter('a', event.created_at)])).toBeUndefined();
    expect(matchLetterEvent({ ...event, detail: null }, [letter('a', event.created_at)])).toBeUndefined();
  });
});