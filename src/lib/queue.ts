import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CLOCK_RUNNING, STATUSES, type QueueRow, type Status } from "./complaints";
import { reportFilterOps } from "./reports";
import type { AppRole } from './org';
import { DAY_SECTIONS, type DaySection } from './my-day';
import { fetchDaySection } from './my-day-query';
import { WORKLOAD_METRICS, workloadOps, type WorkloadMetric } from './workload';
import { nextBusinessDate } from './my-day';
import { auditDateBoundary } from './audit';
import { COUNTRIES } from './countries';

export function queueEmptyState(orgTotal: number, matchingTotal: number, role: AppRole | null) {
  if (orgTotal === 0) return { kind: 'empty' as const, canLog: role !== null && role !== 'read_only', canShare: role === 'org_admin' };
  if (matchingTotal === 0) return { kind: 'filtered' as const, canLog: false, canShare: false };
  return null;
}

export const PAGE_SIZE = 50;

export const QUEUE_TABS = ["mine", "team", "risk", "overdue", "ack", "adr", "all", "reopen_requests"] as const;
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
  workload?: WorkloadMetric | undefined;
  workload_date?: string | undefined;
  day_section?: DaySection | undefined;
  day_date?: string | undefined;
  day_zone?: string | undefined;
  ack_metric?: 'on_time' | 'late' | 'overdue' | undefined; ack_from?: string | undefined; ack_to?: string | undefined; ack_zone?: string | undefined; ack_today?: string | undefined;
  holding?: string | undefined; holding_by?: string | undefined; receipt_start?: string | undefined; receipt_end?: string | undefined;
  reopened?: string | undefined; reopen_from?: string | undefined; reopen_to?: string | undefined; reopen_reason?: string | undefined;
  adr_from?: string | undefined; adr_to?: string | undefined;
  adr_metric?: 'escalated' | 'decided' | 'overturned' | undefined;
  adr_decision?: string | undefined; adr_currency?: string | undefined;
  received_from?: string | undefined;
  received_to?: string | undefined;
  outcome?: string | undefined;
  root_cause?: string | undefined;
  resolved?: string | undefined;
  within_deadline?: string | undefined;
  channel?: string | undefined;
  report_ids?: string | undefined;
  report_basis?: 'current' | undefined;
  tab?: QueueTab | undefined;
  q?: string | undefined;
  status?: string | undefined;
  category?: string | undefined;
  product?: string | undefined;
  country?: string | undefined;
  agent?: string | undefined;
  vulnerable?: string | undefined;
  sort?: QueueSort | undefined;
  dir?: SortDir | undefined;
  page?: number | undefined;
}

