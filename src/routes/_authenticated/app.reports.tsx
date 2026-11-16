import { EmptyState } from '@/components/empty-state';
import { TableSkeleton } from '@/components/table-skeleton';
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, FileText } from "lucide-react";
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { membershipQuery, useMembership } from "@/lib/org";
import { membersQuery, CATEGORIES, PRODUCTS, CHANNELS } from "@/lib/complaints";
import { COUNTRIES } from "@/lib/countries";
import { regulatoryQuery, regulatoryReport, regulatoryCsvRows, summaryComparison, PERIOD_PRESETS, parseReportSearch, selectedPeriod, previousPeriod, computeMetrics, breakdown, rootCauseTrend, formatCurrencyTotals, type ReportRow } from "@/lib/reports";
import { loadPdfFont } from '@/lib/pdf-font';
import { toast } from 'sonner';
import { downloadFile, toCsv } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/reports")({
  validateSearch: parseReportSearch,
  loader: async ({ context }) => {
    const m = await context.queryClient.ensureQueryData(membershipQuery);
    if (m?.org) await context.queryClient.ensureQueryData(membersQuery(m.org.id));
  },
  head: () => ({ meta: [{ title: "Reports — Redress" }, { name: "description", content: "Complaints dashboard, breakdowns and the regulatory reporting pack." }, { property: "og:title", content: "Reports — Redress" }, { property: "og:description", content: "Complaints dashboard, breakdowns and the regulatory reporting pack." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  pendingComponent: () => <TableSkeleton columns={6} />,
  component: Reports,
});

const countryName = (code: string) => COUNTRIES[code] ?? code;
const OUTCOMES: Record<string, string> = { upheld: "Upheld", partially_upheld: "Partially upheld", not_upheld: "Not upheld", withdrawn: "Withdrawn" };
const CHART_COLORS = ["#0F766E", "#14213D", "#D97706", "#B91C1C", "#15803D", "#6B7280"];

function Reports() {
  const m = useMembership();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  if (!m?.org) return null;
  return <ReportsContent membership={{...m, org: m.org}} search={search} navigate={navigate} />;
}

function ReportsContent({ membership: m, search, navigate }: { membership: NonNullable<ReturnType<typeof useMembership>> & { org: NonNullable<NonNullable<ReturnType<typeof useMembership>>['org']> }; search: ReturnType<typeof Route.useSearch>; navigate: ReturnType<typeof Route.useNavigate> }) {
  const orgId = m.org.id;
  const { data: members } = useSuspenseQuery(membersQuery(orgId));
  const nameOf = (u: string | null) => (u ? members.find((x) => x.user_id === u)?.name ?? "Former user" : "Unassigned");

  const today = new Date().toISOString().slice(0, 10);
  const range = selectedPeriod(search, today);
  const { from, to } = range;
  const priorRange = previousPeriod(range);
  const [dim, setDim] = useState<"product" | "category" | "country" | "channel" | "agent">("product");
  const currentQuery = useQuery(regulatoryQuery(orgId, to));
  const priorQuery = useQuery({ ...regulatoryQuery(orgId, priorRange.to), enabled: !!search.compare });
  const isLoading = currentQuery.isLoading || (!!search.compare && priorQuery.isLoading);
  const failed = currentQuery.isError || (!!search.compare && priorQuery.isError);
  const allRows = currentQuery.data?.rows ?? [];
  const rows = allRows.filter(r => r.received_at.slice(0, 10) >= from);
  const report = regulatoryReport(allRows, range, currentQuery.data?.holidays);
  const previous = regulatoryReport(priorQuery.data?.rows ?? [], priorRange, priorQuery.data?.holidays);
  const metrics = useMemo(() => computeMetrics(rows), [rows]);
  const updateSearch = (patch: Partial<typeof search>) => { void navigate({ search: prev => ({ ...prev, ...patch }) }); };
  const dimKey = (r: ReportRow) =>
    dim === "product" ? PRODUCTS[r.product] : dim === "category" ? CATEGORIES[r.category] : dim === "country" ? countryName(r.country_code) : dim === "channel" ? CHANNELS[r.channel] : nameOf(r.assigned_to);
  const bd = useMemo(() => breakdown(rows, dimKey), [rows, dim, members]);
  const trend = useMemo(() => rootCauseTrend(rows), [rows]);
  const trendKeys = useMemo(() => [...new Set(rows.map((r) => r.root_cause_category).filter((k): k is string => !!k))].slice(0, 6), [rows]);

  const allowed = m.role === "org_admin" || m.role === "complaints_manager" || m.role === "read_only";
  if (!allowed) return <p className="text-muted-foreground">You do not have access to reports.</p>;

  const summary = summaryComparison(report, search.compare ? previous : undefined);
  function exportPackCsv() {
    downloadFile(`regulatory-pack-${from}-to-${to}.csv`, toCsv(regulatoryCsvRows(report, search.compare ? previous : undefined)));
  }
  async function exportPackPdf() {
    try {
      if (!m.org) return;
      const { regulatoryPackPdf } = await import('@/lib/regulatory-pdf');
      const font = await loadPdfFont();
      regulatoryPackPdf({ name: m.org.legal_name, address: m.org.firm_address, licence: m.org.licence_type, regulator: m.org.regulator, generatedBy: members.find(x => x.user_id === m.user.id)?.name || m.user.email || 'Signed-in user', generatedAt: new Date().toISOString() }, report, font, search.compare ? previous : undefined).save(`regulatory-pack-${from}-to-${to}.pdf`);
    } catch { toast.error('Could not generate the reporting pack. Please try again.'); }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">Volumes, deadlines, outcomes and root causes for the selected period.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1"><Label htmlFor="report-period">Period</Label><Select value={search.period && Object.hasOwn(PERIOD_PRESETS, search.period) ? search.period : 'this_year'} onValueChange={period => updateSearch({ period })}><SelectTrigger id="report-period" className="w-40"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(PERIOD_PRESETS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></div>
          {search.period === 'custom' && <><div className="space-y-1"><Label htmlFor="report-from">From</Label><Input id="report-from" type="date" value={search.from ?? from} onChange={e => updateSearch({ from: e.target.value })} /></div><div className="space-y-1"><Label htmlFor="report-to">To</Label><Input id="report-to" type="date" value={search.to ?? to} onChange={e => updateSearch({ to: e.target.value })} /></div></>}
          <div className="flex items-center gap-2 pb-2"><Switch id="report-compare" checked={!!search.compare} onCheckedChange={compare => updateSearch({ compare })} /><Label htmlFor="report-compare">Compare with previous period</Label></div>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{from} to {to}{search.compare ? ` · Compared with ${priorRange.from} to ${priorRange.to}` : ''}</p>
      <div className="flex flex-wrap gap-3"><Button variant="outline" onClick={exportPackCsv} disabled={isLoading || failed}><Download aria-hidden="true" className="h-4 w-4" /> Export CSV</Button><Button variant="outline" onClick={exportPackPdf} disabled={isLoading || failed}><FileText aria-hidden="true" className="h-4 w-4" /> Export PDF</Button></div>
      {failed && <p role="alert" className="text-destructive">Could not load the reporting period. Please try again.</p>}

      {isLoading ? <TableSkeleton columns={6} /> : failed ? null : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {summary.map(s => <Stat key={s.label} label={s.label} value={s.value === null ? 'n/a' : `${s.value}${s.unit === '%' ? '%' : s.unit ? ` ${s.unit}` : ''}`} comparisonText={search.compare ? `Previous: ${s.previous ?? 'n/a'} · Change: ${s.absolute ?? 'n/a'} (${s.percent === null ? 'n/a' : s.percent.toFixed(1) + '%'})` : undefined} />)}
          </div>
          {!rows.length && <EmptyState icon={FileText} title="No complaints in this period" description="No complaints were received between the selected dates." />}
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
                        <Line key={k} type="monotone" dataKey={k} name={k.replace(/_/g, " ")} stroke={CHART_COLORS[i % CHART_COLORS.length] ?? "#0F766E"} strokeWidth={2} dot={false} />
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
                <SelectTrigger aria-label="Breakdown dimension" className="w-40"><SelectValue /></SelectTrigger>
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
                    <th scope="col" className="py-2 pr-4 font-medium">{{ product: "Product", category: "Category", country: "Country", channel: "Channel", agent: "Agent" }[dim]}</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Total</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Resolved</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Within deadline</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Upheld / partial</th>
                    <th scope="col" className="py-2 font-medium">Redress + goodwill</th>
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
                      <td className="py-2.5 tabular">{formatCurrencyTotals(r.redress)}</td>
                    </tr>
                  ))}
                  {bd.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No complaints in this period.</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>


        </>
      )}
    </div>
  );
}

function Stat({ label, value, comparisonText }: { label: string; value: string | number; comparisonText?: string | undefined }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="break-words text-2xl font-semibold tabular">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
        {comparisonText && <p className="mt-2 break-words text-xs text-muted-foreground">{comparisonText}</p>}
      </CardContent>
    </Card>
  );
}
