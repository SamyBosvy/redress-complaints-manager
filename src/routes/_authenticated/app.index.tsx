import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Plus, Search, X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DeadlineClock } from "@/components/deadline-clock";
import { AckBadge, StatusPill } from "@/components/status-pill";
import { useMembership, membershipQuery } from "@/lib/org";
import { COUNTRIES } from "@/lib/countries";
import { CATEGORIES, PRODUCTS, STATUSES, countriesQuery, membersQuery, type Status } from "@/lib/complaints";
import {
  PAGE_SIZE, ackState, parseQueueSearch, queueCountsQuery, queueQuery,
  type QueueSearch, type QueueSort, type QueueTab,
} from "@/lib/queue";

export const Route = createFileRoute("/_authenticated/app/")({
  validateSearch: parseQueueSearch,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ context, deps }) => {
    const m = await context.queryClient.ensureQueryData(membershipQuery);
    const orgId = m!.org!.id;
    const params = { ...deps.search, userId: m!.user.id };
    await Promise.all([
      context.queryClient.ensureQueryData(queueQuery(orgId, params)),
      context.queryClient.ensureQueryData(queueCountsQuery(orgId, m!.user.id)),
      context.queryClient.ensureQueryData(membersQuery(orgId)),
      context.queryClient.ensureQueryData(countriesQuery(orgId)),
    ]);
  },
  head: () => ({ meta: [{ title: "Queue — Redress" }, { name: "description", content: "Track customer complaints and regulatory deadlines." }, { property: "og:title", content: "Queue — Redress" }, { property: "og:description", content: "Track customer complaints and regulatory deadlines." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Queue,
});

const ALL = "__all";
const FILTER_KEYS = ["status", "category", "product", "country", "agent", "vulnerable"] as const;

function Queue() {
  const m = useMembership()!;
  const orgId = m.org!.id;
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/app" });
  const tab: QueueTab = search.tab ?? (m.role === "agent" ? "mine" : "team");
  const params = { ...search, userId: m.user.id };
  const { data: page } = useSuspenseQuery(queueQuery(orgId, params));
  const { data: counts } = useSuspenseQuery(queueCountsQuery(orgId, m.user.id));
  const { data: members } = useSuspenseQuery(membersQuery(orgId));
  const { data: countries } = useSuspenseQuery(countriesQuery(orgId));

  const today = new Date().toISOString().slice(0, 10);
  const nameOf = (id: string | null) => (id ? members.find((x) => x.user_id === id)?.name ?? "—" : "Unassigned");
  const update = (patch: Partial<QueueSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch, page: patch.page ?? 1 }), replace: true });
  const setTab = (v: string) => update({ tab: v as QueueTab });
  const openCase = (id: string) => navigate({ to: "/app/c/$id", params: { id } });

  const countryOpts = countries.length
    ? Object.fromEntries(countries.map((c) => [c.country_code, COUNTRIES[c.country_code] ?? c.country_code]))
    : COUNTRIES;

  const chips: { key: keyof QueueSearch; label: string }[] = [];
  if (search.q.trim()) chips.push({ key: "q", label: `Search: ${search.q.trim()}` });
  if (search.status) chips.push({ key: "status", label: `Status: ${STATUSES[search.status as Status] ?? search.status}` });
  if (search.category) chips.push({ key: "category", label: `Category: ${CATEGORIES[search.category as keyof typeof CATEGORIES] ?? search.category}` });
  if (search.product) chips.push({ key: "product", label: `Product: ${PRODUCTS[search.product as keyof typeof PRODUCTS] ?? search.product}` });
  if (search.country) chips.push({ key: "country", label: `Country: ${COUNTRIES[search.country] ?? search.country}` });
  if (search.agent) chips.push({ key: "agent", label: `Agent: ${search.agent === "none" ? "Unassigned" : nameOf(search.agent)}` });
  if (search.vulnerable) chips.push({ key: "vulnerable", label: search.vulnerable === "true" ? "Vulnerable" : "Not flagged" });
  const clearAll = () =>
    navigate({
      search: (prev) => ({ ...prev, q: "", status: undefined, category: undefined, product: undefined, country: undefined, agent: undefined, vulnerable: undefined, page: 1 }),
      replace: true,
    });

  const total = page.total;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (search.page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, search.page * PAGE_SIZE);
  const canLog = m.role !== "read_only";

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Queue</h1>
          <p className="mt-1 text-sm text-muted-foreground tabular">
            {counts.overdue > 0 ? `${counts.overdue} overdue. ` : ""}
            {counts.atRisk} complaints due within 3 business days.
            {counts.ackOverdue > 0 ? ` ${counts.ackOverdue} acknowledgements overdue.` : ""}
          </p>
        </div>
        {canLog && <Button asChild><Link to="/app/new"><Plus className="h-4 w-4" /> New complaint</Link></Button>}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="mine">My complaints</TabsTrigger>
          <TabsTrigger value="team">Team queue</TabsTrigger>
          <TabsTrigger value="risk">At risk <span className="ml-1 tabular text-warning">{counts.atRisk}</span></TabsTrigger>
          <TabsTrigger value="overdue">Overdue <span className="ml-1 tabular text-destructive">{counts.overdue}</span></TabsTrigger>
          <TabsTrigger value="ack">Ack overdue <span className="ml-1 tabular text-destructive">{counts.ackOverdue}</span></TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-4 flex flex-wrap gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Reference, name or customer ID" value={search.q}
            onChange={(e) => update({ q: e.target.value })} />
        </div>
        <Filter label="Status" value={search.status ?? ALL} onChange={(v) => update({ status: v === ALL ? undefined : v })} options={STATUSES} />
        <Filter label="Category" value={search.category ?? ALL} onChange={(v) => update({ category: v === ALL ? undefined : v })} options={CATEGORIES} />
        <Filter label="Product" value={search.product ?? ALL} onChange={(v) => update({ product: v === ALL ? undefined : v })} options={PRODUCTS} />
        <Filter label="Country" value={search.country ?? ALL} onChange={(v) => update({ country: v === ALL ? undefined : v })} options={countryOpts} />
        <Filter label="Agent" value={search.agent ?? ALL} onChange={(v) => update({ agent: v === ALL ? undefined : v })} options={{ none: "Unassigned", ...Object.fromEntries(members.map((x) => [x.user_id, x.name])) }} />
        <Filter label="Vulnerable" value={search.vulnerable ?? ALL} onChange={(v) => update({ vulnerable: v === ALL ? undefined : v })} options={{ true: "Vulnerable", false: "Not flagged" }} />
      </div>

      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <span key={c.key} className="inline-flex max-w-full items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
              <span className="truncate">{c.label}</span>
              <button type="button" aria-label={`Remove filter ${c.label}`} onClick={() => update({ [c.key]: c.key === "q" ? "" : undefined })}
                className="shrink-0 rounded-full p-0.5 hover:bg-muted">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <Button variant="ghost" size="sm" onClick={clearAll}>Clear all</Button>
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <SortTh label="Reference" sortKey="reference" search={search} update={update} />
              <SortTh label="Customer" sortKey="customer" search={search} update={update} />
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">Category</th>
              <SortTh label="Status" sortKey="status" search={search} update={update} />
              <SortTh label="Agent" sortKey="agent" search={search} update={update} className="hidden lg:table-cell" />
              <SortTh label="Time left" sortKey="time_left" search={search} update={update} />
            </tr>
          </thead>
          <tbody>
            {page.rows.map((r) => {
              const ack = ackState(r.status as Status, r.ack_due, today);
              return (
                <tr key={r.id} tabIndex={0} role="link" aria-label={`Open complaint ${r.reference}`}
                  onClick={() => openCase(r.id!)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); openCase(r.id!); } }}
                  className="cursor-pointer border-b last:border-0 hover:bg-muted/40 focus:bg-muted/40 focus:outline-none">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                    <Link to="/app/c/$id" params={{ id: r.id! }} onClick={(e) => e.stopPropagation()} className="text-primary hover:underline">
                      {r.reference}
                    </Link>
                    {r.priority === "high" && <span className="ml-2 rounded bg-destructive/10 px-1.5 py-0.5 font-sans text-destructive">High</span>}
                  </td>
                  <td className="px-4 py-3">
                    {r.complainant_name}
                    {r.vulnerable && <span className="ml-2 rounded bg-warning/15 px-1.5 py-0.5 text-xs text-warning">Vulnerable</span>}
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">{CATEGORIES[r.category!]}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex flex-col items-start gap-1">
                      <StatusPill status={r.status as Status} />
                      {ack && <AckBadge state={ack} />}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">{nameOf(r.assigned_to)}</td>
                  <td className="px-4 py-3"><DeadlineClock daysLeft={r.days_left} status={r.status as Status} due={r.current_due} receivedAt={r.received_at} /></td>
                </tr>
              );
            })}
            {page.rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No complaints match this view.</td></tr>
            )}
          </tbody>
        </table>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 text-sm">
          <p className="text-muted-foreground tabular">{total === 0 ? "No complaints" : `Showing ${from}–${to} of ${total}`}</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={search.page <= 1} onClick={() => update({ page: search.page - 1 })}>
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <span className="tabular text-muted-foreground">Page {search.page} of {pages}</span>
            <Button variant="outline" size="sm" disabled={search.page >= pages} onClick={() => update({ page: search.page + 1 })}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SortTh({ label, sortKey, search, update, className }: {
  label: string;
  sortKey: QueueSort;
  search: QueueSearch;
  update: (patch: Partial<QueueSearch>) => void;
  className?: string;
}) {
  const active = search.sort === sortKey;
  const nextDir = active && search.dir === "asc" ? "desc" : "asc";
  return (
    <th aria-sort={active ? (search.dir === "asc" ? "ascending" : "descending") : undefined} className={`px-4 py-2.5 font-medium ${className ?? ""}`}>
      <button type="button" onClick={() => update({ sort: sortKey, dir: nextDir })}
        className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-foreground">
        {label}
        {active ? (search.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
      </button>
    </th>
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
