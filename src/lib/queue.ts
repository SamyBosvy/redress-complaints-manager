import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CLOCK_RUNNING, STATUSES, type QueueRow, type Status } from "./complaints";

export const PAGE_SIZE = 50;

export const QUEUE_TABS = ["mine", "team", "risk", "overdue", "ack", "all"] as const;
export type QueueTab = (typeof QUEUE_TABS)[number];

export const QUEUE_SORTS = ["time_left", "reference", "customer", "status", "agent"] as const;
export type QueueSort = (typeof QUEUE_SORTS)[number];
export type SortDir = "asc" | "desc";

/** Maps a sort key to the complaint_queue column ordered server-side. time_left is handled by pageSlices. */
export const SORT_COLUMNS: Record<Exclude<QueueSort, "time_left">, string> = {
  reference: "reference",
  customer: "complainant_name",
  status: "status",
  agent: "assigned_to",
};

/** Statuses whose final-response clock has stopped; they always sort after running clocks. */
export function stoppedStatuses(): Status[] {
  return (Object.keys(STATUSES) as Status[]).filter((s) => !CLOCK_RUNNING.includes(s));
}

export interface QueueSearch {
  tab?: QueueTab;
  q: string;
  status?: string;
  category?: string;
  product?: string;
  country?: string;
  agent?: string;
  vulnerable?: string;
  sort: QueueSort;
  dir: SortDir;
  page: number;
}

/** Validates raw URL search params into a typed, clamped QueueSearch; unknown values fall back to defaults. */
export function parseQueueSearch(s: Record<string, unknown>): QueueSearch {
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const page = Number(s.page);
  return {
    tab: (QUEUE_TABS as readonly string[]).includes(s.tab as string) ? (s.tab as QueueTab) : undefined,
    q: typeof s.q === "string" ? s.q : "",
    status: str(s.status),
    category: str(s.category),
    product: str(s.product),
    country: str(s.country),
    agent: str(s.agent),
    vulnerable: str(s.vulnerable),
    sort: (QUEUE_SORTS as readonly string[]).includes(s.sort as string) ? (s.sort as QueueSort) : "time_left",
    dir: s.dir === "desc" ? "desc" : "asc",
    page: Number.isInteger(page) && page >= 1 ? Math.min(page, 100_000) : 1,
  };
}

export interface QueueParams extends QueueSearch {
  userId: string;
}

export interface QueuePage {
  rows: QueueRow[];
  total: number;
  page: number;
  pageSize: number;
}

export type QueueSegment = "running" | "stopped";
export interface PageSlice {
  segment: QueueSegment;
  from: number;
  to: number;
}

/**
 * Splits a 1-based page into running/stopped row ranges so stopped clocks always
 * sort after every running clock, across page boundaries.
 */
export function pageSlices(runningCount: number, stoppedCount: number, page: number, size = PAGE_SIZE): PageSlice[] {
  const start = (page - 1) * size;
  const end = start + size - 1;
  const slices: PageSlice[] = [];
  const rTo = Math.min(end, runningCount - 1);
  if (start <= rTo) slices.push({ segment: "running", from: start, to: rTo });
  const sFrom = Math.max(start - runningCount, 0);
  const sTo = Math.min(end - runningCount, stoppedCount - 1);
  if (sFrom <= sTo) slices.push({ segment: "stopped", from: sFrom, to: sTo });
  return slices;
}

export type AckState = "due" | "overdue" | null;
/** Acknowledgement badge: only while status is Received; overdue once ack_due (yyyy-mm-dd) is before today. */
export function ackState(status: Status, ackDue: string | null, today: string): AckState {
  if (status !== "received" || !ackDue) return null;
  return ackDue < today ? "overdue" : "due";
}

export type StatusTone = "neutral" | "teal" | "progress" | "wait" | "review" | "done" | "closed" | "alert";
/** Calm colour tone per status; classes live in components/status-pill.tsx. */
export const STATUS_TONES: Record<Status, StatusTone> = {
  received: "neutral",
  acknowledged: "teal",
  under_investigation: "progress",
  holding_response_sent: "wait",
  pending_qa: "review",
  final_response_sent: "done",
  closed: "closed",
  escalated_to_adr: "alert",
  reopened: "wait",
};

/** Weekend-only business-day count from start (exclusive) to end (inclusive); negative when end precedes start. */
export function businessDaysBetween(start: string, end: string): number {
  const a = new Date(start);
  const b = new Date(end);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  const dir = a <= b ? 1 : -1;
  let days = 0;
  const d = new Date(a);
  while (dir > 0 ? d < b : d > b) {
    d.setDate(d.getDate() + dir);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) days += dir;
  }
  return days;
}

