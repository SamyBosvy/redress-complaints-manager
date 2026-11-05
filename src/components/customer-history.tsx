import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { customerHistoryQuery } from '@/lib/customer-history-query';
import { normaliseCustomer, type CustomerIdentity } from '@/lib/customer-history';
import { CATEGORIES } from '@/lib/complaints';
import { formatDate } from '@/lib/letters';
import { StatusPill } from '@/components/status-pill';

export function CustomerHistory({ orgId, currentId, identity }: { orgId: string; currentId: string; identity: CustomerIdentity }) {
  const result = useQuery(customerHistoryQuery(orgId, identity, currentId));
  return <section className="min-w-0 rounded-lg border bg-card p-5">
    <h2 className="text-sm font-semibold">Customer history</h2>
    {result.isError ? <p className="mt-3 text-sm text-muted-foreground">Couldn't load customer history.</p>
      : result.isFetching ? <p className="mt-3 text-sm text-muted-foreground">Checking customer history…</p>
      : !result.data?.total ? <p className="mt-3 text-sm text-muted-foreground">No other complaints from this customer.</p>
      : <>
        <p className="mt-2 text-sm text-muted-foreground">{result.data.total} previous complaint{result.data.total === 1 ? '' : 's'} · {result.data.open} open</p>
        <ul className="mt-3 space-y-3">
          {result.data.rows.map(row => row.id && <li key={row.id} className="border-t pt-3 text-sm">
            <Link to="/app/c/$id" params={{ id: row.id }} className="break-all font-mono text-primary hover:underline">{row.reference}</Link>
            <p className="mt-1 text-xs text-muted-foreground">{formatDate(row.received_at)} · {row.category ? CATEGORIES[row.category] : '—'}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">{row.status && <StatusPill status={row.status} />}
              {row.status === 'closed' && row.outcome && <span>{row.outcome.replaceAll('_', ' ')}</span>}
            </div>
          </li>)}
        </ul>
      </>}
  </section>;
}

export function useDuplicateWarning(orgId: string, identity: CustomerIdentity) {
  const normalised = normaliseCustomer(identity);
  const [settled, setSettled] = useState(normalised);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(normalised), 400);
    return () => clearTimeout(timer);
  }, [normalised.customerRef, normalised.email]);
  const result = useQuery(customerHistoryQuery(orgId, settled, undefined, true));
  // Never display matches from a previous identity while a new lookup settles.
  const current = settled.customerRef === normalised.customerRef && settled.email === normalised.email;
  return { result, current, onBlur: () => setSettled(normalised) };
}

export function DuplicateWarning({ lookup }: { lookup: ReturnType<typeof useDuplicateWarning> }) {
  if (!lookup.current) return null;
  if (lookup.result.isError) return <p role="status" className="mt-6 text-sm text-muted-foreground">Couldn't check for open complaints.</p>;
  const data = lookup.result.data;
  if (!data?.open) return null;
  return <div role="status" className="mt-6 min-w-0 rounded-lg border border-warning bg-warning/10 p-4 text-sm">
    <p className="font-medium text-warning">This customer has {data.open} open complaint{data.open === 1 ? '' : 's'}</p>
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
      {data.rows.map(row => row.id && <li key={row.id}><Link to="/app/c/$id" params={{ id: row.id }} target="_blank" rel="noopener noreferrer" className="break-all text-primary underline" aria-label={`${row.reference} (opens in a new tab)`}>{row.reference}</Link></li>)}
    </ul>
  </div>;
}