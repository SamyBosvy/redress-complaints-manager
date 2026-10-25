import {supabase} from '@/integrations/supabase/client';
import {validRecalculationReason} from './workspace-access';

export type DeadlineDates = {ack_due:string|null; final_due:string|null; extended_due:string|null};
export async function previewDeadlines(org:string, country:string, product:string, received:string):Promise<DeadlineDates> {
  const {data:ruleId,error}=await supabase.rpc('resolve_rule_set',{_org:org,_country:country,_product:product});
  if(error)throw error;
  const {data:rule,error:ruleError}=await supabase.from('rule_sets').select('ack_days,final_days,extended_days').eq('org_id',org).eq('id',ruleId).single();
  if(ruleError)throw ruleError;
  const start=new Date(received).toISOString().slice(0,10);
  const results=await Promise.all([rule.ack_days,rule.final_days,rule.extended_days].map(n=>supabase.rpc('add_business_days',{_org:org,_country:country,_start:start,_n:n})));
  for(const result of results)if(result.error)throw result.error;
  return {ack_due:results[0]?.data??null,final_due:results[1]?.data??null,extended_due:results[2]?.data??null};
}
export async function recalculateDeadlines(org:string,id:string,reason:string) {
  if(!validRecalculationReason(reason))throw new Error('Record a reason of 10–1000 characters.');
  const {error}=await supabase.rpc('recalculate_complaint',{_org:org,_case:id,_reason:reason.trim()});
  if(error)throw error;
}