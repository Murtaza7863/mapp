import { describe, expect, it } from "vitest";

import type { Category } from "../../types";

import { parseDumpWithRules } from "./rules-parser";

const categories: Category[] = [
  {
    id: "work",
    name: "Work",
    color: "#3b82f6",
    icon: "briefcase",
    sortOrder: 0,
    subgroups: ["Homework", "Exam"],
  },
  {
    id: "personal",
    name: "Personal",
    color: "#22c55e",
    icon: "home",
    sortOrder: 1,
  },
  {
    id: "smubia",
    name: "Smubia",
    color: "#a855f7",
    icon: "folder",
    sortOrder: 2,
  },
];

const NOW = new Date(2026, 6, 26, 10, 0, 0); // Sunday

/** Probes for gaps — each should parse meaningfully. */
const GAPS: Array<{
  dump: string;
  minItems?: number;
  minActions?: number;
  assert?: (r: ReturnType<typeof parseDumpWithRules>) => void;
}> = [
  {
    dump: "call mom and buy milk tomorrow",
    minItems: 2,
  },
  {
    dump: "next monday standup prep",
    minItems: 1,
    assert: (r) => expect(r.items[0]?.dueAt).toBeTruthy(),
  },
  {
    dump: "this friday submit report",
    minItems: 1,
    assert: (r) => expect(r.items[0]?.dueAt).toBeTruthy(),
  },
  {
    dump: "in 3 days renew passport",
    minItems: 1,
    assert: (r) => expect(r.items[0]?.dueAt).toBeTruthy(),
  },
  {
    dump: "todo: pack for trip",
    minItems: 1,
  },
  {
    dump: "FU: google recruiter",
    minItems: 1,
    assert: (r) => expect(r.items[0]?.type).toBe("follow-up"),
  },
  {
    dump: "every monday team sync",
    minItems: 1,
    assert: (r) => expect(r.items[0]?.type).toBe("routine"),
  },
  {
    dump: "add area Freelance",
    minActions: 1,
  },
  {
    dump: "put visa checklist in smubia folder",
    minItems: 1,
    assert: (r) => expect(r.items[0]?.parentFolderName).toMatch(/smubia/i),
  },
  {
    dump: "create folder for Visa in Smubia",
    minActions: 1,
    assert: (r) => expect(r.actions[0]?.categoryId).toBe("smubia"),
  },
  {
    dump: "don't forget dentist thursday",
    minItems: 1,
    assert: (r) => expect(r.items[0]?.title).toMatch(/dentist/i),
  },
  {
    dump: "urgent fix production bug",
    minItems: 1,
    assert: (r) => expect(r.items[0]?.priority).toBe(true),
  },
  {
    dump: "call mom",
    minItems: 1,
  },
  {
    dump: "smubia folder: add passport scan",
    minItems: 1,
    assert: (r) => expect(r.items[0]?.parentFolderName).toMatch(/smubia/i),
  },
  {
    dump: "email prof | gym friday | pay rent",
    minItems: 3,
  },
  {
    dump: "eod send team update",
    minItems: 1,
    assert: (r) => expect(r.items[0]?.dueAt).toBeTruthy(),
  },
];

describe("Plot gap probes", () => {
  for (const gap of GAPS) {
    it(gap.dump.slice(0, 60), () => {
      const result = parseDumpWithRules(gap.dump, categories, NOW);
      if (gap.minItems !== undefined) {
        expect(result.items.length).toBeGreaterThanOrEqual(gap.minItems);
      }
      if (gap.minActions !== undefined) {
        expect(result.actions.length).toBeGreaterThanOrEqual(gap.minActions);
      }
      gap.assert?.(result);
    });
  }
});
