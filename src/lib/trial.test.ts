import { describe, expect, it } from 'vitest';
import { trialState } from './trial';

describe('trial state', () => {
  const now = new Date('2026-11-03T01:07:00Z');
  it.each([
    ['2026-11-11T12:00:00Z', 8, 'neutral', true],
    ['2026-11-10T12:00:00Z', 7, 'warning', true],
    ['2026-11-06T12:00:00Z', 3, 'warning', true],
    ['2026-11-05T12:00:00Z', 2, 'destructive', false],
    ['2026-11-04T12:00:00Z', 1, 'destructive', false],
  ])('uses urgency thresholds for %s', (end, days, tone, dismissible) => {
    expect(trialState(end, now)).toMatchObject({ days, tone, dismissible, expired: false, today: false });
  });
  it('distinguishes the last day before expiry from an expired trial', () => {
    expect(trialState('2026-11-03T12:00:00Z', now)).toMatchObject({ days: 1, today: true, expired: false, dismissible: false, tone: 'destructive' });
    expect(trialState(now.toISOString(), now)).toMatchObject({ days: 0, today: false, expired: true, dismissible: false });
    expect(trialState('2026-11-02T12:00:00Z', now)?.days).toBe(0);
  });
  it('counts identical instants equally across timezone offsets', () => {
    expect(trialState('2026-11-06T00:30:00+02:00', now)).toEqual(trialState('2026-11-05T22:30:00Z', now));
  });
  it('uses UTC days across daylight-saving changes', () => {
    expect(trialState('2026-03-30T00:30:00+02:00', new Date('2026-03-27T23:30:00Z'))?.days).toBe(2);
  });
  it('fails safely for an invalid date', () => {
    expect(trialState('invalid', now)).toBeNull();
  });
});