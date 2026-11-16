import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCTS, CATEGORIES, CHANNELS } from "./complaints";
import { COUNTRIES } from "./countries";
import type { Database } from "@/integrations/supabase/types";

export type ReportRow = Pick<
  Database["public"]["Tables"]["complaints"]["Row"],
  | "id" | "reference" | "status" | "category" | "product" | "country_code" | "channel"
  | "assigned_to" | "vulnerable" | "outcome" | "redress_amount" | "redress_currency"
  | "goodwill_amount" | "goodwill_currency" | "root_cause_category" | "received_at" | "closed_at"
  | "final_due" | "extended_due" | "holding_sent_at"
>;

const COLS =
  "id, reference, status, category, product, country_code, channel, assigned_to, vulnerable, outcome, redress_amount, redress_currency, goodwill_amount, goodwill_currency, root_cause_category, root_cause_id, received_at, closed_at, final_due, extended_due, holding_sent_at";

export const reportQuery = (orgId: string, from: string, to: string) =>
  queryOptions({
    queryKey: ["report", orgId, from, to],
    queryFn: async () => {
      const {data:causes,error:causeError}=await supabase.from('root_causes').select('id,name').eq('org_id',orgId);
      if(causeError)throw causeError;
      const { data, error } = await supabase
        .from("complaints")
        .select(COLS)
        .eq("org_id", orgId)
        .gte("received_at", from + "T00:00:00Z")
        .lte("received_at", to + "T23:59:59Z")
        .order("received_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return data.map(row=>({...row,root_cause_category:causes.find(c=>c.id===row.root_cause_id)?.name??row.root_cause_category})) as ReportRow[];
    },
  });

const CLOSED: ReportRow["status"][] = ["closed", "final_response_sent", "escalated_to_adr"];

export function isResolved(r: ReportRow) {
  return CLOSED.includes(r.status) || r.closed_at !== null;
}

/** Business days between two ISO dates, excluding weekends (holidays not subtracted). */
export function businessDays(fromIso: string, toIso: string) {
  let d = new Date(fromIso.slice(0, 10) + "T00:00:00Z");
  const end = new Date(toIso.slice(0, 10) + "T00:00:00Z");
  if (end < d) return 0;
  let n = 0;
  while (d < end) {
    d = new Date(d.getTime() + 86400000);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) n++;
  }
  return n;
}

/** A resolved complaint met its deadline if closed on or before the extended due (when a holding response was sent) or the final due date. */
export function resolvedWithinDeadline(r: ReportRow) {
  if (!r.closed_at) return null;
  const due = r.holding_sent_at && r.extended_due ? r.extended_due : r.final_due;
  if (!due) return null;
  return r.closed_at.slice(0, 10) <= due;
}

export type CurrencyTotals = Record<string, number>;

/** Never infer a payment currency from the firm's base currency. */
export function paidByCurrency(rows: ReportRow[]): CurrencyTotals {
  const cents = new Map<string, number>();
  for (const row of rows) {
    for (const [amount, currency] of [[row.redress_amount, row.redress_currency], [row.goodwill_amount, row.goodwill_currency]] as const) {
      if (amount === null || !Number.isFinite(amount) || amount === 0) continue;
      const key = currency?.trim().toUpperCase() || 'Unspecified currency';
      cents.set(key, (cents.get(key) ?? 0) + Math.round(amount * 100));
    }
  }
  return Object.fromEntries([...cents].sort(([a], [b]) => a.localeCompare(b)).map(([currency, value]) => [currency, value / 100]));
}

export function formatCurrencyTotals(totals: CurrencyTotals): string {
  return Object.entries(totals).map(([currency, value]) => `${currency} ${value.toLocaleString('en-GB', { maximumFractionDigits: 2 })}`).join(' · ') || '—';
}

export interface Metrics {
  open: number;
  receivedThisMonth: number;
  closedThisMonth: number;
  withinDeadlinePct: number | null;
  avgBusinessDaysToResolve: number | null;
  upholdRatePct: number | null;
  redressTotal: CurrencyTotals;
  vulnerableCount: number;
  topCategories: [string, number][];
  topRootCauses: [string, number][];
}

