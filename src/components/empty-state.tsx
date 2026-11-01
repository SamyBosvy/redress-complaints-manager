import type { ReactNode } from 'react';
import { Inbox, type LucideIcon } from 'lucide-react';

export function EmptyState({ icon: Icon = Inbox, title, description, primaryAction, secondaryAction }: {
  icon?: LucideIcon;
  title: string;
  description: string;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
}) {
  return <div className="flex min-w-0 flex-col items-center gap-3 px-4 py-10 text-center">
    <Icon aria-hidden="true" className="h-8 w-8 text-muted-foreground" />
    <div className="space-y-1"><h2 className="text-base font-semibold text-foreground">{title}</h2><p className="text-sm text-muted-foreground">{description}</p></div>
    {(primaryAction || secondaryAction) && <div className="flex max-w-full flex-wrap justify-center gap-2 [&>a]:h-auto [&>a]:min-h-10 [&>a]:whitespace-normal [&>button]:h-auto [&>button]:min-h-10 [&>button]:whitespace-normal">{primaryAction}{secondaryAction}</div>}
  </div>;
}