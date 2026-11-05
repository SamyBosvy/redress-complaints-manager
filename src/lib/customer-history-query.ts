import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { customerFilter, normaliseCustomer, type CustomerIdentity } from './customer-history';

export function customerHistoryQuery(orgId: string, identity: CustomerIdentity, currentId?: string, openOnly = false) {
  const filter = customerFilter(identity);
  return queryOptions({
    queryKey: ['customer-history', orgId, normaliseCustomer(identity), currentId, openOnly],
    enabled: Boolean(orgId && filter),
    retry: false,
    queryFn: async () => {
      const base = () => {
        let q = supabase.from('complaint_queue')
          .select('id,reference,received_at,category,status,outcome', { count: 'exact' })
          .eq('org_id', orgId).is('anonymised_at', null);
        if (filter) q = q.or(filter);
        if (currentId) q = q.neq('id', currentId);
        if (openOnly) q = q.neq('status', 'closed');
        return q;
      };
      if (!filter) return { rows: [], total: 0, open: 0 };
      const first = await base().order('received_at', { ascending: false }).order('id').range(0, openOnly ? 99 : 9);
      if (first.error) throw first.error;
      const rows = first.data;
      const total = first.count ?? 0;
      if (openOnly) {
        for (let offset = 100; offset < total; offset += 100) {
          const next = await base().order('received_at', { ascending: false }).order('id').range(offset, offset + 99);
          if (next.error) throw next.error;
          rows.push(...next.data);
        }
        return { rows, total, open: total };
      }
      const count = await base().neq('status', 'closed').limit(0);
      if (count.error) throw count.error;
      return { rows, total, open: count.count ?? 0 };
    },
  });
}