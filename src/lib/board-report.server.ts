import type { supabase } from '@/integrations/supabase/client';
import { fetchReportData } from './reports';
import { buildBoardSnapshot, type BoardInput } from './board-report';
import { fetchQaPages, QA_CRITERIA, type QaAnalyticsRow } from './qa-analytics';
export async function boardPreview(client:typeof supabase,input:BoardInput){
 const {data:allowed,error:roleError}=await client.rpc('has_org_role',{_org:input.org,_roles:['org_admin','complaints_manager']});
 if(roleError||!allowed)throw new Error('Only managers and administrators can prepare board reports.');
 const {data:org,error}=await client.from('organisations').select('legal_name,time_zone').eq('id',input.org).single();if(error)throw error;
 const [report,rawQa,form]=await Promise.all([
  fetchReportData(client,input.org),
  fetchQaPages((start,end)=>client.from('qa_reviews').select('id,org_id,complaint_id,kind,status,reviewer,comments,scorecard,created_at,decided_at,letter_id').eq('org_id',input.org).order('id').range(start,end)),
  client.from('public_complaint_forms').select('logo_path').eq('org_id',input.org).maybeSingle(),
 ]);
 // Strip QA notes before the shared analytics helper; snapshots never contain failure examples or attribution.
 const qa:QaAnalyticsRow[]=rawQa.map(r=>({...r,comments:null,complaints:null,scorecard:Object.fromEntries(QA_CRITERIA.map(([key])=>{const raw=r.scorecard&&typeof r.scorecard==='object'&&!Array.isArray(r.scorecard)?r.scorecard[key]:null;const result=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw['result']:null;return [key,{result}];}))}));
 let logo:string|null=null;
 if(form.error)throw form.error;
 if(form.data?.logo_path){const download=await client.storage.from('firm-logos').download(form.data.logo_path);if(download.error)throw download.error;const bytes=new Uint8Array(await download.data.arrayBuffer());let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);logo=`data:${download.data.type};base64,${btoa(binary)}`;}
 return buildBoardSnapshot(report,qa,{from:input.from,to:input.to,...(input.quarter?{unit:'quarter' as const}:{})},org.time_zone,org.legal_name,input.title,input.commentary,logo);
}