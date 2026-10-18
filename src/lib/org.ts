import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type Organisation = Database["public"]["Tables"]["organisations"]["Row"];

export const ROLE_LABELS: Record<AppRole, string> = {
  org_admin: "Org Admin",
  complaints_manager: "Complaints Manager",
  agent: "Agent",
  qa_reviewer: "QA Reviewer",
  read_only: "Read-only",
};

export const membershipQuery = queryOptions({
  queryKey: ["membership"],
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const { data, error } = await supabase
      .from("org_members")
      .select("role, org_id, organisations(*)")
      .eq("user_id", u.user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { user: u.user, role: null, org: null };
    return { user: u.user, role: data.role as AppRole, org: data.organisations as Organisation };
  },
});

export function useMembership() {
  return useSuspenseQuery(membershipQuery).data;
}

/** Sidebar items visible per role. */
export function navFor(role: AppRole) {
  const all = ["queue", "new", "qa", "reports", "audit", "templates", "settings"] as const;
  if (role === "agent") return ["queue", "new", "templates"];
  if (role === "read_only") return ["queue", "reports", "audit"];
  if (role === "qa_reviewer") return ["queue", "qa", "templates"];
  if (role === "complaints_manager") return ["queue", "new", "qa", "reports", "audit", "templates"];
  return [...all];
}
