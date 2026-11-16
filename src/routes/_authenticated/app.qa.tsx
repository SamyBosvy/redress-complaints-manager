import { fourEyes, FOUR_EYES, workflowError } from '@/lib/workflow';
import { EmptyState } from '@/components/empty-state';
import { TableSkeleton } from '@/components/table-skeleton';
import { CheckCheck } from 'lucide-react';
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { membershipQuery, useMembership } from "@/lib/org";
import { QA_KINDS, QA_STATUSES, SCORECARD, emptyScorecard, qaReviewsQuery, scorecardPassed, type Scorecard } from "@/lib/qa";
import { formatDate } from "@/lib/letters";
import { QaAnalytics, QaPeriodControls } from '@/components/qa-analytics';
import { parseQaSearch, qaOwnRows, type QaAnalyticsRow } from '@/lib/qa-analytics';
import { selectedPeriod } from '@/lib/reports';
import { firmDate } from '@/lib/reopening';
import { membersQuery } from '@/lib/complaints';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { maskAuditValue } from '@/lib/audit';

export const Route = createFileRoute("/_authenticated/app/qa")({
  validateSearch: parseQaSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    const m = await context.queryClient.ensureQueryData(membershipQuery);
    if(!m?.org)return;
    await Promise.all([context.queryClient.ensureQueryData(qaReviewsQuery(m.org.id,deps.view==='analytics'?{}:{...deps,...(deps.decided?selectedPeriod(deps,firmDate(new Date(),m.org.time_zone)):{})},m.org.time_zone)),context.queryClient.ensureQueryData(membersQuery(m.org.id))]);
  },
  head: () => ({ meta: [{ title: "QA review — Redress" }, { name: "description", content: "Approve final responses and review sampled complaints." }, { property: "og:title", content: "QA review — Redress" }, { property: "og:description", content: "Approve final responses and review sampled complaints." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  pendingComponent: () => <TableSkeleton columns={5} />,
  component: QaPage,
});

type ReviewRow = QaAnalyticsRow;

function QaPage() {
  const m = useMembership();
  if(!m?.org)return null;
  return <QaContent membership={{...m,org:m.org}}/>;
}
function QaContent({membership:m}:{membership:NonNullable<ReturnType<typeof useMembership>>&{org:NonNullable<NonNullable<ReturnType<typeof useMembership>>['org']>}}) {
  const orgId = m.org.id;
  const search=Route.useSearch(),navigate=Route.useNavigate(),zone=m.org.time_zone;
  const range=selectedPeriod(search,firmDate(new Date(),zone));
  const listFilters={...search,...(search.decided?{from:range.from,to:range.to}:{})};
  const update=(patch:Partial<typeof search>)=>{void navigate({search:prev=>({...prev,...patch})});};
  const qc = useQueryClient();
  const { data: allReviews } = useSuspenseQuery(qaReviewsQuery(orgId,search.view==='analytics'?{}:listFilters,zone));
  const reviews=qaOwnRows(allReviews,m.role,m.user.id);
  const {data:members}=useSuspenseQuery(membersQuery(orgId));
  const name=(id:string)=>id==='unassigned'?'Unassigned':members.find(x=>x.user_id===id)?.name??'Former user';
  const canDecide = ["org_admin", "complaints_manager", "qa_reviewer"].includes(m.role??'');
  const [returnFor, setReturnFor] = useState<ReviewRow | null>(null);
  const [scoreFor, setScoreFor] = useState<ReviewRow | null>(null);
  const [comments, setComments] = useState("");
  const [card, setCard] = useState<Scorecard>(emptyScorecard());

  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ["qa-reviews", orgId] }), qc.invalidateQueries({ queryKey: ["queue"] }), qc.invalidateQueries({ queryKey: ["case"] })]);

  async function decide(r: ReviewRow, status: "approved" | "returned", note: string) {
    const { error } = await supabase.from("qa_reviews").update({ status, comments: note || null, reviewer: m.user.id, decided_at: new Date().toISOString() }).eq("id", r.id);
    if (error) { toast.error(workflowError(error.message)); return; }
    toast.success(status === "approved" ? "Final response approved and marked sent." : "Returned to the agent.");
    await refresh();
  }

  async function saveScorecard(r: ReviewRow) {
    const passed = scorecardPassed(card);
    const { error } = await supabase.from("qa_reviews").update({ status: passed ? "passed" : "failed", scorecard: card as any, comments: comments || null, reviewer: m.user.id, decided_at: new Date().toISOString() }).eq("id", r.id);
    if (error) { toast.error(workflowError(error.message)); return; }
    toast.success(passed ? "Review passed." : "Review failed — recorded.");
    setScoreFor(null);
    setComments("");
    setCard(emptyScorecard());
    await refresh();
  }

  const pending = reviews.filter((r) => r.status === "pending");
  const done = reviews.filter((r) => r.status !== "pending");

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold">QA review</h1>
      <p className="mt-1 text-sm text-muted-foreground tabular">{pending.length} awaiting review.</p>

      <Tabs value={search.view??'list'} onValueChange={value=>update({view:value==='analytics'?'analytics':'list'})} className="my-5"><TabsList aria-label="QA views"><TabsTrigger value="list">Reviews</TabsTrigger><TabsTrigger value="analytics">Analytics</TabsTrigger></TabsList></Tabs>
      <QaPeriodControls search={search} range={range} update={patch=>update({...patch,...(search.view==='analytics'?{}:{decided:true})})}/>
      {search.view==='analytics'?<div className="mt-6"><QaAnalytics rows={reviews} range={range} zone={zone} role={m.role} userId={m.user.id} compare={!!search.compare} name={name}/></div>:<>
      <div className="my-4 flex flex-wrap gap-3">{([{key:'agent',label:'Agent',options:[['all','All agents'],...members.map(m=>[m.user_id,m.name]),['unassigned','Unassigned']]},{key:'reviewer',label:'Reviewer',options:[['all','All reviewers'],...members.map(m=>[m.user_id,m.name]),['unassigned','Unassigned']]},{key:'criterion',label:'Failed criterion',options:[['all','Any criterion'],...SCORECARD.map(([k,l])=>[k,l])]},{key:'result',label:'Result',options:[['all','Any result'],['pass','Pass'],['fail','Fail']]},{key:'kind',label:'Review kind',options:[['all','Any kind'],['approval','Letter approval'],['sample','Sampling']]}] as const).map(f=><div key={f.key} className="space-y-1"><Label htmlFor={`qa-filter-${f.key}`}>{f.label}</Label><Select value={search[f.key]??'all'} onValueChange={value=>update(parseQaSearch({...search,[f.key]:value==='all'?undefined:value,...(f.key==='criterion'?{criterion_result:'fail'}:{})}))}><SelectTrigger id={`qa-filter-${f.key}`} className="w-44"><SelectValue/></SelectTrigger><SelectContent>{f.options.map(([key,label])=><SelectItem key={key??'all'} value={key??'all'}>{label}</SelectItem>)}</SelectContent></Select></div>)}<Button variant="outline" onClick={()=>void navigate({search:{view:'list'}})}>Clear filters</Button></div>

      <h2 className="mt-6 text-sm font-medium uppercase tracking-wide text-muted-foreground">Awaiting review</h2>
      <div className="mt-2 overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr><th scope="col" className="px-4 py-2.5 font-medium">Reference</th><th scope="col" className="px-4 py-2.5 font-medium">Customer</th><th scope="col" className="px-4 py-2.5 font-medium">Type</th><th scope="col" className="px-4 py-2.5 font-medium">Since</th><th scope="col" className="px-4 py-2.5 font-medium"><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody>
            {pending.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs"><Link to="/app/c/$id" params={{ id: r.complaint_id }} className="text-primary hover:underline">{r.complaints?.reference}</Link></td>
                <td className="px-4 py-3">{r.complaints?.complainant_name}</td>
                <td className="px-4 py-3">{QA_KINDS[r.kind as keyof typeof QA_KINDS]}</td>
                <td className="px-4 py-3 tabular">{formatDate(r.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  {canDecide && r.kind === "approval" && (
                    <div className="flex justify-end gap-2">
                      <Button size="sm" disabled={fourEyes(m.user.id,r.letters?.sent_by,r.complaints?.assigned_to) || !r.letters} onClick={() => decide(r, "approved", "")}>Approve</Button>
                      <Button disabled={fourEyes(m.user.id,r.letters?.sent_by,r.complaints?.assigned_to) || !r.letters} size="sm" variant="outline" onClick={() => { setReturnFor(r); setComments(""); }}>Return</Button>
                    {fourEyes(m.user.id,r.letters?.sent_by,r.complaints?.assigned_to) && <p className="text-sm text-muted-foreground">{FOUR_EYES}</p>}
                    </div>
                  )}
                  {canDecide && r.kind === "sample" && (
                    <Button size="sm" variant="outline" onClick={() => { setScoreFor(r); setCard(emptyScorecard()); setComments(""); }}>Scorecard</Button>
                  )}
                </td>
              </tr>
            ))}
            {pending.length === 0 && <tr><td colSpan={5}><EmptyState icon={CheckCheck} title="Nothing awaiting review" description="There are no pending approvals or sample reviews." /></td></tr>}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 text-sm font-medium uppercase tracking-wide text-muted-foreground">Completed</h2>
      <div className="mt-2 overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr><th scope="col" className="px-4 py-2.5 font-medium">Reference</th><th scope="col" className="px-4 py-2.5 font-medium">Type</th><th scope="col" className="px-4 py-2.5 font-medium">Result</th><th scope="col" className="px-4 py-2.5 font-medium">Decided</th><th scope="col" className="hidden px-4 py-2.5 font-medium md:table-cell">Comments</th></tr>
          </thead>
          <tbody>
            {done.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs"><Link to="/app/c/$id" params={{ id: r.complaint_id }} className="text-primary hover:underline">{r.complaints?.reference}</Link></td>
                <td className="px-4 py-3">{QA_KINDS[r.kind as keyof typeof QA_KINDS]}</td>
                <td className="px-4 py-3"><span className={r.status === "failed" || r.status === "returned" ? "text-destructive" : "text-success"}>{QA_STATUSES[r.status]}</span></td>
                <td className="px-4 py-3 tabular">{formatDate(r.decided_at)}</td>
                <td className="hidden max-w-64 truncate px-4 py-3 text-muted-foreground md:table-cell">{String(maskAuditValue(r.comments,'comments',m.role==='org_admin')??'—')}</td>
              </tr>
            ))}
            {done.length === 0 && <tr><td colSpan={5}><EmptyState icon={CheckCheck} title="No completed reviews yet" description="No review decisions have been recorded." /></td></tr>}
          </tbody>
        </table>
      </div>

      </>}

      <Dialog open={!!returnFor} onOpenChange={(o) => !o && setReturnFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Return to agent</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">The complaint goes back to Under investigation and the agent is notified.</p>
          <div className="space-y-2">
            <Label htmlFor="qa-comments">Feedback for the agent</Label>
            <Textarea id="qa-comments" rows={4} value={comments} onChange={(e) => setComments(e.target.value)} placeholder="What needs to change?" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnFor(null)}>Cancel</Button>
            <Button disabled={!comments.trim()} onClick={() => { if(returnFor)void decide(returnFor, "returned", comments.trim()); setReturnFor(null); }}>Return</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!scoreFor} onOpenChange={(o) => !o && setScoreFor(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>QA scorecard — {scoreFor?.complaints?.reference}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {SCORECARD.map(([key, label]) => (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={`qa-note-${key}`}>{label}</Label>
                  <div role="group" aria-label={`${label} result`} className="flex gap-1">
                    {(["pass", "fail"] as const).map((v) => (
                      <Button key={v} size="sm" variant={card[key].result === v ? (v === "pass" ? "default" : "destructive") : "outline"} onClick={() => setCard({ ...card, [key]: { ...card[key], result: v } })}>{v === "pass" ? "Pass" : "Fail"}</Button>
                    ))}
                  </div>
                </div>
                <Textarea id={`qa-note-${key}`} rows={1} placeholder="Note (optional)" value={card[key].note} onChange={(e) => setCard({ ...card, [key]: { ...card[key], note: e.target.value } })} />
              </div>
            ))}
            <div className="space-y-2">
              <Label htmlFor="qa-overall">Overall comments</Label>
              <Textarea id="qa-overall" rows={2} value={comments} onChange={(e) => setComments(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScoreFor(null)}>Cancel</Button>
            <Button onClick={() => scoreFor && saveScorecard(scoreFor)}>Save review</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