export function computeMetrics(rows: ReportRow[], now = new Date()): Metrics {
  const monthStart = now.toISOString().slice(0, 8) + "01";
  const resolved = rows.filter(isResolved);
  const withDeadline = resolved.map((r) => resolvedWithinDeadline(r)).filter((v): v is boolean => v !== null);
  const durations = resolved.flatMap((r) => r.closed_at ? [businessDays(r.received_at, r.closed_at)] : []);
  const withOutcome = rows.filter((r) => r.outcome && r.outcome !== "withdrawn");
  const count = (key: (r: ReportRow) => string | null) => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const k = key(r);
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  return {
    open: rows.filter((r) => !isResolved(r)).length,
    receivedThisMonth: rows.filter((r) => r.received_at.slice(0, 10) >= monthStart).length,
    closedThisMonth: resolved.filter((r) => r.closed_at && r.closed_at.slice(0, 10) >= monthStart).length,
    withinDeadlinePct: withDeadline.length ? Math.round((withDeadline.filter(Boolean).length / withDeadline.length) * 100) : null,
    avgBusinessDaysToResolve: durations.length ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10 : null,
    upholdRatePct: withOutcome.length
      ? Math.round((withOutcome.filter((r) => r.outcome === "upheld" || r.outcome === "partially_upheld").length / withOutcome.length) * 100)
      : null,
    redressTotal: paidByCurrency(rows),
    vulnerableCount: rows.filter((r) => r.vulnerable).length,
    topCategories: count((r) => r.category).slice(0, 5),
    topRootCauses: count((r) => r.root_cause_category).slice(0, 5),
  };
}

export interface BreakdownRow {
  key: string;
  total: number;
  resolved: number;
  withinPct: number | null;
  upheldPct: number | null;
  redress: CurrencyTotals;
}

export function breakdown(rows: ReportRow[], key: (r: ReportRow) => string | null): BreakdownRow[] {
  const groups = new Map<string, ReportRow[]>();
  for (const r of rows) {
    const k = key(r) ?? "—";
    const group = groups.get(k) ?? [];
    group.push(r);
    groups.set(k, group);
  }
  return [...groups.entries()]
    .map(([k, rs]) => {
      const resolved = rs.filter(isResolved);
      const wd = resolved.map((r) => resolvedWithinDeadline(r)).filter((v): v is boolean => v !== null);
      const oc = rs.filter((r) => r.outcome && r.outcome !== "withdrawn");
      return {
        key: k,
        total: rs.length,
        resolved: resolved.length,
        withinPct: wd.length ? Math.round((wd.filter(Boolean).length / wd.length) * 100) : null,
        upheldPct: oc.length
          ? Math.round((oc.filter((r) => r.outcome === "upheld" || r.outcome === "partially_upheld").length / oc.length) * 100)
          : null,
        redress: paidByCurrency(rs),
      };
    })
    .sort((a, b) => b.total - a.total);
}

/** Monthly counts of each root-cause category, for the trend line chart. */
export function rootCauseTrend(rows: ReportRow[]) {
  const months = new Map<string, Record<string, number>>();
  for (const r of rows) {
    if (!r.root_cause_category) continue;
    const m = r.received_at.slice(0, 7);
    if (!months.has(m)) months.set(m, {});
    const rec = months.get(m);
    if (!rec) continue;
    rec[r.root_cause_category] = (rec[r.root_cause_category] ?? 0) + 1;
  }
  return [...months.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, counts]) => ({ month, ...counts }));
}


