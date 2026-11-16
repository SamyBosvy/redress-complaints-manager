import { DAY_LABELS } from '@/lib/my-day';
import { EmptyState } from '@/components/empty-state';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { QueueBulkActions } from '@/components/queue-bulk-actions';
import { Checkbox } from '@/components/ui/checkbox';
import { selectAllMatching, selectRange } from '@/lib/bulk-actions';
import { eligibleHandler } from '@/lib/settings';
import { supabase } from '@/integrations/supabase/client';
import { shortcutsBlocked } from '@/lib/shortcuts';
import { TableSkeleton } from '@/components/table-skeleton';
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
  PAGE_SIZE, queueEmptyState, ackState, parseQueueSearch, queueCountsQuery, queueQuery, fetchMatchingQueue,
  type QueueItem, type QueueSearch, type QueueSort, type QueueTab,
} from "@/lib/queue";

export const Route = createFileRoute("/_authenticated/app/")({
  validateSearch: parseQueueSearch,
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ context, deps }) => {
    const m = await context.queryClient.ensureQueryData(membershipQuery);
    if (!m?.org) return;
    const orgId = m.org.id;
    const params = { ...deps.search, userId: m.user.id };
    await Promise.all([
      context.queryClient.ensureQueryData(queueQuery(orgId, params)),
      context.queryClient.ensureQueryData(queueCountsQuery(orgId, m.user.id)),
      context.queryClient.ensureQueryData(membersQuery(orgId)),
      context.queryClient.ensureQueryData(countriesQuery(orgId)),
    ]);
  },
  head: () => ({ meta: [{ title: "Queue — Redress" }, { name: "description", content: "Track customer complaints and regulatory deadlines." }, { property: "og:title", content: "Queue — Redress" }, { property: "og:description", content: "Track customer complaints and regulatory deadlines." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  pendingComponent: () => <TableSkeleton columns={6} />,
  component: Queue,
});

const ALL = "__all";
const FILTER_KEYS = ["day_section", "day_date", "day_zone", "holding", "holding_by", "receipt_start", "receipt_end", "reopened", "reopen_from", "reopen_to", "reopen_reason", "status", "category", "product", "country", "agent", "vulnerable", "received_from", "received_to", "outcome", "root_cause", "resolved", "within_deadline", "channel", "report_ids", "report_basis", "adr_from", "adr_to", "adr_metric", "adr_decision", "adr_currency"] as const;

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
    navigate({ search: (prev) => ({ ...prev, ...patch, day_section: Object.keys(patch).some(k=>k==='tab'||(FILTER_KEYS.includes(k as typeof FILTER_KEYS[number])&&k!=='day_section')) ? undefined : patch.day_section ?? (Object.hasOwn(patch,'day_section') ? undefined : search.day_section), report_ids: Object.keys(patch).some(k => FILTER_KEYS.includes(k as typeof FILTER_KEYS[number])) ? undefined : search.report_ids, report_basis: Object.keys(patch).some(k => FILTER_KEYS.includes(k as typeof FILTER_KEYS[number])) ? undefined : search.report_basis, page: patch.page ?? 1 }), replace: true });
  const setTab = (v: string) => update({ tab: v as QueueTab });
  const openCase = (id: string) => navigate({ to: "/app/c/$id", params: { id } });

  const [selected, setSelected] = useState<QueueItem[]>([]);
  const [selecting, setSelecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [handlers, setHandlers] = useState<{user_id: string; name: string}[]>([]);
  const anchor = useRef(-1);
  const scope = JSON.stringify({orgId, userId: m.user.id, tab, q:search.q, status:search.status, category:search.category, product:search.product, country:search.country, agent:search.agent, vulnerable:search.vulnerable, drill: FILTER_KEYS.map(k=>search[k])});
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const clearSelection = () => {setSelected([]); anchor.current = -1;};
  useEffect(() => {setSelected([]); anchor.current = -1;}, [scope]);
  useEffect(() => {anchor.current = -1;}, [search.page, search.sort, search.dir]);
  useEffect(() => {
    let cancelled = false;
    setHandlers([]);
    if (m.role === 'org_admin' || m.role === 'complaints_manager') {
      void supabase.rpc('org_member_directory', {_org:orgId}).then(({data,error}) => {
        if (!cancelled && !error) setHandlers((data ?? []).filter(eligibleHandler).map(h => ({user_id:h.user_id,name:h.full_name || h.email || 'Unknown'})));
      });
    }
    return () => {cancelled = true;};
  }, [orgId, m.role]);
  const pageIds = page.rows.flatMap(r => r.id ? [r.id] : []);
  const selectedIds = new Set(selected.map(r => r.id));
  const wholePage = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id));
  function toggleRow(index: number, checked: boolean, shift: boolean) {
    const ids = selectRange(selected.flatMap(r => r.id ? [r.id] : []), pageIds, shift ? anchor.current : index, index, checked);
    const available = new Map([...selected,...page.rows].map(r => [r.id,r]));
    setSelected(ids.flatMap(id => {const row = available.get(id); return row ? [row] : [];}));
    anchor.current = index;
  }
  async function selectMatching() {
    const originalScope = scope;
    setSelecting(true);
    try {
      const rows = await fetchMatchingQueue(orgId, {...params,tab});
      if (scopeRef.current === originalScope) setSelected(selectAllMatching(rows));
    } catch (error) {toast.error((error as {message?:string})?.message ?? 'Complaints could not be selected.');}
    finally {setSelecting(false);}
  }

  const tableRef = useRef<HTMLTableElement>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (shortcutsBlocked(event.target) || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      if (event.key === 'Escape' && !busy && !selecting) {setSelected([]); anchor.current = -1; return;}
      const key = event.key.toLowerCase();
      if (key !== 'j' && key !== 'k') return;
      const rows = Array.from(tableRef.current?.querySelectorAll<HTMLTableRowElement>('tbody tr[role="link"]') ?? []);
      if (!rows.length) return;
      const index = rows.findIndex(row => row === document.activeElement || row.contains(document.activeElement));
      const next = index < 0 ? (key === 'j' ? 0 : rows.length - 1) : Math.max(0, Math.min(rows.length - 1, index + (key === 'j' ? 1 : -1)));
      event.preventDefault();
      rows[next]?.focus();
      rows[next]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [page.rows, busy, selecting]);

  const countryOpts = countries.length
    ? Object.fromEntries(countries.map((c) => [c.country_code, COUNTRIES[c.country_code] ?? c.country_code]))
    : COUNTRIES;

  const chips: { key: keyof QueueSearch; label: string }[] = [];
  if(search.day_section) chips.push({key:'day_section',label:`My day: ${DAY_LABELS[search.day_section]} (${search.day_date})`});
  if ((search.q ?? "").trim()) chips.push({ key: "q", label: `Search: ${(search.q ?? "").trim()}` });
  if (search.status) chips.push({ key: "status", label: `Status: ${STATUSES[search.status as Status] ?? search.status}` });
  if (search.category) chips.push({ key: "category", label: `Category: ${CATEGORIES[search.category as keyof typeof CATEGORIES] ?? search.category}` });
  if (search.product) chips.push({ key: "product", label: `Product: ${PRODUCTS[search.product as keyof typeof PRODUCTS] ?? search.product}` });
  if (search.country) chips.push({ key: "country", label: `Country: ${COUNTRIES[search.country] ?? search.country}` });
  if (search.agent) chips.push({ key: "agent", label: `Agent: ${search.agent === "none" ? "Unassigned" : nameOf(search.agent)}` });
  if (search.vulnerable) chips.push({ key: "vulnerable", label: search.vulnerable === "true" ? "Vulnerable" : "Not flagged" });
  for (const key of ['received_from','received_to','outcome','root_cause','resolved','within_deadline','channel','adr_from','adr_to','adr_metric','adr_decision','adr_currency'] as const) if(search[key]) chips.push({key,label:`${key.replaceAll('_',' ')}: ${search[key]}`});
  if(search.report_ids) chips.push({key:'report_ids',label:'Report snapshot'});
  const clearAll = () =>
    navigate({
      search: (prev) => ({ ...prev, day_section:undefined,day_date:undefined,day_zone:undefined,q: "", status: undefined, category: undefined, product: undefined, country: undefined, agent: undefined, vulnerable: undefined, received_from:undefined,received_to:undefined,outcome:undefined,root_cause:undefined,resolved:undefined,within_deadline:undefined,channel:undefined,report_ids:undefined,report_basis:undefined,adr_from:undefined,adr_to:undefined,adr_metric:undefined,adr_decision:undefined,adr_currency:undefined,reopened:undefined,reopen_from:undefined,reopen_to:undefined,reopen_reason:undefined,page: 1 }),
      replace: true,
    });

  const total = page.total;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = search.page ?? 1;
  const from = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, currentPage * PAGE_SIZE);
  const empty = queueEmptyState(counts.total, total, m.role);
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
        {canLog && <Button asChild><Link to="/app/new"><Plus aria-hidden="true" className="h-4 w-4" /> New complaint</Link></Button>}
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="mine">My complaints</TabsTrigger>
          <TabsTrigger value="team">Team queue</TabsTrigger>
          <TabsTrigger value="risk">At risk <span className="ml-1 tabular text-warning">{counts.atRisk}</span></TabsTrigger>
          <TabsTrigger value="overdue">Overdue <span className="ml-1 tabular text-destructive">{counts.overdue}</span></TabsTrigger>
          <TabsTrigger value="ack">Ack overdue <span className="ml-1 tabular text-destructive">{counts.ackOverdue}</span></TabsTrigger>
          <TabsTrigger value="adr">ADR</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-4 flex flex-wrap gap-2">
        <div className="relative w-full sm:w-64">
          <Search aria-hidden="true" className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Reference, name or customer ID" value={search.q ?? ""}
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
                <X aria-hidden="true" className="h-3 w-3" />
              </button>
            </span>
          ))}
          <Button variant="ghost" size="sm" onClick={clearAll}>Clear all</Button>
          {search.report_basis === 'current' && <p className="w-full text-xs text-muted-foreground">Showing current status — the report counted status at period end.</p>}
          {search.day_section==='ack'&&<p className="w-full text-xs text-muted-foreground">Acknowledgement evidence checked for up to 200 open assigned cases; larger caseloads may be incomplete.</p>}
        </div>
      )}

      {wholePage && selected.length < total && <Button variant="link" className="mt-3 h-auto max-w-full whitespace-normal text-left" disabled={selecting || busy} onClick={selectMatching}>{selecting ? 'Selecting…' : `Select all ${total} matching the current filters`}</Button>}

      <QueueBulkActions key={scope} rows={selected} orgId={orgId} role={m.role} handlers={handlers} members={members} clear={clearSelection} onBusy={setBusy}/>

      <div className="mt-4 max-w-full overflow-x-auto rounded-lg border bg-card">
        <table ref={tableRef} className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="w-10 px-3 py-2.5"><Checkbox aria-label="Select all on this page" disabled={busy || selecting || !pageIds.length} checked={wholePage ? true : pageIds.some(id => selectedIds.has(id)) ? 'indeterminate' : false} onCheckedChange={checked => {
                setSelected(current => checked === true ? selectAllMatching([...current,...page.rows]) : current.filter(r => !r.id || !pageIds.includes(r.id)));
                anchor.current = -1;
              }}/></th>
              <SortTh label="Reference" sortKey="reference" search={search} update={update} />
              <SortTh label="Customer" sortKey="customer" search={search} update={update} />
              <th scope="col" className="hidden px-4 py-2.5 font-medium md:table-cell">Category</th>
              <SortTh label="Status" sortKey="status" search={search} update={update} />
              <SortTh label="Agent" sortKey="agent" search={search} update={update} className="hidden lg:table-cell" />
              <SortTh label="Time left" sortKey="time_left" search={search} update={update} />
            </tr>
          </thead>
          <tbody>
            {page.rows.map((r, index) => {
              if (!r.id) return null;
              const id = r.id;
              const ack = ackState(r.status as Status, r.ack_due, today);
              return (
                <tr key={r.id} tabIndex={0} role="link" aria-label={`Open complaint ${r.reference}`}
                  onClick={() => openCase(id)}
                  onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget) { e.preventDefault(); openCase(id); } }}
                  className="cursor-pointer border-b last:border-0 hover:bg-muted/40 focus:bg-accent focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring">
                  <td className="px-3 py-3" onClick={e => e.stopPropagation()}><Checkbox aria-label={`Select complaint ${r.reference}`} checked={selectedIds.has(id)} disabled={busy || selecting} onClick={e => {e.stopPropagation(); toggleRow(index, !selectedIds.has(id), e.shiftKey);}} /></td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                    <Link to="/app/c/$id" params={{ id }} onClick={(e) => e.stopPropagation()} className="text-primary hover:underline">
                      {r.reference}
                    </Link>
                    {r.priority === "high" && <span className="ml-2 rounded bg-destructive/10 px-1.5 py-0.5 font-sans text-destructive">High</span>}
                  </td>
                  <td className="px-4 py-3">
                    {r.complainant_name}
                    {r.vulnerable && <span className="ml-2 rounded bg-warning/15 px-1.5 py-0.5 text-xs text-warning">Vulnerable</span>}
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">{r.category ? CATEGORIES[r.category] : '—'}</td>
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
            {empty && (
              <tr><td colSpan={7}><EmptyState
                title={empty.kind === 'empty' ? 'No complaints yet' : 'No complaints match this view'}
                description={empty.kind === 'empty' ? 'Your firm has no recorded complaints.' : 'No complaints meet the selected view criteria.'}
                primaryAction={empty.kind === 'filtered' ? <Button onClick={() => navigate({search: {tab: 'all'}, replace: true})}>Clear filters</Button> : empty.canLog ? <Button asChild><Link to="/app/new">Log your first complaint</Link></Button> : undefined}
                secondaryAction={empty.canShare ? <Button variant="outline" asChild><Link to="/app/forms">Share your public form</Link></Button> : undefined}
              /></td></tr>
            )}
          </tbody>
        </table>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 text-sm">
          <p className="text-muted-foreground tabular">{total === 0 ? "No complaints" : `Showing ${from}–${to} of ${total}`}</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => update({ page: currentPage - 1 })}>
              <ChevronLeft aria-hidden="true" className="h-4 w-4" /> Previous
            </Button>
            <span className="tabular text-muted-foreground">Page {currentPage} of {pages}</span>
            <Button variant="outline" size="sm" disabled={currentPage >= pages} onClick={() => update({ page: currentPage + 1 })}>
              Next <ChevronRight aria-hidden="true" className="h-4 w-4" />
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
    <th scope="col" aria-sort={active ? (search.dir === "asc" ? "ascending" : "descending") : undefined} className={`px-4 py-2.5 font-medium ${className ?? ""}`}>
      <button type="button" onClick={() => update({ sort: sortKey, dir: nextDir })}
        className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-foreground">
        {label}
        {active ? (search.dir === "asc" ? <ArrowUp aria-hidden="true" className="h-3 w-3" /> : <ArrowDown aria-hidden="true" className="h-3 w-3" />) : <ArrowUpDown aria-hidden="true" className="h-3 w-3 opacity-40" />}
      </button>
    </th>
  );
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Record<string, string> }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="w-auto min-w-32"><SelectValue placeholder={label} /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All {label.toLowerCase()}</SelectItem>
        {Object.entries(options).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
