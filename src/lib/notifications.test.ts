import { describe, expect, it } from "vitest";

import { createItem } from "./items";
import {
  buildScheduledNotifications,
  currentTimeZone,
  subscriptionMatchesVapidKey,
  urlBase64ToUint8Array,
} from "./notifications";

describe("buildScheduledNotifications", () => {
  const now = new Date("2026-07-26T12:00:00").getTime();

  it("includes future reminders only", () => {
    const future = createItem({
      title: "Later",
      dueAt: new Date("2026-07-26T14:00:00").toISOString(),
    });
    const past = createItem({
      title: "Missed",
      dueAt: new Date("2026-07-26T10:00:00").toISOString(),
    });

    const scheduled = buildScheduledNotifications([future, past], now);
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].title).toBe("Later");
  });

  it("skips notes", () => {
    const note = createItem({
      title: "Note",
      type: "note",
      dueAt: new Date("2026-07-26T14:00:00").toISOString(),
    });
    expect(buildScheduledNotifications([note], now)).toHaveLength(0);
  });

  it("schedules look-back reminders for threads", () => {
    const thread = createItem({
      title: "Revisit Google deal",
      type: "follow-up",
      checkBackAt: new Date("2026-07-27T09:00:00").toISOString(),
    });
    const scheduled = buildScheduledNotifications([thread], now);
    expect(scheduled.some((s) => s.id.endsWith("-checkback"))).toBe(true);
  });

  it("schedules chase nudges for stale threads", () => {
    const thread = createItem({
      title: "Outreach",
      type: "follow-up",
      pipelineStage: "waiting",
      lastContactAt: "2026-07-10T12:00:00",
    });
    const scheduled = buildScheduledNotifications([thread], now);
    expect(scheduled.some((s) => s.id.endsWith("-chase"))).toBe(true);
  });

  it("gives every reminder a deep link for the tap target", () => {
    const thread = createItem({
      title: "Revisit Google deal",
      type: "follow-up",
      checkBackAt: new Date("2026-07-27T09:00:00").toISOString(),
    });
    const scheduled = buildScheduledNotifications([thread], now);

    expect(scheduled.length).toBeGreaterThan(0);
    for (const entry of scheduled) {
      expect(entry.url).toMatch(/^\//);
    }
  });
});

describe("currentTimeZone", () => {
  it("reports an IANA zone the worker can resolve", () => {
    // The worker runs in UTC, so the digest time is meaningless without this.
    const zone = currentTimeZone();
    expect(zone).toBeTruthy();
    expect(() =>
      new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(new Date()),
    ).not.toThrow();
  });
});

describe("subscriptionMatchesVapidKey", () => {
  const publicKey =
    "BE3diAYpBBCuv-i3GF0sAvhwaJGSY_BMuzqlQIvAE7buAaBj7HHiVUAriFb9wdPuowROX5aKXRqmQGBn6YXApK8";

  function fakeSubscription(key: ArrayBuffer | null): PushSubscription {
    return {
      options: { applicationServerKey: key, userVisibleOnly: true },
    } as PushSubscription;
  }

  it("accepts a subscription created with the current public key", () => {
    const key = urlBase64ToUint8Array(publicKey);
    expect(
      subscriptionMatchesVapidKey(
        fakeSubscription(key.buffer as ArrayBuffer),
        publicKey,
      ),
    ).toBe(true);
  });

  it("rejects a subscription bound to a different key", () => {
    const bytes = new Uint8Array(65);
    bytes.fill(7);
    expect(
      subscriptionMatchesVapidKey(fakeSubscription(bytes.buffer), publicKey),
    ).toBe(false);

    // Same length as a real P-256 point, but one byte flipped.
    const nearly = new Uint8Array(urlBase64ToUint8Array(publicKey));
    nearly[1] ^= 0xff;
    expect(
      subscriptionMatchesVapidKey(fakeSubscription(nearly.buffer), publicKey),
    ).toBe(false);
  });

  it("rejects a subscription with no applicationServerKey", () => {
    expect(subscriptionMatchesVapidKey(fakeSubscription(null), publicKey)).toBe(
      false,
    );
  });
});
