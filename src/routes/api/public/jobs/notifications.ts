import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';
export const Route=createFileRoute('/api/public/jobs/notifications')({server:{handlers:{POST:async({request})=>{
  const failure=await authenticateCronRequest(request);if(failure)return failure;
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const {error}=await supabaseAdmin.rpc('notification_deadline_job',{});
  return error?Response.json({ok:false},{status:500}):Response.json({ok:true});
}}}});