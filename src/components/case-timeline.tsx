import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { TableSkeleton } from '@/components/table-skeleton';
import { TIMELINE_GROUPS, mentionSegments, type TimelineEvent, type TimelineSearch } from '@/lib/timeline';
import { mentionMembersQuery, timelineQuery } from '@/lib/timeline-query';
export function CaseTimeline({ org, id, user, search, onSearch, nameOf, renderEvent }: {
  org: string; id: string; user: string; search: TimelineSearch; onSearch: (search: TimelineSearch) => void; nameOf: (user: string | null) => string; renderEvent: (event: TimelineEvent) => React.ReactNode;
}) {
  const query = useInfiniteQuery(timelineQuery(org, id, user, search));
  const members = useQuery(mentionMembersQuery(org, id));
  const [text, setText] = useState(search.q ?? '');
  useEffect(() => setText(search.q ?? ''), [search.q]);
  const groups = search.tl?.split(',') ?? [];
  const rows = query.data?.pages.flatMap(page => page.events) ?? [];
  return <section className="min-w-0 rounded-lg border bg-card p-5" aria-labelledby="timeline-title">
    <h2 id="timeline-title" className="mb-4 text-sm font-semibold">Timeline</h2>
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap gap-1" aria-label="Timeline event groups"><Button size="sm" variant={groups.length ? 'outline' : 'default'} aria-pressed={!groups.length} onClick={() => onSearch({ ...search, tl: undefined })}>All</Button>{Object.entries(TIMELINE_GROUPS).map(([group, label]) => <Button key={group} size="sm" className="h-auto min-h-9 whitespace-normal" aria-pressed={groups.includes(group)} variant={groups.includes(group) ? 'default' : 'outline'} onClick={() => { const next = groups.includes(group) ? groups.filter(value => value !== group) : [...groups, group]; onSearch({ ...search, tl: next.length ? next.join(',') : undefined }); }}>{label}</Button>)}</div>
      <form className="flex min-w-0 gap-2" onSubmit={event => { event.preventDefault(); onSearch({ ...search, q: text || undefined }); }}><Input aria-label="Search notes and attachment names" value={text} maxLength={200} onChange={event => setText(event.target.value)} /><Button size="sm" type="submit">Search</Button></form>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm"><label className="flex items-center gap-2"><Checkbox checked={Boolean(search.mentions)} onCheckedChange={checked => onSearch({ ...search, mentions: checked === true || undefined })} />Mentions of me</label><label className="flex items-center gap-2"><Checkbox checked={Boolean(search.oldest)} onCheckedChange={checked => onSearch({ ...search, oldest: checked === true || undefined })} />Oldest first</label><Button size="sm" variant="link" onClick={() => { setText(''); onSearch({}); }}>Clear</Button></div>
    </div>
    {query.isPending ? <TableSkeleton columns={1} rows={3} /> : query.isError && !query.data ? <p role="status" className="text-sm text-muted-foreground">Couldn't load timeline.</p> : <>
      <p role="status" className="mb-3 text-xs text-muted-foreground">Showing {rows.length} of {query.data?.pages[0]?.total ?? 0} events{Boolean(search.tl || search.q || search.mentions) && ` · ${query.data?.pages[0]?.matching ?? 0} match`}</p>
      {!rows.length && <p className="text-sm text-muted-foreground">No matching events.</p>}
      <ol className="space-y-4">{rows.map(event => { const detail = event.detail as { text?: string; mentions?: string[] }; return <li key={event.id} className="min-w-0 break-words border-l-2 pl-3 text-sm [overflow-wrap:anywhere]">
        {event.kind === 'note' ? <p className="whitespace-pre-wrap rounded bg-muted px-2 py-1">{mentionSegments(detail.text ?? '', detail.mentions ?? [], members.data ?? []).map((part, i) => part.highlighted ? <strong key={i} className="text-primary">{part.text}</strong> : <span key={i}>{part.text}</span>)}</p> : renderEvent(event)}
        <p className="mt-0.5 text-xs text-muted-foreground tabular">{nameOf(event.actor)} · {new Date(event.created_at).toLocaleString('en-GB')}</p>
      </li>; })}</ol>
      {query.isFetchNextPageError && <p role="status" className="mt-3 text-sm text-destructive">Couldn't load more events. Try again.</p>}
      {query.hasNextPage && <Button className="mt-4" variant="outline" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>{query.isFetchingNextPage ? 'Loading…' : 'Load more'}</Button>}
    </>}
  </section>;
}