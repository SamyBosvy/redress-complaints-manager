export type CustomerIdentity = { customerRef?: string | null; email?: string | null };

export function normaliseCustomer(identity: CustomerIdentity) {
  return { customerRef: identity.customerRef?.trim() ?? '', email: identity.email?.trim().toLowerCase() ?? '' };
}

// PostgREST quoted literals escape both quotes and backslashes. Escape LIKE
// metacharacters too: ilike must be an exact, case-insensitive email match.
function literal(value: string) {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function customerFilter(identity: CustomerIdentity): string | null {
  const { customerRef, email } = normaliseCustomer(identity);
  const clauses: string[] = [];
  if (customerRef) clauses.push(`customer_ref.eq.${literal(customerRef)}`);
  if (email) clauses.push(`complainant_email.ilike.${literal(email.replace(/[\\%_*]/g, '\\$&'))}`);
  return clauses.length ? clauses.join(',') : null;
}

export function isOpenComplaint(status: string | null) {
  return status !== null && status !== 'closed';
}

export function eligibleCustomerHistory(row: { id: string | null; anonymised_at: string | null }, currentId?: string) {
  return row.id !== currentId && row.anonymised_at === null;
}

export function openCount(rows: { status: string | null }[]) {
  return rows.filter(row => isOpenComplaint(row.status)).length;
}