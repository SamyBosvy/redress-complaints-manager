import { describe, expect, it } from "vitest";
import { emptyScorecard, scorecardPassed } from "./qa";

describe("qa scorecard", () => {
  it("a fresh scorecard passes", () => expect(scorecardPassed(emptyScorecard())).toBe(true));
  it("any failed criterion fails the review", () => {
    const card = emptyScorecard();
    card.deadlines_met.result = "fail";
    expect(scorecardPassed(card)).toBe(false);
  });
  it("covers all five criteria", () => expect(Object.keys(emptyScorecard())).toHaveLength(5));
});
