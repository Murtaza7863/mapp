import { describe, expect, it } from "vitest";

import {
  buildDigest,
  digestKeyFor,
  dueNotifications,
  isDigestDue,
  localTime,
  LOOKBACK_MS,
  parseDigestTime,
  toPushPayload,
} from "./delivery.js";
import type { ScheduledNotification, SchedulePayload } from "./types.js";

const AT = (iso: string) => Date.parse(iso);

function note(
  overrides: Partial<ScheduledNotification> = {},
): ScheduledNotification {
  return {
    id: "item-1-due",
    fireAt: "2026-03-10T09:00:00.000Z",
    title: "Call the dentist",
    body: "Due now",
    ...overrides,
  };
}

function schedule(overrides: Partial<SchedulePayload> = {}): SchedulePayload {
  return {
    deviceId: "device-1",
    digestEnabled: false,
    digestTime: "08:00",
    timeZone: "America/New_York",
    notifications: [],
    ...overrides,
  };
}

describe("reminder delivery window", () => {
  it("sends a reminder whose fire time falls between cron runs", () => {
    // The old worker paired a 5-minute cron with a 2-minute window, so a
    // reminder landing 4 minutes before a run was dropped and never retried.
    const s = schedule({ notifications: [note()] });
    const fourMinutesLate = AT("2026-03-10T09:04:00.000Z");

    expect(dueNotifications(s, {}, fourMinutesLate)).toHaveLength(1);
  });

  it("still recovers a reminder after several missed cron runs", () => {
    const s = schedule({ notifications: [note()] });
    const nearlyLate = AT("2026-03-10T09:00:00.000Z") + LOOKBACK_MS - 1000;

    expect(dueNotifications(s, {}, nearlyLate)).toHaveLength(1);
  });

  it("gives up rather than sending a badly stale reminder", () => {
    const s = schedule({ notifications: [note()] });
    const tooLate = AT("2026-03-10T09:00:00.000Z") + LOOKBACK_MS + 1000;

    expect(dueNotifications(s, {}, tooLate)).toHaveLength(0);
  });

  it("does not send before the fire time", () => {
    const s = schedule({ notifications: [note()] });
    expect(dueNotifications(s, {}, AT("2026-03-10T08:59:00.000Z"))).toEqual([]);
  });

  it("never sends the same reminder twice", () => {
    const n = note({ id: "abc", fireAt: "2026-03-10T09:00:00.000Z" });
    const s = schedule({ notifications: [n] });
    const now = AT("2026-03-10T09:01:00.000Z");
    const alreadySent = {
      "abc@2026-03-10T09:00:00.000Z": "2026-03-10T09:00:30.000Z",
    };

    expect(dueNotifications(s, {}, now)).toHaveLength(1);
    expect(dueNotifications(s, alreadySent, now)).toHaveLength(0);
  });

  it("re-fires after a snooze or reschedule changes fireAt", () => {
    // Client keeps the same id (`item-7-due`) when the user moves the time.
    // Keying only on id would suppress the new fire for days.
    const s = schedule({
      notifications: [
        note({ id: "item-7-due", fireAt: "2026-03-10T14:00:00.000Z" }),
      ],
    });
    const sentFromEarlier = {
      "item-7-due@2026-03-10T09:00:00.000Z": "2026-03-10T09:00:30.000Z",
    };

    expect(
      dueNotifications(s, sentFromEarlier, AT("2026-03-10T14:01:00.000Z")),
    ).toHaveLength(1);
  });

  it("re-fires a chase nudge when it rolls to the next morning", () => {
    const s = schedule({
      notifications: [
        note({ id: "item-7-chase", fireAt: "2026-03-11T13:00:00.000Z" }),
      ],
    });
    const sentYesterday = {
      "item-7-chase@2026-03-10T13:00:00.000Z": "2026-03-10T13:00:30.000Z",
    };

    expect(
      dueNotifications(s, sentYesterday, AT("2026-03-11T13:01:00.000Z")),
    ).toHaveLength(1);
  });

  it("ignores entries with an unparseable fire time", () => {
    const s = schedule({ notifications: [note({ fireAt: "not a date" })] });
    expect(dueNotifications(s, {}, Date.now())).toEqual([]);
  });

  it("delivers oldest first", () => {
    const s = schedule({
      notifications: [
        note({ id: "b", fireAt: "2026-03-10T09:03:00.000Z" }),
        note({ id: "a", fireAt: "2026-03-10T09:01:00.000Z" }),
      ],
    });
    const ids = dueNotifications(s, {}, AT("2026-03-10T09:04:00.000Z")).map(
      (n) => n.id,
    );
    expect(ids).toEqual(["a", "b"]);
  });
});

