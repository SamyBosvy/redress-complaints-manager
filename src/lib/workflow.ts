import type { Status } from './complaints';
import type { AppRole } from './org';
import { CURRENCIES } from './currencies';

export const TRANSITIONS: Record<Status, Status[]> = {
  received: ['acknowledged', 'closed'],
  acknowledged: ['under_investigation', 'holding_response_sent', 'pending_qa', 'final_response_sent', 'closed'],
  under_investigation: ['holding_response_sent', 'pending_qa', 'final_response_sent', 'closed'],
  holding_response_sent: ['under_investigation', 'pending_qa', 'final_response_sent', 'closed'],
  reopened: ['under_investigation', 'pending_qa', 'final_response_sent', 'closed'],
  pending_qa: ['under_investigation', 'final_response_sent', 'closed'],
  final_response_sent: ['closed', 'escalated_to_adr'],
  closed: ['reopened', 'escalated_to_adr'], escalated_to_adr: [],
};
export function nextStatuses(status: Status, role: AppRole | null, qa: boolean, editable = true) {
  if (!editable || !role || role === 'read_only') return [];
  return TRANSITIONS[status].filter(next => next !== 'pending_qa' || qa).filter(next => next !== 'final_response_sent' || !qa || status === 'pending_qa');
}
export const FOUR_EYES = 'Four-eyes rule: someone else must approve this';
export function fourEyes(user: string, author: string | null | undefined, handler: string | null | undefined) {
  return user === author || user === handler;
}
export type CloseChecklist = { outcome: string; rootCause: string; withdrawalReason: string; finalSent: boolean; adr: boolean; redressNone: boolean; goodwillNone: boolean; redress: string; goodwill: string; redressCurrency: string; goodwillCurrency: string };
const paymentComplete = (none: boolean, amount: string, currency: string) => none ? amount === '' : amount.trim() !== '' && Number.isFinite(Number(amount)) && Number(amount) >= 0 && CURRENCIES.some(code => code === currency);
export function closeComplete(c: CloseChecklist) {
  return ['upheld','partially_upheld','not_upheld','withdrawn'].includes(c.outcome) && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c.rootCause) && c.adr && (c.outcome === 'withdrawn' ? !!c.withdrawalReason.trim() : c.finalSent) && paymentComplete(c.redressNone,c.redress,c.redressCurrency) && paymentComplete(c.goodwillNone,c.goodwill,c.goodwillCurrency);
}
export function transitionRequirement(next: Status, current: Status, letters: readonly { kind: string; status: string }[], reason: string | null | undefined) {
  const sent = (kind: string) => letters.some(l => l.kind === kind && l.status === 'sent');
  if (next === 'closed') return 'Complete the close checklist';
  if (next === 'acknowledged' && !sent('acknowledgement')) return 'Send the acknowledgement letter first';
  if (next === 'holding_response_sent' && (!sent('holding') || !reason?.trim())) return 'Send a holding letter and record the reason for delay';
  if (next === 'pending_qa' && !letters.some(l => l.kind.startsWith('final_') && l.status === 'pending_approval')) return 'Submit a final response for QA first';
  if (next === 'final_response_sent' && current === 'pending_qa') return 'Waiting for QA approval';
  if (next === 'final_response_sent' && !letters.some(l => l.kind.startsWith('final_') && l.status === 'sent')) return 'Send the final response letter first';
  return '';
}
export function workflowError(message: string) {
  if (/cannot approve a letter you wrote|cannot review a complaint assigned to you/i.test(message)) return FOUR_EYES;
  if (/Acknowledgement requires/i.test(message)) return 'Send the acknowledgement letter first.';
  if (/Final response requires QA|must go through QA/i.test(message)) return 'Waiting for QA approval.';
  if (/Invalid status change/i.test(message)) return 'This next step is no longer available. Refresh the complaint and try again.';
  if (/closing|before closing|ADR referral/i.test(message)) return 'Complete the close checklist, including the final response or withdrawal reason, payments and ADR rights.';
  if (/currency|amount|confirmed none/i.test(message)) return 'Enter a valid payment amount and ISO currency, or confirm no payment.';
  if (/review|pending final letter/i.test(message)) return 'This review is no longer available. Refresh and check the pending final response.';
  if (/holding|delay/i.test(message)) return 'Send a holding letter and record the reason for delay.';
  if (/final response|final-response/i.test(message)) return 'Send or submit the final response at the appropriate next step first.';
  if (/read-only|privacy/i.test(message)) return 'This complaint is read-only.';
  return 'The change could not be saved. Refresh the complaint and check your access before trying again.';
}