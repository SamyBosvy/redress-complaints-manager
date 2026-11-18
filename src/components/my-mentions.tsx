import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { toast } from 'sonner';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TableSkeleton } from '@/components/table-skeleton';
import { EmptyState } from '@/components/empty-state';
import { mentionsQuery, unreadMentionsQuery, markMentionsRead } from '@/lib/mentions-query';
import { membersQuery } from '@/lib/complaints';
export function MyMentions({ org, user }: { org: string; user: string }) {
  const query = useInfiniteQuery(mentionsQuery(org, user));
  const count = useQuery(unreadMentionsQuery(org, user));
  const members = useQuery(membersQuery(org));
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function mark(id?: string) {
    setBusy(true);
    try { await markMentionsRead(org, user, id); await Promise.all([qc.invalidateQueries({ queryKey: ['my-mentions', org, user] }), qc.invalidateQueries({ queryKey: ['unread-mentions', org, user] })]); }
    catch { toast.error('Could not mark mentions read.'); }
    finally { setBusy(false); }
  }
  const rows = query.data?.pages.flat() ?? [];
  return <section aria-labelledby="my-mentions-title" className="my-6 min-w-0 border-t pt-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 id="my-mentions-title" className="font-semibold">Mentions <span className="text-muted-foreground">({count.data ?? rows.length})</span></h2><Button variant="outline" size="sm" disabled={busy || !rows.length} onClick={() => void mark()}>Mark all read</Button></div>
    {query.isPending ? <TableSkeleton columns={1} rows={2} /> : query.isError && !query.data ? <p role="status" className="mt-3 text-sm text-muted-foreground">Couldn't load mentions.</p> : !rows.length ? <EmptyState title="No unread mentions" description="No internal notes are waiting for you." /> : <ul className="mt-2 divide-y">{rows.map(row => <li key={row.id}><Link to="/app/c/$id" params={{ id: row.complaint_id }} search={{ mentions: true }} onClick={() => void mark(row.id)} className="block min-w-0 rounded-md py-3 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"><p className="font-mono text-xs">{row.complaints.reference}</p><p className="mt-1 break-words text-sm [overflow-wrap:anywhere]">{String((row.complaint_events.detail as { text?: string })?.text ?? '').slice(0, 140)}</p><p className="mt-1 text-xs text-muted-foreground">{members.data?.find(member => member.user_id === row.mentioned_by)?.name ?? 'Firm member'} · {new Date(row.created_at).toLocaleString('en-GB')}</p></Link></li>)}</ul>}
    {query.hasNextPage && <Button variant="outline" size="sm" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>Load more</Button>}
  </section>;
}