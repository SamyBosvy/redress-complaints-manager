export type DensityPreference = 'comfortable' | 'compact';
export const DENSITY_STORAGE_KEY = 'redress-density';
export function resolveDensityPreference(value: unknown): DensityPreference {
  return value === 'compact' ? 'compact' : 'comfortable';
}
export function readDensityPreference(storage?: Pick<Storage, 'getItem'> | null): DensityPreference {
  try { return resolveDensityPreference(storage?.getItem(DENSITY_STORAGE_KEY)); }
  catch { return 'comfortable'; }
}
export function getDensityPreference(): DensityPreference {
  try { return readDensityPreference(window.localStorage); }
  catch { return 'comfortable'; }
}
export function setDensityPreference(value: DensityPreference): void {
  try { window.localStorage.setItem(DENSITY_STORAGE_KEY, value); } catch { /* Session preference still applies. */ }
  if (typeof document !== 'undefined') document.documentElement.dataset['density'] = value;
}