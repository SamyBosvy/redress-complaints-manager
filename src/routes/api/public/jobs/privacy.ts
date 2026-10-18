import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';
import { retentionState } from '@/lib/privacy';
export const Route=createFileRoute('/api/public/jobs/privacy')({server:{handlers:{POST:async({request})=>{
  const failure=await authenticateCronRequest(request);if(failure)return failure;
  const { supabaseAdmin }=await import('@/integrations/supabase/client.server');
  const { removeFiles, allRows }=await import('@/lib/privacy.server');
  let processed=0;
  try{
    const {data:candidates,error}=await supabaseAdmin.rpc('privacy_retention_candidates');if(error)throw error;
    for(const org of candidates){
      const cases = await allRows(supabaseAdmin,'complaints',org.org_id);
      for(const row of cases){
        const c={id:String(row['id']),status:String(row['status']),closed_at:row['closed_at'] as string|null,legal_hold:Boolean(row['legal_hold']),anonymised_at:row['anonymised_at'] as string|null};
        if(retentionState(c,org.retention_years)!=='due')continue;
        const {error:claimError}=await supabaseAdmin.rpc('privacy_claim_case',{_org:org.org_id,_case:c.id,_retention:true});if(claimError)continue;
        await removeFiles(supabaseAdmin,'attachments',`${org.org_id}/${c.id}`);
        const {error:eraseError}=await supabaseAdmin.rpc('privacy_anonymise_case',{_org:org.org_id,_case:c.id,_reason:'Configured working-record retention period elapsed; historical audit retained.',_actor:org.org_id,_retention:true});if(eraseError)throw eraseError;processed++;
        if(processed>=5)return Response.json({ok:true,processed,more:true});
      }
    }
    // Organisation purge remains disabled until paused billing can verify cancellation.
    return Response.json({ok:true,processed});
  }catch{ return Response.json({ok:false,error:'Privacy processing failed; will retry on the next scheduled run.'},{status:500}); }
}}}});