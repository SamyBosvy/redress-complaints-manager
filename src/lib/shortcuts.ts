import { appNavigation } from './app-navigation';
import type { AppRole } from './org';

export function palettePages(role: AppRole | null | undefined) {
  return [...appNavigation(role).flatMap(group => group.links.map(({ label, to }) => ({ label, to }))), { label: 'Account', to: '/account' as const }];
}

export function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"]');
}

export function shortcutsBlocked(target: EventTarget | null): boolean {
  return isTypingTarget(target) || !!document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [aria-modal="true"]');
}

export const SEQUENCE_TIMEOUT = 1000;
export type ShortcutAction = 'new' | 'queue' | 'reports' | 'day' | 'help';
export function createShortcutHandler(role: AppRole | null | undefined) {
  let prefixAt: number | null = null;
  const pages = palettePages(role);
  return (event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'repeat'>, blocked: boolean, now: number): ShortcutAction | null => {
    if (blocked || event.ctrlKey || event.metaKey || event.altKey || event.repeat) { prefixAt = null; return null; }
    const key = event.key.toLowerCase();
    const hasPrefix = prefixAt !== null && now - prefixAt <= SEQUENCE_TIMEOUT;
    prefixAt = null;
    if (hasPrefix && key === 'q') return 'queue';
    if (hasPrefix && key === 'd' && pages.some(page => page.to === '/app/my-day')) return 'day';
    if (hasPrefix && key === 'r' && pages.some(page => page.to === '/app/reports')) return 'reports';
    if (key === 'g') { prefixAt = now; return null; }
    if (key === 'n' && pages.some(page => page.to === '/app/new')) return 'new';
    if (key === '?') return 'help';
    return null;
  };
}