import { db } from "../db";
import type { AppSettings, Category, CompletionLog, Item } from "../types";
import { isIos } from "./pwa";

export interface ExportBundle {
  version: 2;
  exportedAt: string;
  categories: Category[];
  items: Item[];
  completions: CompletionLog[];
  settings: AppSettings;
}

export async function exportData(): Promise<ExportBundle> {
  const [categories, items, completions, settings] = await Promise.all([
    db.categories.orderBy("sortOrder").toArray(),
    db.items.toArray(),
    db.completions.orderBy("completedAt").toArray(),
    db.settings.get("app"),
  ]);

  if (!settings) {
    throw new Error("App settings missing — cannot export");
  }

  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    categories,
    items,
    completions,
    settings,
  };
}

function validateBundle(bundle: ImportBundle): void {
  if (!bundle.categories?.length) {
    throw new Error("Backup has no areas");
  }
  if (!Array.isArray(bundle.items)) {
    throw new Error("Backup items are invalid");
  }
  const catIds = new Set(bundle.categories.map((c) => c.id));
  for (const item of bundle.items) {
    if (!item.id || !item.title || !item.type) {
      throw new Error(`Invalid item in backup: ${item.title ?? "unknown"}`);
    }
    if (!catIds.has(item.categoryId)) {
      throw new Error(
        `Item "${item.title}" references a missing area — backup may be corrupt`,
      );
    }
  }
}

export interface ExportBundleV1 {
  version: 1;
  exportedAt: string;
  categories: Category[];
  items: Item[];
  settings: AppSettings;
}

export type ImportBundle = ExportBundle | ExportBundleV1;

export async function importData(bundle: ImportBundle, replace = true) {
  if (bundle.version !== 2 && bundle.version !== 1) {
    throw new Error("Unsupported export version");
  }
  validateBundle(bundle);

  const completions = bundle.version === 2 ? bundle.completions : [];

  await db.transaction(
    "rw",
    db.items,
    db.categories,
    db.settings,
    db.completions,
    async () => {
      if (replace) {
        await db.items.clear();
        await db.categories.clear();
        await db.completions.clear();
      }
      await db.categories.bulkPut(bundle.categories);
      await db.items.bulkPut(bundle.items);
      if (completions.length) await db.completions.bulkPut(completions);
      await db.settings.put({
        ...bundle.settings,
        defaultReminderOffsetMinutes:
          bundle.settings.defaultReminderOffsetMinutes ?? 0,
        weekStartsOnMonday: bundle.settings.weekStartsOnMonday ?? false,
      });
    },
  );
}

export async function exportDataForCategory(
  categoryId: string,
): Promise<ExportBundle> {
  const full = await exportData();
  return {
    ...full,
    categories: full.categories.filter((c) => c.id === categoryId),
    items: full.items.filter((i) => i.categoryId === categoryId),
    completions: full.completions.filter((c) => c.categoryId === categoryId),
  };
}

export async function downloadJson(data: unknown, filename: string) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });

  if (typeof navigator.share === "function" && isIos()) {
    const file = new File([blob], filename, { type: "application/json" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch (err) {
        // Dismissing the iOS share sheet rejects; that is not a failure.
        if (err instanceof Error && err.name === "AbortError") return;
        throw err;
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // Revoking synchronously can cancel the download before it starts.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
