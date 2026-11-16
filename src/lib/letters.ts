import type { Database } from "@/integrations/supabase/types";
import { PRODUCTS, CATEGORIES, type QueueRow } from './complaints';

export type TemplateKind = Database["public"]["Enums"]["template_kind"];

export const TEMPLATE_KINDS: Record<TemplateKind, string> = {
  acknowledgement: "Acknowledgement",
  holding: "Holding response",
  final_upheld: "Final response — Upheld",
  final_partially_upheld: "Final response — Partially upheld",
  final_not_upheld: "Final response — Not upheld",
  information_request: "Information request",
  closure: "Closure",
};

export const MERGE_FIELDS = [
  "customer_name", "reference", "date_received", "final_deadline",
  "adr_body_name", "adr_body_contact", "agent_name", "firm_name",
  "complainant_first_name", "customer_ref", "product", "category", "date_of_letter", "ack_deadline", "days_to_final", "complaint_summary", "outcome", "root_cause", "redress_amount", "firm_address", "firm_complaints_email", "agent_email",
] as const;
export type MergeValues = Partial<Record<(typeof MERGE_FIELDS)[number], string>>;
export const MERGE_GROUPS = {
  Customer: ['customer_name', 'complainant_first_name', 'customer_ref'],
  Complaint: ['reference', 'product', 'category', 'complaint_summary', 'agent_name', 'agent_email'],
  Deadlines: ['date_received', 'date_of_letter', 'ack_deadline', 'final_deadline', 'days_to_final'],
  Outcome: ['outcome', 'root_cause', 'redress_amount'],
  'Firm/ADR': ['firm_name', 'firm_address', 'firm_complaints_email', 'adr_body_name', 'adr_body_contact'],
} satisfies Record<string, readonly (keyof MergeValues)[]>;
export const SAMPLE_VALUES: MergeValues = { customer_name: 'Anna Kowalska', complainant_first_name: 'Anna', customer_ref: 'CUS-1042', reference: 'RDR-2026-000123', product: 'Credit transfer', category: 'Fees and charges', complaint_summary: 'An unexpected fee was charged for a transfer.', agent_name: 'Alex Martin', agent_email: 'alex@example.com', date_received: '02 Nov 2026', date_of_letter: '16 Nov 2026', ack_deadline: '09 Nov 2026', final_deadline: '23 Nov 2026', days_to_final: '5', outcome: 'Upheld', root_cause: 'Incorrect fees applied', redress_amount: 'EUR 25.00', firm_name: 'Example Payments', firm_address: '10 Example Street\nParis, France', firm_complaints_email: 'complaints@example.com', adr_body_name: 'Example ADR body', adr_body_contact: 'adr@example.com' };
export const MERGE_LABELS = Object.fromEntries(MERGE_FIELDS.map(f => [f, f.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase())])) as Record<keyof MergeValues, string>;
export function unknownPlaceholders(text: string) {
  return [...new Set([...text.matchAll(/\{([^{}\s]+)\}/g)].map(m => m[1]).filter(k => !MERGE_FIELDS.some(f => f === k)))];
}
export function insertAtCursor(text: string, field: keyof MergeValues, start: number, end = start) {
  const token = `{${field}}`;
  const from = Math.max(0, Math.min(text.length, start));
  return { text: text.slice(0, from) + token + text.slice(Math.max(from, end)), cursor: from + token.length };
}
export function caseMergeValues(c: Partial<QueueRow>, context: { firm: string; address?: string | null; firmEmail?: string | null; agent?: string; agentEmail?: string; adrName?: string | null; adrContact?: string; rootCause?: string; language?: string; date?: Date; extended?: boolean }): MergeValues {
  const language = context.language ?? c.language ?? 'en';
  const locale = ({ en: 'en-GB', fr: 'fr-FR', es: 'es-ES', pt: 'pt-PT', pl: 'pl-PL', nl: 'nl-NL' } as Record<string, string>)[language] ?? 'en-GB';
  const date = (value?: string | null) => value ? formatDate(value) : '';
  return { customer_name: c.complainant_name ?? '', complainant_first_name: c.complainant_name?.trim().split(/\s+/)[0] ?? '', customer_ref: c.customer_ref ?? '', reference: c.reference ?? '', product: c.product ? PRODUCTS[c.product] : '', category: c.category ? CATEGORIES[c.category] : '', complaint_summary: c.summary ?? '', date_received: date(c.received_at), date_of_letter: formatDate((context.date ?? new Date()).toISOString()), ack_deadline: date(c.ack_due), final_deadline: date(context.extended || c.holding_sent_at ? c.extended_due : c.final_due), days_to_final: c.days_left == null ? '' : String(c.days_left), outcome: c.outcome?.replaceAll('_', ' ').replace(/^./, x => x.toUpperCase()) ?? '', root_cause: context.rootCause ?? c.root_cause_category ?? '', redress_amount: c.redress_amount != null && c.redress_currency ? new Intl.NumberFormat(locale, { style: 'currency', currency: c.redress_currency, currencyDisplay: 'code' }).format(c.redress_amount) : '', firm_name: context.firm, firm_address: context.address ?? '', firm_complaints_email: context.firmEmail ?? '', agent_name: context.agent ?? '', agent_email: context.agentEmail ?? '', adr_body_name: context.adrName ?? '', adr_body_contact: context.adrContact ?? '' };
}

export function isFinal(kind: TemplateKind) {
  return kind.startsWith("final_");
}

/** Replace {field} placeholders; unknown or empty fields are left visible so the agent notices. */
export function mergeTemplate(text: string, values: MergeValues) {
  return text.replace(/\{([a-z_]+)\}/g, (m, k: string) => {
    const v = values[k as keyof MergeValues];
    return v ? v : m;
  });
}

/** Final responses must tell the customer about the ADR body. */
export function hasAdrBlock(body: string) {
  return body.includes("{adr_body_name}") && body.includes("{adr_body_contact}");
}

/** Status the complaint moves to when a letter of this kind is marked sent (null = no change).
 *  When the org requires QA, final responses go to pending_qa instead of final_response_sent. */
export function statusAfterLetter(kind: TemplateKind, current: string, qaRequired = false) {
  if (kind === "acknowledgement") return current === "received" ? "acknowledged" : null;
  if (kind === "holding") return "holding_response_sent";
  if (isFinal(kind)) return qaRequired ? "pending_qa" : "final_response_sent";
  if (kind === "closure") return "closed";
  return null;
}

export function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d.length === 10 ? d + "T00:00:00" : d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
