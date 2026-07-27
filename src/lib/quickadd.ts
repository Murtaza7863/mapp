import {
  addDays,
  addHours,
  addMonths,
  setHours,
  setMinutes,
  startOfDay,
} from "date-fns";
import type { Category, ItemType } from "../types";

export interface ParsedQuickAdd {
  title: string;
  dueAt?: string;
  priority: boolean;
  categoryId?: string;
  categoryName?: string;
  type?: ItemType;
  contactName?: string;
  nextAction?: string;
}

/**
 * Weekday spellings safe to read as a date with no cue word in front of them.
 */
const WEEKDAY_SAFE_RE =
  "monday|tuesday|wednesday|thursday|friday|saturday|sunday|tues|tue|weds|wed|thurs|thur|thu|fri|mon";

/**
 * Adds "sat" and "sun", which are also ordinary words. Only trust those after a
 * cue like "next" or "on", otherwise "study sat exam" loses the SAT and
 * "buy sun hat" loses the sun.
 */
const WEEKDAY_ANY_RE = `${WEEKDAY_SAFE_RE}|sat|sun`;

const MONTH_RE =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

const MONTH_INDEX: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

/** Times of day people say instead of a clock time. */
const TIME_OF_DAY: Record<string, number> = {
  morning: 9,
  afternoon: 14,
  evening: 18,
  night: 20,
};

/** Colloquial weekday spellings → day index (0=Sun). */
export function resolveWeekdayToken(token: string): number {
  const t = token.toLowerCase().replace(/\.$/, "");
  if (/^sun/.test(t)) return 0;
  if (/^mon/.test(t)) return 1;
  if (/^tue/.test(t)) return 2;
  if (/^wed/.test(t)) return 3;
  if (/^thu/.test(t)) return 4;
  if (/^fri/.test(t)) return 5;
  if (/^sat/.test(t)) return 6;
  return -1;
}

function offsetToWeekday(
  dayIndex: number,
  now: Date,
  mode: "next" | "this" | "nearest",
): number {
  const today = now.getDay();
  if (mode === "this") {
    return (dayIndex - today + 7) % 7;
  }
  if (mode === "next") {
    return (dayIndex - today + 7) % 7 || 7;
  }
  // nearest upcoming (same weekday → next week)
  return (dayIndex - today + 7) % 7 || 7;
}

function stripWeekdayMatch(text: string, match: RegExpMatchArray): string {
  return text.replace(match[0], " ");
}

function tryWeekdayPattern(
  text: string,
  pattern: RegExp,
  mode: "next" | "this" | "nearest",
  now: Date,
): { text: string; dayOffset: number } | null {
  const m = text.match(pattern);
  if (!m) return null;
  const dayIndex = resolveWeekdayToken(m[1]);
  if (dayIndex < 0) return null;
  return {
    text: stripWeekdayMatch(text, m),
    dayOffset: offsetToWeekday(dayIndex, now, mode),
  };
}

/** Tries every weekday phrasing, most specific first. */
function matchWeekday(
  text: string,
  now: Date,
): { text: string; dayOffset: number } | null {
  const cued: Array<[string, "next" | "this" | "nearest", number]> = [
    [
      `\\s(?:due\\s+|by\\s+)?next\\s+(${WEEKDAY_ANY_RE})(?=\\s|$|[.,!?])`,
      "next",
      0,
    ],
    [`\\sthis\\s+(${WEEKDAY_ANY_RE})(?=\\s|$|[.,!?])`, "this", 0],
    [`\\s(?:due|by|on)\\s+(${WEEKDAY_ANY_RE})(?=\\s|$|[.,!?])`, "nearest", 0],
  ];

  for (const [source, mode, bonus] of cued) {
    const hit = tryWeekdayPattern(text, new RegExp(source, "i"), mode, now);
    if (hit) return { ...hit, dayOffset: hit.dayOffset + bonus };
  }

  return tryWeekdayPattern(
    text,
    new RegExp(`\\s(${WEEKDAY_SAFE_RE})(?=\\s|$|[.,!?])`, "i"),
    "nearest",
    now,
  );
}

/** Handles "dec 15", "jan 5th", "5 jan". Rolls to next year when already past. */
function matchMonthDay(
  text: string,
  now: Date,
): { text: string; date: Date } | null {
  const forward = text.match(
    new RegExp(
      `\\s(?:on\\s+)?(${MONTH_RE})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?=\\s|$|[.,!?])`,
      "i",
    ),
  );
  const backward = text.match(
    new RegExp(
      `\\s(?:on\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_RE})\\.?(?=\\s|$|[.,!?])`,
      "i",
    ),
  );

  const hit = forward ?? backward;
  if (!hit) return null;

  const monthToken = (forward ? hit[1] : hit[2]).toLowerCase().slice(0, 3);
  const day = parseInt(forward ? hit[2] : hit[1], 10);
  const month = MONTH_INDEX[monthToken];
  if (month === undefined || day < 1 || day > 31) return null;

  let date = new Date(now.getFullYear(), month, day);
  if (date.getMonth() !== month) return null; // e.g. feb 31
  if (startOfDay(date) < startOfDay(now)) {
    date = new Date(now.getFullYear() + 1, month, day);
  }

  return { text: text.replace(hit[0], " "), date };
}

