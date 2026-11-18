import { adjustmentShares } from './vulnerability';
import { acknowledgedAt, responseDate, responseMetrics, RESPONSE_METHODOLOGY, type ResponseLetter, type ResponseEvent } from './response-metrics';
import {REOPEN_REASONS,reopeningMetrics,type ReopeningRow} from './reopening';
import { ADR_DECISIONS, adrMetrics, type AdrReportRow } from './adr';
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PRODUCTS, CATEGORIES, CHANNELS } from "./complaints";
import { COUNTRIES } from "./countries";
import type { QueueSearch } from "./queue";
import type { Database } from "@/integrations/supabase/types";

export type ReportRow = Pick<
  Database["public"]["Tables"]["complaints"]["Row"],
  | "id" | "reference" | "status" | "category" | "product" | "country_code" | "channel"
  | "assigned_to" | "vulnerable" | "outcome" | "redress_amount" | "redress_currency"
  | "goodwill_amount" | "goodwill_currency" | "root_cause_category" | "received_at" | "closed_at"
  | "final_due" | "extended_due" | "holding_sent_at"
> & { root_cause_id?: string | null | undefined; ack_due?: string | null; acknowledged_at?: string | null; holding_letters?: string[]; support_adjustments?: string[]|null };

const COLS =
  "id, reference, status, category, product, country_code, channel, assigned_to, vulnerable, outcome, redress_amount, redress_currency, goodwill_amount, goodwill_currency, root_cause_category, root_cause_id, received_at, closed_at, final_due, extended_due, holding_sent_at, ack_due";

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
export interface ReportSearch { period?: string | undefined; from?: string | undefined; to?: string | undefined; compare?: boolean | undefined }
export function parseReportSearch(s: Record<string, unknown>): ReportSearch {
  return { period: typeof s['period'] === 'string' ? s['period'] : undefined, from: typeof s['from'] === 'string' ? s['from'] : undefined, to: typeof s['to'] === 'string' ? s['to'] : undefined, compare: s['compare'] === true || s['compare'] === 'true' };
}
export function selectedPeriod(s: ReportSearch, today: string): PeriodRange {
  const preset = Object.hasOwn(PERIOD_PRESETS, s['period'] ?? '') ? s['period'] as PeriodPreset : 'this_year';
  const fallback = periodRange(preset, today);
  const valid = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && isoDay(new Date(v)) === v;
  return preset === 'custom' && valid(s['from']) && valid(s['to']) && String(s['from']) <= String(s['to']) ? { from: String(s['from']), to: String(s['to']) } : fallback;
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
export interface RegulatoryReport { range: PeriodRange; summary: { label: string; value: number | null; unit?: string }[]; tables: RegulatoryTable[]; methodology?: string[]; qaTables?: { title: string; headers: string[]; rows: (string | number)[][] }[]; responseTables?: { title: string; headers: string[]; rows: (string | number)[][] }[] }
export function regulatoryReport(all: ReportRow[], range: PeriodRange, holidays: Holiday[] = [], adr: AdrReportRow[] = [], reopenings: ReopeningRow[] = [], timeZone = 'Europe/Dublin', now = new Date()): RegulatoryReport {
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
    { label: 'Escalated to ADR', value: adrMetrics(adr, range).escalated.length },
    { label: 'ADR decisions', value: adrMetrics(adr, range).decided.length },
    { label: 'ADR overturn rate', value: adrMetrics(adr, range).overturnRate, unit: '%' },
  ];
  summary.push({label:'Complaints with support needs',value:rows.filter(r=>r.vulnerable).length});
  const payment = (kind: 'redress' | 'goodwill') => paidByCurrency(resolved.map(r => ({ ...r, ...(kind === 'redress' ? { goodwill_amount: null } : { redress_amount: null }) })));
  for (const kind of ['redress', 'goodwill'] as const) for (const [currency, value] of Object.entries(payment(kind))) summary.push({ label: `${kind === 'redress' ? 'Redress' : 'Goodwill'} paid — ${currency}`, value, unit: currency });
  const grouping: [string, (r: ReportRow) => string][] = [ ['By product', r => PRODUCTS[r.product] ?? r.product], ['By category', r => CATEGORIES[r.category] ?? r.category], ['By country', r => COUNTRIES[r.country_code] ?? r.country_code], ['By root cause', r => r.root_cause_category ?? 'Not recorded'], ['By channel', r => CHANNELS[r.channel] ?? r.channel], ['By support needs', r=>r.vulnerable?'With support needs':'Without support needs'] ];
  const tables = grouping.map(([title, key]) => {
    const groups = new Map<string, ReportRow[]>();
    for (const row of rows) { const k = key(row); groups.set(k, [...(groups.get(k) ?? []), row]); }
    return { title, rows: [...groups].map(([label, group]) => {
      const rs = group.filter(resolvedAtEnd), wd = rs.filter(r => resolvedWithinDeadline(r) !== null);
      return { label, count: group.length, share: pct(group.length, rows.length) ?? 0, upheld: pct(rs.filter(r => r.outcome === 'upheld' || r.outcome === 'partially_upheld').length, rs.length), within: pct(wd.filter(r => resolvedWithinDeadline(r)).length, wd.length) };
    }).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)) };
  });
  if(rows.some(r=>r.support_adjustments!==undefined))tables.push({title:'By support adjustment',rows:adjustmentShares(rows)});
  const rm=reopeningMetrics(reopenings,range,all.filter(r=>r.closed_at&&r.closed_at.slice(0,10)>=range.from&&r.closed_at.slice(0,10)<=range.to).length);
  summary.push({label:'Reopened',value:rm.count},{label:'Reopen rate',value:rm.rate,unit:'%'});
  tables.push({title:'By reopen reason',rows:Object.entries(REOPEN_REASONS).map(([key,label])=>{const count=new Set(rm.rows.filter(r=>r.reason_category===key).map(r=>r.complaint_id)).size;return {label,count,share:pct(count,rm.count)??0,upheld:null,within:null};}).filter(r=>r.count>0)});
  const am = adrMetrics(adr, range);
  for (const [currency, value] of Object.entries(am.awards)) summary.push({ label: `ADR awards — ${currency}`, value, unit: currency });
  tables.push({ title: 'By ADR outcome', rows: Object.entries(ADR_DECISIONS).filter(([k]) => k !== 'pending').map(([key,label]) => ({label,count:am.decided.filter(a => a.decision === key).length,share:pct(am.decided.filter(a => a.decision === key).length,am.decided.length) ?? 0,upheld:null,within:null})).filter(r => r.count > 0) });
  const response = responseMetrics(all,range,holidays,timeZone,now);
  summary.push({label:'Acknowledged on time',value:response.onTimePct,unit:'%'},{label:'Acknowledgement overdue now',value:response.overdue.length},{label:'Median business days to acknowledge',value:response.median,unit:'business days'},{label:'Holding responses sent',value:response.holdingLetters.length},{label:'% of cases needing a holding response',value:response.holdingPct,unit:'%'},{label:'Resolved after holding response within extended deadline',value:response.extendedPct,unit:'%'});
  const responseTables = (['agent','country'] as const).map(dimension => {
    const groups = new Map<string,ReportRow[]>();
    for(const row of all){const key=dimension==='agent'?row.assigned_to??'Unassigned':row.country_code;groups.set(key,[...(groups.get(key)??[]),row]);}
    return {title:`Acknowledgement and holding metrics by ${dimension}`,headers:['Group','Ack eligible','Ack on time %','Median ack days','Holding letters','Holding cases %','Extended on time %'],rows:[...groups].map(([key,group])=>{const m=responseMetrics(group,range,holidays,timeZone,now);return [key,m.ackCohort.length,m.onTimePct??'n/a',m.median??'n/a',m.holdingLetters.length,m.holdingPct??'n/a',m.extendedPct??'n/a'];})};
  });
  return { range, summary, tables, responseTables, methodology:[...RESPONSE_METHODOLOGY, 'Support adjustment shares use complaints with support needs as the denominator; a case may have several adjustments. Adjustment data is limited to records visible to the reporting user. Drivers and support notes are never included in reports.'] };
}
export const TABLE_HEADERS = ['Group', 'Count', '% of total', 'Upheld / partial %', 'Within deadline %'];
export function summaryComparison(current: RegulatoryReport, previous?: RegulatoryReport) {
  const labels = [...new Set([...current.summary, ...(previous?.summary ?? [])].map(s => s.label))];
  return labels.map(label => {
    const c = current.summary.find(s => s.label === label), p = previous?.summary.find(s => s.label === label);
    return { label, unit: c?.unit ?? p?.unit, ...comparison(c?.value ?? ((label.includes(' paid — ') || label.startsWith('ADR awards — ')) ? 0 : null), (label==='Acknowledgement overdue now'?null:p?.value) ?? ((label.includes(' paid — ') || label.startsWith('ADR awards — ')) ? 0 : null)) };
  });
}
export function regulatoryCsvRows(report: RegulatoryReport, previous?: RegulatoryReport): (string | number)[][] {
  const output: (string | number)[][] = [['Regulatory reporting pack'], ['Period', report.range.from, report.range.to], ...(previous ? [['Previous period', previous.range.from, previous.range.to]] : []), [], ['Summary'], ['Metric', 'Value', 'Unit', ...(previous ? ['Previous', 'Absolute change', '% change'] : [])]];
  for (const s of summaryComparison(report, previous)) output.push([s.label, s.value ?? 'n/a', s.unit ?? '', ...(previous ? [s.previous ?? 'n/a', s.absolute ?? 'n/a', s.percent ?? 'n/a'] : [])]);
  for (const t of report.tables) { output.push([], [t.title], TABLE_HEADERS); if (!t.rows.length) output.push(['No complaints in this period']); for (const r of t.rows) output.push([r.label, r.count, r.share, r.upheld ?? 'n/a', r.within ?? 'n/a']); }
  for(const t of report.responseTables??[]){output.push([],[t.title],[...t.headers,...(previous?['Previous values (same column order)']:[])]);for(const row of t.rows){const prior=previous?.responseTables?.find(p=>p.title===t.title)?.rows.find(p=>p[0]===row[0]);output.push([...row,...(previous?[prior?.slice(1).join(' / ')??'n/a']:[])]);}}
  for(const t of report.qaTables??[]){output.push([],[t.title],[...t.headers,...(previous?['Previous values (same column order)']:[])]);for(const row of t.rows)output.push([...row,...(previous?[previous.qaTables?.find(p=>p.title===t.title)?.rows.find(p=>p[0]===row[0])?.slice(1).join(' / ')??'n/a']:[])]);}
  output.push([],['Response methodology'],...(report.methodology??[]).map(text=>[text]));
  return output;
}