/** Validates raw URL search params into a typed, clamped QueueSearch; unknown values fall back to defaults. */
export function parseQueueSearch(s: Record<string, unknown>): QueueSearch {
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const page = Number(s["page"]);
  const date = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v ? v : undefined;
  const instant=(v:unknown)=>typeof v==='string' && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(v)&&Number.isFinite(Date.parse(v))?v:undefined;
  const yesNo = (v: unknown) => v === 'yes' || v === 'no' ? v : undefined;
  return {
    workload: typeof s['workload']==='string' && Object.hasOwn(WORKLOAD_METRICS,s['workload']) ? s['workload'] as WorkloadMetric : undefined,
    workload_date: date(s['workload_date']),
    day_section: DAY_SECTIONS.includes(s['day_section'] as DaySection) ? s['day_section'] as DaySection : undefined,
    day_date: date(s['day_date']),
    day_zone: (()=>{try{if(typeof s['day_zone']==='string'){new Intl.DateTimeFormat('en',{timeZone:s['day_zone']});return s['day_zone'];}}catch{}return undefined;})(),
    ack_metric: ['on_time','late','overdue'].includes(String(s['ack_metric'])) ? s['ack_metric'] as QueueSearch['ack_metric'] : undefined,
    ack_from:date(s['ack_from']),ack_to:date(s['ack_to']),ack_today:date(s['ack_today']),
    ack_zone:(()=>{try{if(typeof s['ack_zone']==='string'){new Intl.DateTimeFormat('en',{timeZone:s['ack_zone']});return s['ack_zone'];}}catch{}return undefined;})(),
    holding:yesNo(s['holding']), holding_by:instant(s['holding_by']),receipt_start:instant(s['receipt_start']),receipt_end:instant(s['receipt_end']),
    reopened:yesNo(s['reopened']),reopen_from:date(s['reopen_from']),reopen_to:date(s['reopen_to']),reopen_reason:['new_evidence','customer_disagreed','handling_error','regulator_adr_request','other'].includes(String(s['reopen_reason']))?String(s['reopen_reason']):undefined,
    adr_from:date(s['adr_from']),adr_to:date(s['adr_to']),
    adr_metric: ['escalated','decided','overturned'].includes(String(s['adr_metric'])) ? s['adr_metric'] as QueueSearch['adr_metric'] : undefined,
    adr_decision: ['pending','upheld_firm','overturned','partially_overturned','settled','withdrawn'].includes(String(s['adr_decision'])) ? String(s['adr_decision']) : undefined,
    adr_currency: ['EUR','GBP','PLN','CZK','HUF','RON','SEK','DKK','NOK','CHF','BGN','ISK','USD'].includes(String(s['adr_currency'])) ? String(s['adr_currency']) : undefined,
    received_from: date(s["received_from"]), received_to: date(s["received_to"]),
    outcome: ['upheld','partially_upheld','not_upheld','withdrawn'].includes(String(s["outcome"])) ? String(s["outcome"]) : undefined,
    root_cause: str(s["root_cause"]), resolved: yesNo(s["resolved"]), within_deadline: yesNo(s["within_deadline"]), channel: str(s["channel"]),
    report_basis: s["report_basis"] === 'current' ? 'current' : undefined,
    report_ids: typeof s["report_ids"] === 'string' && /^(none|[a-zA-Z0-9-]+(,[a-zA-Z0-9-]+)*)$/.test(s["report_ids"]) ? s["report_ids"] : undefined,
    tab: (QUEUE_TABS as readonly string[]).includes(s["tab"] as string) ? (s["tab"] as QueueTab) : undefined,
    q: typeof s["q"] === "string" ? (s["q"] as string) : "",
    status: str(s["status"]),
    category: str(s["category"]),
    product: str(s["product"]),
    country: str(s["country"]),
    agent: str(s["agent"]),
    vulnerable: str(s["vulnerable"]),
    sort: (QUEUE_SORTS as readonly string[]).includes(s["sort"] as string) ? (s["sort"] as QueueSort) : "time_left",
    dir: s["dir"] === "desc" ? "desc" : "asc",
    page: Number.isInteger(page) && page >= 1 ? Math.min(page, 100_000) : 1,
  };
}

export interface QueueParams extends QueueSearch {
  userId: string;
  workload_or?: string | undefined;
  workload_from?: string | undefined;
  workload_until?: string | undefined;
}

/** The complaint_queue columns selected for the queue table (see QUEUE_SELECT). */
export type QueueItem = Pick<
  QueueRow,
  | "id" | "reference" | "complainant_name" | "customer_ref" | "category" | "product" | "country_code"
  | "status" | "assigned_to" | "vulnerable" | "priority" | "days_left" | "current_due" | "ack_due" | "received_at"
>;

export interface QueuePage {
  rows: QueueItem[];
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
  neq(c: string, v: string): this;
  eq(c: string, v: string | boolean): this;
  is(c: string, v: null): this;
  in(c: string, v: readonly string[]): this;
  gte(c: string, v: number | string): this;
  not(c: string, op: string, v: null): this;
  lte(c: string, v: number): this;
  lt(c: string, v: string | number): this;
  or(f: string): this;
}

