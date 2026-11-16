import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type E = Database["public"]["Enums"];
export type Status = E["complaint_status"];
export type QueueRow = Database["public"]["Views"]["complaint_queue"]["Row"];

export const CHANNELS: Record<E["complaint_channel"], string> = {
  email: "Email", phone: "Phone", chat: "Chat", letter: "Letter", web_form: "Web form", social_media: "Social media", in_person: "In person",
};
export const PRODUCTS: Record<E["complaint_product"], string> = {
  payment_account: "Payment account", card: "Card", credit_transfer: "Credit transfer", direct_debit: "Direct debit",
  e_money_wallet: "E-money wallet", merchant_acquiring: "Merchant acquiring", other: "Other",
};
export const CATEGORIES: Record<E["complaint_category"], string> = {
  unauthorised_transaction: "Unauthorised transaction", fraud_or_scam: "Fraud or scam", fees_and_charges: "Fees and charges",
  account_blocked_or_closed: "Account blocked or closed", payment_delay_or_failure: "Payment delay or failure",
  refund_or_chargeback: "Refund or chargeback", customer_service: "Customer service", data_protection: "Data protection", other: "Other",
};
export const STATUSES: Record<Status, string> = {
  received: "Received", acknowledged: "Acknowledged", under_investigation: "Under investigation",
  holding_response_sent: "Holding response sent", pending_qa: "Pending QA", final_response_sent: "Final response sent", closed: "Closed",
  escalated_to_adr: "Escalated to ADR", reopened: "Reopened",
};
export const LANGUAGES = { en: "English", fr: "French", es: "Spanish", pt: "Portuguese", pl: "Polish", nl: "Dutch" } as const;

/** Statuses where the final-response clock is still running. */
export const CLOCK_RUNNING: Status[] = ["received", "acknowledged", "under_investigation", "holding_response_sent", "pending_qa", "reopened"];

export type ClockTone = "ok" | "risk" | "overdue" | "stopped";
/** Green > 5 business days, amber 0–5, red when overdue. */
export function clockTone(daysLeft: number | null, status: Status): ClockTone {
  if (!CLOCK_RUNNING.includes(status) || daysLeft === null) return "stopped";
  if (daysLeft < 0) return "overdue";
  if (daysLeft <= 5) return "risk";
  return "ok";
}
/** At-risk alert threshold: 3 business days or fewer to deadline. */
export function isAtRisk(daysLeft: number | null, status: Status) {
  return CLOCK_RUNNING.includes(status) && daysLeft !== null && daysLeft >= 0 && daysLeft <= 3;
}

export const membersQuery = (orgId: string) =>
  queryOptions({
    queryKey: ["members", orgId],
    queryFn: async () => {
      const { data: m, error } = await supabase.from("org_members").select("user_id, role").eq("org_id", orgId);
      if (error) throw error;
      const ids = m.map((x) => x.user_id);
      const { data: p } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      return m.map((x) => {
        const prof = p?.find((y) => y.id === x.user_id);
        return { ...x, name: prof?.full_name || prof?.email || "Unknown", email: prof?.email ?? '' };
      });
    },
  });

export const countriesQuery = (orgId: string) =>
  queryOptions({
    queryKey: ["org-countries", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("org_countries").select("*").eq("org_id", orgId);
      if (error) throw error;
      return data;
    },
  });