/** Paginated, org-scoped history: no silent report row cap. */
export const regulatoryQuery = (orgId: string, end: string, timeZone = 'Europe/Dublin') => queryOptions({
  queryKey: ['regulatory-report', orgId, end, timeZone],
  queryFn: async () => {
    const fetchPages = async <T,>(fetchPage: (offset: number) => PromiseLike<{ data: T[] | null; error: unknown }>) => {
      const rows: T[] = [];
      for (let offset = 0; ; offset += 500) { const { data, error } = await fetchPage(offset); if (error) throw error; rows.push(...(data ?? [])); if ((data?.length ?? 0) < 500) break; }
      return rows;
    };
    const [rows, causes, events, holidays, adr, reopenings, letters, support] = await Promise.all([
      fetchPages(offset => supabase.from('complaints').select(COLS).eq('org_id', orgId).order('id').range(offset, offset + 499)),
      fetchPages(offset => supabase.from('root_causes').select('id,name').eq('org_id', orgId).order('id').range(offset, offset + 499)),
      fetchPages(offset => supabase.from('complaint_events').select('complaint_id,created_at,detail').eq('org_id', orgId).eq('kind', 'status').order('created_at').order('id').range(offset, offset + 499)),
      fetchPages(offset => supabase.from('holidays').select('country_code,holiday_date').eq('org_id', orgId).order('id').range(offset, offset + 499)),
      fetchPages(offset => supabase.from('adr_cases').select('complaint_id,escalated_on,decision,decision_on,award_amount,award_currency').eq('org_id',orgId).lte('escalated_on',end).order('id').range(offset,offset+499)),
      fetchPages(offset=>supabase.from('complaint_reopenings').select('complaint_id,reopened_at,reason_category').eq('org_id',orgId).lt('reopened_at',isoDay(new Date(Date.parse(end)+DAY))+'T00:00:00Z').order('id').range(offset,offset+499)),
      fetchPages(offset=>supabase.from('letters').select('complaint_id,kind,sent_at').eq('org_id',orgId).eq('status','sent').in('kind',['acknowledgement','holding']).order('id').range(offset,offset+499)),
      fetchPages(offset=>supabase.from('complaint_vulnerability').select('complaint_id,adjustments').eq('org_id',orgId).order('id').range(offset,offset+499)),
    ]);
    const projected = rows.map(row => {
      const history = events.filter(e => e.complaint_id === row.id && responseDate(e.created_at,timeZone) <= end);
      const statusOf = (e: typeof events[number], key: string) => e.detail && typeof e.detail === 'object' && !Array.isArray(e.detail) ? String(e.detail[key] ?? '') : '';
      const latest = history.at(-1);
      const future = events.find(e => e.complaint_id === row.id && responseDate(e.created_at,timeZone) > end);
      const status = (latest ? statusOf(latest, 'after') : future ? statusOf(future, 'before') : row.status) as ReportRow['status'];
      const resolved = CLOSED.includes(status);
      let lastReopened = -1; history.forEach((e, i) => { if (statusOf(e, 'after') === 'reopened') lastReopened = i; });
      const resolution = history.slice(lastReopened + 1).find(e => CLOSED.includes(statusOf(e, 'after') as ReportRow['status']));
      return { ...row, support_adjustments:support.find(s=>s.complaint_id===row.id)?.adjustments, acknowledged_at:acknowledgedAt(row.id,letters as ResponseLetter[],events as ResponseEvent[]), holding_letters:letters.filter(l=>l.complaint_id===row.id && l.kind==='holding' && l.sent_at).map(l=>String(l.sent_at)), status, closed_at: resolved ? resolution?.created_at ?? (row.closed_at && row.closed_at.slice(0, 10) <= end ? row.closed_at : null) : null, root_cause_category: causes.find(c => c.id === row.root_cause_id)?.name ?? row.root_cause_category };
    });
    return { rows: projected as ReportRow[], holidays, adr, reopenings };
  },
});

