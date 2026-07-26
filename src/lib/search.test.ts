import { describe, expect, it } from "vitest";

import { createItem } from "./items";
import { searchItems } from "./search";

describe("search", () => {
  const items = [
    createItem({
      title: "Email professor",
      notes: "About thesis",
      type: "deadline",
    }),
    createItem({
      title: "Team sync",
      type: "follow-up",
      waitingOn: "Sarah",
    }),
    createItem({ title: "Grocery list", type: "note", notes: "Milk and eggs" }),
  ];

  it("finds by title", () => {
    const results = searchItems(items, { query: "team" });
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Team sync");
  });

  it("finds by notes and waiting on", () => {
    expect(searchItems(items, { query: "thesis" })).toHaveLength(1);
    expect(searchItems(items, { query: "sarah" })).toHaveLength(1);
  });

  it("filters by type and status", () => {
    const done = { ...items[0], status: "done" as const };
    const all = [...items, done];
    expect(searchItems(all, { query: "", type: "note" })).toHaveLength(1);
    expect(searchItems(all, { query: "", status: "done" })).toHaveLength(1);
  });
});
