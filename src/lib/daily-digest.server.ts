import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/integrations/supabase/types';
import {selectDailyDigest,type DigestCase} from './daily-digest';

/** Preparation for a future single-recipient managed send. Not an HTTP endpoint or scheduled job. */
export async function prepareDailyDigest(client:SupabaseClient<Database>,orgId:string,userId:string) {
  const {data:member,error}=await client.from('org_members').select('org_id,user_id,role,active').eq('org_id',orgId).eq('user_id',userId).maybeSingle();
  if(error)throw error;
  if(!member?.active)return null;
  const cases:DigestCase[]=[];
  const reviews:{org_id:string;complaint_id:string;kind:string;status:string}[]=[];
  // Paginate to avoid silently truncating a large firm's digest at the Data API row cap.
  for(let offset=0;;offset+=500){
    let query=client.from('complaint_queue').select('id,org_id,reference,assigned_to,status,days_left,current_due').eq('org_id',orgId).order('id').range(offset,offset+499);
    if(member.role==='agent')query=query.eq('assigned_to',userId);
    const {data,error:readError}=await query;
    if(readError)throw readError;
    for(const row of data??[]){
      if(!row.id||!row.org_id||!row.reference||!row.status)continue;
      cases.push({...row,id:row.id,org_id:row.org_id,reference:row.reference,status:row.status});
    }
    if((data?.length??0)<500)break;
  }
  if(['org_admin','complaints_manager','qa_reviewer'].includes(member.role)){
    for(let offset=0;;offset+=500){
      const {data,error:readError}=await client.from('qa_reviews').select('org_id,complaint_id,kind,status').eq('org_id',orgId).eq('kind','approval').eq('status','pending').order('id').range(offset,offset+499);
      if(readError)throw readError;
      reviews.push(...data??[]);
      if((data?.length??0)<500)break;
    }
  }
  return selectDailyDigest(member,cases,reviews);
}