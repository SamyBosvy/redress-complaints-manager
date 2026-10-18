import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { BarChart3, CheckCheck, FilePlus, FileText, History, Inbox, LogOut, Globe, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { membershipQuery, useMembership, ROLE_LABELS } from "@/lib/org";
import { Logo } from "@/components/logo";
import { InstallAppButton } from "@/components/install-app";
import { NotificationBell } from "@/components/notification-bell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app")({
  beforeLoad: async ({ context }) => {
    const m = await context.queryClient.ensureQueryData(membershipQuery);
    if (!m?.org || !m.org.setup_complete) throw redirect({ to: "/setup" });
  },
  head: () => ({ meta: [{ title: "Workspace — Redress" }, { name: "description", content: "Manage your firm’s customer complaints." }, { property: "og:title", content: "Workspace — Redress" }, { property: "og:description", content: "Manage your firm’s customer complaints." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: AppLayout,
});

function AppLayout() {
  const m = useMembership();
  const navigate = useNavigate();
  const trialDays = m?.org ? Math.ceil((new Date(m.org.trial_ends_at).getTime() - Date.now()) / 86400000) : 0;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col bg-sidebar text-sidebar-foreground md:w-60">
        <div className="flex items-center justify-between px-5 py-4 md:block">
          <Logo className="text-sidebar-accent-foreground" />
          <p className="mt-1 hidden truncate text-xs md:block">{m?.org?.legal_name}</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
          <Link
            to="/app"
            activeOptions={{ exact: true }}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground"
          >
            <Inbox className="h-4 w-4" /> Queue
          </Link>
          {m?.role && m.role !== "read_only" && (
            <Link
              to="/app/new"
              className="flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground"
            >
              <FilePlus className="h-4 w-4" /> New complaint
            </Link>
          )}
          {m?.role && m.role !== "read_only" && (
            <Link
              to="/app/templates"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground"
            >
              <FileText className="h-4 w-4" /> Templates
            </Link>
          )}
          {m?.role && ["org_admin", "complaints_manager", "qa_reviewer"].includes(m.role) && (
            <Link
              to="/app/qa"
              className="flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground"
            >
              <CheckCheck className="h-4 w-4" /> QA review
            </Link>
          )}
          {m?.role && ["org_admin", "complaints_manager", "read_only"].includes(m.role) && (
            <Link
              to="/app/reports"
              className="flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground"
            >
              <BarChart3 className="h-4 w-4" /> Reports
            </Link>
          )}
          {m?.role && ["org_admin", "complaints_manager", "read_only"].includes(m.role) && (
            <Link
              to="/app/audit"
              className="flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground"
            >
              <History className="h-4 w-4" /> Audit log
            </Link>
          )}
          {m?.role === "org_admin" && <Link to="/app/forms" className="flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground"><Globe className="h-4 w-4" /> Public form</Link>}
          {m?.role === "org_admin" && <Link to="/app/privacy" className="flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground"><ShieldCheck className="h-4 w-4" /> Privacy & data</Link>}
        </nav>
        <div className="mt-auto hidden border-t border-sidebar-border p-4 text-xs md:block">
          <p className="truncate text-sidebar-accent-foreground">{m?.user.email}</p>
          <p className="mt-0.5">{m?.role ? ROLE_LABELS[m.role] : ""}</p>
          <button
            className="mt-3 inline-flex items-center gap-1.5 hover:text-sidebar-accent-foreground"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth", search: {} });
            }}
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        {trialDays > 0 && (
          <div className="border-b bg-accent px-6 py-2 text-sm text-accent-foreground">
            Free trial: <span className="tabular font-medium">{trialDays}</span> days remaining. All Growth features included.
          </div>
        )}
        <div className="flex items-center justify-end gap-1 border-b px-4 py-2"><NotificationBell /><InstallAppButton variant="ghost" /></div>
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
        <div className="border-t p-3 md:hidden">
          <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}>Sign out</Button>
        </div>
      </div>
    </div>
  );
}