export const PERIOD_PRESETS = { this_month: 'This month', last_month: 'Last month', this_quarter: 'This quarter', last_quarter: 'Last quarter', h1: 'H1', h2: 'H2', this_year: 'This year', last_year: 'Last year', custom: 'Custom' } as const;
export type PeriodPreset = keyof typeof PERIOD_PRESETS;
export interface PeriodRange { from: string; to: string; unit?: 'quarter' | 'year' }
const DAY = 86400000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const utcDate = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
export function periodRange(preset: PeriodPreset, today: Date | string): PeriodRange {
  const d = new Date(typeof today === 'string' ? today.slice(0, 10) + 'T00:00:00Z' : today);
  const y = d.getUTCFullYear(), m = d.getUTCMonth(), q = Math.floor(m / 3) * 3;
  const span = (month: number, months: number, unit?: PeriodRange['unit']) => ({ from: isoDay(utcDate(y, month, 1)), to: isoDay(utcDate(y, month + months, 0)), ...(unit ? { unit } : {}) });
  switch (preset) {
    case 'this_month': return span(m, 1);
    case 'last_month': return span(m - 1, 1);
    case 'this_quarter': return span(q, 3, 'quarter');
    case 'last_quarter': return span(q - 3, 3, 'quarter');
    case 'h1': return span(0, 6);
    case 'h2': return span(6, 6);
    case 'last_year': return span(-12, 12, 'year');
    case 'this_year': return span(0, 12, 'year');
    default: return { from: isoDay(utcDate(y, 0, 1)), to: isoDay(d) };
  }
}
export function previousPeriod(range: PeriodRange): PeriodRange {
  const start = new Date(range.from + 'T00:00:00Z');
  const end = new Date(range.to + 'T00:00:00Z');
  const to = isoDay(new Date(start.getTime() - DAY));
  const from = range.unit ? isoDay(utcDate(start.getUTCFullYear(), start.getUTCMonth() - (range.unit === 'year' ? 12 : 3), 1)) : isoDay(new Date(start.getTime() - (end.getTime() - start.getTime() + DAY)));
  return { from, to, ...(range.unit ? { unit: range.unit } : {}) };
}
export function comparison(value: number | null, previous: number | null) {
  const absolute = value === null || previous === null ? null : value - previous;
  return { value, previous, absolute, percent: absolute === null || previous === null || previous === 0 ? null : absolute / Math.abs(previous) * 100 };
}
export interface ReportSearch { period?: string; from?: string; to?: string; compare?: boolean }
export function parseReportSearch(s: Record<string, unknown>): ReportSearch {
  return { period: typeof s.period === 'string' ? s.period : undefined, from: typeof s.from === 'string' ? s.from : undefined, to: typeof s.to === 'string' ? s.to : undefined, compare: s.compare === true || s.compare === 'true' };
}
export function selectedPeriod(s: ReportSearch, today: string): PeriodRange {
  const preset = Object.hasOwn(PERIOD_PRESETS, s.period ?? '') ? s.period as PeriodPreset : 'this_year';
  const fallback = periodRange(preset, today);
  const valid = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && isoDay(new Date(v)) === v;
  return preset === 'custom' && valid(s.from) && valid(s.to) && String(s.from) <= String(s.to) ? { from: String(s.from), to: String(s.to) } : fallback;
}
export interface Holiday { country_code: string; holiday_date: string }
export function resolutionDays(row: ReportRow, holidays: Holiday[] = []) {
  if (!row.closed_at) return null;
  const excluded = new Set(holidays.filter(h => h.country_code === row.country_code).map(h => h.holiday_date));
  let days = 0;
  for (let t = Date.parse(row.received_at.slice(0, 10)) + DAY; t <= Date.parse(row.closed_at.slice(0, 10)); t += DAY) {
    const d = new Date(t);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6 && !excluded.has(isoDay(d))) days++;
  }
  return days;
}
export interface RegulatoryTable { title: string; rows: { label: string; count: number; share: number; upheld: number | null; within: number | null }[] }
export interface RegulatoryReport { range: PeriodRange; summary: { label: string; value: number | null; unit?: string }[]; tables: RegulatoryTable[] }
export function regulatoryReport(all: ReportRow[], range: PeriodRange, holidays: Holiday[] = []): RegulatoryReport {
  const eligible = all.filter(r => r.received_at.slice(0, 10) <= range.to);
  const rows = eligible.filter(r => r.received_at.slice(0, 10) >= range.from);
  const resolvedAtEnd = (r: ReportRow) => !!r.closed_at && r.closed_at.slice(0, 10) <= range.to;
  const resolved = rows.filter(resolvedAtEnd);
  const durations = resolved.flatMap(r => { const d = resolutionDays(r, holidays); return d === null ? [] : [d]; }).sort((a, b) => a - b);
  const avg = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
  const mid = Math.floor(durations.length / 2);
  const median = durations.length ? durations.length % 2 ? durations[mid] ?? null : ((durations[mid - 1] ?? 0) + (durations[mid] ?? 0)) / 2 : null;
  const pct = (a: number, b: number) => b ? Math.round(a / b * 1000) / 10 : null;
  const knownDeadline = resolved.filter(r => resolvedWithinDeadline(r) !== null);
  const summary: RegulatoryReport['summary'] = [
    { label: 'Complaints received', value: rows.length }, { label: 'Resolved', value: resolved.length },
    { label: 'Open at period end', value: eligible.filter(r => !resolvedAtEnd(r)).length },
    { label: 'Resolved within deadline', value: pct(knownDeadline.filter(r => resolvedWithinDeadline(r)).length, knownDeadline.length), unit: '%' },
    { label: 'Median days to resolve', value: median, unit: 'business days' }, { label: 'Average days to resolve', value: avg === null ? null : Math.round(avg * 10) / 10, unit: 'business days' },
    ...(['upheld', 'partially_upheld', 'not_upheld', 'withdrawn'] as const).map(outcome => ({ label: outcome.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase()), value: pct(resolved.filter(r => r.outcome === outcome).length, resolved.length), unit: '%' })),
    { label: 'Escalated to ADR', value: rows.filter(r => r.status === 'escalated_to_adr').length },
  ];
  const payment = (kind: 'redress' | 'goodwill') => paidByCurrency(resolved.map(r => ({ ...r, ...(kind === 'redress' ? { goodwill_amount: null } : { redress_amount: null }) })));
  for (const kind of ['redress', 'goodwill'] as const) for (const [currency, value] of Object.entries(payment(kind))) summary.push({ label: `${kind === 'redress' ? 'Redress' : 'Goodwill'} paid — ${currency}`, value, unit: currency });
  const grouping: [string, (r: ReportRow) => string][] = [ ['By product', r => PRODUCTS[r.product] ?? r.product], ['By category', r => CATEGORIES[r.category] ?? r.category], ['By country', r => COUNTRIES[r.country_code] ?? r.country_code], ['By root cause', r => r.root_cause_category ?? 'Not recorded'], ['By channel', r => CHANNELS[r.channel] ?? r.channel] ];
  const tables = grouping.map(([title, key]) => {
    const groups = new Map<string, ReportRow[]>();
    for (const row of rows) { const k = key(row); groups.set(k, [...(groups.get(k) ?? []), row]); }
    return { title, rows: [...groups].map(([label, group]) => {
      const rs = group.filter(resolvedAtEnd), wd = rs.filter(r => resolvedWithinDeadline(r) !== null);
      return { label, count: group.length, share: pct(group.length, rows.length) ?? 0, upheld: pct(rs.filter(r => r.outcome === 'upheld' || r.outcome === 'partially_upheld').length, rs.length), within: pct(wd.filter(r => resolvedWithinDeadline(r)).length, wd.length) };
    }).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)) };
  });
  return { range, summary, tables };
}
export const TABLE_HEADERS = ['Group', 'Count', '% of total', 'Upheld / partial %', 'Within deadline %'];
export function summaryComparison(current: RegulatoryReport, previous?: RegulatoryReport) {
  const labels = [...new Set([...current.summary, ...(previous?.summary ?? [])].map(s => s.label))];
  return labels.map(label => {
    const c = current.summary.find(s => s.label === label), p = previous?.summary.find(s => s.label === label);
    return { label, unit: c?.unit ?? p?.unit, ...comparison(c?.value ?? (label.includes(' paid — ') ? 0 : null), p?.value ?? (label.includes(' paid — ') ? 0 : null)) };
  });
}
export function regulatoryCsvRows(report: RegulatoryReport, previous?: RegulatoryReport): (string | number)[][] {
  const output: (string | number)[][] = [['Regulatory reporting pack'], ['Period', report.range.from, report.range.to], ...(previous ? [['Previous period', previous.range.from, previous.range.to]] : []), [], ['Summary'], ['Metric', 'Value', 'Unit', ...(previous ? ['Previous', 'Absolute change', '% change'] : [])]];
  for (const s of summaryComparison(report, previous)) output.push([s.label, s.value ?? 'n/a', s.unit ?? '', ...(previous ? [s.previous ?? 'n/a', s.absolute ?? 'n/a', s.percent ?? 'n/a'] : [])]);
  for (const t of report.tables) { output.push([], [t.title], TABLE_HEADERS); if (!t.rows.length) output.push(['No complaints in this period']); for (const r of t.rows) output.push([r.label, r.count, r.share, r.upheld ?? 'n/a', r.within ?? 'n/a']); }
  return output;
}

