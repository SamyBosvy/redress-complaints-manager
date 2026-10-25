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

export type OrgAccess = { org_id: string; legal_name: string; role: AppRole; active: boolean; require_2fa: boolean; setup_complete: boolean };
let selectedOrg: string | null = null;
export function selectOrganisation(id: string) { selectedOrg = id; sessionStorage.setItem('redress-org', id); }
export function clearSelectedOrganisation() { selectedOrg = null; sessionStorage.removeItem('redress-org'); }
export const membershipQuery = queryOptions({
  queryKey: ['membership'],
  queryFn: async () => {
    const { data: u, error: authError } = await supabase.auth.getUser();
    if (authError || !u.user) return null;
    const { data: rows, error } = await supabase.rpc('my_organisations');
    if(error) throw error;
    const organisations = (rows ?? []) as unknown as OrgAccess[];
    if(typeof window !== 'undefined' && !selectedOrg) selectedOrg = sessionStorage.getItem('redress-org');
    const access = organisations.find(x => x.org_id === selectedOrg && x.active) ?? organisations.find(x => x.active);
    const base = { user: u.user, organisations, access, needsVerification: !u.user.email_confirmed_at };
    if(!access || !u.user.email_confirmed_at) return {...base, role:null, org:null, needs2fa:false};
    const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if(assuranceError) throw assuranceError;
    const needs2fa = assurance?.currentLevel !== 'aal2' && (access.require_2fa || assurance?.nextLevel === 'aal2');
    if(needs2fa) return {...base, role:access.role, org:null, needs2fa:true};
    const {data:org,error:orgError} = await supabase.from('organisations').select('*').eq('id',access.org_id).single();
    if(orgError) throw orgError;
    return {...base, role:access.role, org, needs2fa:false};
  },
  staleTime: 0,
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
  if (role === "complaints_manager") return ["queue", "new", "qa", "reports", "audit", "templates", "settings"];
  return [...all];
}