/** Share of the deadline already consumed, 0–1; null when the clock is stopped or dates are missing. */
export function clockProgress(receivedAt: string | null, due: string | null, daysLeft: number | null, status: Status): number | null {
  if (!CLOCK_RUNNING.includes(status) || !receivedAt || !due || daysLeft === null) return null;
  const total = businessDaysBetween(receivedAt.slice(0, 10), due);
  if (total <= 0) return null;
  return Math.min(1, Math.max(0, (total - daysLeft) / total));
}

const QUEUE_SELECT =
  "id, reference, complainant_name, customer_ref, category, product, country_code, status, assigned_to, vulnerable, priority, days_left, current_due, ack_due, received_at";

interface QueueFilterable {
  eq(c: string, v: string | boolean): this;
  is(c: string, v: null): this;
  in(c: string, v: readonly string[]): this;
  gte(c: string, v: number): this;
  lte(c: string, v: number): this;
  lt(c: string, v: string | number): this;
  or(f: string): this;
}

/** Applies tab, column filters and text search shared by the page and count queries. */
function applyFilters<Q extends QueueFilterable>(q: Q, p: QueueParams): Q {
  const tab = p.tab ?? "team";
  if (tab === "mine") q = q.eq("assigned_to", p.userId);
  if (tab === "team") q = q.in("status", CLOCK_RUNNING);
  if (tab === "risk") q = q.in("status", CLOCK_RUNNING).gte("days_left", 0).lte("days_left", 3);
  if (tab === "overdue") q = q.in("status", CLOCK_RUNNING).lt("days_left", 0);
  if (tab === "ack") q = q.eq("status", "received").lt("ack_due", todayISO());
  if (p.status) q = q.eq("status", p.status);
  if (p.category) q = q.eq("category", p.category);
  if (p.product) q = q.eq("product", p.product);
  if (p.country) q = q.eq("country_code", p.country);
  if (p.agent) q = p.agent === "none" ? q.is("assigned_to", null) : q.eq("assigned_to", p.agent);
  if (p.vulnerable) q = q.eq("vulnerable", p.vulnerable === "true");
  const needle = p.q.trim().replace(/[%,_()."\\]/g, " ").trim();
  if (needle) q = q.or(`reference.ilike.%${needle}%,complainant_name.ilike.%${needle}%,customer_ref.ilike.%${needle}%`);
  return q;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function countRows(orgId: string, p: QueueParams, segment?: readonly Status[]): Promise<number> {
  let q = supabase.from("complaint_queue").select("id", { count: "exact", head: true }).eq("org_id", orgId);
  q = applyFilters(q, p);
  if (segment) q = q.in("status", segment);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

async function fetchQueuePage(orgId: string, p: QueueParams): Promise<QueuePage> {
  const size = PAGE_SIZE;
  if (p.sort === "time_left") {
    const stopped = stoppedStatuses();
    const [runningCount, stoppedCount] = await Promise.all([countRows(p, CLOCK_RUNNING), countRows(p, stopped)]);
    const slices = pageSlices(runningCount, stoppedCount, p.page, size);
    const parts = await Promise.all(
      slices.map(async (s) => {
        let q = applyFilters(supabase.from("complaint_queue").select(QUEUE_SELECT), p).eq("org_id", orgId);
        q = q.in("status", s.segment === "running" ? CLOCK_RUNNING : stopped);
        const ordered =
          s.segment === "running"
            ? q.order("days_left", { ascending: p.dir === "asc", nullsFirst: false }).order("id", { ascending: true })
            : q.order("received_at", { ascending: false }).order("id", { ascending: true });
        const { data, error } = await ordered.range(s.from, s.to);
        if (error) throw error;
        return data;
      }),
    );
    return { rows: parts.flat(), total: runningCount + stoppedCount, page: p.page, pageSize: size };
  }
  let q = applyFilters(supabase.from("complaint_queue").select(QUEUE_SELECT, { count: "exact" }), p).eq("org_id", orgId);
  const ordered = q
    .order(SORT_COLUMNS[p.sort], { ascending: p.dir === "asc", nullsFirst: false })
    .order("id", { ascending: true });
  const { data, count, error } = await ordered.range((p.page - 1) * size, p.page * size - 1);
  if (error) throw error;
  return { rows: data, total: count ?? 0, page: p.page, pageSize: size };
}

export const queueQuery = (orgId: string, p: QueueParams) =>
  queryOptions({
    queryKey: ["queue", orgId, p],
    queryFn: () => fetchQueuePage(orgId, p),
  });

/** Unfiltered tab badge counts for the queue header. */
export const queueCountsQuery = (orgId: string, userId: string) =>
  queryOptions({
    queryKey: ["queue-counts", orgId, userId],
    queryFn: async () => {
      const base = { userId, q: "", sort: "time_left", dir: "asc", page: 1 } as const;
      const [atRisk, overdue, ackOverdue] = await Promise.all([
        countRows({ ...base, tab: "risk" }),
        countRows({ ...base, tab: "overdue" }),
        countRows({ ...base, tab: "ack" }),
      ]);
      return { atRisk, overdue, ackOverdue };
    },
  });