/** Paginated, org-scoped history: no silent report row cap. */
export const regulatoryQuery = (orgId: string, end: string) => queryOptions({
  queryKey: ['regulatory-report', orgId, end],
  queryFn: async () => {
    const fetchPages = async <T,>(fetchPage: (offset: number) => PromiseLike<{ data: T[] | null; error: unknown }>) => {
      const rows: T[] = [];
      for (let offset = 0; ; offset += 500) { const { data, error } = await fetchPage(offset); if (error) throw error; rows.push(...(data ?? [])); if ((data?.length ?? 0) < 500) break; }
      return rows;
    };
    const [rows, causes, events, holidays] = await Promise.all([
      fetchPages(offset => supabase.from('complaints').select(COLS).eq('org_id', orgId).lt('received_at', isoDay(new Date(Date.parse(end) + DAY)) + 'T00:00:00Z').order('id').range(offset, offset + 499)),
      fetchPages(offset => supabase.from('root_causes').select('id,name').eq('org_id', orgId).order('id').range(offset, offset + 499)),
      fetchPages(offset => supabase.from('complaint_events').select('complaint_id,created_at,detail').eq('org_id', orgId).eq('kind', 'status').order('created_at').order('id').range(offset, offset + 499)),
      fetchPages(offset => supabase.from('holidays').select('country_code,holiday_date').eq('org_id', orgId).order('id').range(offset, offset + 499)),
    ]);
    const projected = rows.map(row => {
      const history = events.filter(e => e.complaint_id === row.id && e.created_at.slice(0, 10) <= end);
      const statusOf = (e: typeof events[number], key: string) => e.detail && typeof e.detail === 'object' && !Array.isArray(e.detail) ? String(e.detail[key] ?? '') : '';
      const latest = history.at(-1);
      const future = events.find(e => e.complaint_id === row.id && e.created_at.slice(0, 10) > end);
      const status = (latest ? statusOf(latest, 'after') : future ? statusOf(future, 'before') : row.status) as ReportRow['status'];
      const resolved = CLOSED.includes(status);
      let lastReopened = -1; history.forEach((e, i) => { if (statusOf(e, 'after') === 'reopened') lastReopened = i; });
      const resolution = history.slice(lastReopened + 1).find(e => CLOSED.includes(statusOf(e, 'after') as ReportRow['status']));
      return { ...row, status, closed_at: resolved ? resolution?.created_at ?? (row.closed_at && row.closed_at.slice(0, 10) <= end ? row.closed_at : null) : null, root_cause_category: causes.find(c => c.id === row.root_cause_id)?.name ?? row.root_cause_category };
    });
    return { rows: projected as ReportRow[], holidays };
  },
});
