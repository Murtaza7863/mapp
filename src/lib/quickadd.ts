import { addDays, setHours, setMinutes, startOfDay } from "date-fns";
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

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];
const WEEKDAY_ABBR = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

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
    const atMatch = text.match(/\s@([\w][\w\s.-]{0,40}?)(?=\s+#|\s+!|\s+re:|\s*$)/i);
    if (atMatch) {
      contactName = atMatch[1].trim();
      text = text.replace(atMatch[0], " ");
    }
  }

  if (
    !type &&
    (/\b(follow[- ]?up|bump|email|call|reach out)\b/i.test(raw) ||
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

  if (/\s(tomorrow|tmrw|tmr)(?=\s|$)/i.test(text)) {
    dayOffset = 1;
    explicitDate = true;
    text = text.replace(/\s(tomorrow|tmrw|tmr)(?=\s|$)/gi, " ");
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
  } else if (/\snext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)(?=\s|$|[.,!?])/i.test(text)) {
    const m = text.match(
      /\snext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)(?=\s|$|[.,!?])/i,
    )!;
    const token = m[1].toLowerCase();
    const idx = WEEKDAYS.findIndex((d) => d.startsWith(token.slice(0, 3)));
    const abbrIdx = WEEKDAY_ABBR.indexOf(token.slice(0, 3));
    const dayIndex = idx >= 0 ? idx : abbrIdx;
    if (dayIndex >= 0) {
      dayOffset = (dayIndex - now.getDay() + 7) % 7 || 7;
      explicitDate = true;
      text = text.replace(m[0], " ");
    }
  } else if (/\sthis\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)(?=\s|$|[.,!?])/i.test(text)) {
    const m = text.match(
      /\sthis\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)(?=\s|$|[.,!?])/i,
    )!;
    const token = m[1].toLowerCase();
    const idx = WEEKDAYS.findIndex((d) => d.startsWith(token.slice(0, 3)));
    const abbrIdx = WEEKDAY_ABBR.indexOf(token.slice(0, 3));
    const dayIndex = idx >= 0 ? idx : abbrIdx;
    if (dayIndex >= 0) {
      let offset = (dayIndex - now.getDay() + 7) % 7;
      if (offset === 0) offset = 0; // today if same weekday
      dayOffset = offset;
      explicitDate = true;
      text = text.replace(m[0], " ");
    }
  } else {
    const dueByDay = text.match(
      /\s(?:due|by)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)(?=\s|$|[.,!?])/i,
    );
    if (dueByDay) {
      const token = dueByDay[1].toLowerCase();
      const idx = WEEKDAYS.findIndex((d) => d.startsWith(token.slice(0, 3)));
      const abbrIdx = WEEKDAY_ABBR.indexOf(token.slice(0, 3));
      const dayIndex = idx >= 0 ? idx : abbrIdx;
      if (dayIndex >= 0) {
        dayOffset = (dayIndex - now.getDay() + 7) % 7 || 7;
        explicitDate = true;
        text = text.replace(dueByDay[0], " ");
      }
    } else {
      for (let i = 0; i < 7; i++) {
        const re = new RegExp(
          `\\s(?:on\\s+)?(${WEEKDAYS[i]}|${WEEKDAY_ABBR[i]})(?=\\s|$|[.,!?])`,
          "i",
        );
        const m = text.match(re);
        if (m) {
          dayOffset = (i - now.getDay() + 7) % 7 || 7;
          explicitDate = true;
          text = text.replace(m[0], " ");
          break;
        }
      }
    }
  }

  let dueAt: string | undefined;
  if (explicitDate || hour !== null) {
    const offset = dayOffset ?? 0;
    let d = setMinutes(
      setHours(startOfDay(addDays(now, offset)), hour ?? 9),
      hour === null ? 0 : minute,
    );
    // A bare time that already passed today rolls to tomorrow.
    if (!explicitDate && hour !== null && d <= now) d = addDays(d, 1);
    dueAt = d.toISOString();
  }

  const title = text.replace(/\s+/g, " ").trim();
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
