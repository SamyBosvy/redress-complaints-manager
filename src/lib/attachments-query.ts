import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
export const attachmentsQuery = (org: string, id: string) => queryOptions({
  queryKey: ['case-attachments', org, id],
  queryFn: async () => {
    const rows = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from('complaint_attachments').select('*').eq('org_id', org).eq('complaint_id', id).order('uploaded_at', { ascending: false }).order('id').range(offset, offset + 499);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 500) return rows;
    }
  },
});