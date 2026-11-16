import { queryOptions, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { dayFilterOps, daySelect, DAY_SECTIONS, pendingAcknowledgements, type DaySection } from './my-day';
import type { QueueItem, QueuePage } from './queue';
import { fetchQaPages } from './qa-analytics';
import type { ResponseLetter, ResponseEvent } from './response-metrics';

export type DayRow = QueueItem & { qa_reviews?: {comments:string|null;decided_at:string|null}[]; adr_cases?: {firm_response_due:string|null}|null };
const columns='id,reference,complainant_name,customer_ref,category,product,country_code,status,assigned_to,vulnerable,priority,days_left,current_due,ack_due,received_at';
export async function fetchDaySection(org:string,user:string,section:DaySection,today:string,zone:string,page=1,size=10):Promise<Omit<QueuePage,'rows'> & {rows:DayRow[];limited:boolean}> {
  let query=supabase.from('complaint_queue').select(daySelect(columns,section),{count:'exact'}).eq('org_id',org);
  for(const f of dayFilterOps(section,user,today,zone)) {
    if(f.op==='in'&&Array.isArray(f.value))query=query.in(f.column,f.value);
    else if(f.op==='is')query=query.is(f.column,null);
    else if(f.op==='eq'&&f.value!==null)query=query.eq(f.column,f.value);
    else if(typeof f.value==='number'||typeof f.value==='string') {if(f.op==='gte')query=query.gte(f.column,f.value);else if(f.op==='lt')query=query.lt(f.column,f.value);else query=query.lte(f.column,f.value);}
  }
  query=query.order('current_due',{ascending:true,nullsFirst:false}).order('id');
  const {data,error,count}=await query.range(section==='ack'?0:(page-1)*size,section==='ack'?199:page*size-1);
  if(error)throw error;
  let rows=(data??[]) as unknown as DayRow[];
  const limited=section==='ack'&&(count??0)>200;
  if(section==='ack'&&rows.length) {
    const ids=rows.flatMap(r=>r.id?[r.id]:[]);
    const [letters,events]=await Promise.all([
      fetchQaPages((from,to)=>supabase.from('letters').select('complaint_id,kind,sent_at').eq('org_id',org).in('complaint_id',ids).eq('kind','acknowledgement').not('sent_at','is',null).order('id').range(from,to)),
      fetchQaPages((from,to)=>supabase.from('complaint_events').select('complaint_id,created_at,detail').eq('org_id',org).in('complaint_id',ids).eq('kind','status').eq('detail->>after','acknowledged').order('id').range(from,to)),
    ]);
    rows=pendingAcknowledgements(rows,letters as ResponseLetter[],events as ResponseEvent[]);
  }
  const total=section==='ack'?rows.length:count??0;
  return {rows:section==='ack'?rows.slice((page-1)*size,page*size):rows,total,page,pageSize:size,limited};
}
export const myDayQuery=(org:string,user:string,today:string,zone:string)=>queryOptions({
  queryKey:['my-day',org,user,today,zone],
  queryFn:async()=>Object.fromEntries(await Promise.all(DAY_SECTIONS.map(async section=>[section,await fetchDaySection(org,user,section,today,zone)] as const))) as Record<DaySection,Awaited<ReturnType<typeof fetchDaySection>>>,
  placeholderData:keepPreviousData,refetchInterval:120_000,refetchIntervalInBackground:false,
});
