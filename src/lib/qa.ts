import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { QA_CRITERIA, fetchQaPages, qaFilterOps, matchesQaFilters, type QaSearch } from './qa-analytics';

export type QaReview = Database["public"]["Tables"]["qa_reviews"]["Row"];
export type QaStatus = QaReview["status"];

export const QA_KINDS = { approval: "Final response approval", sample: "Sampling review" } as const;
export const QA_STATUSES: Record<QaStatus, string> = {
  pending: "Pending", approved: "Approved", returned: "Returned", passed: "Passed", failed: "Failed",
};

/** Scorecard criteria for sampling reviews (Pass/Fail + note each). */
export const SCORECARD = QA_CRITERIA;
export type ScorecardKey = (typeof SCORECARD)[number][0];
export type Scorecard = Record<ScorecardKey, { result: "pass" | "fail"; note: string }>;

export function emptyScorecard(): Scorecard {
  return Object.fromEntries(SCORECARD.map(([k]) => [k, { result: "pass", note: "" }])) as Scorecard;
}

/** A sampling review fails if any criterion is failed. */
export function scorecardPassed(s: Scorecard) {
  return SCORECARD.every(([k]) => s[k].result === "pass");
}

export const qaReviewsQuery = (orgId: string, filters: QaSearch = {}, zone = 'Europe/Dublin') =>
  queryOptions({
    queryKey: ["qa-reviews", orgId, filters, zone],
    queryFn: async () => {
      const rows = await fetchQaPages((offset,end) => {
      let query = supabase
        .from("qa_reviews")
        .select("*, complaints(reference, complainant_name, assigned_to), letters(sent_by)")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .order('id', { ascending: false })
        .range(offset,end);
      for(const f of qaFilterOps(filters,zone)) {
        if(f.op==='in'&&Array.isArray(f.value))query=query.in(f.column,f.value);
        else if(f.op==='is')query=query.is(f.column,null);
        else if(typeof f.value==='string') {
          if(f.op==='gte')query=query.gte(f.column,f.value);
          else if(f.op==='lt')query=query.lt(f.column,f.value);
          else query=query.eq(f.column,f.value);
        }
      }
      return query;
      });
      return rows.filter(r=>matchesQaFilters(r,filters,zone));
    },
  });

export const notificationsQuery = queryOptions({
  queryKey: ["notifications"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return data;
  },
  refetchInterval: 60_000,
});
