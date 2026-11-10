import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { newestLetters, type CaseLetter } from './case-letters';

export const caseLettersQuery = (orgId: string, complaintId: string, anonymised = false) => queryOptions({
  queryKey: ['case-letters', orgId, complaintId, anonymised],
  enabled: !anonymised,
  retry: false,
  queryFn: async () => {
    const letters: CaseLetter[] = [];
    const size = 200;
    for (let offset = 0; ; offset += size) {
      const { data, error } = await supabase.from('letters').select('*')
        .eq('org_id', orgId).eq('complaint_id', complaintId)
        .order('sent_at', { ascending: false }).order('id', { ascending: true }).range(offset, offset + size - 1);
      if (error) throw error;
      letters.push(...data);
      if (data.length < size) break;
    }
    return newestLetters(letters);
  },
});