import { createFileRoute } from '@tanstack/react-router';
import { queryOptions, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { ComplaintImport } from '@/components/complaint-import';
import { supabase } from '@/integrations/supabase/client';
import { membershipQuery, useMembership } from '@/lib/org';
import { canImport } from '@/lib/import';
import { pageHead } from '@/lib/settings';

const importMembersQuery = (orgId: string) => queryOptions({
  queryKey: ['import-members', orgId],
  queryFn: async () => {
    try {
      const { data, error } = await supabase.rpc('org_member_directory', { _org: orgId });
      if (error) return null;
      return data ?? [];
    } catch { return null; }
  },
});
export const Route = createFileRoute('/_authenticated/app/settings/import')({
  loader: async ({ context }) => {
    const membership = await context.queryClient.ensureQueryData(membershipQuery);
    if (membership?.org && canImport(membership.role)) await context.queryClient.ensureQueryData(importMembersQuery(membership.org.id));
  },
  head: () => pageHead('Import complaints', 'Map and validate existing complaint files before importing them into your firm.'),
  component: ImportPage,
});
function ImportPage() {
  const membership = useMembership();
  if (!membership?.org || !canImport(membership.role)) return <p>Only Org Admins and Complaints Managers can import complaints.</p>;
  return <ImportContent orgId={membership.org.id} userId={membership.user.id} />;
}
function ImportContent({ orgId, userId }: { orgId: string; userId: string }) {
  const { data: members } = useSuspenseQuery(importMembersQuery(orgId));
  const queryClient = useQueryClient();
  return <ComplaintImport key={orgId} orgId={orgId} userId={userId} members={members} insert={rows => supabase.from('complaints').insert(rows)} onComplete={() => { void queryClient.invalidateQueries({ queryKey: ['queue'] }); }} />;
}