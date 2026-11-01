import { TableSkeleton } from '@/components/table-skeleton';
import { useRouterState } from '@tanstack/react-router';

function AuthenticatedPending() {
  const path = useRouterState({select: state => state.location.pathname});
  return path === '/app' || path.startsWith('/app/') || path === '/account' || path === '/setup' ? <TableSkeleton /> : null;
}

import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPendingComponent: AuthenticatedPending,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
