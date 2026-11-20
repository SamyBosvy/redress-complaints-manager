import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { boardInputSchema } from './board-report';
import type { Json } from '@/integrations/supabase/types';
export const previewBoardReport=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>boardInputSchema.parse(v)).handler(async({context,data})=>{
 const {boardPreview}=await import('./board-report.server');return boardPreview(context.supabase,data);
});
export const issueBoardReport=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>boardInputSchema.parse(v)).handler(async({context,data})=>{
 const {boardPreview}=await import('./board-report.server');const snapshot=await boardPreview(context.supabase,data);
 const values={period_start:data.from,period_end:data.to,title:data.title,commentary:data.commentary,snapshot:snapshot as unknown as Json,status:'issued'};
 const q=data.id?context.supabase.from('board_reports').update(values).eq('org_id',data.org).eq('id',data.id).eq('status','draft'):context.supabase.from('board_reports').insert({...values,org_id:data.org,created_by:context.userId});
 const {data:issued,error}=await q.select('*').single();if(error)throw error;return issued;
});