import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
export type ReopenRequest = Database['public']['Tables']['reopen_requests']['Row'];
export type CaseReopenRequest = ReopenRequest & { requester_name: string };
export const canDecideRequests = (role: string | null) => role === 'org_admin' || role === 'complaints_manager';
export const requestHistorySince = (now = new Date()) => new Date(now.getTime() - 30 * 86400000).toISOString();
export const requestListQuery = (org: string, user?: string, page = 1) => queryOptions({
  queryKey: ['reopen-requests', org, user ?? 'pending', page],
  queryFn: async () => {
    let q = supabase.from('reopen_requests').select('*, complaints(reference)', { count: 'exact' }).eq('org_id', org);
    q = user ? q.eq('requested_by', user).or(`status.eq.pending,and(status.in.(approved,rejected),decided_at.gte.${requestHistorySince()})`) : q.eq('status', 'pending');
    const { data, error, count } = await q.order('created_at', { ascending: false }).order('id', { ascending: false }).range((page - 1) * 50, page * 50 - 1);
    if (error) throw error;
    return { rows: data, total: count ?? 0 };
  }, refetchInterval: 120000, refetchIntervalInBackground: false,
});
export const pendingRequestsCountQuery = (org: string) => queryOptions({queryKey:['reopen-requests',org,'count'],queryFn:async()=>{
  const {count,error}=await supabase.from('reopen_requests').select('id',{count:'exact',head:true}).eq('org_id',org).eq('status','pending');
  if(error)throw error;return count??0;
},refetchInterval:120000,refetchIntervalInBackground:false});
export const caseRequestsQuery = (org: string, id: string) => queryOptions({queryKey:['reopen-requests',org,'case',id],queryFn:async()=>{
  const {data,error}=await supabase.rpc('case_reopen_requests',{_org:org,_case:id});if(error)throw error;
  return data as unknown as CaseReopenRequest[];
},refetchInterval:120000,refetchIntervalInBackground:false});