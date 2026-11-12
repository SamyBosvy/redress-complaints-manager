const DAY_MS = 86_400_000;

const utcDay = (date: Date) => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

/** UTC calendar days avoid browser timezone and daylight-saving differences.
 * A live trial ending today retains one day until its exact expiry instant.
 */
export function trialState(endsAt: string, now = new Date()) {
  const end = new Date(endsAt);
  if (!Number.isFinite(end.getTime())) return null;
  const expired = end.getTime() <= now.getTime();
  const calendarDays = Math.round((utcDay(end) - utcDay(now)) / DAY_MS);
  const days = expired ? 0 : Math.max(1, calendarDays);
  const today = !expired && calendarDays === 0;
  const tone = days > 7 ? 'neutral' : days >= 3 ? 'warning' : 'destructive';
  return { days, today, expired, tone, dismissible: days > 2 } as const;
}

export const TRIAL_PLANS = [
  { name: 'Starter', features: ['3 seats · 100 complaints per month', 'Complaint handling and deadline tracking', 'Standard letters, audit trail and core reports'] },
  { name: 'Growth', features: ['10 seats · 500 complaints per month', 'Everything in Starter', 'Custom templates and firm branding', 'QA review and regulatory PDF pack'] },
  { name: 'Scale', features: ['Unlimited seats and complaints', 'Everything in Growth', 'Contact us to discuss your firm’s needs'] },
] as const;