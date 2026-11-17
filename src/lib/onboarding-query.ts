import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { settingsQuery } from './settings';
import { firmMainLanguage, qaReviewed, type SetupEvidence } from './onboarding';
import type { Organisation } from './org';

// Read-only evidence: unavailable RLS-protected data is unknown, never completed.
export const onboardingQuery=(org:Organisation,qc:QueryClient,year:number)=>queryOptions({
 queryKey:['setup-progress',org.id,year,org.home_country],staleTime:0,
 queryFn:async():Promise<SetupEvidence>=>{
  const language=firmMainLanguage(org.home_country);
  const [settings,team,templates,rootAudit,qaAudit,form,complaint]=await Promise.all([
   qc.fetchQuery(settingsQuery(org.id)).catch(()=>null),
   (async()=>{const [members,invites]=await Promise.all([supabase.from('org_members').select('active').eq('org_id',org.id),supabase.from('org_invites').select('accepted_at,revoked_at,expires_at').eq('org_id',org.id).is('accepted_at',null).is('revoked_at',null).gt('expires_at',new Date().toISOString()).limit(1)]);return members.error||invites.error?null:{members:members.data??[],invites:invites.data??[]};})(),
   Promise.all((['acknowledgement','holding','final_upheld','final_partially_upheld','final_not_upheld'] as const).map(async kind=>{
    const r=await supabase.from('template_versions').select('saved_at,saved_by,templates!inner(kind,language)').eq('org_id',org.id).eq('templates.kind',kind).eq('templates.language',language).not('saved_by','is',null).order('saved_at').limit(1);
    if(r.error)throw r.error;return {kind,language,template_versions:(r.data??[]).map(v=>({saved_at:v.saved_at,saved_by:v.saved_by}))};
   })).catch(()=>null),
   (async()=>{const r=await supabase.from('audit_log').select('actor,table_name,created_at,before,after,action').eq('org_id',org.id).eq('table_name','root_causes').not('actor','is',null).order('created_at').limit(1);return r.error?null:r.data;})(),
   (async()=>{for(let from=0;;from+=200){const r=await supabase.from('audit_log').select('actor,table_name,created_at,before,after,action').eq('org_id',org.id).eq('table_name','organisations').eq('action','update').not('actor','is',null).order('created_at').order('id').range(from,from+199);if(r.error)return null;const match=r.data.find(qaReviewed);if(match)return [match];if(r.data.length<200)return [];}})(),
   (async()=>{const r=await supabase.from('public_complaint_forms').select('enabled,privacy_notice,updated_at').eq('org_id',org.id).maybeSingle();return r.error?undefined:r.data;})(),
   (async()=>{const r=await supabase.from('complaints').select('created_at').eq('org_id',org.id).order('created_at').limit(1).maybeSingle();return r.error?undefined:r.data;})(),
  ]);
  return {org,countries:settings?.countries??null,holidays:settings?.holidays??null,team,templates,rootAudit,qaAudit,form,complaint};
 },
});