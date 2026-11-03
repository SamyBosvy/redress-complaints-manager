import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { TRIAL_CONTACT_EMAIL, TRIAL_PLANS, trialState } from '@/lib/trial';
import { cn } from '@/lib/utils';

export function TrialBanner({ orgId, endsAt, isAdmin }: { orgId: string; endsAt: string; isAdmin: boolean }) {
  const [now, setNow] = useState<Date | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const key = `redress:trial-dismissed:${orgId}:${endsAt}`;
  useEffect(() => {
    setNow(new Date());
    try { setDismissed(sessionStorage.getItem(key) === '1'); } catch { setDismissed(false); }
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, [key]);
  const state = now ? trialState(endsAt, now) : null;
  if (!state || (state.dismissible && dismissed)) return null;
  const dismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(key, '1'); } catch { /* Keep dismissed for this mount. */ }
  };
  return (
    <section aria-label="Trial status" className={cn('flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2 text-sm md:px-6',
      state.tone === 'neutral' ? 'bg-muted text-foreground' : state.tone === 'warning' ? 'bg-warning text-warning-foreground' : 'bg-destructive text-destructive-foreground')}>
      <p className="min-w-0 flex-1 basis-48">
        {state.expired ? 'Your trial has ended' : state.today ? 'Your trial ends today.' : `Free trial: ${state.days} ${state.days === 1 ? 'day' : 'days'} left · All Growth features included.`}
      </p>
      <Dialog>
        <DialogTrigger asChild><Button variant="link" className="h-auto min-h-10 px-0 text-inherit underline">Compare plans</Button></DialogTrigger>
        <DialogContent className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl flex-col gap-4 p-4 sm:p-6">
          <DialogHeader className="shrink-0 pr-6">
            <DialogTitle>Starter / Growth / Scale</DialogTitle>
            <DialogDescription>Pricing coming soon</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto">
            <div className="grid gap-4 sm:grid-cols-3">
              {TRIAL_PLANS.map(plan => <section key={plan.name} className="min-w-0">
                <h3 className="font-semibold">{plan.name}</h3>
                <ul className="mt-2 space-y-2 text-sm text-muted-foreground">{plan.features.map(feature => <li key={feature}>{feature}</li>)}</ul>
              </section>)}
            </div>
            <section className="mt-5 border-t pt-4 text-sm">
              <h3 className="font-semibold">When your trial ends</h3>
              <p className="mt-2 text-muted-foreground">Nothing is locked while billing is paused. When billing launches, only exports, custom templates, QA and branding may be restricted by your plan. Complaint intake, handling and letters remain available. Your data is never deleted because your trial ends.</p>
            </section>
          </div>
          <div className="shrink-0 space-y-2">
            {isAdmin && <Button asChild variant="outline" className="w-full min-h-12"><a href={`mailto:${TRIAL_CONTACT_EMAIL}`}>Talk to us</a></Button>}
            <DialogClose asChild><Button className="w-full min-h-12">Continue</Button></DialogClose>
          </div>
        </DialogContent>
      </Dialog>
      {state.dismissible && <Button variant="ghost" size="icon" aria-label="Dismiss trial banner for this session" className="shrink-0 text-inherit" onClick={dismiss}><X aria-hidden="true" className="h-4 w-4" /></Button>}
    </section>
  );
}