import { describe, expect, it } from "vitest";

// `vite preview` binds to localhost, which can resolve to IPv6 only — using
// the hostname (not 127.0.0.1) lets Node pick whichever family is listening.
const BASE = "http://localhost:4173";

describe("push-handler", () => {
  it("registers push and notificationclick listeners", async () => {
    const code = await fetch(`${BASE}/push-handler.js`).then((r) => r.text());
    expect(code).toContain('addEventListener("push"');
    expect(code).toContain('addEventListener("notificationclick"');
    expect(code).toContain("showNotification");
  });

  it("resolves notification targets against the registration scope", async () => {
    const code = await fetch(`${BASE}/push-handler.js`).then((r) => r.text());
    // Absolute "/path" URLs break when the app is hosted under a sub-path.
    expect(code).toContain("self.registration.scope");
    expect(code).not.toContain('icon: "/pwa-192.png"');
  });
});

describe("pwa manifest", () => {
  it("is standalone installable", async () => {
    const manifest = await fetch(`${BASE}/manifest.webmanifest`).then((r) =>
      r.json(),
    );
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons?.length).toBeGreaterThan(0);
    // start_url/scope must share the deployed base or iOS opens a second app.
    expect(manifest.scope).toBe(manifest.start_url);
  });

  it("serves the service worker and offline shell", async () => {
    const sw = await fetch(`${BASE}/sw.js`);
    expect(sw.status).toBe(200);
    expect(await sw.text()).toContain("precacheAndRoute");
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
    const res = await fetch(`${BASE}${route}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('id="root"');
  });
});