/**
 * Parses shorthand like "pay rent tomorrow 9am #personal !" into a
 * structured item. Supported tokens:
 *   !            → priority
 *   #name        → category (prefix match, case-insensitive)
 *   5pm / 5:30pm / at 17:00 → time
 *   today / tonight / tomorrow / tmr / next week / mon…sunday → date
 */
export function parseQuickAdd(
  input: string,
  categories: Category[],
  now: Date = new Date(),
): ParsedQuickAdd {
  let raw = input.trim();
  let type: ItemType | undefined;

  const typeMatch = raw.match(
    /^(follow[- ]?up|fu|routine|note|deadline|task|todo|project):\s*/i,
  );
  if (typeMatch) {
    const token = typeMatch[1].toLowerCase();
    if (token === "fu" || token.startsWith("follow")) type = "follow-up";
    else if (token === "routine") type = "routine";
    else if (token === "note") type = "note";
    else if (token === "project") type = "project";
    else type = "deadline";
    raw = raw.slice(typeMatch[0].length);
  }

  let text = ` ${raw} `;
  let priority = false;
  let categoryId: string | undefined;
  let categoryName: string | undefined;
  let contactName: string | undefined;
  let nextAction: string | undefined;
  let hour: number | null = null;
  let minute = 0;
  let dayOffset: number | null = null;
  let explicitDate = false;
  let absoluteDay: Date | null = null;
  let absoluteAt: Date | null = null;

  if (/\s!{1,2}(?=\s|$)/.test(text)) {
    priority = true;
    text = text.replace(/\s!{1,2}(?=\s|$)/g, " ");
  }

  if (
    /^(?:urgent|asap)\s*:?\s*/i.test(raw) ||
    /\s(?:urgent|asap)(?=\s|$)/i.test(text)
  ) {
    priority = true;
    raw = raw.replace(/^(?:urgent|asap)\s*:?\s*/i, "");
    text = ` ${raw} `.replace(/\s(?:urgent|asap)(?=\s|$)/gi, " ");
  }

  const catMatch = text.match(/\s#([\w-]+)/);
  if (catMatch) {
    const q = catMatch[1].toLowerCase();
    const cat = categories.find((c) => c.name.toLowerCase().startsWith(q));
    if (cat) {
      categoryId = cat.id;
      categoryName = cat.name;
    }
    text = text.replace(catMatch[0], " ");
  }

  const nextActionMatch = text.match(/\s(?:→|->)\s*(.+?)(?=\s*$)/);
  if (nextActionMatch) {
    nextAction = nextActionMatch[1].trim();
    text = text.replace(nextActionMatch[0], " ");
  }

  const reMatch = text.match(/\sre:\s*([^@#!]+?)(?=\s+#|\s+!|\s+@|\s*$)/i);
  if (reMatch) {
    contactName = reMatch[1].trim();
    text = text.replace(reMatch[0], " ");
  } else {
    const atMatch = text.match(
      /\s@([\w][\w\s.-]{0,40}?)(?=\s+#|\s+!|\s+re:|\s*$)/i,
    );
    if (atMatch) {
      contactName = atMatch[1].trim();
      text = text.replace(atMatch[0], " ");
    }
  }

  if (
    !type &&
    (/\b(follow[- ]?up|bump|reach out|waiting on|check in with)\b/i.test(raw) ||
      contactName ||
      nextAction)
  ) {
    type = "follow-up";
  }

  const t12 = text.match(
    /\s(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)(?=\s|$)/i,
  );
  if (t12) {
    hour =
      (parseInt(t12[1], 10) % 12) + (t12[3].toLowerCase() === "pm" ? 12 : 0);
    minute = t12[2] ? parseInt(t12[2], 10) : 0;
    text = text.replace(t12[0], " ");
  } else {
    const t24 = text.match(/\s(?:at\s+)?(\d{1,2}):(\d{2})(?=\s|$)/);
    if (t24) {
      hour = parseInt(t24[1], 10);
      minute = parseInt(t24[2], 10);
      text = text.replace(t24[0], " ");
    }
  }

  const monthDay = matchMonthDay(text, now);
  if (monthDay) {
    absoluteDay = monthDay.date;
    explicitDate = true;
    text = monthDay.text;
  } else if (/\sin\s+(?:an?|\d+)\s+hours?(?=\s|$)/i.test(text)) {
    const m = text.match(/\sin\s+(an?|\d+)\s+hours?(?=\s|$)/i)!;
    const amount = /^an?$/i.test(m[1]) ? 1 : parseInt(m[1], 10);
    absoluteAt = addHours(now, amount);
    explicitDate = true;
    text = text.replace(m[0], " ");
  } else if (/\s(tomorrow|tmrw|tmr)(?=\s|$)/i.test(text)) {
    dayOffset = 1;
    explicitDate = true;
    text = text.replace(/\s(tomorrow|tmrw|tmr)(?=\s|$)/gi, " ");
  } else if (/\sthis weekend(?=\s|$)/i.test(text)) {
    dayOffset = (6 - now.getDay() + 7) % 7 || 7;
    explicitDate = true;
    text = text.replace(/\sthis weekend(?=\s|$)/gi, " ");
  } else if (/\s(?:end of (?:the )?week|eow)(?=\s|$)/i.test(text)) {
    dayOffset = (5 - now.getDay() + 7) % 7 || 7;
    explicitDate = true;
    if (hour === null) hour = 17;
    text = text.replace(/\s(?:end of (?:the )?week|eow)(?=\s|$)/gi, " ");
  } else if (/\snext month(?=\s|$)/i.test(text)) {
    absoluteDay = addMonths(now, 1);
    explicitDate = true;
    text = text.replace(/\snext month(?=\s|$)/gi, " ");
  } else if (/\s(eod|end of day)(?=\s|$)/i.test(text)) {
    dayOffset = 0;
    explicitDate = true;
    hour = 17;
    text = text.replace(/\s(eod|end of day)(?=\s|$)/gi, " ");
  } else if (/\sin\s+(\d+)\s+days?(?=\s|$)/i.test(text)) {
    const m = text.match(/\sin\s+(\d+)\s+days?(?=\s|$)/i)!;
    dayOffset = parseInt(m[1], 10);
    explicitDate = true;
    text = text.replace(m[0], " ");
  } else if (/\sin\s+(\d+)\s+weeks?(?=\s|$)/i.test(text)) {
    const m = text.match(/\sin\s+(\d+)\s+weeks?(?=\s|$)/i)!;
    dayOffset = parseInt(m[1], 10) * 7;
    explicitDate = true;
    text = text.replace(m[0], " ");
  } else if (/\stonight(?=\s|$)/i.test(text)) {
    dayOffset = 0;
    explicitDate = true;
    if (hour === null) hour = 20;
    text = text.replace(/\stonight(?=\s|$)/gi, " ");
  } else if (/\stoday(?=\s|$)/i.test(text)) {
    dayOffset = 0;
    explicitDate = true;
    text = text.replace(/\stoday(?=\s|$)/gi, " ");
  } else if (/\snext week(?=\s|$)/i.test(text)) {
    dayOffset = 7;
    explicitDate = true;
    text = text.replace(/\snext week(?=\s|$)/gi, " ");
  } else {
    const weekday = matchWeekday(text, now);
    if (weekday) {
      dayOffset = weekday.dayOffset;
      explicitDate = true;
      text = weekday.text;
    }
  }

  if (hour === null) {
    const noon = text.match(
      /\s(?:at\s+)?(noon|midday|midnight)(?=\s|$|[.,!?])/i,
    );
    if (noon) {
      hour = /midnight/i.test(noon[1]) ? 0 : 12;
      text = text.replace(noon[0], " ");
    } else {
      // "morning" only reads as a time once we already know the day, so
      // "morning routine" keeps its name.
      const partOfDay = text.match(
        /\s(?:at\s+|in\s+the\s+|this\s+)?(morning|afternoon|evening|night)(?=\s|$|[.,!?])/i,
      );
      const cued = partOfDay
        ? /\s(?:at|in the|this)\s/i.test(partOfDay[0])
        : false;
      if (partOfDay && (explicitDate || cued)) {
        hour = TIME_OF_DAY[partOfDay[1].toLowerCase()];
        if (!explicitDate) explicitDate = true;
        text = text.replace(partOfDay[0], " ");
      }
    }
  }

  let dueAt: string | undefined;
  if (absoluteAt) {
    dueAt = absoluteAt.toISOString();
  } else if (absoluteDay) {
    dueAt = setMinutes(
      setHours(startOfDay(absoluteDay), hour ?? 9),
      hour === null ? 0 : minute,
    ).toISOString();
  } else if (explicitDate || hour !== null) {
    const offset = dayOffset ?? 0;
    let d = setMinutes(
      setHours(startOfDay(addDays(now, offset)), hour ?? 9),
      hour === null ? 0 : minute,
    );
    // A bare time that already passed today rolls to tomorrow.
    if (!explicitDate && hour !== null && d <= now) d = addDays(d, 1);
    dueAt = d.toISOString();
  }

  // Soft contact verbs without a date stay as open loops; with a date they're tasks.
  if (!type && !dueAt && /\b(email|call|text)\b/i.test(raw)) {
    type = "follow-up";
  }

  // "3pm tmrw" is all date and no task. Keep it rather than dropping it.
  const title =
    text
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\s+(?:due|by|on)$/i, "") || (dueAt ? "Reminder" : "");
  return {
    title,
    dueAt,
    priority,
    categoryId,
    categoryName,
    type,
    contactName,
    nextAction,
  };
}
