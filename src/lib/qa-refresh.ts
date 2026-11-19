import type { QueryClient } from '@tanstack/react-query';
export function refreshQaDecision(client: QueryClient, org: string) {
  return Promise.all([
    client.invalidateQueries({queryKey:['qa-reviews',org]}),
    client.invalidateQueries({queryKey:['queue']}),
    client.invalidateQueries({queryKey:['case']}),
    client.invalidateQueries({queryKey:['timeline',org]}),
  ]);
}