import { describe, expect, it } from 'vitest';
import { COUNTRIES } from './countries';
import { missingHolidays, publicHolidays } from './public-holidays';

const has = async (c: string, y: number, d: string) => (await publicHolidays(c, y)).some((h) => h.date === d);

describe('publicHolidays', () => {
  it.each([
    ['FR', '2026-07-14'], ['IE', '2026-03-17'], ['DE', '2026-04-06'], ['ES', '2026-12-25'], ['FR', '2026-12-25'],
    ['GR', '2026-04-13'], ['RO', '2026-04-13'], ['PL', '2026-12-24'], ['GB', '2026-05-04'],
  ])('%s includes %s', async (c, d) => expect(await has(c, 2026, d)).toBe(true));

  it('GB uses weekend substitute days', async () => {
    expect(await has('GB', 2026, '2026-12-28')).toBe(true);
    expect(await has('GB', 2026, '2026-08-03')).toBe(false); // Scotland only
  });

  it('CH excludes cantonal holidays', async () => {
    const dates = (await publicHolidays('CH', 2026)).map((h) => h.date);
    expect(dates).toContain('2026-08-01');
    expect(dates).not.toContain('2026-04-03'); // Good Friday not in every canton
    expect(dates).not.toContain('2026-01-02'); // Berchtold's Day
  });

  it('covers all 32 countries without duplicate dates', async () => {
    expect(Object.keys(COUNTRIES)).toHaveLength(32);
    for (const c of Object.keys(COUNTRIES)) for (const y of [2026, 2027]) {
      const dates = (await publicHolidays(c, y)).map((h) => h.date);
      expect(dates.length, `${c} ${y}`).toBeGreaterThan(0);
      expect(new Set(dates).size).toBe(dates.length);
    }
  });

  it('only adds dates not already present', () => {
    expect(missingHolidays([{ date: '2026-01-01', name: 'A' }, { date: '2026-01-06', name: 'B' }], ['2026-01-01'])).toEqual([{ date: '2026-01-06', name: 'B' }]);
  });
});
