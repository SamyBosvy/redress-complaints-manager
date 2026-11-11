import { COUNTRIES } from '@/lib/countries';

export type PublicHoliday = { date: string; name: string };
type HolidayLike = { date: string; name: string; type: string };
type HolidaysClass = new (country?: string, state?: string | Record<string, unknown>, opts?: Record<string, unknown>) => {
  getHolidays(year?: number, lang?: string): HolidayLike[];
  getStates(country: string, lang?: string): Record<string, string> | undefined;
};

export const REGIONAL_HOLIDAY_COUNTRIES = ['DE', 'ES', 'CH', 'AT', 'IT'] as const;

export function holidayNote(countryCode: string): string | null {
  if (countryCode === 'GB') return 'England and Wales holidays are used. Scotland and Northern Ireland differ, so adjust them manually.';
  if ((REGIONAL_HOLIDAY_COUNTRIES as readonly string[]).includes(countryCode)) return "Only nationwide holidays are added — add regional holidays for your customers' regions.";
  return null;
}

/** Keeps public holidays observed across the whole country (England & Wales for GB). */
export function nationwidePublic(lists: HolidayLike[][]): PublicHoliday[] {
  const [first = [], ...rest] = lists.map((list) => list.filter((h) => h.type === 'public'));
  const byDate = new Map<string, string>();
  for (const h of first) {
    const date = h.date.slice(0, 10);
    if (!rest.every((list) => list.some((x) => x.date.slice(0, 10) === date))) continue;
    byDate.set(date, byDate.has(date) ? `${byDate.get(date)} / ${h.name}` : h.name);
  }
  return [...byDate].sort(([a], [b]) => a.localeCompare(b)).map(([date, name]) => ({ date, name }));
}

let loader: Promise<HolidaysClass> | null = null;
function loadHolidays() {
  loader ??= import('date-holidays').then((m) => m.default as unknown as HolidaysClass);
  return loader;
}

export async function publicHolidays(countryCode: string, year: number): Promise<PublicHoliday[]> {
  const code = countryCode.toUpperCase();
  if (!COUNTRIES[code] || !Number.isInteger(year)) return [];
  const Holidays = await loadHolidays();
  const opts = { languages: ['en'], timezone: 'UTC' };
  if (code === 'GB') {
    return nationwidePublic(['ENG', 'WLS'].map((s) => new Holidays('GB', s, opts).getHolidays(year, 'en')));
  }
  const national = new Holidays(code, opts);
  const states = Object.keys(new Holidays().getStates(code) ?? {});
  return nationwidePublic([national.getHolidays(year, 'en'), ...states.map((s) => new Holidays(code, s, opts).getHolidays(year, 'en'))]);
}

export function missingHolidays(candidates: PublicHoliday[], existingDates: Iterable<string>) {
  const existing = new Set(existingDates);
  return candidates.filter((h) => !existing.has(h.date));
}
