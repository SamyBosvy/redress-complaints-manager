import { useEffect, useState } from 'react';

export function shortcutLabel(userAgent: string, coarsePointer = false): string | null {
  if (coarsePointer) return null;
  return /Macintosh|Mac OS|iPad|iPhone|iPod/.test(userAgent) ? '⌘K' : 'Ctrl K';
}

export function useShortcutLabel() {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    const media = window.matchMedia('(pointer: coarse)');
    const update = () => setLabel(shortcutLabel(navigator.userAgent, media.matches));
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return label;
}

export function installPlatform(ua: string, platform = '', touchPoints = 0) {
  const ios = /iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && touchPoints > 1);
  if (ios) return /CriOS|FxiOS|EdgiOS/.test(ua) ? 'ios-other' : 'ios-safari';
  if (/SamsungBrowser/.test(ua)) return 'samsung';
  if (/Firefox/.test(ua)) return 'firefox';
  if (/Android/.test(ua)) return 'android';
  if (/Macintosh|Mac OS/.test(ua) && touchPoints === 0 && /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR/.test(ua)) return 'mac-safari';
  return 'desktop';
}