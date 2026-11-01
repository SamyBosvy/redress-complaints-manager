import { Skeleton } from '@/components/ui/skeleton';

export function TableSkeletonRows({ columns = 5, rows = 6 }: { columns?: number; rows?: number }) {
  return <>{Array.from({ length: rows }, (_, row) => <tr key={row} aria-hidden="true" className="border-b last:border-0">
    {Array.from({ length: columns }, (_, col) => <td key={col} className="px-4 py-4"><Skeleton className={col % 2 ? 'h-4 w-3/4' : 'h-4 w-full'} /></td>)}
  </tr>)}</>;
}

export function TableSkeleton({ columns = 5, rows = 6 }: { columns?: number; rows?: number }) {
  return <div role="status" aria-label="Loading records" className="min-w-0 overflow-hidden rounded-lg border bg-card">
    <span className="sr-only">Loading records</span>
    <table aria-hidden="true" className="w-full table-fixed"><thead className="border-b bg-muted/50"><tr>{Array.from({ length: columns }, (_, col) => <th key={col} className="px-4 py-3"><Skeleton className="h-3 w-3/4" /></th>)}</tr></thead><tbody><TableSkeletonRows columns={columns} rows={rows} /></tbody></table>
  </div>;
}