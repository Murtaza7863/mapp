import { describe, expect, it } from "vitest";

import { looksLikeMultiCapture } from "./clipboard";

describe("clipboard", () => {
  it("detects multi-line captures", () => {
    expect(looksLikeMultiCapture("one\ntwo")).toBe(true);
    expect(looksLikeMultiCapture("- bullet one")).toBe(true);
    expect(looksLikeMultiCapture("single task")).toBe(false);
  });
});
