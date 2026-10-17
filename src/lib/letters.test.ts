import { describe, expect, it } from "vitest";
import { hasAdrBlock, mergeTemplate, statusAfterLetter } from "./letters";

describe("letters", () => {
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
});
