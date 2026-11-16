import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
    const rec = months.get(m)!;
    rec[r.root_cause_category] = (rec[r.root_cause_category] ?? 0) + 1;
  }
  return [...months.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, counts]) => ({ month, ...counts }));
}
