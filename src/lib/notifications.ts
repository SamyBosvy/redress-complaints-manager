import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
export const NOTIFICATION_KINDS = { mention:'Mentions', assigned:'Assignments', qa_pending:'QA awaiting review', qa_returned:'QA returned', qa_sample:'QA sampling', reopened:'Reopened cases', deadline_at_risk:'Deadlines at risk', deadline_overdue:'Overdue deadlines' } as const;
export type NotificationKind = keyof typeof NOTIFICATION_KINDS;
export type NotificationRow = Database['public']['Tables']['notifications']['Row'];
export const alwaysOn = (kind: string) => kind === 'mention' || kind === 'qa_returned';
export type NotificationSearch = { kind?: NotificationKind | undefined; unread?: boolean | undefined; page?: number | undefined };
export function parseNotificationSearch(s: Record<string, unknown>): NotificationSearch {
  const page = Number(s['page']);
  return { kind: typeof s['kind'] === 'string' && Object.hasOwn(NOTIFICATION_KINDS,s['kind']) ? s['kind'] as NotificationKind : undefined, unread: s['unread'] === true || s['unread'] === 'true' ? true : undefined, page: Number.isInteger(page) && page > 0 ? Math.min(page,100000) : 1 };
}
export function notificationLink(n: Pick<NotificationRow,'link_path'|'complaint_id'>) {
  const match = n.link_path?.match(/^\/app\/c\/([0-9a-f-]{36})(?:\?(.*))?$/i);
  if (match && match[1] === n.complaint_id) return { id:match[1], notes: new URLSearchParams(match[2]).get('tl') === 'notes' || new URLSearchParams(match[2]).get('timeline_groups') === 'notes' };
  return n.complaint_id ? {id:n.complaint_id,notes:false} : null;
}
export const notificationLabel = (kind:string) => Object.hasOwn(NOTIFICATION_KINDS,kind) ? NOTIFICATION_KINDS[kind as NotificationKind] : 'Notification';
export function relativeNotificationTime(timestamp:string,now=new Date()) {
  const seconds=Math.max(0,Math.floor((now.getTime()-Date.parse(timestamp))/1000));
  if (!Number.isFinite(seconds)) return '';
  if(seconds<60)return 'Just now';
  if(seconds<3600)return `${Math.floor(seconds/60)}m ago`;
  if(seconds<86400)return `${Math.floor(seconds/3600)}h ago`;
  return `${Math.floor(seconds/86400)}d ago`;
}
export const notificationListQuery=(user:string,org:string,search:NotificationSearch={},size=50)=>queryOptions({
  queryKey:['notifications',user,org,'list',search,size],
  queryFn:async()=>{
    let q=supabase.from('notifications').select('*, complaints(reference)',{count:'exact'}).eq('user_id',user).eq('org_id',org);
    if(search.kind)q=q.eq('kind',search.kind);if(search.unread)q=q.is('read_at',null);
    const start=((search.page??1)-1)*size;
    const {data,error,count}=await q.order('created_at',{ascending:false}).order('id',{ascending:false}).range(start,start+size-1);
    if(error)throw error;return {rows:data,total:count??0};
  },refetchInterval:60000,refetchOnWindowFocus:true,
});
export const notificationCountQuery=(user:string,org:string)=>queryOptions({queryKey:['notifications',user,org,'unread'],queryFn:async()=>{
  const {count,error}=await supabase.from('notifications').select('id',{count:'exact',head:true}).eq('user_id',user).eq('org_id',org).is('read_at',null);if(error)throw error;return count??0;
},refetchInterval:60000,refetchOnWindowFocus:true});
export async function setNotificationRead(user:string,org:string,id:string|null,read=true){
  let q=supabase.from('notifications').update({read_at:read?new Date().toISOString():null}).eq('user_id',user).eq('org_id',org);
  q=id?q.eq('id',id):q.is('read_at',null);const {error}=await q;if(error)throw error;
}
export const notificationPreferencesQuery=(user:string,org:string)=>queryOptions({queryKey:['notification-preferences',user,org],queryFn:async()=>{
  const {data,error}=await supabase.from('notification_preferences').select('*').eq('user_id',user).eq('org_id',org);if(error)throw error;return data;
}});