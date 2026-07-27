import Dexie, { type EntityTable } from "dexie";
import { v4 as uuidv4 } from "uuid";
import { APP_NAME } from "../config";
import type {
  AppSettings,
  Category,
  CompletionLog,
  DbBackup,
  Item,
} from "../types";
import { DEFAULT_CATEGORIES } from "../types";

class RemindersDB extends Dexie {
  items!: EntityTable<Item, "id">;
  categories!: EntityTable<Category, "id">;
  settings!: EntityTable<AppSettings, "id">;
  completions!: EntityTable<CompletionLog, "id">;
  backups!: EntityTable<DbBackup, "id">;

  constructor() {
    super("RemindersDB");
    this.version(1).stores({
      items: "id, type, categoryId, status, dueAt, completedAt, priority",
      categories: "id, sortOrder",
      settings: "id",
    });
    this.version(2)
      .stores({
        items: "id, type, categoryId, status, dueAt, completedAt, priority",
        categories: "id, sortOrder",
        settings: "id",
        completions: "id, itemId, categoryId, completedAt, itemType",
      })
      .upgrade(async (tx) => {
        const items = await tx.table("items").toArray();
        for (const item of items as Item[]) {
          if (item.status === "done" && item.completedAt) {
            await tx.table("completions").add({
              id: uuidv4(),
              itemId: item.id,
              itemTitle: item.title,
              itemType: item.type,
              categoryId: item.categoryId,
              completedAt: item.completedAt,
              notes: item.notes,
            });
          }
        }
      });
    this.version(3)
      .stores({
        items: "id, type, categoryId, status, dueAt, completedAt, priority",
        categories: "id, sortOrder",
        settings: "id",
        completions: "id, itemId, categoryId, completedAt, itemType",
      })
      .upgrade(async (tx) => {
        const categories = await tx.table("categories").toArray();
        const names = new Set(
          (categories as { name: string }[]).map((c) => c.name.toLowerCase()),
        );
        const maxOrder = (categories as { sortOrder: number }[]).reduce(
          (m, c) => Math.max(m, c.sortOrder),
          -1,
        );
        let order = maxOrder + 1;
        for (const seed of DEFAULT_CATEGORIES) {
          if (!names.has(seed.name.toLowerCase())) {
            await tx
              .table("categories")
              .add({ ...seed, id: uuidv4(), sortOrder: order++ });
          }
        }
      });
    this.version(4)
      .stores({
        items:
          "id, type, categoryId, status, dueAt, completedAt, priority, parentId",
        categories: "id, sortOrder",
        settings: "id",
        completions: "id, itemId, categoryId, completedAt, itemType",
      })
      .upgrade(async () => {
        // parentId, goalCount, schoolKind are optional — no row migration needed.
      });
    this.version(5)
      .stores({
        items:
          "id, type, categoryId, status, dueAt, completedAt, priority, parentId",
        categories: "id, sortOrder",
        settings: "id",
        completions: "id, itemId, categoryId, completedAt, itemType",
      })
      .upgrade(async (tx) => {
        const categories = await tx.table("categories").toArray();
        for (const cat of categories as Category[]) {
          if (
            cat.name.toLowerCase() === "school" &&
            (!cat.subgroups || cat.subgroups.length === 0)
          ) {
            await tx
              .table("categories")
              .update(cat.id, { subgroups: ["Homework", "Exam"] });
          }
        }
        const items = await tx.table("items").toArray();
        for (const item of items as Item[]) {
          if (item.schoolKind && !item.childGroup) {
            const label = item.schoolKind === "exam" ? "Exam" : "Homework";
            await tx.table("items").update(item.id, { childGroup: label });
          }
        }
      });
    this.version(6).stores({
      items:
        "id, type, categoryId, status, dueAt, completedAt, priority, parentId",
      categories: "id, sortOrder",
      settings: "id",
      completions: "id, itemId, categoryId, completedAt, itemType",
      backups: "id",
    });
  }
}

export const db = new RemindersDB();

db.on("blocked", () => {
  console.warn(
    `${APP_NAME} database blocked — close other tabs with this app open.`,
  );
});

db.on("versionchange", () => {
  db.close();
});

let seeding: Promise<void> | null = null;

/**
 * Boot and the first getSettings() call can both land on a cold database. Left
 * unguarded they each see an empty store and seed it, which duplicates the
 * default areas and can throw a ConstraintError on the settings row. Sharing
 * one in-flight promise keeps first launch to a single seed.
 */
export function seedDatabase(): Promise<void> {
  seeding ??= runSeed().catch((err: unknown) => {
    seeding = null;
    throw err;
  });
  return seeding;
}

async function runSeed() {
  const categoryCount = await db.categories.count();
  if (categoryCount === 0) {
    await db.categories.bulkAdd(
      DEFAULT_CATEGORIES.map((c) => ({ ...c, id: uuidv4() })),
    );
  }

  const settings = await db.settings.get("app");
  if (!settings) {
    await db.settings.add({
      id: "app",
      digestEnabled: false,
      digestTime: "08:00",
      notificationsEnabled: false,
      deviceId: uuidv4(),
      defaultReminderOffsetMinutes: 0,
      weekStartsOnMonday: false,
    });
  } else if (settings.defaultReminderOffsetMinutes === undefined) {
    await db.settings.update("app", {
      defaultReminderOffsetMinutes: 0,
      weekStartsOnMonday: false,
    });
  }
}

export async function getSettings(): Promise<AppSettings> {
  const settings = await db.settings.get("app");
  if (!settings) {
    await seedDatabase();
    return (await db.settings.get("app"))!;
  }
  return settings;
}

export async function updateSettings(
  partial: Partial<Omit<AppSettings, "id">>,
) {
  await db.settings.update("app", partial);
}
