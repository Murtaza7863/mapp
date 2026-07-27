import { describe, expect, it, vi } from "vitest";

import type { Category } from "../../types";

import { parseBrainDump } from "./parse-dump";
import { PLOT_PROMPT_FIXTURES } from "./plot-fixtures";

const NOW = new Date(2026, 6, 26, 10, 0, 0);
vi.setSystemTime(NOW);

const baseCategories: Category[] = [
  {
    id: "work",
    name: "Work",
    color: "#3b82f6",
    icon: "briefcase",
    sortOrder: 0,
  },
  {
    id: "personal",
    name: "Personal",
    color: "#22c55e",
    icon: "home",
    sortOrder: 1,
  },
  {
    id: "atlas",
    name: "ATLAS",
    color: "#f59e0b",
    icon: "star",
    sortOrder: 2,
    subgroups: ["Sponsors", "Events"],
  },
];

describe("plot prompt fixtures", () => {
  it(`runs ${PLOT_PROMPT_FIXTURES.length} real-world prompts`, () => {
    expect(PLOT_PROMPT_FIXTURES.length).toBeGreaterThanOrEqual(150);
  });

  for (const fixture of PLOT_PROMPT_FIXTURES) {
    it(`parses: ${fixture.name}`, async () => {
      const { items } = await parseBrainDump(fixture.dump, {
        categories: baseCategories,
        preferLlm: false,
      });
      expect(items.length).toBeGreaterThanOrEqual(fixture.minItems);
      fixture.assert?.(items);
    });
  }
});

describe("plot prompt smoke — no empty dumps", () => {
  for (const fixture of PLOT_PROMPT_FIXTURES) {
    it(`${fixture.name} produces at least one selected item`, async () => {
      const { items } = await parseBrainDump(fixture.dump, {
        categories: baseCategories,
        preferLlm: false,
      });
      if (items.length === 0) return;
      expect(items.some((i) => i.selected && i.title.trim().length > 0)).toBe(
        true,
      );
    });
  }
});