/** Drill-downs use receipt cohorts; snapshot IDs preserve historical status membership. */
export function buildDrillDownSearch(metric: string, group: string | undefined, range: PeriodRange): QueueSearch {
  const s: QueueSearch = { tab: 'all', received_from: range.from, received_to: range.to };
  if (metric === 'Open at period end' || metric === 'open') { s.received_from = undefined; s.resolved = 'no'; }
  if (['Resolved', 'Median days to resolve', 'Average days to resolve', 'resolved'].includes(metric) || metric.includes(' paid — ')) s.resolved = 'yes';
  if (metric === 'Resolved within deadline' || metric === 'within') { s.resolved = 'yes'; s.within_deadline = 'yes'; }
  if(metric==='Complaints with support needs')s.vulnerable='true';
  if(metric==='By support needs')s.vulnerable=group==='With support needs'?'true':'false';
  const outcome = ({ Upheld: 'upheld', 'Partially upheld': 'partially_upheld', 'Not upheld': 'not_upheld', Withdrawn: 'withdrawn' } as Record<string, string>)[metric];
  if (outcome) { s.outcome = outcome; s.resolved = 'yes'; }
  if (metric === 'Escalated to ADR' || metric.startsWith('ADR ') || metric === 'By ADR outcome') {
    s.received_from = undefined; s.received_to = undefined; s.adr_from = range.from; s.adr_to = range.to;
    s.adr_metric = metric === 'Escalated to ADR' ? 'escalated' : metric === 'ADR overturn rate' ? 'overturned' : 'decided';
    if (metric === 'By ADR outcome' && group) s.adr_decision = Object.entries(ADR_DECISIONS).find(([,label])=>label===group)?.[0];
    if (metric.startsWith('ADR awards — ')) s.adr_currency = metric.slice('ADR awards — '.length);
  }
  if(['Reopened','Reopen rate','By reopen reason'].includes(metric)){s.received_from=undefined;s.received_to=undefined;s.reopened='yes';s.reopen_from=range.from;s.reopen_to=range.to;if(group)s.reopen_reason=Object.entries(REOPEN_REASONS).find(([,v])=>v===group)?.[0];}
  const dimensions: Record<string, keyof QueueSearch> = { 'By product': 'product', 'By category': 'category', 'By country': 'country', 'By channel': 'channel', 'By root cause': 'root_cause', 'By agent': 'agent' };
  const dimension = dimensions[metric];
  if (dimension && group !== undefined) {
    const labels: Record<string, Record<string, string>> = { 'By product': PRODUCTS, 'By category': CATEGORIES, 'By country': COUNTRIES, 'By channel': CHANNELS };
    const value = Object.entries(labels[metric] ?? {}).find(([, label]) => label === group)?.[0] ?? group;
    Object.assign(s, { [dimension]: value });
  }
  return s;
}
export function matchesReportFilters(r: ReportRow, s: QueueSearch): boolean {
  if (s.adr_metric && !evalFilterOps(r as unknown as Record<string, unknown>, reportFilterOps(s))) return false;
  const date = r.received_at.slice(0, 10);
  const resolved = !!r.closed_at && (!s.received_to || r.closed_at.slice(0, 10) <= s.received_to);
  return (!s.received_from || date >= s.received_from) && (!s.received_to || date <= s.received_to)
    && (!s.resolved || resolved === (s.resolved === 'yes'))
    && (!s.within_deadline || (resolved && resolvedWithinDeadline(r) === (s.within_deadline === 'yes')))
    && (!s.outcome || r.outcome === s.outcome) && (!s.status || r.status === s.status)
    && (!s.root_cause || (UUID.test(s.root_cause) ? r.root_cause_id === s.root_cause : (r.root_cause_category ?? 'Not recorded') === s.root_cause))
    && (!s.product || r.product === s.product) && (!s.category || r.category === s.category)
    && (!s.country || r.country_code === s.country) && (!s.channel || r.channel === s.channel)
    && (!s.vulnerable || r.vulnerable===(s.vulnerable==='true'))
    && (!s.agent || (r.assigned_to ?? 'none') === s.agent);
}
export function drillDownRows(rows: ReportRow[], metric: string, group: string | undefined, range: PeriodRange) {
  const s = buildDrillDownSearch(metric, group, range);
  return rows.filter(r => matchesReportFilters(r, s)).filter(r => {
    if (!metric.includes(' paid — ')) return true;
    const [kind, currency] = metric.split(' paid — ');
    const amount = kind === 'Redress' ? r.redress_amount : r.goodwill_amount;
    const recorded = kind === 'Redress' ? r.redress_currency : r.goodwill_currency;
    return !!amount && (recorded?.trim().toUpperCase() || 'Unspecified currency') === currency;
  });
}
export function reportBuckets(range: PeriodRange) {
  const weekly = (Date.parse(range.to) - Date.parse(range.from)) / DAY < 100;
  const buckets: { from: string; to: string; label: string }[] = [];
  for (let from = range.from; from <= range.to;) {
    const d = new Date(from + 'T00:00:00Z');
    const next = weekly ? isoDay(new Date(d.getTime() + 7 * DAY)) : isoDay(utcDate(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
    const to = [isoDay(new Date(Date.parse(next) - DAY)), range.to].sort()[0] ?? range.to;
    buckets.push({ from, to, label: weekly ? from : from.slice(0, 7) }); from = next;
  }
  return { unit: weekly ? 'week' : 'month', buckets };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const nextDay = (d: string) => new Date(Date.parse(d) + DAY).toISOString().slice(0, 10);
/** Server-side filter operations on complaint_queue equivalent to matchesReportFilters (status/product/category/country/agent are applied by the queue's existing filters). */
export type FilterOp = { op: 'gte' | 'lt' | 'eq' | 'is_null' | 'not_null' | 'null_or_gte' | 'in'; col: string; v?: string | boolean };
export function reportFilterOps(s: QueueSearch): FilterOp[] {
  const ops: FilterOp[] = [];
  if(s.holding)ops.push({op:s.holding==='yes'?'not_null':'is_null',col:'holding_sent_at'});
  if(s.holding_by)ops.push({op:'lt',col:'holding_sent_at',v:s.holding_by});
  if(s.receipt_start)ops.push({op:'gte',col:'received_at',v:s.receipt_start});
  if(s.receipt_end)ops.push({op:'lt',col:'received_at',v:s.receipt_end});
  if(s.reopened)ops.push({op:'eq',col:'has_reopened',v:s.reopened==='yes'});
  if(s.reopen_from)ops.push({op:'gte',col:'complaint_reopenings.reopened_at',v:s.reopen_from});
  if(s.reopen_to)ops.push({op:'lt',col:'complaint_reopenings.reopened_at',v:nextDay(s.reopen_to)});
  if(s.reopen_reason)ops.push({op:'eq',col:'complaint_reopenings.reason_category',v:s.reopen_reason});
  if (s.adr_metric) {
    const col = s.adr_metric === 'escalated' ? 'adr_escalated_on' : 'adr_decision_on';
    ops.push({op:'not_null',col});
    if(s.adr_from) ops.push({op:'gte',col,v:s.adr_from});
    if(s.adr_to) ops.push({op:'lt',col,v:nextDay(s.adr_to)});
    if(s.adr_metric === 'overturned') ops.push({op:'in',col:'adr_decision',v:'overturned,partially_overturned'});
    if(s.adr_decision) ops.push({op:'eq',col:'adr_decision',v:s.adr_decision});
    if(s.adr_currency) {ops.push({op:'eq',col:'adr_award_currency',v:s.adr_currency});ops.push({op:'not_null',col:'adr_award_amount'});}
  }
  if (s.received_from) ops.push({ op: 'gte', col: 'received_at', v: s.received_from });
  if (s.received_to) ops.push({ op: 'lt', col: 'received_at', v: nextDay(s.received_to) });
  const resolved = s.within_deadline ? 'yes' : s.resolved;
  if (resolved === 'yes') { ops.push({ op: 'not_null', col: 'closed_at' }); if (s.received_to) ops.push({ op: 'lt', col: 'closed_at', v: nextDay(s.received_to) }); }
  if (resolved === 'no') ops.push(s.received_to ? { op: 'null_or_gte', col: 'closed_at', v: nextDay(s.received_to) } : { op: 'is_null', col: 'closed_at' });
  if (s.within_deadline) ops.push({ op: 'eq', col: 'resolved_within_deadline', v: s.within_deadline === 'yes' });
  if (s.outcome) ops.push({ op: 'eq', col: 'outcome', v: s.outcome });
  if (s.channel) ops.push({ op: 'eq', col: 'channel', v: s.channel });
  if (s.root_cause) {
    if (UUID.test(s.root_cause)) ops.push({ op: 'eq', col: 'root_cause_id', v: s.root_cause });
    else { ops.push({ op: 'is_null', col: 'root_cause_id' }); ops.push(s.root_cause === 'Not recorded' ? { op: 'is_null', col: 'root_cause_category' } : { op: 'eq', col: 'root_cause_category', v: s.root_cause }); }
  }
  return ops;
}
/** Reference evaluation of reportFilterOps against a row shaped like complaint_queue (used by tests). */
export function evalFilterOps(row: Record<string, unknown>, ops: FilterOp[]) {
  return ops.every(({ op, col, v }) => {
    const x = row[col] as string | boolean | null | undefined;
    if (op === 'in') return String(v).split(',').includes(String(x));
    if (op === 'is_null') return x == null; if (op === 'not_null') return x != null;
    if (op === 'eq') return x === v;
    if (x == null) return op === 'null_or_gte';
    return op === 'lt' ? String(x) < String(v) : String(x) >= String(v);
  });
}
export const SNAPSHOT_CAP = 150;
/** Drill-down link: filters only, plus snapshot IDs solely for historical period-end status (capped), else a current-status note. */
export function buildReportLink(rows: ReportRow[], metric: string, group: string | undefined, range: PeriodRange, today = new Date().toISOString().slice(0, 10)): QueueSearch {
  const s = buildDrillDownSearch(metric, group, range);
  if (metric === 'By root cause' && group) { const id = rows.find(r => r.root_cause_id && r.root_cause_category === group)?.root_cause_id; if (id) s.root_cause = id; }
  if ((metric === 'Open at period end' || metric === 'open') && range.to < today) {
    const ids = drillDownRows(rows, metric, group, range).map(r => r.id);
    if (ids.length <= SNAPSHOT_CAP) return { ...s, report_ids: ids.join(',') || 'none' };
    return { ...s, report_basis: 'current' };
  }
  return s;
}
