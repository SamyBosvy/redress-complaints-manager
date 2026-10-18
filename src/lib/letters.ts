import type { Database } from "@/integrations/supabase/types";

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
] as const;
export type MergeValues = Partial<Record<(typeof MERGE_FIELDS)[number], string>>;

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
