import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import type { QueueSearch } from './queue';
import type { AppRole } from './org';
export const WORKLOAD_METRICS = { open: 'Open', overdue: 'Overdue final', soon: 'Due in 3 business days', ack: 'Acknowledgement overdue', vulnerable: 'Vulnerable open', high: 'High priority open', recent: 'Received in 30 days' } as const;
export type WorkloadMetric = keyof typeof WORKLOAD_METRICS;
export type Capacity = Database['public']['Tables']['agent_capacity']['Row'];
export const workloadVisible = (role: AppRole | null | undefined) => !!role && ['org_admin','complaints_manager','qa_reviewer','read_only'].includes(role);
export const capacityEditable = (role: AppRole | null | undefined) => role === 'org_admin' || role === 'complaints_manager';
export function workloadLink(agent: string | null, metric: WorkloadMetric, today: string): QueueSearch {
  return { tab: 'all', agent: agent ?? 'none', workload: metric, workload_date: today };
}
export type WorkloadOp = { column: string; op: 'neq' | 'eq' | 'lt' | 'gte' | 'lte'; value: string | boolean };
export function workloadOps(metric: WorkloadMetric, today: string): WorkloadOp[] {
  const ops: WorkloadOp[] = metric === 'recent' ? [] : [{ column: 'status', op: 'neq', value: 'closed' }];
  if (metric === 'overdue') ops.push({column:'final_due',op:'lt',value:today});
  // Soon/recent predicates need org holidays/time zone and are prepared by the queue reader.
  if (metric === 'ack') ops.push({column:'status',op:'eq',value:'received'},{column:'ack_due',op:'lt',value:today});
  if (metric === 'vulnerable') ops.push({column:'vulnerable',op:'eq',value:true});
  if (metric === 'high') ops.push({column:'priority',op:'eq',value:'high'});
  return ops;
}
export const workloadQuery = (org: string) => queryOptions({ queryKey: ['workload',org], queryFn: async () => {
  const {data,error} = await supabase.rpc('workload_summary',{_org:org}); if(error)throw error; return data;
}, refetchInterval: 120_000 });
export const capacityQuery = (org: string, user: string) => queryOptions({ queryKey:['capacity',org,user], queryFn:async()=>{
  const {data,error}=await supabase.from('agent_capacity').select('*').eq('org_id',org).eq('user_id',user).maybeSingle();if(error)throw error;return data;
}});