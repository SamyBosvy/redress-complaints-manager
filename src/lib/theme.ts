export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'redress-theme';

export function resolveThemePreference(stored: string | null | undefined): ThemePreference {
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
}

export function readThemePreference(storage: Pick<Storage, 'getItem'> | null | undefined): ThemePreference {
  try {
    return resolveThemePreference(storage?.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'system';
  }
}

export function writeThemePreference(storage: Pick<Storage, 'setItem'> | null | undefined, value: ThemePreference): void {
  try {
    storage?.setItem(THEME_STORAGE_KEY, value);
  } catch {
    // storage unavailable (private mode etc.) — preference just won't persist
  }
}

export function prefersDarkOS(matchMediaFn: ((query: string) => { matches: boolean }) | null | undefined): boolean {
  try {
    return matchMediaFn?.('(prefers-color-scheme: dark)').matches ?? false;
  } catch {
    return false;
  }
}

export function isDarkActive(preference: ThemePreference, osDark: boolean): boolean {
  return preference === 'dark' || (preference === 'system' && osDark);
}

export function applyTheme(preference: ThemePreference): void {
  if (typeof document === 'undefined') return;
  const dark = isDarkActive(preference, prefersDarkOS(typeof window !== 'undefined' ? window.matchMedia : null));
  document.documentElement.classList.toggle('dark', dark);
}

export function setThemePreference(preference: ThemePreference): void {
  writeThemePreference(typeof window !== 'undefined' ? window.localStorage : null, preference);
  applyTheme(preference);
}

export function getThemePreference(): ThemePreference {
  return readThemePreference(typeof window !== 'undefined' ? window.localStorage : null);
}

/** Follow OS changes while the preference is System. Call once from a client effect. */
export function watchSystemTheme(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => onChange();
  mql.addEventListener?.('change', handler);
  return () => mql.removeEventListener?.('change', handler);
}
