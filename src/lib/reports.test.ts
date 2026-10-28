import { describe, expect, it } from "vitest";
import { breakdown, businessDays, computeMetrics, resolvedWithinDeadline, rootCauseTrend, paidByCurrency, formatCurrencyTotals, type ReportRow } from "./reports";

const row = (over: Partial<ReportRow>): ReportRow => ({
  id: "1", reference: "RDR-2026-000001", status: "received", category: "fees_and_charges", product: "card",
  country_code: "FR", channel: "email", assigned_to: null, vulnerable: false, outcome: null,
  redress_amount: null, redress_currency: null, goodwill_amount: null, goodwill_currency: null, root_cause_category: null,
  received_at: "2026-10-01T09:00:00Z", closed_at: null, final_due: "2026-10-22", extended_due: null,
  holding_sent_at: null, ...over,
});

describe("businessDays", () => {
  it("excludes weekends", () => {
    // Thu 1 Oct 2026 → Mon 5 Oct 2026 = Fri + Mon = 2 business days
    expect(businessDays("2026-10-01T09:00:00Z", "2026-10-05T09:00:00Z")).toBe(2);
  });
  it("same day is zero", () => expect(businessDays("2026-10-01", "2026-10-01")).toBe(0));
});

describe("resolvedWithinDeadline", () => {
  it("true when closed on or before final due", () => {
    expect(resolvedWithinDeadline(row({ closed_at: "2026-10-20T10:00:00Z" }))).toBe(true);
    expect(resolvedWithinDeadline(row({ closed_at: "2026-10-23T10:00:00Z" }))).toBe(false);
  });
  it("uses the extended deadline when a holding response was sent", () => {
    const r = row({ closed_at: "2026-11-10T10:00:00Z", holding_sent_at: "2026-10-10T10:00:00Z", extended_due: "2026-11-20" });
    expect(resolvedWithinDeadline(r)).toBe(true);
  });
  it("is null for open complaints", () => expect(resolvedWithinDeadline(row({}))).toBeNull());
});

describe("computeMetrics", () => {
  const now = new Date("2026-10-18T00:00:00Z");
  const rows = [
    row({ id: "a", status: "closed", closed_at: "2026-10-10T10:00:00Z", outcome: "upheld", redress_amount: 100, redress_currency: "EUR", vulnerable: true, root_cause_category: "pricing" }),
    row({ id: "b", status: "closed", closed_at: "2026-11-01T10:00:00Z", outcome: "not_upheld", root_cause_category: "pricing" }),
    row({ id: "c", status: "under_investigation" }),
  ];
  const m = computeMetrics(rows, now);
  it("counts open and this-month figures", () => {
    expect(m.open).toBe(1);
    expect(m.receivedThisMonth).toBe(3);
    expect(m.closedThisMonth).toBe(2);
  });
  it("computes within-deadline %, uphold rate and redress", () => {
    expect(m.withinDeadlinePct).toBe(50);
    expect(m.upholdRatePct).toBe(50);
    expect(m.redressTotal).toEqual({ EUR: 100 });
    expect(m.vulnerableCount).toBe(1);
  });
  it("ranks top categories and root causes", () => {
    expect(m.topCategories[0]).toEqual(["fees_and_charges", 3]);
    expect(m.topRootCauses[0]).toEqual(["pricing", 2]);
  });
});

describe("breakdown", () => {
  it("groups and sorts by total", () => {
    const rows = [row({ product: "card" }), row({ product: "card" }), row({ product: "card", status: "closed", closed_at: "2026-10-05T10:00:00Z" }), row({ product: "card" }), row({ product: "card" }), row({ product: "card" }), row({ product: "card" }), row({ product: "card" }), row({ product: "card" }), row({ product: "card" }), row({ product: "payment_account" })];
    const b = breakdown(rows, (r) => r.product);
    expect(b[0]!.key).toBe("card");
    expect(b[0]!.total).toBe(10);
    expect(b[0]!.withinPct).toBe(100);
    expect(b[1]!.key).toBe("payment_account");
  });
});

describe("rootCauseTrend", () => {
  it("buckets by month", () => {
    const rows = [
      row({ root_cause_category: "pricing", received_at: "2026-09-05T09:00:00Z" }),
      row({ root_cause_category: "pricing", received_at: "2026-10-01T09:00:00Z" }),
    ];
    expect(rootCauseTrend(rows)).toEqual([
      { month: "2026-09", pricing: 1 },
      { month: "2026-10", pricing: 1 },
    ]);
  });
});

describe('per-currency payments', () => {
  const rows = [
    row({ redress_amount: 1000, redress_currency: 'EUR', goodwill_amount: 3500, goodwill_currency: 'PLN' }),
    row({ redress_amount: 240, redress_currency: 'EUR', goodwill_amount: 12.25, goodwill_currency: 'GBP' }),
  ];
  it('keeps unlike redress and goodwill currencies separate, including on one case', () => {
    expect(paidByCurrency(rows)).toEqual({ EUR: 1240, GBP: 12.25, PLN: 3500 });
  });
  it('uses the same currency totals in dashboard and every breakdown group', () => {
    expect(computeMetrics(rows).redressTotal).toEqual({ EUR: 1240, GBP: 12.25, PLN: 3500 });
    expect(breakdown(rows, r => r.product)[0]?.redress).toEqual({ EUR: 1240, GBP: 12.25, PLN: 3500 });
  });
  it('does not infer missing goodwill currency from redress currency', () => {
    expect(paidByCurrency([row({ redress_amount: 10, redress_currency: 'EUR', goodwill_amount: 20 })])).toEqual({ EUR: 10, 'Unspecified currency': 20 });
  });
  it('retains decimals without floating-point drift', () => {
    expect(paidByCurrency([row({ redress_amount: 0.1, redress_currency: 'EUR', goodwill_amount: 0.2, goodwill_currency: 'EUR' })])).toEqual({ EUR: 0.3 });
  });
  it('formats labelled figures for display and export without conversion', () => {
    expect(formatCurrencyTotals({ EUR: 1240, PLN: 3500 })).toBe('EUR 1,240 · PLN 3,500');
    expect(paidByCurrency([row({})])).toEqual({});
  });
});
