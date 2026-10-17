import { describe, expect, it } from "vitest";
import { clockTone, isAtRisk } from "./complaints";

describe("deadline clock", () => {
  it("is green with more than 5 business days left", () => expect(clockTone(6, "received")).toBe("ok"));
  it("is amber with 5 business days or fewer", () => expect(clockTone(5, "received")).toBe("risk"));
  it("is amber on the due day", () => expect(clockTone(0, "acknowledged")).toBe("risk"));
  it("is red when overdue", () => expect(clockTone(-1, "under_investigation")).toBe("overdue"));
  it("stops once the final response is sent", () => expect(clockTone(-3, "final_response_sent")).toBe("stopped"));
  it("flags at risk at 3 business days or fewer", () => {
    expect(isAtRisk(3, "received")).toBe(true);
    expect(isAtRisk(4, "received")).toBe(false);
  });
});
