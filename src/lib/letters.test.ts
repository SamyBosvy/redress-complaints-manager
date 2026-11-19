import { describe, expect, it } from "vitest";
import { hasAdrBlock, mergeTemplate, statusAfterLetter, caseMergeValues, unknownPlaceholders, insertAtCursor, MERGE_FIELDS, MERGE_GROUPS, SAMPLE_VALUES } from "./letters";
import { composerGroups, choiceValue, parseChoice, letterTypeLabel, needsAdrBlock, validateLetterTypeName } from "./letters";
import { withLetterTypeNames } from "./privacy";

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

describe('custom letter types', () => {
  const types = [
    { id: 'b', name: 'zeta notice', requires_adr_block: false, archived_at: null },
    { id: 'a', name: 'Account statement', requires_adr_block: true, archived_at: null },
    { id: 'c', name: 'Old', requires_adr_block: false, archived_at: '2026-01-01T00:00:00Z' },
  ];
  it('lists built-in types first, then active custom types alphabetically under Custom', () => {
    const groups = composerGroups(types);
    expect(groups.map(g => g.label)).toEqual(['Built-in', 'Custom']);
    expect(groups[0]!.options.map(o => o.value)).toEqual(['acknowledgement', 'holding', 'final_upheld', 'final_partially_upheld', 'final_not_upheld', 'information_request', 'closure']);
    expect(groups[1]!.options).toEqual([{ value: 'custom:a', label: 'Account statement' }, { value: 'custom:b', label: 'zeta notice' }]);
    expect(composerGroups([]).map(g => g.label)).toEqual(['Built-in']);
  });
  it('round-trips choices and labels custom letters by name', () => {
    expect(parseChoice(choiceValue('custom', 'a'))).toEqual({ kind: 'custom', customTypeId: 'a' });
    expect(parseChoice('holding')).toEqual({ kind: 'holding', customTypeId: null });
    expect(letterTypeLabel('custom', 'a', types)).toBe('Account statement');
    expect(letterTypeLabel('custom', 'gone', types, 'Snapshot')).toBe('Snapshot');
    expect(letterTypeLabel('custom', null, [])).toBe('Custom letter');
    expect(letterTypeLabel('holding', null, types)).toBe('Holding response');
  });
  it('never changes status for custom letters and applies the ADR rule only when required', () => {
    expect(statusAfterLetter('custom', 'received')).toBeNull();
    expect(statusAfterLetter('custom', 'acknowledged', true)).toBeNull();
    expect(needsAdrBlock('custom', types[1])).toBe(true);
    expect(needsAdrBlock('custom', types[0])).toBe(false);
    expect(needsAdrBlock('final_upheld')).toBe(true);
  });
  it('validates type names case-insensitively within 2–80 characters', () => {
    expect(validateLetterTypeName('x', types)).toMatch('2–80');
    expect(validateLetterTypeName('a'.repeat(81), types)).toMatch('2–80');
    expect(validateLetterTypeName(' account STATEMENT ', types)).toMatch('already exists');
    expect(validateLetterTypeName('Account statement', types, 'a')).toBeNull();
  });
  it('adds the custom type name to exported letters', () => {
    expect(withLetterTypeNames([{ id: '1', custom_type_id: 'a' }, { id: '2', custom_type_id: null }], [{ id: 'a', name: 'Account statement' }]))
      .toEqual([{ id: '1', custom_type_id: 'a', custom_type_name: 'Account statement' }, { id: '2', custom_type_id: null, custom_type_name: null }]);
  });
});
