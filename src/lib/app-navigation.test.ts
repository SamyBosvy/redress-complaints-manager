import { describe, expect, it } from 'vitest';
import { appNavigation } from './app-navigation';
import type { AppRole } from './org';

describe('app shell navigation visibility', () => {
  const cases: [AppRole, string[][]][] = [
    ['org_admin', [['Queue', 'New complaint', 'QA review'], ['Reports', 'Audit log'], ['Templates', 'Public form', 'Privacy & data', 'Settings']]],
    ['complaints_manager', [['Queue', 'New complaint', 'QA review'], ['Reports', 'Audit log'], ['Templates', 'Settings']]],
    ['agent', [['Queue', 'New complaint'], ['Templates']]],
    ['qa_reviewer', [['Queue', 'New complaint', 'QA review'], ['Templates']]],
    ['read_only', [['Queue'], ['Reports', 'Audit log']]],
  ];
  it.each(cases)('preserves every existing link permission for %s', (role, expected) => {
    expect(appNavigation(role).map(group => group.links.map(link => link.label))).toEqual(expected);
  });
  it('groups admin links under Work, Insight and Admin in order', () => {
    expect(appNavigation('org_admin').map(group => group.label)).toEqual(['Work', 'Insight', 'Admin']);
  });
  it('hides empty groups', () => {
    expect(appNavigation('agent').map(group => group.label)).toEqual(['Work', 'Admin']);
    expect(appNavigation('read_only').map(group => group.label)).toEqual(['Work', 'Insight']);
    expect(appNavigation(null).map(group => group.label)).toEqual(['Work']);
  });
});