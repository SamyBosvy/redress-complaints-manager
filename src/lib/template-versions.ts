import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
export function lineDiff(oldText: string, newText: string) {
  const oldLines=oldText.split('\n'), newLines=newText.split('\n');
  let start=0;
  while(start<oldLines.length&&start<newLines.length&&oldLines[start]===newLines[start])start++;
  let end=0;
  while(end<oldLines.length-start&&end<newLines.length-start&&oldLines[oldLines.length-1-end]===newLines[newLines.length-1-end])end++;
  return [...oldLines.slice(0,start).map(text=>({kind:'same' as const,text})),...oldLines.slice(start,oldLines.length-end).map(text=>({kind:'removed' as const,text})),...newLines.slice(start,newLines.length-end).map(text=>({kind:'added' as const,text})),...oldLines.slice(oldLines.length-end).map(text=>({kind:'same' as const,text}))];
}
export function restoreTemplate(version: {id:string;subject:string;body:string}) { return {subject:version.subject,body:version.body,restored_from:version.id}; }
export const templateVersionsQuery=(org:string,template:string)=>queryOptions({queryKey:['template-versions',org,template],enabled:Boolean(template),queryFn:async()=>{
  const {data,error}=await supabase.from('template_versions').select('*').eq('org_id',org).eq('template_id',template).order('saved_at',{ascending:false}).order('id').limit(100);
  if(error)throw error;return data;
}});