import { describe, expect, it } from "vitest";

describe("push-handler", () => {
  it("registers push and notificationclick listeners", async () => {
    const code = await fetch("http://127.0.0.1:4173/push-handler.js").then(
      (r) => r.text(),
    );
    expect(code).toContain('addEventListener("push"');
    expect(code).toContain('addEventListener("notificationclick"');
    expect(code).toContain("showNotification");
  });
});

describe("pwa manifest", () => {
  it("is standalone installable", async () => {
    const manifest = await fetch(
      "http://127.0.0.1:4173/manifest.webmanifest",
    ).then((r) => r.json());
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons?.length).toBeGreaterThan(0);
  });
});

describe("spa routes", () => {
  const routes = [
    "/",
    "/calendar",
    "/categories",
    "/follow-ups",
    "/search",
    "/notes",
    "/history",
    "/insights",
    "/guide",
    "/settings",
  ];

  it.each(routes)("serves index.html for %s", async (route) => {
    const res = await fetch(`http://127.0.0.1:4173${route}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('id="root"');
  });
});
