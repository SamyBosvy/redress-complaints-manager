import type { AppRole } from './org';
export function canEditDetails(role: AppRole | null, user: string, c: { assigned_to?: string | null; status?: string | null; privacy_processing?: boolean; legal_hold?: boolean | null; anonymised_at?: string | null }) {
  return !c.privacy_processing && !c.legal_hold && !c.anonymised_at && c.status !== 'closed' && (role === 'org_admin' || role === 'complaints_manager' || (role === 'agent' && c.assigned_to === user));
}
export const detailReasonValid = (reason: string) => reason.trim().length >= 10 && reason.trim().length <= 1000;