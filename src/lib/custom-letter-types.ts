import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const customLetterTypesQuery = (orgId: string) => queryOptions({
  queryKey: ['custom-letter-types', orgId],
  enabled: Boolean(orgId),
  queryFn: async () => {
    const { data, error } = await supabase.from('custom_letter_types').select('*').eq('org_id', orgId).order('name');
    if (error) throw error;
    return data;
  },
});
