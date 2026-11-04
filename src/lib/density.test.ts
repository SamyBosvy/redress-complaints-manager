import { describe, expect, it } from 'vitest';
import { readDensityPreference, resolveDensityPreference } from './density';
describe('density preference', () => {
  it('defaults to comfortable for absent and invalid values', () => {
    for (const value of [null, undefined, '', 'dense', 'COMPACT']) expect(resolveDensityPreference(value)).toBe('comfortable');
  });
  it('preserves both supported preferences', () => {
    expect(resolveDensityPreference('compact')).toBe('compact');
    expect(resolveDensityPreference('comfortable')).toBe('comfortable');
  });
  it('reads stored compact preference', () => {
    expect(readDensityPreference({ getItem: () => 'compact' })).toBe('compact');
  });
  it('tolerates unavailable storage', () => {
    expect(readDensityPreference({ getItem: () => { throw new Error('Unavailable'); } })).toBe('comfortable');
  });
});