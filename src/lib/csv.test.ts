import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("csv", () => {
  it("quotes commas and quotes", () => expect(toCsv([["a,b", 'say "hi"']])).toBe('"a,b","say ""hi"""'));
  it("neutralises formula injection", () => expect(toCsv([["=SUM(A1)"]])).toBe("'=SUM(A1)"));
});
