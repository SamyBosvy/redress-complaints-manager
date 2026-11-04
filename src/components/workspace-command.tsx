import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Command, CommandInput, CommandList, CommandGroup, CommandItem } from '@/components/ui/command';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { complaintSearchQuery } from '@/lib/queue';
import { createShortcutHandler, palettePages, shortcutsBlocked } from '@/lib/shortcuts';
import type { AppRole } from '@/lib/org';
import type { ThemePreference } from '@/lib/theme';
import type { DensityPreference } from '@/lib/density';

export function WorkspaceCommand({ role, orgId, userId, theme, changeTheme, density, changeDensity, open, setOpen }: {
  role: AppRole | null | undefined; orgId: string; userId: string;
  theme: ThemePreference; changeTheme: (theme: ThemePreference) => void;
  density: DensityPreference; changeDensity: (density: DensityPreference) => void;
  open: boolean; setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const navigate = useNavigate();
  const [help, setHelp] = useState(false);
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  const pages = palettePages(role);
  const canNew = pages.some(page => page.to === '/app/new');
  const canReports = pages.some(page => page.to === '/app/reports');
  useEffect(() => {
    if (!open) { setText(''); setDebounced(''); return; }
    setDebounced('');
    const timer = window.setTimeout(() => setDebounced(text.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [text, open]);
  const search = useQuery({ ...complaintSearchQuery(orgId, userId, debounced), enabled: open && !!orgId && debounced.length >= 3, retry: false });
  useEffect(() => {
    const handler = createShortcutHandler(role);
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !event.altKey && !event.repeat) {
        if (shortcutsBlocked(null) && !open) return;
        event.preventDefault(); setOpen(value => !value); return;
      }
      const action = handler(event, shortcutsBlocked(event.target), Date.now());
      if (!action) return;
      event.preventDefault();
      if (action === 'help') setHelp(true);
      else void navigate({ to: action === 'new' ? '/app/new' : action === 'reports' ? '/app/reports' : '/app' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [role, navigate, open, setOpen]);
  const needle = text.toLowerCase().trim();
  const matches = (label: string) => !needle || label.toLowerCase().includes(needle);
  const themes = ['light', 'dark', 'system'] as const;
  const go = (to: (typeof pages)[number]['to']) => { setOpen(false); void navigate({ to }); };
  return <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90dvh] max-w-[min(32rem,calc(100vw-1rem))] gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Search commands and complaints</DialogTitle>
        <DialogDescription className="sr-only">Navigate your workspace or search your firm's complaints.</DialogDescription>
        <Command shouldFilter={false}>
          <CommandInput aria-label="Search commands and complaints" placeholder="Search…" value={text} onValueChange={setText} className="pr-10" />
          <CommandList className="max-h-[65dvh]">
            <CommandGroup heading="Go to">
              {pages.filter(page => matches(page.label)).map(page => <CommandItem key={page.to} value={page.to} onSelect={() => go(page.to)}>{page.label}</CommandItem>)}
            </CommandGroup>
            <CommandGroup heading="Actions">
              {(['comfortable', 'compact'] as const).filter(value => matches(`Density ${value}`)).map(value => <CommandItem key={value} value={`density-${value}`} onSelect={() => { changeDensity(value); setOpen(false); }}>Density — {value === 'compact' ? 'Compact' : 'Comfortable'}{density === value ? ' ✓' : ''}</CommandItem>)}
              {canNew && matches('New complaint') && <CommandItem value="action-new" onSelect={() => go('/app/new')}>New complaint</CommandItem>}
              {themes.filter(value => matches(`Toggle theme ${value}`)).map(value => <CommandItem key={value} value={`theme-${value}`} onSelect={() => { changeTheme(value); setOpen(false); }}>Toggle theme — {value.charAt(0).toUpperCase() + value.slice(1)}{theme === value ? ' ✓' : ''}</CommandItem>)}
            </CommandGroup>
            {text.trim().length >= 3 && <CommandGroup heading="Complaints">
              {debounced !== text.trim() || search.isFetching ? <p className="px-2 py-3 text-sm text-muted-foreground" role="status">Searching…</p> : search.isError ? <p className="px-2 py-3 text-sm text-muted-foreground" role="status">Couldn't search complaints</p> : <>
                {!search.data?.length && <p className="px-2 py-3 text-sm text-muted-foreground" role="status">No complaints found</p>}
                {search.data?.map(row => row.id && <CommandItem key={row.id} value={`case-${row.id}`} onSelect={() => { if (!row.id) return; setOpen(false); void navigate({ to: '/app/c/$id', params: { id: row.id } }); }}>
                  <span className="shrink-0 font-mono text-xs">{row.reference}</span><span className="min-w-0 truncate">{row.complainant_name}</span>
                </CommandItem>)}
              </>}
            </CommandGroup>}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
    <Dialog open={help} onOpenChange={setHelp}>
      <DialogContent className="max-h-[90dvh] max-w-[min(32rem,calc(100vw-1rem))] overflow-y-auto">
        <DialogTitle>Keyboard shortcuts</DialogTitle>
        <DialogDescription>Workspace shortcuts</DialogDescription>
        <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-3 text-sm">
          <dt><kbd>⌘K / Ctrl+K</kbd></dt><dd>Search</dd>
          {canNew && <><dt><kbd>N</kbd></dt><dd>New complaint</dd></>}
          <dt><kbd>G then Q</kbd></dt><dd>Queue</dd>
          {canReports && <><dt><kbd>G then R</kbd></dt><dd>Reports</dd></>}
          <dt><kbd>J / K</kbd></dt><dd>Next / previous queue row</dd>
          <dt><kbd>Enter</kbd></dt><dd>Open focused complaint</dd>
          <dt><kbd>?</kbd></dt><dd>Keyboard shortcuts</dd>
        </dl>
      </DialogContent>
    </Dialog>
  </>;
}