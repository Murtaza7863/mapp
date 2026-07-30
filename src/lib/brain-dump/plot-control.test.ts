import { describe, expect, it } from "vitest";

import type { Category, Item } from "../../types";
import { createItem } from "../items";

import { matchFeatureIntent } from "./features";
import { findItemMatches, resolveActionTargets } from "./resolve-target";
import type { ProposedFeatureAction } from "./types";

const NOW = new Date(2026, 6, 26, 10, 0, 0);

const categories: Category[] = [
  {
    id: "work",
    name: "Work",
    color: "#000",
    icon: "briefcase",
    sortOrder: 0,
  },
  {
    id: "personal",
    name: "Personal",
    color: "#000",
    icon: "home",
    sortOrder: 1,
  },
];

describe("matchFeatureIntent control", () => {
  it("matches complete phrases", () => {
    expect(
      matchFeatureIntent("done: pay rent", categories, NOW)?.featureId,
    ).toBe("complete_item");
    expect(
      matchFeatureIntent("mark gym done", categories, NOW)?.targetQuery,
    ).toBe("gym");
  });

  it("does not steal task creation phrasing", () => {
    expect(
      matchFeatureIntent("finish stats homework by thursday", categories, NOW),
    ).toBeNull();
    expect(matchFeatureIntent("bump recruiter", categories, NOW)).toBeNull();
    expect(
      matchFeatureIntent("waiting on legal for redlines", categories, NOW),
    ).toBeNull();
    expect(
      matchFeatureIntent("cancel subscription", categories, NOW),
    ).toBeNull();
  });

  it("matches snooze with until date", () => {
    const m = matchFeatureIntent(
      "snooze call mom until friday",
      categories,
      NOW,
    );
    expect(m?.featureId).toBe("snooze_item");
    expect(m?.targetQuery).toBe("call mom");
    expect(m?.dueAt).toBeTruthy();
  });

  it("matches delete, navigate, move, star, stage", () => {
    expect(matchFeatureIntent("delete gym", categories, NOW)?.featureId).toBe(
      "delete_item",
    );
    expect(matchFeatureIntent("open calendar", categories, NOW)).toMatchObject({
      featureId: "navigate",
      navigateTo: "/calendar",
    });
    expect(matchFeatureIntent("show nudges", categories, NOW)?.navigateTo).toBe(
      "/?focus=chase",
    );
    const move = matchFeatureIntent("move essay to #personal", categories, NOW);
    expect(move?.featureId).toBe("update_item");
    expect(move?.patch?.categoryId).toBe("personal");
    expect(
      matchFeatureIntent("star gym", categories, NOW)?.patch?.priority,
    ).toBe(true);
    expect(
      matchFeatureIntent("mark acme waiting", categories, NOW)?.pipelineStage,
    ).toBe("waiting");
  });

  it("matches find and open-item navigate", () => {
    expect(matchFeatureIntent("find rent", categories, NOW)).toMatchObject({
      featureId: "navigate",
      navigateTo: "/search?q=rent",
    });
    expect(matchFeatureIntent("open pay rent", categories, NOW)).toMatchObject({
      featureId: "navigate",
      targetQuery: "pay rent",
    });
  });

  it("matches note, clear date, and retype", () => {
    expect(
      matchFeatureIntent("note on rent: paid half", categories, NOW)?.patch
        ?.notes,
    ).toBe("paid half");
    expect(
      matchFeatureIntent("clear date on dentist", categories, NOW)?.patch
        ?.dueAt,
    ).toBeNull();
    expect(
      matchFeatureIntent("make essay a follow-up", categories, NOW)?.patch
        ?.type,
    ).toBe("follow-up");
    expect(
      matchFeatureIntent("set gym daily", categories, NOW)?.patch?.recurrence
        ?.frequency,
    ).toBe("daily");
  });

  it("matches bulk, folder, event, subgroup, duplicate", () => {
    expect(
      matchFeatureIntent("bump all nudges", categories, NOW)?.featureId,
    ).toBe("bump_nudges");
    expect(
      matchFeatureIntent("complete all overdue", categories, NOW)?.featureId,
    ).toBe("complete_overdue");
    expect(
      matchFeatureIntent("duplicate gym", categories, NOW)?.featureId,
    ).toBe("duplicate_item");
    expect(
      matchFeatureIntent("rename folder Smubia to Atlas", categories, NOW),
    ).toMatchObject({
      featureId: "rename_folder",
      patch: { title: "Atlas" },
    });
    expect(
      matchFeatureIntent("open folder Smubia", categories, NOW),
    ).toMatchObject({
      featureId: "navigate",
      targetQuery: "Smubia",
    });
    expect(
      matchFeatureIntent("show area Work", categories, NOW)?.categoryHint,
    ).toBe("Work");
    expect(
      matchFeatureIntent("link event on wedding to oct 4", categories, NOW)
        ?.patch?.linkedEventAt,
    ).toBeTruthy();
    expect(
      matchFeatureIntent("set subgroup on visa to Sponsors", categories, NOW)
        ?.patch?.childGroup,
    ).toBe("Sponsors");
    expect(
      matchFeatureIntent("contacted acme today", categories, NOW)?.patch
        ?.lastContactAt,
    ).toBeTruthy();
  });

  it("matches clear fields, hours reminder, move folder, area style, restore", () => {
    expect(
      matchFeatureIntent("remind 1 hour before gym", categories, NOW)?.patch
        ?.reminderOffsetMinutes,
    ).toBe(60);
    expect(
      matchFeatureIntent("remind 1 day before dentist", categories, NOW)?.patch
        ?.reminderOffsetMinutes,
    ).toBe(1440);
    expect(
      matchFeatureIntent("clear reminder on gym", categories, NOW)?.patch
        ?.reminderOffsetMinutes,
    ).toBeNull();
    expect(
      matchFeatureIntent("clear next action on acme", categories, NOW)?.patch
        ?.nextAction,
    ).toBeNull();
    expect(
      matchFeatureIntent("move folder Smubia to Personal", categories, NOW),
    ).toMatchObject({
      featureId: "move_folder",
      categoryId: "personal",
    });
    expect(
      matchFeatureIntent("recolor area Work blue", categories, NOW),
    ).toMatchObject({
      featureId: "update_area",
      areaPatch: { color: "#3b82f6" },
    });
    expect(
      matchFeatureIntent(
        "set subgroups on Work to Homework, Exam",
        categories,
        NOW,
      )?.areaPatch?.subgroups,
    ).toEqual(["Homework", "Exam"]);
    expect(
      matchFeatureIntent("restore auto-backup", categories, NOW)?.featureId,
    ).toBe("restore_backup");
    expect(
      matchFeatureIntent("export area Work", categories, NOW),
    ).toMatchObject({
      featureId: "export_data",
      categoryId: "work",
    });
  });
});

