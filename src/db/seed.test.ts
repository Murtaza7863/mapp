import { beforeEach, describe, expect, it, vi } from "vitest";

// Each case needs a fresh module so the single-flight seed promise is reset,
// otherwise a later test would silently reuse the first test's seed.
async function loadDb() {
  return await import("./index");
}

describe("seedDatabase", () => {
  beforeEach(async () => {
    const { db } = await loadDb();
    await db.categories.clear();
    await db.settings.clear();
    vi.resetModules();
  });

  it("seeds default areas exactly once", async () => {
    const { db, seedDatabase } = await loadDb();
    await seedDatabase();
    const first = await db.categories.count();
    expect(first).toBeGreaterThan(0);
    await seedDatabase();
    expect(await db.categories.count()).toBe(first);
  });

  it("does not duplicate areas when boot and settings race", async () => {
    const { db, getSettings, seedDatabase } = await loadDb();
    // BootGate seeds while another caller asks for settings on a cold start.
    await Promise.all([seedDatabase(), getSettings(), seedDatabase()]);

    const names = (await db.categories.toArray()).map((c) => c.name);
    expect(names.length).toBeGreaterThan(0);
    expect(names.length).toBe(new Set(names).size);
    expect(await db.settings.count()).toBe(1);
  });
});
