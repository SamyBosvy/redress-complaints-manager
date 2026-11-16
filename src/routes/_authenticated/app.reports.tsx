import { responseMetrics } from '@/lib/response-metrics';
import { auditDateBoundary } from '@/lib/audit';
import { firmDate } from '@/lib/reopening';
import { Chart, ReportCharts, reportLink, ViewComplaints } from '@/components/report-charts';
import type { QueueSearch } from '@/lib/queue';
import { EmptyState } from '@/components/empty-state';
import { TableSkeleton } from '@/components/table-skeleton';
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, FileText } from "lucide-react";

import { membershipQuery, useMembership } from "@/lib/org";
import { membersQuery, CATEGORIES, PRODUCTS, CHANNELS } from "@/lib/complaints";
import { COUNTRIES } from "@/lib/countries";
import { regulatoryQuery, regulatoryReport, regulatoryCsvRows, summaryComparison, reportBuckets, PERIOD_PRESETS, parseReportSearch, selectedPeriod, previousPeriod, breakdown, formatCurrencyTotals, type ReportRow } from "@/lib/reports";
import { loadPdfFont } from '@/lib/pdf-font';
import { toast } from 'sonner';
import { downloadFile, toCsv } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { qaReviewsQuery } from '@/lib/qa';
import { qaAnalytics, qaAnalyticsTables, QA_METHODOLOGY } from '@/lib/qa-analytics';

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

  const zone=m.org.time_zone;
  const today = firmDate(new Date(),zone);
  const range = selectedPeriod(search, today);
  const { from, to } = range;
  const priorRange = previousPeriod(range);
  const [dim, setDim] = useState<"product" | "category" | "country" | "channel" | "agent">("product");
  const currentQuery = useQuery(regulatoryQuery(orgId, to, zone));
  const priorQuery = useQuery({ ...regulatoryQuery(orgId, priorRange.to, zone), enabled: !!search.compare });
  const qaQuery = useQuery(qaReviewsQuery(orgId));
  const isLoading = currentQuery.isLoading || qaQuery.isLoading || (!!search.compare && priorQuery.isLoading);
  const failed = currentQuery.isError || qaQuery.isError || (!!search.compare && priorQuery.isError);
  const allRows = currentQuery.data?.rows ?? [];
  const rows = allRows.filter(r => r.received_at.slice(0, 10) >= from && r.received_at.slice(0,10) <= to);
  const report = regulatoryReport(allRows, range, currentQuery.data?.holidays, currentQuery.data?.adr,currentQuery.data?.reopenings,zone);
  const previous = regulatoryReport(priorQuery.data?.rows ?? [], priorRange, priorQuery.data?.holidays, priorQuery.data?.adr,priorQuery.data?.reopenings,zone);
  for(const [pack,period] of [[report,range],[previous,priorRange]] as const){pack.qaTables=qaAnalyticsTables(qaAnalytics(qaQuery.data??[],period,zone,m.role,m.user.id),id=>nameOf(id==='unassigned'?null:id)).filter(t=>['QA summary','QA per criterion','QA by agent'].includes(t.title));pack.methodology=[...pack.methodology??[],...QA_METHODOLOGY];}
  
  const updateSearch = (patch: Partial<typeof search>) => { void navigate({ search: prev => ({ ...prev, ...patch }) }); };
  const dimKey = (r: ReportRow) =>
    dim === "product" ? PRODUCTS[r.product] : dim === "category" ? CATEGORIES[r.category] : dim === "country" ? countryName(r.country_code) : dim === "channel" ? CHANNELS[r.channel] : nameOf(r.assigned_to);
  const bd = useMemo(() => breakdown(rows, dimKey), [rows, dim, members]);



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
      <div className="flex flex-wrap gap-3"><Button variant="outline" onClick={exportPackCsv} disabled={isLoading || failed}><Download aria-hidden="true" className="h-4 w-4" /> Export CSV</Button><Button variant="outline" onClick={exportPackPdf} disabled={isLoading || failed}><FileText aria-hidden="true" className="h-4 w-4" /> Export PDF</Button><Button variant="outline" asChild><Link to="/app/qa" search={{...search,view:'analytics'}}>QA analytics</Link></Button></div>
      {failed && <p role="alert" className="text-destructive">Could not load the reporting period. Please try again.</p>}

      {isLoading ? <TableSkeleton columns={6} /> : failed ? null : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {summary.map(s => <Stat search={s.label==='% of cases needing a holding response'?{tab:'all',holding:'yes',holding_by:auditDateBoundary(to,zone,true),receipt_start:auditDateBoundary(from,zone),receipt_end:auditDateBoundary(to,zone,true)}:isResponse(s.label)?undefined:reportLink(allRows,s.label,undefined,range)} key={s.label} label={s.label} value={s.value === null ? 'n/a' : `${s.value}${s.unit === '%' ? '%' : s.unit ? ` ${s.unit}` : ''}`} comparisonText={search.compare ? `Previous: ${s.previous ?? 'n/a'} · Change: ${s.absolute ?? 'n/a'} (${s.percent === null ? 'n/a' : s.percent.toFixed(1) + '%'})` : undefined} />)}
          </div>
          {!rows.length && <EmptyState icon={FileText} title="No complaints in this period" description="No complaints were received between the selected dates." />}
          <section className="border-t pt-5"><h2 className="mb-3 font-semibold">By ADR outcome</h2><div className="max-w-full overflow-x-auto"><table className="w-full text-sm"><thead><tr><th scope="col" className="text-left">Decision</th><th scope="col">Count</th><th scope="col">Share</th>{search.compare && <th scope="col">Previous</th>}</tr></thead><tbody>{(report.tables.find(t=>t.title==='By ADR outcome')?.rows ?? []).map(r=><tr key={r.label} className="border-t"><td className="py-3">{r.label}<ViewComplaints search={reportLink(allRows,'By ADR outcome',r.label,range)}/></td><td className="text-center">{r.count}</td><td className="text-center">{r.share}%</td>{search.compare && <td className="text-center">{previous.tables.find(t=>t.title==='By ADR outcome')?.rows.find(p=>p.label===r.label)?.count ?? 0}</td>}</tr>)}</tbody></table></div>{!report.tables.find(t=>t.title==='By ADR outcome')?.rows.length && <p className="text-sm text-muted-foreground">No ADR decisions in this period.</p>}</section>
          <section className="border-t pt-5"><h2 className="mb-3 font-semibold">By reopen reason</h2><table className="w-full text-sm"><thead><tr><th className="text-left">Reason</th><th>Count</th>{search.compare&&<th>Previous</th>}</tr></thead><tbody>{(report.tables.find(t=>t.title==='By reopen reason')?.rows??[]).map(r=><tr key={r.label} className="border-t"><td className="py-3">{r.label}<ViewComplaints search={reportLink(allRows,'By reopen reason',r.label,range)}/></td><td className="text-center">{r.count}</td>{search.compare&&<td className="text-center">{previous.tables.find(t=>t.title==='By reopen reason')?.rows.find(p=>p.label===r.label)?.count??0}</td>}</tr>)}</tbody></table></section>
          <Chart title={`Acknowledged on time per ${reportBuckets(range).unit}`} kind="line" series="Acknowledged on time" percent compare={!!search.compare} points={reportBuckets(range).buckets.map((b,i)=>{const p=reportBuckets(priorRange).buckets[i];return {label:b.label,value:responseMetrics(allRows,b,currentQuery.data?.holidays,zone).onTimePct,previous:p?responseMetrics(priorQuery.data?.rows??[],p,priorQuery.data?.holidays,zone).onTimePct:null};})}/>
          {(report.responseTables??[]).map(t=><section key={t.title} className="space-y-3 border-t pt-5"><h2 className="font-semibold">{t.title}</h2><div className="max-w-full overflow-x-auto"><table className="w-full text-sm"><thead><tr>{t.headers.map(h=><th key={h} scope="col" className="px-2 text-left">{h}</th>)}{search.compare&&<th scope="col">Previous (same metrics)</th>}</tr></thead><tbody>{t.rows.map(r=><tr key={String(r[0])} className="border-t">{r.map((v,i)=><td key={i} className="px-2 py-3">{i===0?(t.title.endsWith('agent')?nameOf(v==='Unassigned'?null:String(v)):countryName(String(v))):v}</td>)}{search.compare&&<td>{previous.responseTables?.find(p=>p.title===t.title)?.rows.find(p=>p[0]===r[0])?.slice(1).join(' / ')??'n/a'}</td>}</tr>)}</tbody></table></div></section>)}
          <details><summary className="cursor-pointer font-semibold">Response methodology</summary>{report.methodology?.map(text=><p key={text} className="mt-3 text-sm text-muted-foreground">{text}</p>)}</details>
          <ReportCharts rows={allRows} previousRows={priorQuery.data?.rows ?? []} range={range} previousRange={priorRange} compare={!!search.compare}/>
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
                      <td className="py-2.5 pr-4">{r.key}<ViewComplaints search={reportLink(allRows,`By ${dim}`,dim === 'agent' ? (members.find(x=>x.name===r.key)?.user_id ?? 'none') : r.key,range)}/></td>
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

function Stat({ label, value, comparisonText, search }: { label: string; value: string | number; comparisonText?: string | undefined; search?: QueueSearch | undefined }) {
  return (
    <Card>
      <CardContent className="pt-5">
        {search?<Button variant="link" className="h-auto max-w-full whitespace-normal p-0 text-2xl" asChild><Link to="/app" search={search}>{value}</Link></Button>:<p className="text-2xl font-semibold">{value}</p>}
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
        {comparisonText && <p className="mt-2 break-words text-xs text-muted-foreground">{comparisonText}</p>}
      </CardContent>
    </Card>
  );
}

function isResponse(label:string){return ['Acknowledged on time','Acknowledgement overdue now','Median business days to acknowledge','Holding responses sent','Resolved after holding response within extended deadline'].includes(label);}
