import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';
import { retentionState } from '@/lib/privacy';
export const Route=createFileRoute('/api/public/jobs/privacy')({server:{handlers:{POST:async({request})=>{
  const failure=await authenticateCronRequest(request);if(failure)return failure;
  const { supabaseAdmin }=await import('@/integrations/supabase/client.server');
  const { removeFiles }=await import('@/lib/privacy.server');
  let processed=0;
  try{
    const {data:orgs,error}=await supabaseAdmin.from('organisations').select('id,retention_years');if(error)throw error;
    for(const org of orgs){
      const {data:cases,error:caseError}=await supabaseAdmin.from('complaints').select('id,status,closed_at,legal_hold,anonymised_at').eq('org_id',org.id).eq('status','closed').eq('legal_hold',false).is('anonymised_at',null).order('closed_at').limit(100);
      if(caseError)throw caseError;
      for(const c of cases??[]){if(retentionState(c,org.retention_years)!=='due')continue;
        await removeFiles(supabaseAdmin,'attachments',`${org.id}/${c.id}`);
        const {error:eraseError}=await supabaseAdmin.rpc('privacy_anonymise_case',{_org:org.id,_case:c.id,_reason:'Configured working-record retention period elapsed; historical audit retained.',_actor:org.id,_retention:true});if(eraseError)throw eraseError;processed++;
      }
    }
    const {data:deletions,error:deleteError}=await supabaseAdmin.from('org_privacy_settings').select('org_id').lte('deletion_due_at',new Date().toISOString()).not('billing_cancellation_verified_at','is',null);if(deleteError)throw deleteError;
    for(const d of deletions??[]){
      const {count,error:holdError}=await supabaseAdmin.from('complaints').select('id',{count:'exact',head:true}).eq('org_id',d.org_id).eq('legal_hold',true);if(holdError)throw holdError;if(count)continue;
      await removeFiles(supabaseAdmin,'attachments',d.org_id);await removeFiles(supabaseAdmin,'firm-logos',d.org_id);
      const {error:purgeError}=await supabaseAdmin.rpc('privacy_purge_org',{_org:d.org_id});if(purgeError)throw purgeError;
    }
    return Response.json({ok:true,processed});
  }catch{ return Response.json({ok:false,error:'Privacy processing failed; will retry on the next scheduled run.'},{status:500}); }
}}}});