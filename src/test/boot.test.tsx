import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import App from "../App";
import { db, seedDatabase } from "../db";

/**
 * Mounts the real app against fake-indexeddb. Catches the crash-on-render class
 * of bug (a missing browser API, a bad hook) that unit tests walk straight past.
 */

const ROUTES = [
  "/",
  "/calendar",
  "/categories",
  "/follow-ups",
  "/deadlines",
  "/folders",
  "/search",
  "/notes",
  "/history",
  "/insights",
  "/guide",
  "/settings",
];

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeAll(async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  await db.open();
  await seedDatabase();
  // jsdom implements neither, and both run on first paint.
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubGlobal("scrollTo", () => {});
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

async function mountAt(route: string): Promise<string> {
  window.history.pushState({}, "", route);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  const errors: unknown[] = [];
  const spy = vi.spyOn(console, "error").mockImplementation((...args) => {
    errors.push(args[0]);
  });

  await act(async () => {
    root!.render(<App />);
  });
  // Let Dexie live queries resolve and paint.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50));
  });

  spy.mockRestore();
  if (errors.length > 0) {
    throw new Error(`console.error during render: ${String(errors[0])}`);
  }
  return container.textContent ?? "";
}

describe("app boots", () => {
  it.each(ROUTES)("renders %s without crashing", async (route) => {
    const text = await mountAt(route);
    expect(text.length).toBeGreaterThan(0);
    expect(text).not.toContain("Something went wrong");
  });
});
