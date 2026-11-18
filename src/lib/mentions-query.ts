import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
export const unreadMentionsQuery = (org: string, user: string) => queryOptions({
  queryKey: ['unread-mentions', org, user], enabled: Boolean(org && user), refetchInterval: 120_000,
  queryFn: async () => {
    const { count, error } = await supabase.from('note_mentions').select('id', { count: 'exact', head: true }).eq('org_id', org).eq('mentioned_user', user).is('read_at', null);
    if (error) throw error; return count ?? 0;
  },
});
export const mentionsQuery = (org: string, user: string) => infiniteQueryOptions({
  queryKey: ['my-mentions', org, user], initialPageParam: null as { time: string; id: string } | null, refetchInterval: 120_000,
  queryFn: async ({ pageParam }) => {
    let request = supabase.from('note_mentions').select('*,complaints!inner(reference),complaint_events!inner(detail)').eq('org_id', org).eq('mentioned_user', user).is('read_at', null).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(50);
    if (pageParam) request = request.or(`created_at.lt.${pageParam.time},and(created_at.eq.${pageParam.time},id.lt.${pageParam.id})`);
    const { data, error } = await request; if (error) throw error;
    return data;
  },
  getNextPageParam: last => { const row = last.at(-1); return row && last.length === 50 ? { time: row.created_at, id: row.id } : undefined; },
});
export async function markMentionsRead(org: string, user: string, id?: string) {
  let request = supabase.from('note_mentions').update({ read_at: new Date().toISOString() }).eq('org_id', org).eq('mentioned_user', user).is('read_at', null);
  if (id) request = request.eq('id', id);
  const { error } = await request; if (error) throw error;
}