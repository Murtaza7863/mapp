import { describe, expect, it } from "vitest";

import type { Category } from "../types";
import { parseQuickAdd } from "./quickadd";

const categories: Category[] = [
  { id: "c1", name: "Work", color: "#3b82f6", icon: "briefcase", sortOrder: 0 },
  { id: "c2", name: "Personal", color: "#22c55e", icon: "home", sortOrder: 1 },
  {
    id: "c3",
    name: "Projects",
    color: "#a855f7",
    icon: "folder",
    sortOrder: 2,
  },
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
    const p = parseQuickAdd("submit report #pro", categories, NOW);
    expect(p.categoryId).toBe("c3");
    expect(p.categoryName).toBe("Projects");
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

  it("parses due friday and trailing priority", () => {
    const p = parseQuickAdd("cs homework due friday", categories, NOW);
    expect(p.title).toBe("cs homework");
    expect(p.dueAt).toBeTruthy();
    expect(new Date(p.dueAt!).getDay()).toBe(5);

    const urgent = parseQuickAdd("pay rent tomorrow !", categories, NOW);
    expect(urgent.priority).toBe(true);
    expect(urgent.title).toBe("pay rent");
  });

  it("parses next tues with time and strips date from title", () => {
    // Monday Jul 27, 2026 — "next tues" should be Tue Jul 28
    const monday = new Date(2026, 6, 27, 10, 0, 0);
    const p = parseQuickAdd(
      "meeting for bia with shopee next tues 4pm",
      categories,
      monday,
    );
    expect(p.title).toBe("meeting for bia with shopee");
    const due = new Date(p.dueAt!);
    expect(due.getDay()).toBe(2);
    expect(due.getDate()).toBe(28);
    expect(due.getHours()).toBe(16);
  });

  it("accepts colloquial weekday abbreviations", () => {
    const p = parseQuickAdd("standup next weds 9am", categories, NOW);
    const due = new Date(p.dueAt!);
    expect(due.getDay()).toBe(3);
    expect(p.title).toBe("standup");
  });

  it("does not mistake sat or sun inside real words for weekdays", () => {
    const sat = parseQuickAdd("study sat exam", categories, NOW);
    expect(sat.title).toBe("study sat exam");
    expect(sat.dueAt).toBeUndefined();

    const sun = parseQuickAdd("buy sun hat", categories, NOW);
    expect(sun.title).toBe("buy sun hat");
    expect(sun.dueAt).toBeUndefined();

    // A cue word makes the same token unambiguous.
    const cued = parseQuickAdd("laundry on sat", categories, NOW);
    expect(new Date(cued.dueAt!).getDay()).toBe(6);
  });

  it("keeps date-only input instead of dropping it", () => {
    const p = parseQuickAdd("3pm tmrw", categories, NOW);
    expect(p.title).toBe("Reminder");
    const due = new Date(p.dueAt!);
    expect(due.getDate()).toBe(23);
    expect(due.getHours()).toBe(15);
  });

  it("parses calendar dates and rolls past months to next year", () => {
    const dec = parseQuickAdd("essay due dec 15", categories, NOW);
    expect(dec.title).toBe("essay");
    expect(new Date(dec.dueAt!).getMonth()).toBe(11);
    expect(new Date(dec.dueAt!).getFullYear()).toBe(2026);

    const jan = parseQuickAdd("meeting jan 5", categories, NOW);
    expect(new Date(jan.dueAt!).getFullYear()).toBe(2027);
  });

  it("parses weekend, next month, and times of day", () => {
    const weekend = parseQuickAdd("call mom this weekend", categories, NOW);
    expect(weekend.title).toBe("call mom");
    expect(new Date(weekend.dueAt!).getDay()).toBe(6);

    const month = parseQuickAdd("gym next month", categories, NOW);
    expect(month.title).toBe("gym");
    expect(new Date(month.dueAt!).getMonth()).toBe(7);

    const noon = parseQuickAdd("lunch at noon", categories, NOW);
    expect(noon.title).toBe("lunch");
    expect(new Date(noon.dueAt!).getHours()).toBe(12);

    const morning = parseQuickAdd("gym tomorrow morning", categories, NOW);
    expect(morning.title).toBe("gym");
    expect(new Date(morning.dueAt!).getHours()).toBe(9);
  });

  it("leaves 'morning routine' alone when there is no date", () => {
    const p = parseQuickAdd("morning routine", categories, NOW);
    expect(p.title).toBe("morning routine");
    expect(p.dueAt).toBeUndefined();
  });

  it("parses relative hours", () => {
    const p = parseQuickAdd("call back in 2 hours", categories, NOW);
    expect(p.title).toBe("call back");
    expect(new Date(p.dueAt!).getHours()).toBe(12);
  });

  it("keeps dated email as a task, undated email as a follow-up", () => {
    const dated = parseQuickAdd("email prof tomorrow", categories, NOW);
    expect(dated.type).not.toBe("follow-up");
    expect(dated.dueAt).toBeTruthy();

    const open = parseQuickAdd("email professor", categories, NOW);
    expect(open.type).toBe("follow-up");
  });

  it("parses thread contact and next action", () => {
    const p = parseQuickAdd(
      "follow-up: deck review @Jake → send v2",
      categories,
      NOW,
    );
    expect(p.type).toBe("follow-up");
    expect(p.contactName).toBe("Jake");
    expect(p.nextAction).toBe("send v2");
    expect(p.title).toBe("deck review");

    const re = parseQuickAdd("bump re: Acme Corp", categories, NOW);
    expect(re.type).toBe("follow-up");
    expect(re.contactName).toBe("Acme Corp");
    expect(re.title).toBe("bump");
  });
});
