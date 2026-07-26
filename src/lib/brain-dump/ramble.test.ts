import { describe, expect, it } from "vitest";

import type { Category } from "../../types";

import { matchFeatureIntent } from "./features";
import { expandLineSegments } from "./line-split";
import {
  normalizePlotLine,
  parseFolderCompoundRamble,
  splitRambleSentences,
} from "./ramble";
import { parseDumpWithRules } from "./rules-parser";

const categories: Category[] = [
  { id: "smubia", name: "Smubia", color: "#a", icon: "f", sortOrder: 2 },
];

describe("ramble helpers", () => {
  it("normalizes conversational prefix", () => {
    expect(
      normalizePlotLine("so um create a folder for smubia lol"),
    ).toBe("create a folder for smubia");
  });

  it("splits feature and task on and also", () => {
    const segments = expandLineSegments(
      "create a folder for smubia and also add visa checklist by friday",
      categories,
    );
    expect(segments).toHaveLength(2);
    expect(matchFeatureIntent(segments[0], categories)?.featureId).toBe(
      "create_folder",
    );
  });

  it("parses folder compound ramble", () => {
    const parsed = parseFolderCompoundRamble(
      "need a folder there for visa docs and add passport scan task",
    );
    expect(parsed?.folderName).toMatch(/visa/i);
    expect(parsed?.taskTitle).toMatch(/passport/i);
  });

  it("parses folder dump end to end", () => {
    const r = parseDumpWithRules(
      "so um create a folder for smubia lol and also add visa checklist by friday",
      categories,
      new Date(2026, 6, 26),
    );
    expect(r.actions.length).toBeGreaterThanOrEqual(1);
    expect(r.items.some((i) => /visa/i.test(i.title))).toBe(true);
  });
});
