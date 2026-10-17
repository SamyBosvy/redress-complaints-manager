import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DeadlineClock } from "@/components/deadline-clock";
import { useMembership, membershipQuery } from "@/lib/org";
import { COUNTRIES } from "@/lib/countries";
import {
  CATEGORIES, CLOCK_RUNNING, PRODUCTS, STATUSES, isAtRisk, membersQuery, queueQuery, type Status,
} from "@/lib/complaints";

export const Route = createFileRoute("/_authenticated/app/")({
  loader: async ({ context }) => {
    const m = await context.queryClient.ensureQueryData(membershipQuery);
    const orgId = m!.org!.id;
    await Promise.all([
      context.queryClient.ensureQueryData(queueQuery(orgId)),
      context.queryClient.ensureQueryData(membersQuery(orgId)),
    ]);
  },
  head: () => ({ meta: [{ title: "Queue — Redress" }] }),
  component: Queue,
});

type Tab = "mine" | "team" | "risk" | "overdue" | "all";
const ALL = "__all";

function Queue() {
  const m = useMembership()!;
  const orgId = m.org!.id;
  const { data: rows } = useSuspenseQuery(queueQuery(orgId));
  const { data: members } = useSuspenseQuery(membersQuery(orgId));
  const [tab, setTab] = useState<Tab>(m.role === "agent" ? "mine" : "team");
  const [q, setQ] = useState("");
  const [f, setF] = useState({ status: ALL, category: ALL, product: ALL, country: ALL, agent: ALL, vulnerable: ALL });
  const nameOf = (id: string | null) => (id ? members.find((x) => x.user_id === id)?.name ?? "—" : "Unassigned");

  const open = (s: Status) => CLOCK_RUNNING.includes(s);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      const s = r.status as Status;
      if (tab === "mine" && r.assigned_to !== m.user.id) return false;
      if (tab === "team" && !open(s)) return false;
      if (tab === "risk" && !isAtRisk(r.days_left, s)) return false;
      if (tab === "overdue" && !(open(s) && (r.days_left ?? 0) < 0)) return false;
      if (f.status !== ALL && r.status !== f.status) return false;
      if (f.category !== ALL && r.category !== f.category) return false;
      if (f.product !== ALL && r.product !== f.product) return false;
      if (f.country !== ALL && r.country_code !== f.country) return false;
      if (f.agent !== ALL && (r.assigned_to ?? "none") !== f.agent) return false;
      if (f.vulnerable !== ALL && String(r.vulnerable) !== f.vulnerable) return false;
      if (needle && ![r.reference, r.complainant_name, r.customer_ref].some((v) => v?.toLowerCase().includes(needle))) return false;
      return true;
    });
  }, [rows, tab, q, f, m.user.id]);

  const atRisk = rows.filter((r) => isAtRisk(r.days_left, r.status as Status)).length;
  const overdue = rows.filter((r) => open(r.status as Status) && (r.days_left ?? 0) < 0).length;
  const countries = [...new Set(rows.map((r) => r.country_code!).filter(Boolean))];
  const canLog = m.role !== "read_only";

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Queue</h1>
          <p className="mt-1 text-sm text-muted-foreground tabular">
            {overdue > 0 ? `${overdue} overdue. ` : ""}{atRisk} complaints due within 3 business days.
          </p>
        </div>
        {canLog && <Button asChild><Link to="/app/new"><Plus className="h-4 w-4" /> New complaint</Link></Button>}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mt-6">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="mine">My complaints</TabsTrigger>
          <TabsTrigger value="team">Team queue</TabsTrigger>
          <TabsTrigger value="risk">At risk <span className="ml-1 tabular text-warning">{atRisk}</span></TabsTrigger>
          <TabsTrigger value="overdue">Overdue <span className="ml-1 tabular text-destructive">{overdue}</span></TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-4 flex flex-wrap gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Reference, name or customer ID" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Filter label="Status" value={f.status} onChange={(v) => setF({ ...f, status: v })} options={STATUSES} />
        <Filter label="Category" value={f.category} onChange={(v) => setF({ ...f, category: v })} options={CATEGORIES} />
        <Filter label="Product" value={f.product} onChange={(v) => setF({ ...f, product: v })} options={PRODUCTS} />
        <Filter label="Country" value={f.country} onChange={(v) => setF({ ...f, country: v })} options={Object.fromEntries(countries.map((c) => [c, COUNTRIES[c] ?? c]))} />
        <Filter label="Agent" value={f.agent} onChange={(v) => setF({ ...f, agent: v })} options={{ none: "Unassigned", ...Object.fromEntries(members.map((x) => [x.user_id, x.name])) }} />
        <Filter label="Vulnerable" value={f.vulnerable} onChange={(v) => setF({ ...f, vulnerable: v })} options={{ true: "Vulnerable", false: "Not flagged" }} />
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Reference</th>
              <th className="px-4 py-2.5 font-medium">Customer</th>
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">Category</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Agent</th>
              <th className="px-4 py-2.5 font-medium">Time left</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                  {r.reference}
                  {r.priority === "high" && <span className="ml-2 rounded bg-destructive/10 px-1.5 py-0.5 font-sans text-destructive">High</span>}
                </td>
                <td className="px-4 py-3">
                  {r.complainant_name}
                  {r.vulnerable && <span className="ml-2 rounded bg-warning/15 px-1.5 py-0.5 text-xs text-warning">Vulnerable</span>}
                </td>
                <td className="hidden px-4 py-3 md:table-cell">{CATEGORIES[r.category!]}</td>
                <td className="whitespace-nowrap px-4 py-3">{STATUSES[r.status!]}</td>
                <td className="hidden px-4 py-3 lg:table-cell">{nameOf(r.assigned_to)}</td>
                <td className="px-4 py-3"><DeadlineClock daysLeft={r.days_left} status={r.status!} /></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No complaints match this view.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Record<string, string> }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-auto min-w-32"><SelectValue placeholder={label} /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All {label.toLowerCase()}</SelectItem>
        {Object.entries(options).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
