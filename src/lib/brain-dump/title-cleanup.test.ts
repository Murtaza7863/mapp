import { describe, expect, it } from "vitest";

import { isValidTask, parseContextClause, polishTitle } from "./title-cleanup";

describe("title-cleanup", () => {
  it("polishes follow-up titles", () => {
    expect(
      polishTitle(
        "email prof about extension",
        "email prof about extension",
        "follow-up",
      ),
    ).toBe("Prof — extension");

    expect(
      polishTitle(
        "follow up acme corp",
        "follow up acme corp next week",
        "follow-up",
        "Acme Corp",
      ),
    ).toBe("Follow up — Acme Corp");
  });

  it("strips stray dates from titles", () => {
    expect(
      polishTitle(
        "cs homework due friday",
        "cs homework due friday",
        "deadline",
      ),
    ).toBe("Cs homework");
  });

  it("rejects junk fragments", () => {
    expect(isValidTask("also maybe", "also", {})).toBe(false);
    expect(isValidTask("if they reply", "if they reply", {})).toBe(false);
    expect(isValidTask("buy milk tomorrow", "buy milk", { dueAt: "x" })).toBe(
      true,
    );
  });

  it("detects context-only clauses", () => {
    expect(parseContextClause("finished call with shopee")?.contactName).toBe(
      "Shopee",
    );
    expect(parseContextClause("met with acme corp")?.contactName).toBe(
      "Acme Corp",
    );
  });
});
