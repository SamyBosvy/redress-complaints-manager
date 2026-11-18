import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { parseTimelineSearch, type TimelineSearch, type TimelineEvent } from './timeline';
export const mentionMembersQuery = (org: string, id: string) => queryOptions({ queryKey: ['mention-members', org, id], queryFn: async () => {
  const { data, error } = await supabase.rpc('case_mention_members', { _complaint_id: id });
  if (error) throw error; return data;
} });
type Cursor = { time: string; id: string } | null;
type Page = { total: number; matching: number; events: TimelineEvent[] };
export const timelineQuery = (org: string, id: string, user: string, raw: TimelineSearch) => {
  const search = parseTimelineSearch(raw);
  return infiniteQueryOptions({
    queryKey: ['timeline', org, id, user, search], initialPageParam: null as Cursor,
    queryFn: async ({ pageParam }): Promise<Page> => {
      const { data, error } = await supabase.rpc('case_timeline_page', { _case: id, _groups: search.tl?.split(',') ?? [], _query: search.q ?? '', _mine: Boolean(search.mentions), _oldest: Boolean(search.oldest), ...(pageParam ? { _cursor_time: pageParam.time, _cursor_id: pageParam.id } : {}) });
      if (error) throw error;
      return data as unknown as Page;
    },
    getNextPageParam: (last, pages): Cursor | undefined => {
      const event = last.events.at(-1);
      return event && pages.reduce((n, page) => n + page.events.length, 0) < last.matching ? { time: event.created_at, id: event.id } : undefined;
    },
  });
};