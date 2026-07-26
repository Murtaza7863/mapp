import { describe, expect, it } from "vitest";

import { createItem } from "./items";

describe("export validation", () => {
  it("rejects bundles with orphan category references", async () => {
    const { importData } = await import("./export");
    const item = createItem({ title: "Orphan", categoryId: "missing" });
    await expect(
      importData(
        {
          version: 2,
          exportedAt: new Date().toISOString(),
          categories: [
            {
              id: "cat-1",
              name: "Test",
              color: "#fff",
              icon: "folder",
              sortOrder: 0,
            },
          ],
          items: [item],
          completions: [],
          settings: {
            id: "app",
            digestEnabled: false,
            digestTime: "08:00",
            notificationsEnabled: false,
            deviceId: "dev",
            defaultReminderOffsetMinutes: 0,
            weekStartsOnMonday: false,
          },
        },
        false,
      ),
    ).rejects.toThrow(/missing area/i);
  });
});
