import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, FileText } from "lucide-react";
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { membershipQuery, useMembership } from "@/lib/org";
import { membersQuery, CATEGORIES, PRODUCTS, CHANNELS } from "@/lib/complaints";
import { COUNTRIES } from "@/lib/countries";
import { reportQuery, computeMetrics, breakdown, rootCauseTrend, type ReportRow } from "@/lib/reports";
import { downloadFile, toCsv } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/reports")({
  loader: async ({ context }) => {
    const m = await context.queryClient.ensureQueryData(membershipQuery);
    await context.queryClient.ensureQueryData(membersQuery(m!.org!.id));
  },
  head: () => ({ meta: [{ title: "Reports — Redress" }, { name: "description", content: "Complaints dashboard, breakdowns and the regulatory reporting pack." }, { property: "og:title", content: "Reports — Redress" }, { property: "og:description", content: "Complaints dashboard, breakdowns and the regulatory reporting pack." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Reports,
});

const countryName = (code: string) => COUNTRIES.find((c) => c.code === code)?.name ?? code;
const OUTCOMES: Record<string, string> = { upheld: "Upheld", partially_upheld: "Partially upheld", not_upheld: "Not upheld", withdrawn: "Withdrawn" };
const CHART_COLORS = ["#0F766E", "#14213D", "#D97706", "#B91C1C", "#15803D", "#6B7280"];

function Reports() {
  const m = useMembership()!;
  const orgId = m.org!.id;
  const { data: members } = useSuspenseQuery(membersQuery(orgId));
  const nameOf = (u: string | null) => (u ? members.find((x) => x.user_id === u)?.name ?? "Former user" : "Unassigned");

  const today = new Date().toISOString().slice(0, 10);
  const yearStart = today.slice(0, 4) + "-01-01";
  const [from, setFrom] = useState(yearStart);
  const [to, setTo] = useState(today);
  const [dim, setDim] = useState<"product" | "category" | "country" | "channel" | "agent">("product");

  const { data: rows = [], isLoading } = useQuery(reportQuery(orgId, from, to));
  const metrics = useMemo(() => computeMetrics(rows), [rows]);
  const dimKey = (r: ReportRow) =>
    dim === "product" ? PRODUCTS[r.product] : dim === "category" ? CATEGORIES[r.category] : dim === "country" ? countryName(r.country_code) : dim === "channel" ? CHANNELS[r.channel] : nameOf(r.assigned_to);
  const bd = useMemo(() => breakdown(rows, dimKey), [rows, dim, members]);
  const trend = useMemo(() => rootCauseTrend(rows), [rows]);
  const trendKeys = useMemo(() => [...new Set(rows.map((r) => r.root_cause_category).filter((k): k is string => !!k))].slice(0, 6), [rows]);

  const allowed = m.role === "org_admin" || m.role === "complaints_manager" || m.role === "read_only";
  if (!allowed) return <p className="text-muted-foreground">You do not have access to reports.</p>;

  function packRows() {
    const out: (string | number)[][] = [["Regulatory reporting pack", m.org!.legal_name], [`Period: ${from} to ${to}`, ""], []];
    out.push(["By product and category", "", "", "", "", ""]);
    out.push(["Product", "Category", "Total", "Upheld", "Partially upheld", "Not upheld", "Withdrawn", "Within deadline %", "Redress + goodwill"]);
    for (const p of Object.keys(PRODUCTS)) {
      for (const c of Object.keys(CATEGORIES)) {
        const rs = rows.filter((r) => r.product === p && r.category === c);
        if (!rs.length) continue;
        const b = breakdown(rs, () => "x")[0];
        const count = (o: string) => rs.filter((r) => r.outcome === o).length;
        out.push([PRODUCTS[p as keyof typeof PRODUCTS], CATEGORIES[c as keyof typeof CATEGORIES], rs.length, count("upheld"), count("partially_upheld"), count("not_upheld"), count("withdrawn"), b.withinPct ?? "", b.redress]);
      }
    }
    return out;
  }

  function exportPackCsv() {
    downloadFile(`regulatory-pack-${from}-to-${to}.csv`, toCsv(packRows()));
  }

  async function exportPackPdf() {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    let y = 20;
    doc.setFontSize(16);
    doc.text("Regulatory reporting pack", 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.text(`${m.org!.legal_name} — ${from} to ${to}`, 14, y);
    y += 10;
    const lines = packRows().slice(4);
    doc.setFontSize(8);
    for (const line of lines) {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(line.map((v) => String(v)).join("  |  "), 14, y);
      y += 5;
    }
    doc.save(`regulatory-pack-${from}-to-${to}.pdf`);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">Volumes, deadlines, outcomes and root causes for the selected period.</p>
        </div>
        <div className="flex items-end gap-3">
          <div className="space-y-1"><Label className="text-xs">From</Label><Input type="date" className="tabular" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">To</Label><Input type="date" className="tabular" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
      </div>

      {isLoading ? <p className="text-muted-foreground">Loading…</p> : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Open complaints" value={metrics.open} />
            <Stat label="Received this month" value={metrics.receivedThisMonth} />
            <Stat label="Closed this month" value={metrics.closedThisMonth} />
            <Stat label="Resolved within deadline" value={metrics.withinDeadlinePct === null ? "—" : metrics.withinDeadlinePct + "%"} />
            <Stat label="Avg business days to resolve" value={metrics.avgBusinessDaysToResolve ?? "—"} />
            <Stat label="Uphold rate" value={metrics.upholdRatePct === null ? "—" : metrics.upholdRatePct + "%"} />
            <Stat label="Redress + goodwill paid" value={metrics.redressTotal.toLocaleString("en-GB")} />
            <Stat label="Vulnerable customers" value={metrics.vulnerableCount} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Top categories</CardTitle></CardHeader>
              <CardContent>
                {metrics.topCategories.length === 0 ? <p className="text-sm text-muted-foreground">No complaints in this period.</p> : (
                  <ul className="space-y-1.5 text-sm">
                    {metrics.topCategories.map(([k, n]) => (
                      <li key={k} className="flex justify-between"><span>{CATEGORIES[k as keyof typeof CATEGORIES] ?? k}</span><span className="tabular font-medium">{n}</span></li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Top root causes</CardTitle></CardHeader>
              <CardContent>
                {metrics.topRootCauses.length === 0 ? <p className="text-sm text-muted-foreground">No root causes recorded yet.</p> : (
                  <ul className="space-y-1.5 text-sm">
                    {metrics.topRootCauses.map(([k, n]) => (
                      <li key={k} className="flex justify-between"><span className="capitalize">{k.replace(/_/g, " ")}</span><span className="tabular font-medium">{n}</span></li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Root cause trends over time</CardTitle></CardHeader>
            <CardContent>
              {trend.length < 2 ? <p className="text-sm text-muted-foreground">Record root causes on closed complaints across at least two months to see trends.</p> : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" fontSize={12} />
                      <YAxis allowDecimals={false} fontSize={12} />
                      <Tooltip />
                      <Legend />
                      {trendKeys.map((k, i) => (
                        <Line key={k} type="monotone" dataKey={k} name={k.replace(/_/g, " ")} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={false} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Breakdown</CardTitle>
              <Select value={dim} onValueChange={(v) => setDim(v as typeof dim)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="product">By product</SelectItem>
                  <SelectItem value="category">By category</SelectItem>
                  <SelectItem value="country">By country</SelectItem>
                  <SelectItem value="channel">By channel</SelectItem>
                  <SelectItem value="agent">By agent</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4 font-medium">{dim === "agent" ? "Agent" : dim[0].toUpperCase() + dim.slice(1)}</th>
                    <th className="py-2 pr-4 font-medium">Total</th>
                    <th className="py-2 pr-4 font-medium">Resolved</th>
                    <th className="py-2 pr-4 font-medium">Within deadline</th>
                    <th className="py-2 pr-4 font-medium">Upheld / partial</th>
                    <th className="py-2 font-medium">Redress + goodwill</th>
                  </tr>
                </thead>
                <tbody>
                  {bd.map((r) => (
                    <tr key={r.key} className="border-b last:border-0">
                      <td className="py-2.5 pr-4">{r.key}</td>
                      <td className="py-2.5 pr-4 tabular">{r.total}</td>
                      <td className="py-2.5 pr-4 tabular">{r.resolved}</td>
                      <td className="py-2.5 pr-4 tabular">{r.withinPct === null ? "—" : r.withinPct + "%"}</td>
                      <td className="py-2.5 pr-4 tabular">{r.upheldPct === null ? "—" : r.upheldPct + "%"}</td>
                      <td className="py-2.5 tabular">{r.redress.toLocaleString("en-GB")}</td>
                    </tr>
                  ))}
                  {bd.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No complaints in this period.</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Regulatory reporting pack</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <p className="mr-auto max-w-xl text-sm text-muted-foreground">
                Totals by product and category, outcomes, within-deadline percentage and redress paid, for {from} to {to}.
              </p>
              <Button variant="outline" onClick={exportPackCsv} disabled={!rows.length}><Download className="h-4 w-4" /> Export CSV</Button>
              <Button variant="outline" onClick={exportPackPdf} disabled={!rows.length}><FileText className="h-4 w-4" /> Export PDF</Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-2xl font-semibold tabular">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
