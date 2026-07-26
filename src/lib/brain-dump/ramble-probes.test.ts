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

const NOW = new Date(2026, 6, 26, 10, 0, 0);

const RAMBLES: Array<{
  name: string;
  dump: string;
  minItems?: number;
  minActions?: number;
  titleMatch?: RegExp[];
  types?: string[];
  assert?: (r: ReturnType<typeof parseDumpWithRules>) => void;
}> = [
  {
    name: "filler open email professor",
    dump:
      "ok so like I really need to email the professor about the extension maybe thursday idk",
    minItems: 1,
    titleMatch: [/professor|extension|email/i],
    assert: (r) => expect(r.items[0]?.dueAt).toBeTruthy(),
  },
  {
    name: "brain dump multi clause",
    dump:
      "brain dump: laundry tomorrow, also mom called and I should call her back sunday, passport renew before trip",
    minItems: 2,
    titleMatch: [/laundry|mom|passport/i],
  },
  {
    name: "ramble folder and task",
    dump:
      "so um create a folder for smubia lol and also add visa checklist by friday",
    minActions: 1,
    minItems: 1,
    titleMatch: [/visa/i],
  },
  {
    name: "guess probably follow up",
    dump:
      "I guess I should probably follow up with Jake about the deck next tuesday",
    minItems: 1,
    types: ["follow-up"],
    titleMatch: [/jake|deck/i],
  },
  {
    name: "random thought dont forget",
    dump: "random thought but don't forget dentist thursday at 2",
    minItems: 1,
    titleMatch: [/dentist/i],
  },
  {
    name: "anyway context and two tasks",
    dump:
      "anyway finished the call with shopee, still need to send proposal and bump them friday",
    minItems: 1,
    types: ["follow-up"],
    titleMatch: [/shopee|proposal|bump/i],
  },
  {
    name: "ugh pay rent ramble",
    dump: "ugh pay rent tomorrow landlord been texting",
    minItems: 1,
    titleMatch: [/rent/i],
    assert: (r) => expect(r.items[0]?.dueAt).toBeTruthy(),
  },
  {
    name: "not urgent eventually",
    dump: "honestly not urgent but eventually sort out car insurance renewal",
    minItems: 1,
    titleMatch: [/insurance|car/i],
  },
  {
    name: "maybe book flights",
    dump: "maybe book flights for december trip next week when I have time",
    minItems: 1,
    titleMatch: [/flight/i],
    assert: (r) => expect(r.items[0]?.dueAt).toBeTruthy(),
  },
  {
    name: "em dash triple list",
    dump:
      "ok so like three things — email prof tomorrow, gym friday, and smubia visa stuff due monday",
    minItems: 3,
    titleMatch: [/prof|gym|visa/i],
  },
  {
    name: "wall of text single task",
    dump:
      "I've been putting this off forever but I really really need to schedule the visa medical exam before the embassy appointment and friday is probably the last day that works for me",
    minItems: 1,
    titleMatch: [/medical|visa|exam/i],
    assert: (r) => expect(r.items[0]?.dueAt).toBeTruthy(),
  },
  {
    name: "lol idk suffix",
    dump: "submit homework lol idk whenever friday works",
    minItems: 1,
    titleMatch: [/homework/i],
  },
  {
    name: "parenthetical aside",
    dump: "call insurance (the car one) on monday — they close early",
    minItems: 1,
    titleMatch: [/insurance/i],
  },
  {
    name: "question marks follow up",
    dump: "should I bump sarah about the contract?? maybe wednesday",
    minItems: 1,
    types: ["follow-up"],
    titleMatch: [/sarah|contract/i],
  },
  {
    name: "stream of consciousness folder",
    dump:
      "oh yeah smubia — need a folder there for visa docs and add passport scan task",
    minActions: 1,
    minItems: 1,
    titleMatch: [/passport/i],
  },
  {
    name: "also split mid ramble",
    dump:
      "was a long day. also email landlord about lease. also buy groceries tonight.",
    minItems: 2,
    titleMatch: [/landlord|groceries/i],
  },
  {
    name: "ignore pure venting",
    dump: "today was awful and I'm so tired nothing matters",
    minItems: 0,
  },
  {
    name: "vent then task",
    dump:
      "super stressed about everything rn but I still need to pay the electric bill tomorrow",
    minItems: 1,
    titleMatch: [/electric|bill/i],
  },
  {
    name: "nested reminder",
    dump:
      "remind me that I promised mom I'd call her sunday evening after dinner",
    minItems: 1,
    titleMatch: [/mom|call/i],
  },
  {
    name: "multi sentence paragraph",
    dump: `Woke up late. Email prof about extension.
Still need to renew passport. Gym tonight.`,
    minItems: 3,
    titleMatch: [/prof|passport|gym/i],
  },
];

describe("Plot ramble probes", () => {
  for (const probe of RAMBLES) {
    it(probe.name, () => {
      const result = parseDumpWithRules(probe.dump, categories, NOW);
      if (probe.minItems !== undefined) {
        expect(result.items.length).toBeGreaterThanOrEqual(probe.minItems);
      }
      if (probe.minActions !== undefined) {
        expect(result.actions.length).toBeGreaterThanOrEqual(probe.minActions);
      }
      if (probe.titleMatch) {
        for (const re of probe.titleMatch) {
          expect(result.items.some((i) => re.test(i.title))).toBe(true);
        }
      }
      if (probe.types) {
        for (const t of probe.types) {
          expect(result.items.some((i) => i.type === t)).toBe(true);
        }
      }
      probe.assert?.(result);
    });
  }
});
