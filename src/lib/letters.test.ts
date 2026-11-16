import { describe, expect, it } from "vitest";
import { hasAdrBlock, mergeTemplate, statusAfterLetter, caseMergeValues, unknownPlaceholders, insertAtCursor, MERGE_FIELDS, MERGE_GROUPS, SAMPLE_VALUES } from "./letters";

describe("letters", () => {
  it('groups every merge field and supplies samples', () => {
    expect(Object.values(MERGE_GROUPS).flat().sort()).toEqual([...MERGE_FIELDS].sort());
    expect(MERGE_FIELDS.every(f => Boolean(SAMPLE_VALUES[f]))).toBe(true);
  });
  it('detects unknown fields, including digits, without rejecting known fields', () => expect(unknownPlaceholders('{custmer_name} {customer_name} {field2}')).toEqual(['custmer_name', 'field2']));
  it('inserts at a cursor and replaces a selection', () => {
    expect(insertAtCursor('Dear ,', 'customer_name', 5)).toEqual({ text: 'Dear {customer_name},', cursor: 20 });
    expect(insertAtCursor('Dear NAME,', 'customer_name', 5, 9).text).toBe('Dear {customer_name},');
  });
  it('fills case values and recorded-currency amounts in letter locale', () => {
    const c = { complainant_name: 'Anna Kowalska', product: 'credit_transfer' as const, category: 'fees_and_charges' as const, redress_amount: 1234.5, redress_currency: 'PLN', days_left: 0, ack_due: '2026-11-10', summary: 'Fee error', outcome: 'partially_upheld' as const };
    const values = caseMergeValues(c, { firm: 'Firm', language: 'pl', date: new Date('2026-11-16T12:00:00Z'), rootCause: 'Incorrect fees applied' });
    expect(values.complainant_first_name).toBe('Anna');
    expect(values.product).toBe('Credit transfer');
    expect(values.category).toBe('Fees and charges');
    expect(values.days_to_final).toBe('0');
    expect(values.root_cause).toBe('Incorrect fees applied');
    expect(values.redress_amount).toBe(new Intl.NumberFormat('pl-PL', {style:'currency',currency:'PLN',currencyDisplay:'code'}).format(1234.5));
    expect(caseMergeValues(c, {firm:'Firm',language:'fr'}).redress_amount).toBe(new Intl.NumberFormat('fr-FR', {style:'currency',currency:'PLN',currencyDisplay:'code'}).format(1234.5));
  });
  it('leaves missing values visible and never infers a missing currency', () => {
    const values = caseMergeValues({redress_amount:25}, {firm:''});
    expect(mergeTemplate('{redress_amount} {firm_complaints_email} {customer_ref}', values)).toBe('{redress_amount} {firm_complaints_email} {customer_ref}');
  });
  it("fills merge fields", () => {
    expect(mergeTemplate("Dear {customer_name}, ref {reference}", { customer_name: "Ana", reference: "RDR-2026-000001" }))
      .toBe("Dear Ana, ref RDR-2026-000001");
  });
  it("leaves missing fields visible", () => expect(mergeTemplate("{adr_body_name}", {})).toBe("{adr_body_name}"));
  it("warns when a final response lacks the ADR block", () => {
    expect(hasAdrBlock("We do not uphold.")).toBe(false);
    expect(hasAdrBlock("Refer to {adr_body_name} at {adr_body_contact}")).toBe(true);
  });
  it("sending a holding response switches to the holding status", () =>
    expect(statusAfterLetter("holding", "under_investigation")).toBe("holding_response_sent"));
  it("sending a final response sets final response sent", () =>
    expect(statusAfterLetter("final_not_upheld", "holding_response_sent")).toBe("final_response_sent"));
  it("routes final responses to QA when the org requires approval", () =>
    expect(statusAfterLetter("final_upheld", "under_investigation", true)).toBe("pending_qa"));
  it("non-final letters ignore the QA requirement", () =>
    expect(statusAfterLetter("holding", "under_investigation", true)).toBe("holding_response_sent"));
});
