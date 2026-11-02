import { describe, expect, it } from 'vitest';
import { appNavigation } from './app-navigation';
import { createShortcutHandler, isTypingTarget, palettePages, SEQUENCE_TIMEOUT } from './shortcuts';
import type { AppRole } from './org';

const key = (key: string) => ({ key, ctrlKey: false, metaKey: false, altKey: false, repeat: false });
describe('workspace shortcuts', () => {
  it.each(['input', 'textarea', 'select', 'div'])('ignores typing in %s', tag => {
    const target = document.createElement(tag);
    if (tag === 'div') target.setAttribute('contenteditable', 'true');
    expect(isTypingTarget(target)).toBe(true);
    expect(createShortcutHandler('agent')(key('n'), isTypingTarget(target), 0)).toBeNull();
  });
  it('ignores descendants of editable targets but accepts ordinary elements', () => {
    const parent = document.createElement('div'); parent.setAttribute('contenteditable', 'true');
    const child = document.createElement('span'); parent.append(child);
    expect(isTypingTarget(child)).toBe(true);
    expect(isTypingTarget(document.createElement('button'))).toBe(false);
  });
  it('only accepts G then Q within one second', () => {
    const handler = createShortcutHandler('agent');
    expect(handler(key('q'), false, 0)).toBeNull();
    expect(handler(key('g'), false, 10)).toBeNull();
    expect(handler(key('q'), false, 10 + SEQUENCE_TIMEOUT)).toBe('queue');
    handler(key('g'), false, 2000);
    expect(handler(key('q'), false, 2001 + SEQUENCE_TIMEOUT)).toBeNull();
  });
  it('resets sequences while blocked and blocks new complaint for read-only', () => {
    const handler = createShortcutHandler('read_only');
    expect(handler(key('n'), false, 0)).toBeNull();
    handler(key('g'), false, 0); handler(key('q'), true, 10);
    expect(handler(key('q'), false, 20)).toBeNull();
  });
  it('respects reports visibility', () => {
    const handler = createShortcutHandler('agent'); handler(key('g'), false, 0);
    expect(handler(key('r'), false, 20)).toBeNull();
    const admin = createShortcutHandler('org_admin'); admin(key('g'), false, 0);
    expect(admin(key('r'), false, 20)).toBe('reports');
  });
  it.each<AppRole>(['org_admin', 'complaints_manager', 'agent', 'qa_reviewer', 'read_only'])('matches navigation for %s', role => {
    expect(palettePages(role).filter(page => page.to !== '/account')).toEqual(appNavigation(role).flatMap(group => group.links.map(({ label, to }) => ({ label, to }))));
    expect(palettePages(role).some(page => page.to === '/account')).toBe(true);
  });
  it('read-only has no new complaint in palette', () => {
    expect(palettePages('read_only').some(page => page.to === '/app/new')).toBe(false);
  });
});