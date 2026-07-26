import { afterEach, describe, expect, it, vi } from "vitest";

import { pushBlockReason } from "./pwa";

describe("pwa", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reports iOS Safari needs Home Screen install for push", () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      serviceWorker: {},
    });
    vi.stubGlobal("PushManager", class {});
    vi.stubGlobal("matchMedia", () => ({ matches: false }));

    expect(pushBlockReason()).toContain("Home Screen");
  });
});
