import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
export type RootCause = Database['public']['Tables']['root_causes']['Row'];
export function rootCauseLabel(id: string | null | undefined, legacy: string | null | undefined, causes: readonly Pick<RootCause,'id'|'name'>[], prefix = true) {
  return causes.find(c => c.id === id)?.name ?? (legacy ? `${prefix ? 'Legacy: ' : ''}${legacy}` : '—');
}
export const rootCausesQuery = (org: string) => queryOptions({ queryKey: ['root-causes',org], queryFn: async () => {
  const {data,error} = await supabase.from('root_causes').select('*').eq('org_id',org).order('sort_order').order('name');
  if(error) throw error; return data;
}});