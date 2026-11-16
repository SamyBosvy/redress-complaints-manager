import { createFileRoute } from '@tanstack/react-router';
import { AuditHistory } from '@/components/audit-history';
import { TableSkeleton } from '@/components/table-skeleton';
import { membershipQuery, useMembership } from '@/lib/org';
import { membersQuery } from '@/lib/complaints';
import { parseAuditSearch } from '@/lib/audit';

export const Route = createFileRoute('/_authenticated/app/audit')({
  validateSearch: parseAuditSearch,
  loader: async ({ context }) => {
    const m = await context.queryClient.ensureQueryData(membershipQuery);
    if (m?.org) await context.queryClient.ensureQueryData(membersQuery(m.org.id));
  },
  head: () => ({ meta: [{ title: "Audit log — Redress" }, { name: "description", content: "Review the immutable audit history for your firm." }, { property: "og:title", content: "Audit log — Redress" }, { property: "og:description", content: "Review the immutable audit history for your firm." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  pendingComponent: () => <TableSkeleton columns={5} />,
  component: Audit,
});
function Audit() {
  const m = useMembership();
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  if (!m?.org) return null;
  if (!['org_admin', 'complaints_manager', 'read_only'].includes(m.role ?? '')) return <p className="text-muted-foreground">You do not have access to the audit log.</p>;
  return <div className="mx-auto max-w-7xl space-y-6"><h1 className="text-2xl font-semibold">Audit log</h1><AuditHistory orgId={m.org.id} role={m.role} zone={m.org.time_zone} filters={filters} onFilters={next => void navigate({ search: next })} /></div>;
}