describe("push payload", () => {
  it("keeps the deep link so the tap opens the right screen", () => {
    // The old worker hardcoded "/", so every reminder opened the home screen.
    expect(toPushPayload(note({ url: "/follow-ups?item=7" })).url).toBe(
      "/follow-ups?item=7",
    );
  });

  it("falls back to the home screen when no url was given", () => {
    expect(toPushPayload(note()).url).toBe("/");
  });
});

describe("digest timing", () => {
  it("parses a wall-clock time", () => {
    expect(parseDigestTime("08:30")).toBe(510);
    expect(parseDigestTime("7:05")).toBe(425);
  });

  it("rejects nonsense times", () => {
    expect(parseDigestTime("")).toBeNull();
    expect(parseDigestTime("25:00")).toBeNull();
    expect(parseDigestTime("08:75")).toBeNull();
  });

  it("resolves wall-clock time in the user's zone, not UTC", () => {
    // 12:30 UTC is 08:30 in New York on this date.
    const local = localTime(AT("2026-03-10T12:30:00.000Z"), "America/New_York");
    expect(local.date).toBe("2026-03-10");
    expect(local.minutesSinceMidnight).toBe(8 * 60 + 30);
  });

  it("fires without the cron landing on the exact minute", () => {
    // The old worker required getHours()/getMinutes() to match exactly, which
    // a 5-minute cron almost never did, so the digest never arrived.
    const s = schedule({ digestEnabled: true, digestTime: "08:00" });
    const eightOhThreeLocal = AT("2026-03-10T12:03:00.000Z");

    expect(isDigestDue(s, {}, eightOhThreeLocal)).toBe(true);
  });

  it("uses the user's timezone rather than the worker's UTC clock", () => {
    const s = schedule({ digestEnabled: true, digestTime: "08:00" });
    // 08:00 UTC is 03:00 in New York — too early for this user.
    expect(isDigestDue(s, {}, AT("2026-03-10T08:00:00.000Z"))).toBe(false);
  });

  it("does not send a digest hours late", () => {
    const s = schedule({ digestEnabled: true, digestTime: "08:00" });
    expect(isDigestDue(s, {}, AT("2026-03-10T16:00:00.000Z"))).toBe(false);
  });

  it("sends at most one digest per local day", () => {
    const s = schedule({ digestEnabled: true, digestTime: "08:00" });
    const now = AT("2026-03-10T12:05:00.000Z");
    const sent = { [digestKeyFor("2026-03-10")]: "2026-03-10T12:00:00.000Z" };

    expect(isDigestDue(s, {}, now)).toBe(true);
    expect(isDigestDue(s, sent, now)).toBe(false);
  });

  it("stays off when the user disabled it", () => {
    const s = schedule({ digestEnabled: false, digestTime: "08:00" });
    expect(isDigestDue(s, {}, AT("2026-03-10T12:00:00.000Z"))).toBe(false);
  });
});

describe("digest contents", () => {
  it("lists what is due on the user's local day", () => {
    const s = schedule({
      digestEnabled: true,
      notifications: [
        note({ id: "a", title: "Dentist", fireAt: "2026-03-10T14:00:00.000Z" }),
        note({ id: "b", title: "Taxes", fireAt: "2026-03-10T20:00:00.000Z" }),
        note({ id: "c", title: "Later", fireAt: "2026-03-19T14:00:00.000Z" }),
      ],
    });

    const digest = buildDigest(s, AT("2026-03-10T12:00:00.000Z"));
    expect(digest.title).toBe("Today: 2 items");
    expect(digest.body).toBe("• Dentist\n• Taxes");
  });

  it("says so when the day is clear", () => {
    const s = schedule({ digestEnabled: true });
    expect(buildDigest(s, AT("2026-03-10T12:00:00.000Z")).body).toBe(
      "Nothing due today.",
    );
  });

  it("truncates a long day instead of overflowing the payload", () => {
    const notifications = Array.from({ length: 9 }, (_, i) =>
      note({
        id: `n${i}`,
        title: `Task ${i}`,
        fireAt: `2026-03-10T1${i}:00:00.000Z`,
      }),
    );
    const digest = buildDigest(
      schedule({ digestEnabled: true, notifications }),
      AT("2026-03-10T12:00:00.000Z"),
    );

    expect(digest.title).toBe("Today: 9 items");
    expect(digest.body).toContain("+4 more");
  });
});
