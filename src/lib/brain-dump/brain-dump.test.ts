import { describe, expect, it } from "vitest";

import type { Category } from "../../types";

import { matchFeatureIntent } from "./features";
import { shouldUseLlm } from "./parse-dump";
import { parseDumpWithRules, splitDumpLines } from "./rules-parser";
import { parseModelResponse } from "./validate";

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
];

const NOW = new Date(2026, 6, 26, 10, 0, 0);

describe("brain-dump rules parser", () => {
  it("splits bullet and numbered lists", () => {
    const lines = splitDumpLines(`- email professor
2. gym tomorrow 7am
* buy groceries`);
    expect(lines).toEqual([
      "email professor",
      "gym tomorrow 7am",
      "buy groceries",
    ]);
  });

  it("parses a messy multi-line dump", () => {
    const dump = `email prof about extension
cs homework due friday
follow up acme corp next week !
buy milk tomorrow`;

    const { items } = parseDumpWithRules(dump, categories, NOW);
    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(items.some((i) => /prof|homework/i.test(i.title))).toBe(true);
    expect(items.some((i) => i.type === "follow-up")).toBe(true);
    expect(items.some((i) => i.priority)).toBe(true);
    const homework = items.find((i) => /homework/i.test(i.title));
    expect(homework?.dueAt).toBeTruthy();
  });

  it("splits comma-separated single-line dumps", () => {
    const lines = splitDumpLines("email prof tomorrow, gym friday, pay rent !");
    expect(lines.length).toBe(3);
  });

  it("splits comma-separated single-line dumps", () => {
    const lines = splitDumpLines("email prof tomorrow, gym friday, pay rent !");
    expect(lines.length).toBe(3);
  });

  it("merges past-tense context into the following task", () => {
    const dump =
      "finished call with shopee, need to finish my proposal and send a follow up by friday.";
    const lines = splitDumpLines(dump);
    expect(lines).toHaveLength(1);

    const { items } = parseDumpWithRules(dump, categories, NOW);
    expect(items).toHaveLength(1);
    expect(items[0].title).toMatch(/shopee/i);
    expect(items[0].title).toMatch(/proposal/i);
    expect(items[0].type).toBe("follow-up");
    expect(items[0].contactName).toBe("Shopee");
    expect(items[0].dueAt).toBeTruthy();
  });

  it("parses model json payloads", () => {
    const { items, actions } = parseModelResponse(
      `{"items":[{"title":"Submit report","type":"deadline","categoryHint":"Work","dueAt":"2026-07-28T09:00:00.000Z","priority":false}],"actions":[],"clarifications":[]}`,
      categories,
    );
    expect(items).toHaveLength(1);
    expect(items[0].categoryId).toBe("work");
    expect(actions).toHaveLength(0);
  });

  it("tracks create-folder feature intents instead of reminders", () => {
    const dump = "create a folder for smubia";
    const matched = matchFeatureIntent(dump, categories);
    expect(matched?.featureId).toBe("create_folder");
    expect(matched?.title).toBe("Smubia");

    const { items, actions } = parseDumpWithRules(dump, categories, NOW);
    expect(items).toHaveLength(0);
    expect(actions).toHaveLength(1);
    expect(actions[0].kind).toBe("create_folder");
    expect(actions[0].title).toBe("Smubia");
  });

  it("tracks folder-in-workspace phrasing as a folder action", () => {
    const dump = "create folder in the smubia workspace";
    const { items, actions } = parseDumpWithRules(dump, categories, NOW);
    expect(items).toHaveLength(0);
    expect(actions).toHaveLength(1);
    expect(actions[0].kind).toBe("create_folder");
    expect(actions[0].title).toBe("Smubia");
  });

  it("tracks create-area feature intents", () => {
    const { items, actions } = parseDumpWithRules(
      "create an area called Research",
      categories,
      NOW,
    );
    expect(items).toHaveLength(0);
    expect(actions).toHaveLength(1);
    expect(actions[0].kind).toBe("create_area");
    expect(actions[0].title).toBe("Research");
  });

  it("recovers feature actions buried in model item titles", () => {
    const { items, actions } = parseModelResponse(
      `{"items":[{"title":"create a folder for smubia","type":"deadline"}],"clarifications":[]}`,
      categories,
    );
    expect(items).toHaveLength(0);
    expect(actions).toHaveLength(1);
    expect(actions[0].kind).toBe("create_folder");
    expect(actions[0].title).toBe("Smubia");
  });
});

describe("shouldUseLlm", () => {
  it("skips llm for structured lists with good coverage", () => {
    const text = "- task one\n- task two\n- task three";
    expect(shouldUseLlm(text, 3)).toBe(false);
  });

  it("uses llm for empty rules on non-trivial text", () => {
    expect(shouldUseLlm("lots of messy unstructured thoughts here", 0)).toBe(
      true,
    );
  });

  it("skips llm for short single tasks", () => {
    expect(shouldUseLlm("buy milk tomorrow", 1)).toBe(false);
  });

  it("skips llm when feature actions already cover the dump", () => {
    expect(shouldUseLlm("create a folder for smubia", 0, 1)).toBe(false);
  });
});

describe("brain-dump fixtures", () => {
  const fixtures = [
    {
      name: "school week",
      dump: `- finish stats problem set by thursday
- email ta about office hours
- exam review session sunday 2pm`,
      minItems: 2,
    },
    {
      name: "work outreach",
      dump: `need to follow up with Google about internship
send thank you note to recruiter tomorrow 9am
prep deck for monday meeting`,
      minItems: 2,
      expectFollowUp: true,
    },
    {
      name: "mixed personal",
      dump: `gym mon wed fri
call mom sunday
pay rent tomorrow !`,
      minItems: 2,
    },
  ];

  for (const fixture of fixtures) {
    it(`handles ${fixture.name}`, () => {
      const { items } = parseDumpWithRules(fixture.dump, categories, NOW);
      expect(items.length).toBeGreaterThanOrEqual(fixture.minItems);
      if (fixture.expectFollowUp) {
        expect(items.some((i) => i.type === "follow-up")).toBe(true);
      }
    });
  }
});
