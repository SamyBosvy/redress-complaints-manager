import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import {useQueryClient} from '@tanstack/react-query';
import {useEffect, useState} from 'react';
import {toast} from 'sonner';
import { BarChart3, CheckCheck, FilePlus, FileText, History, Inbox, LogOut, Globe, ShieldCheck, Settings, UserRound, Menu, ChevronsUpDown } from "lucide-react";
import { membershipQuery, useMembership, ROLE_LABELS, selectOrganisation } from "@/lib/org";
import {clearAndSignOut} from '@/lib/sign-out';
import {securityDestination} from '@/lib/workspace-access';
import { appNavigation } from '@/lib/app-navigation';
import { applyTheme, getThemePreference, setThemePreference, watchSystemTheme, type ThemePreference } from '@/lib/theme';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu';
import { Logo } from "@/components/logo";
import { InstallAppButton } from "@/components/install-app";
import { NotificationBell } from "@/components/notification-bell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app")({
  beforeLoad: async ({ context }) => {
    const m = await context.queryClient.ensureQueryData(membershipQuery);
    const destination = securityDestination(m);
    if (destination) throw redirect({to: destination});
    if (!m?.org || !m.org.setup_complete) throw redirect({ to: "/setup" });
  },
  head: () => ({ meta: [{ title: "Workspace — Redress" }, { name: "description", content: "Manage your firm’s customer complaints." }, { property: "og:title", content: "Workspace — Redress" }, { property: "og:description", content: "Manage your firm’s customer complaints." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: AppLayout,
});

function AppLayout() {
  const m = useMembership();
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>('system');
  useEffect(() => {
    setTheme(getThemePreference());
    return watchSystemTheme(() => { if (getThemePreference() === 'system') applyTheme('system'); });
  }, []);
  const organisations = m?.organisations.filter(x=>x.active) ?? [];
  async function signOut() {
    setBusy(true);
    try {await clearAndSignOut(qc); await navigate({to:'/auth',search:{},replace:true});}
    catch {toast.error('Could not sign out. Please try again.');}
    finally {setBusy(false);}
  }
  async function switchOrganisation(id:string) {
    if(busy || id === m?.org?.id)return;
    setBusy(true);
    try {
      await qc.cancelQueries();
      qc.clear();
      selectOrganisation(id);
      await router.invalidate();
      await navigate({to:'/app',replace:true});
      setMenuOpen(false);
    } catch {toast.error('Could not switch organisation. Please try again.');}
    finally {setBusy(false);}
  }
  const trialDays = m?.org ? Math.ceil((new Date(m.org.trial_ends_at).getTime() - Date.now()) / 86400000) : 0;

  const icons = { queue: Inbox, new: FilePlus, qa: CheckCheck, reports: BarChart3, audit: History, templates: FileText, forms: Globe, privacy: ShieldCheck, settings: Settings };
  const fullName = m?.user.user_metadata?.['full_name'];
  const displayName = typeof fullName === 'string' && fullName.trim()
    ? fullName.trim() : m?.user.email ?? 'Account';
  const initials = displayName.includes('@') ? displayName.slice(0, 2).toUpperCase()
    : displayName.split(/\s+/).slice(0, 2).map((part: string) => part[0]).join('').toUpperCase();
  const groupedNav = (
    <nav aria-label="Workspace navigation" className="space-y-4 px-3 py-3">
      {appNavigation(m?.role).map(group => (
        <div key={group.label}>
          <p className="px-3 pb-1 text-xs font-semibold text-sidebar-foreground">{group.label}</p>
          {group.links.map(link => {
            const Icon = icons[link.icon];
            return <Link key={link.to} to={link.to} activeOptions={{ exact: link.to === '/app' }}
              onClick={() => setMenuOpen(false)}
              className="flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground">
              <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />{link.label}
            </Link>;
          })}
        </div>
      ))}
    </nav>
  );
  const userMenu = (
    <div className="mt-auto border-t border-sidebar-border p-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" aria-label="Open user menu" className="h-auto min-h-12 w-full justify-start px-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring">
            <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">{initials}</span>
            <span className="min-w-0 flex-1 text-left"><span className="block truncate text-sm">{displayName}</span><span className="block truncate text-xs font-normal">{m?.role ? ROLE_LABELS[m.role] : ''}</span></span>
            <ChevronsUpDown aria-hidden="true" className="h-4 w-4 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-64 max-w-[calc(100vw-2rem)]">
          <DropdownMenuLabel className="truncate">{m?.user.email}</DropdownMenuLabel>
          {organisations.length > 1 && <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Organisation</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={m?.access?.org_id ?? ''} onValueChange={id => { void switchOrganisation(id); }}>
              {organisations.map(org => <DropdownMenuRadioItem key={org.org_id} value={org.org_id} disabled={busy} className="min-h-11"><span className="min-w-0 break-words">{org.legal_name}</span></DropdownMenuRadioItem>)}
            </DropdownMenuRadioGroup>
          </>}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme} onValueChange={v => { const t = v as ThemePreference; setTheme(t); setThemePreference(t); }}>
            <DropdownMenuRadioItem value="light" className="min-h-11">Light</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark" className="min-h-11">Dark</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system" className="min-h-11">System</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild className="min-h-11"><Link to="/account" onClick={() => setMenuOpen(false)}><UserRound aria-hidden="true" />Account</Link></DropdownMenuItem>
          <DropdownMenuItem className="min-h-11" disabled={busy} onSelect={() => { void signOut(); }}><LogOut aria-hidden="true" />Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <div className="flex min-h-screen min-w-0 flex-col md:flex-row">
      <aside className="hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="px-5 py-4"><Logo className="text-sidebar-accent-foreground" /><p className="mt-1 truncate text-xs">{m?.org?.legal_name}</p></div>
        {groupedNav}
        {userMenu}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-w-0 items-center justify-between gap-2 border-b px-4 py-2 md:hidden">
          <Logo />
          <div className="flex shrink-0 items-center gap-1">
            <NotificationBell />
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild><Button variant="ghost" size="icon" aria-label="Open navigation menu"><Menu aria-hidden="true" className="h-5 w-5" /></Button></SheetTrigger>
              <SheetContent side="left" aria-describedby={undefined} className="flex w-72 max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-y-auto bg-sidebar p-0 text-sidebar-foreground [&>button]:focus:ring-sidebar-ring">
                <SheetTitle className="px-5 pb-1 pt-5 text-left text-sidebar-accent-foreground">Redress</SheetTitle>
                <p className="truncate px-5 pb-2 pr-12 text-xs">{m?.org?.legal_name}</p>
                {groupedNav}
                {userMenu}
              </SheetContent>
            </Sheet>
          </div>
        </header>
        {trialDays > 0 && (
          <div className="border-b bg-accent px-4 py-2 text-sm text-accent-foreground md:px-6">
            Free trial: <span className="tabular font-medium">{trialDays}</span> days remaining. All Growth features included.
          </div>
        )}
        <div className="flex items-center justify-end gap-1 border-b px-4 py-2"><span className="hidden md:block"><NotificationBell /></span><InstallAppButton variant="ghost" /></div>
        <main className="min-w-0 flex-1 p-4 md:p-8"><Outlet /></main>
      </div>
    </div>
  );
}
