import type {AppRole} from './org';

export function securityDestination(m: {needsVerification: boolean; needs2fa: boolean} | null) {
  if (m?.needsVerification) return '/verify-email' as const;
  if (m?.needs2fa) return '/two-factor' as const;
  return null;
}
export function canViewSettings(role: AppRole | null | undefined) {
  return role === 'org_admin' || role === 'complaints_manager';
}
export function canRecalculate(role: AppRole | null | undefined, anonymised: boolean, processing: boolean) {
  return role === 'org_admin' && !anonymised && !processing;
}
export function validRecalculationReason(reason: string) {
  return reason.trim().length >= 10 && reason.trim().length <= 1000;
}