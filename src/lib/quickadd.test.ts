import { describe, expect, it } from "vitest";

import type { Category } from "../types";
import { parseQuickAdd } from "./quickadd";

const categories: Category[] = [
  { id: "c1", name: "Work", color: "#3b82f6", icon: "briefcase", sortOrder: 0 },
  { id: "c2", name: "Personal", color: "#22c55e", icon: "home", sortOrder: 1 },
  { id: "c3", name: "CLIMB", color: "#a855f7", icon: "mountain", sortOrder: 2 },
];

// Wednesday, July 22 2026, 10:00 local time
const NOW = new Date(2026, 6, 22, 10, 0, 0);

describe("parseQuickAdd", () => {
  it("parses full shorthand: date, time, category, priority", () => {
    const p = parseQuickAdd(
      "pay rent tomorrow 9am #personal !",
      categories,
      NOW,
    );
    expect(p.title).toBe("pay rent");
    expect(p.priority).toBe(true);
    expect(p.categoryId).toBe("c2");
    const due = new Date(p.dueAt!);
    expect(due.getDate()).toBe(23);
    expect(due.getHours()).toBe(9);
  });

  it("bare time in the future stays today", () => {
    const p = parseQuickAdd("call mom 5pm", categories, NOW);
    expect(p.title).toBe("call mom");
    const due = new Date(p.dueAt!);
    expect(due.getDate()).toBe(22);
    expect(due.getHours()).toBe(17);
  });

  it("bare time already past rolls to tomorrow", () => {
    const p = parseQuickAdd("standup 9am", categories, NOW);
    const due = new Date(p.dueAt!);
    expect(due.getDate()).toBe(23);
    expect(due.getHours()).toBe(9);
  });

  it("weekday resolves to next occurrence, defaults 9:00", () => {
    const p = parseQuickAdd("gym friday", categories, NOW);
    const due = new Date(p.dueAt!);
    expect(due.getDay()).toBe(5);
    expect(due.getDate()).toBe(24);
    expect(due.getHours()).toBe(9);
  });

  it("same weekday means next week", () => {
    const p = parseQuickAdd("review wed", categories, NOW);
    const due = new Date(p.dueAt!);
    expect(due.getDate()).toBe(29);
  });

  it("tonight defaults to 8pm", () => {
    const p = parseQuickAdd("water plants tonight", categories, NOW);
    const due = new Date(p.dueAt!);
    expect(due.getDate()).toBe(22);
    expect(due.getHours()).toBe(20);
  });

  it("supports 24h times and minutes", () => {
    const p = parseQuickAdd("standup mon 9:30am", categories, NOW);
    const due = new Date(p.dueAt!);
    expect(due.getDay()).toBe(1);
    expect(due.getHours()).toBe(9);
    expect(due.getMinutes()).toBe(30);
  });

  it("category prefix match is case-insensitive", () => {
    const p = parseQuickAdd("submit report #cli", categories, NOW);
    expect(p.categoryId).toBe("c3");
    expect(p.categoryName).toBe("CLIMB");
    expect(p.title).toBe("submit report");
  });

  it("plain text has no due date", () => {
    const p = parseQuickAdd("buy milk", categories, NOW);
    expect(p.title).toBe("buy milk");
    expect(p.dueAt).toBeUndefined();
    expect(p.priority).toBe(false);
  });

  it("unknown category tag is stripped but not matched", () => {
    const p = parseQuickAdd("thing #nonexistent", categories, NOW);
    expect(p.categoryId).toBeUndefined();
    expect(p.title).toBe("thing");
  });

  it("parses item type prefixes", () => {
    const followUp = parseQuickAdd(
      "follow-up: jake owes slides #work",
      categories,
      NOW,
    );
    expect(followUp.type).toBe("follow-up");
    expect(followUp.title).toBe("jake owes slides");
    expect(followUp.categoryId).toBe("c1");

    const note = parseQuickAdd("note: wifi password", categories, NOW);
    expect(note.type).toBe("note");
    expect(note.title).toBe("wifi password");
  });
});
