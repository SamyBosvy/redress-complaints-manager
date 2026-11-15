import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type QaReview = Database["public"]["Tables"]["qa_reviews"]["Row"];
export type QaStatus = QaReview["status"];

export const QA_KINDS = { approval: "Final response approval", sample: "Sampling review" } as const;
export const QA_STATUSES: Record<QaStatus, string> = {
  pending: "Pending", approved: "Approved", returned: "Returned", passed: "Passed", failed: "Failed",
};

/** Scorecard criteria for sampling reviews (Pass/Fail + note each). */
export const SCORECARD = [
  ["accuracy", "Accuracy"],
  ["fair_outcome", "Fair outcome"],
  ["clear_communication", "Clear communication"],
  ["deadlines_met", "Deadlines met"],
  ["adr_rights", "ADR rights given"],
] as const;
export type ScorecardKey = (typeof SCORECARD)[number][0];
export type Scorecard = Record<ScorecardKey, { result: "pass" | "fail"; note: string }>;

export function emptyScorecard(): Scorecard {
  return Object.fromEntries(SCORECARD.map(([k]) => [k, { result: "pass", note: "" }])) as Scorecard;
}

/** A sampling review fails if any criterion is failed. */
export function scorecardPassed(s: Scorecard) {
  return SCORECARD.every(([k]) => s[k].result === "pass");
}

export const qaReviewsQuery = (orgId: string) =>
  queryOptions({
    queryKey: ["qa-reviews", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qa_reviews")
        .select("*, complaints(reference, complainant_name, assigned_to), letters(sent_by)")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
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