/** Applies tab, column filters and text search shared by the page and count queries. */
function applyFilters<Q extends QueueFilterable>(q: Q, p: QueueParams): Q {
  if(p.workload&&p.workload_date){for(const op of workloadOps(p.workload,p.workload_date)){
    if(op.op==='neq')q=q.neq(op.column,String(op.value));else if(op.op==='lt')q=q.lt(op.column,String(op.value));else if(op.op==='eq')q=q.eq(op.column,op.value);
  }if(p.workload_or)q=q.or(p.workload_or);if(p.workload_from)q=q.gte('received_at',p.workload_from);if(p.workload_until)q=q.lt('received_at',p.workload_until);}
  const tab = p.tab ?? "team";
  if (tab === "mine") q = q.eq("assigned_to", p.userId);
  if (tab === "team") q = q.in("status", CLOCK_RUNNING);
  if (tab === "risk") q = q.in("status", CLOCK_RUNNING).gte("days_left", 0).lte("days_left", 3);
  if (tab === "overdue") q = q.in("status", CLOCK_RUNNING).lt("days_left", 0);
  if (tab === "adr") q = q.eq("status", "escalated_to_adr");
  if (tab === "ack") q = q.eq("status", "received").lt("ack_due", todayISO());
  if (p.report_ids) q = q.in('id', p.report_ids === 'none' ? ['00000000-0000-0000-0000-000000000000'] : p.report_ids.split(','));
  if (p.status) q = q.eq("status", p.status);
  if (p.category) q = q.eq("category", p.category);
  if (p.product) q = q.eq("product", p.product);
  if (p.country) q = q.eq("country_code", p.country);
  if (p.agent) q = p.agent === "none" ? q.is("assigned_to", null) : q.eq("assigned_to", p.agent);
  if (p.vulnerable) q = q.eq("vulnerable", p.vulnerable === "true");
  for (const f of reportFilterOps(p)) {
    if (f.op === 'in') q = q.in(f.col, String(f.v).split(',')); else if (f.op === 'gte') q = q.gte(f.col, String(f.v)); else if (f.op === 'lt') q = q.lt(f.col, String(f.v));
    else if (f.op === 'or') q = q.or(String(f.v)); else if (f.op === 'eq') q = q.eq(f.col, f.v as string | boolean); else if (f.op === 'is_null') q = q.is(f.col, null);
    else if (f.op === 'not_null') q = q.not(f.col, 'is', null); else q = q.or(`${f.col}.is.null,${f.col}.gte.${String(f.v)}`);
  }
  const needle = (p.q ?? "").trim().replace(/[%,_()."\\]/g, " ").trim();
  if (needle) q = q.or(`reference.ilike.%${needle}%,complainant_name.ilike.%${needle}%,customer_ref.ilike.%${needle}%`);
  return q;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function queueSelect(cols:string,p:QueueParams){return p.reopen_from||p.reopen_to||p.reopen_reason ? cols+",complaint_reopenings!inner(reopened_at,reason_category)" : cols;}

async function countRows(orgId: string, p: QueueParams, segment?: readonly Status[]): Promise<number> {
  let q = supabase.from("complaint_queue").select(queueSelect("id",p), { count: "exact", head: true }).eq("org_id", orgId);
  q = applyFilters(q, p);
  if (segment) q = q.in("status", segment);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

export async function fetchQueuePage(orgId: string, p: QueueParams): Promise<QueuePage> {
  // The reopening tab reads paginated requests separately, not the complaints list.
  if (p.tab === 'reopen_requests') return { rows: [], total: 0, page: p.page ?? 1, pageSize: PAGE_SIZE };
  if(p.workload&&p.workload_date){
    const workloadDate=p.workload_date;
    if(p.workload==='soon'){
      const data:{country_code:string;holiday_date:string}[]=[];
      for(let offset=0;;offset+=500){const result=await supabase.from('holidays').select('country_code,holiday_date').eq('org_id',orgId).gte('holiday_date',workloadDate).order('id').range(offset,offset+499);if(result.error)throw result.error;data.push(...result.data);if(result.data.length<500)break;}
      p={...p,workload_or:Object.keys(COUNTRIES).map(country=>`and(country_code.eq.${country},final_due.gte.${p.workload_date},final_due.lte.${nextBusinessDate(p.workload_date??'',3,(data??[]).filter(h=>h.country_code===country).map(h=>h.holiday_date))})`).join(',')};
    }
    if(p.workload==='recent'){
      const {data,error}=await supabase.from('organisations').select('time_zone').eq('id',orgId).single();if(error)throw error;
      const date=new Date(p.workload_date+'T12:00:00Z');date.setUTCDate(date.getUTCDate()-29);
      p={...p,workload_from:auditDateBoundary(date.toISOString().slice(0,10),data.time_zone),workload_until:auditDateBoundary(workloadDate,data.time_zone,true)};
    }
  }
  if(p.day_section&&p.day_date&&p.day_zone)return fetchDaySection(orgId,p.userId,p.day_section,p.day_date,p.day_zone,p.page??1,PAGE_SIZE);
  const size = PAGE_SIZE;
  const sort = p.sort ?? "time_left";
  const dir = p.dir ?? "asc";
  const page = p.page ?? 1;
  if (sort === "time_left") {
    const stopped = stoppedStatuses();
    const [runningCount, stoppedCount] = await Promise.all([countRows(orgId, p, CLOCK_RUNNING), countRows(orgId, p, stopped)]);
    const slices = pageSlices(runningCount, stoppedCount, page, size);
    const parts = await Promise.all(
      slices.map(async (s) => {
        let q = applyFilters(supabase.from("complaint_queue").select(queueSelect(QUEUE_SELECT,p)), p).eq("org_id", orgId);
        q = q.in("status", s.segment === "running" ? CLOCK_RUNNING : stopped);
        const ordered =
          s.segment === "running"
            ? q.order("days_left", { ascending: dir === "asc", nullsFirst: false }).order("id", { ascending: true })
            : q.order("received_at", { ascending: false }).order("id", { ascending: true });
        const { data, error } = await ordered.range(s.from, s.to);
        if (error) throw error;
        return data as unknown as QueueItem[];
      }),
    );
    return { rows: parts.flat(), total: runningCount + stoppedCount, page, pageSize: size };
  }
  let q = applyFilters(supabase.from("complaint_queue").select(queueSelect(QUEUE_SELECT,p), { count: "exact" }), p).eq("org_id", orgId);
  const ordered = q
    .order(SORT_COLUMNS[sort], { ascending: dir === "asc", nullsFirst: false })
    .order("id", { ascending: true });
  const { data, count, error } = await ordered.range((page - 1) * size, page * size - 1);
  if (error) throw error;
  return { rows: data as unknown as QueueItem[], total: count ?? 0, page, pageSize: size };
}

export const queueQuery = (orgId: string, p: QueueParams) =>
  queryOptions({
    queryKey: ["queue", orgId, p],
    queryFn: () => fetchQueuePage(orgId, p),
  });

/** Reuses the exact page filters/order and never silently caps matching selection. */
export async function fetchMatchingQueue(orgId: string, p: QueueParams): Promise<QueueItem[]> {
  const first = await fetchQueuePage(orgId, { ...p, page: 1 });
  const rows = [...first.rows];
  for (let page = 2; page <= Math.ceil(first.total / PAGE_SIZE); page++) {
    rows.push(...(await fetchQueuePage(orgId, { ...p, page })).rows);
  }
  return rows;
}

/** Palette search reuses queue filters, with explicit tenant scope and a hard result cap. */
export const complaintSearchQuery = (orgId: string, userId: string, text: string) => queryOptions({
  queryKey: ['complaint-search', orgId, userId, text],
  queryFn: async () => {
    const { data, error } = await applyFilters(
      supabase.from('complaint_queue').select('id, reference, complainant_name, customer_ref').eq('org_id', orgId),
      { tab: 'all', userId, q: text },
    ).order('reference').limit(8);
    if (error) throw error;
    return data;
  },
});

/** Unfiltered tab badge counts for the queue header. */
export const queueCountsQuery = (orgId: string, userId: string) =>
  queryOptions({
    queryKey: ["queue-counts", orgId, userId],
    queryFn: async () => {
      const base = { userId, q: "", sort: "time_left", dir: "asc", page: 1 } as const;
      const [atRisk, overdue, ackOverdue, total] = await Promise.all([
        countRows(orgId, { ...base, tab: "risk" }),
        countRows(orgId, { ...base, tab: "overdue" }),
        countRows(orgId, { ...base, tab: "ack" }),
        countRows(orgId, { ...base, tab: "all" }),
      ]);
      return { atRisk, overdue, ackOverdue, total };
    },
  });
