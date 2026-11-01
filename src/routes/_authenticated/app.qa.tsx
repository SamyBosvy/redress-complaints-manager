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
import { QA_KINDS, QA_STATUSES, SCORECARD, emptyScorecard, qaReviewsQuery, scorecardPassed, type QaReview, type Scorecard } from "@/lib/qa";
import { formatDate } from "@/lib/letters";

export const Route = createFileRoute("/_authenticated/app/qa")({
  loader: async ({ context }) => {
    const m = await context.queryClient.ensureQueryData(membershipQuery);
    await context.queryClient.ensureQueryData(qaReviewsQuery(m!.org!.id));
  },
  head: () => ({ meta: [{ title: "QA review — Redress" }, { name: "description", content: "Approve final responses and review sampled complaints." }, { property: "og:title", content: "QA review — Redress" }, { property: "og:description", content: "Approve final responses and review sampled complaints." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  pendingComponent: () => <TableSkeleton columns={5} />,
  component: QaPage,
});

type ReviewRow = QaReview & { complaints: { reference: string; complainant_name: string } | null };

function QaPage() {
  const m = useMembership()!;
  const orgId = m.org!.id;
  const qc = useQueryClient();
  const { data: reviews } = useSuspenseQuery(qaReviewsQuery(orgId));
  const canDecide = ["org_admin", "complaints_manager", "qa_reviewer"].includes(m.role!);
  const [returnFor, setReturnFor] = useState<ReviewRow | null>(null);
  const [scoreFor, setScoreFor] = useState<ReviewRow | null>(null);
  const [comments, setComments] = useState("");
  const [card, setCard] = useState<Scorecard>(emptyScorecard());

  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ["qa-reviews", orgId] }), qc.invalidateQueries({ queryKey: ["queue"] }), qc.invalidateQueries({ queryKey: ["case"] })]);

  async function decide(r: ReviewRow, status: "approved" | "returned", note: string) {
    const { error } = await supabase.from("qa_reviews").update({ status, comments: note || null, reviewer: m.user.id, decided_at: new Date().toISOString() }).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    const next = status === "approved" ? "final_response_sent" : "under_investigation";
    const { error: e2 } = await supabase.from("complaints").update({ status: next }).eq("id", r.complaint_id);
    if (e2) { toast.error(e2.message); return; }
    if (status === "returned") {
      const { data: c } = await supabase.from("complaints").select("assigned_to, reference").eq("id", r.complaint_id).single();
      if (c?.assigned_to) await supabase.from("notifications").insert({ org_id: orgId, user_id: c.assigned_to, kind: "qa_returned", title: `Final response returned by QA: ${c.reference}`, complaint_id: r.complaint_id });
    }
    toast.success(status === "approved" ? "Final response approved and marked sent." : "Returned to the agent.");
    await refresh();
  }

  async function saveScorecard(r: ReviewRow) {
    const passed = scorecardPassed(card);
    const { error } = await supabase.from("qa_reviews").update({ status: passed ? "passed" : "failed", scorecard: card as any, comments: comments || null, reviewer: m.user.id, decided_at: new Date().toISOString() }).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
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

      <h2 className="mt-6 text-sm font-medium uppercase tracking-wide text-muted-foreground">Awaiting review</h2>
      <div className="mt-2 overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-4 py-2.5 font-medium">Reference</th><th className="px-4 py-2.5 font-medium">Customer</th><th className="px-4 py-2.5 font-medium">Type</th><th className="px-4 py-2.5 font-medium">Since</th><th className="px-4 py-2.5 font-medium" /></tr>
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
                      <Button size="sm" onClick={() => decide(r, "approved", "")}>Approve</Button>
                      <Button size="sm" variant="outline" onClick={() => { setReturnFor(r); setComments(""); }}>Return</Button>
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
            <tr><th className="px-4 py-2.5 font-medium">Reference</th><th className="px-4 py-2.5 font-medium">Type</th><th className="px-4 py-2.5 font-medium">Result</th><th className="px-4 py-2.5 font-medium">Decided</th><th className="hidden px-4 py-2.5 font-medium md:table-cell">Comments</th></tr>
          </thead>
          <tbody>
            {done.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs"><Link to="/app/c/$id" params={{ id: r.complaint_id }} className="text-primary hover:underline">{r.complaints?.reference}</Link></td>
                <td className="px-4 py-3">{QA_KINDS[r.kind as keyof typeof QA_KINDS]}</td>
                <td className="px-4 py-3"><span className={r.status === "failed" || r.status === "returned" ? "text-destructive" : "text-success"}>{QA_STATUSES[r.status]}</span></td>
                <td className="px-4 py-3 tabular">{formatDate(r.decided_at)}</td>
                <td className="hidden max-w-64 truncate px-4 py-3 text-muted-foreground md:table-cell">{r.comments ?? "—"}</td>
              </tr>
            ))}
            {done.length === 0 && <tr><td colSpan={5}><EmptyState icon={CheckCheck} title="No completed reviews yet" description="No review decisions have been recorded." /></td></tr>}
          </tbody>
        </table>
      </div>

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
            <Button disabled={!comments.trim()} onClick={() => { decide(returnFor!, "returned", comments.trim()); setReturnFor(null); }}>Return</Button>
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
                  <Label>{label}</Label>
                  <div className="flex gap-1">
                    {(["pass", "fail"] as const).map((v) => (
                      <Button key={v} size="sm" variant={card[key].result === v ? (v === "pass" ? "default" : "destructive") : "outline"} onClick={() => setCard({ ...card, [key]: { ...card[key], result: v } })}>{v === "pass" ? "Pass" : "Fail"}</Button>
                    ))}
                  </div>
                </div>
                <Textarea rows={1} placeholder="Note (optional)" value={card[key].note} onChange={(e) => setCard({ ...card, [key]: { ...card[key], note: e.target.value } })} />
              </div>
            ))}
            <div className="space-y-2">
              <Label htmlFor="qa-overall">Overall comments</Label>
              <Textarea id="qa-overall" rows={2} value={comments} onChange={(e) => setComments(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScoreFor(null)}>Cancel</Button>
            <Button onClick={() => saveScorecard(scoreFor!)}>Save review</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
