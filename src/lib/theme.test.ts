import { describe, expect, it } from 'vitest';
import { getThemePreference, isDarkActive, readThemePreference, resolveThemePreference } from './theme';

describe('theme preference resolution', () => {
  it('defaults to system when nothing is stored', () => {
    expect(resolveThemePreference(null)).toBe('system');
    expect(resolveThemePreference(undefined)).toBe('system');
  });

  it('falls back to system for invalid stored values', () => {
    expect(resolveThemePreference('blue')).toBe('system');
    expect(resolveThemePreference('')).toBe('system');
    expect(resolveThemePreference('DARK')).toBe('system');
  });

  it('accepts valid stored values', () => {
    expect(resolveThemePreference('light')).toBe('light');
    expect(resolveThemePreference('dark')).toBe('dark');
    expect(resolveThemePreference('system')).toBe('system');
  });

  it('survives storage throwing (private mode)', () => {
    const throwing = { getItem: () => { throw new Error('denied'); } };
    expect(readThemePreference(throwing)).toBe('system');
    expect(readThemePreference(null)).toBe('system');
  });

  it('system follows the OS setting', () => {
    expect(isDarkActive('system', true)).toBe(true);
    expect(isDarkActive('system', false)).toBe(false);
    expect(isDarkActive('dark', false)).toBe(true);
    expect(isDarkActive('light', true)).toBe(false);
  });

  it('getThemePreference is safe without a window', () => {
    expect(getThemePreference()).toBe('system');
  });
});