describe("resolveActionTargets", () => {
  const items: Item[] = [
    createItem({
      title: "Pay rent",
      type: "deadline",
      categoryId: "personal",
    }),
    createItem({
      title: "Pay rent deposit",
      type: "deadline",
      categoryId: "personal",
    }),
    {
      ...createItem({
        title: "Gym",
        type: "routine",
        categoryId: "personal",
      }),
      status: "snoozed",
    },
  ];

  it("resolves unique matches", () => {
    const actions: ProposedFeatureAction[] = [
      {
        id: "1",
        kind: "complete_item",
        title: "Gym",
        summary: "Complete “Gym”",
        selected: true,
        targetQuery: "gym",
      },
    ];
    const resolved = resolveActionTargets(actions, items);
    expect(resolved[0].resolvedItemId).toBe(items[2].id);
    expect(resolved[0].selected).toBe(true);
  });

  it("prefers an exact title match over a longer sibling", () => {
    const actions: ProposedFeatureAction[] = [
      {
        id: "1",
        kind: "complete_item",
        title: "Pay rent",
        summary: "Complete “Pay rent”",
        selected: true,
        targetQuery: "pay rent",
      },
    ];
    const resolved = resolveActionTargets(actions, items);
    expect(resolved[0].resolvedItemId).toBe(items[0].id);
    expect(resolved[0].selected).toBe(true);
  });

  it("flags ambiguous close matches", () => {
    const twinItems: Item[] = [
      createItem({
        title: "Weekly report",
        type: "deadline",
        categoryId: "work",
      }),
      createItem({
        title: "Monthly report",
        type: "deadline",
        categoryId: "work",
      }),
    ];
    const actions: ProposedFeatureAction[] = [
      {
        id: "1",
        kind: "complete_item",
        title: "Report",
        summary: "Complete “Report”",
        selected: true,
        targetQuery: "report",
      },
    ];
    const resolved = resolveActionTargets(actions, twinItems);
    expect(resolved[0].resolvedItemId).toBeUndefined();
    expect(resolved[0].selected).toBe(false);
    expect(resolved[0].matchCandidates?.length).toBeGreaterThan(1);
  });

  it("scores title overlap", () => {
    const matches = findItemMatches("rent", items);
    expect(matches[0].title.toLowerCase()).toContain("rent");
  });
});
