import type { ItemType } from "../../types";

const FILLER_PREFIX =
  /^(?:need to|remember to|remind me to|don't forget(?:\s+to)?|dont forget(?:\s+to)?|have to|gotta|should|also|maybe|probably)\s+/i;

const STRAY_DATE_TOKENS =
  /\b(?:tomorrow|today|tonight|tmrw|tmr|next week|next monday|next tuesday|next wednesday|next thursday|next friday|next saturday|next sunday)\b/gi;

const STRAY_WEEKDAY =
  /\b(?:on\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/gi;

const TRAILING_TIME = /\s+(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*$/i;

const ACTION_PREFIX =
  /^(?:follow[- ]?up(?: with)?|reach out to|check in with|waiting on)\s+/i;

const VERB_PREFIX = /^(?:email|call|text|contact|bump|message|dm)\s+/i;

const JUNK_TITLES = new Set([
  "also",
  "and",
  "or",
  "but",
  "maybe",
  "soon",
  "later",
  "stuff",
  "things",
  "etc",
  "idk",
  "ok",
  "yes",
  "no",
]);

const JUNK_LINE_RE =
  /^(?:also|btw|fyi|note that|if |when |unless |although |because |probably |might |could |just )\s*/i;

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function capitalizeContact(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => capitalize(word))
    .join(" ");
}

const CONTEXT_CLAUSE_RES = [
  /^(?:just\s+)?(?:finished|had|wrapped up|got off|completed)\s+(?:a\s+)?(?:call|meeting|chat|sync)\s+with\s+(.+)$/i,
  /^(?:just\s+)?(?:talked|spoke)\s+(?:to|with)\s+(.+)$/i,
  /^(?:just\s+)?met\s+with\s+(.+)$/i,
];

/** Past-tense status line — context for the next task, not a task itself. */
export function parseContextClause(
  segment: string,
): { contactName: string } | null {
  const s = segment.trim().replace(/[.!?]+$/, "");
  for (const re of CONTEXT_CLAUSE_RES) {
    const match = s.match(re);
    if (!match) continue;
    const contactName = capitalizeContact(match[1].trim());
    if (contactName.length > 0 && contactName.length < 40) {
      return { contactName };
    }
  }
  return null;
}

export const CONTEXT_MERGE_SEP = " || ";

export function polishTitle(
  title: string,
  _raw: string,
  type: ItemType,
  contactName?: string,
  contextContact?: string,
): string {
  let t = title.trim();

  t = t.replace(FILLER_PREFIX, "");
  t = t.replace(STRAY_DATE_TOKENS, " ");
  t = t.replace(STRAY_WEEKDAY, " ");
  t = t.replace(TRAILING_TIME, "");
  t = t.replace(/\b(?:due|by)\s*$/i, "");
  t = t.replace(/\s+/g, " ").trim();

  if (type === "follow-up") {
    const aboutMatch = t.match(/^(.+?)\s+(?:about|re:|regarding)\s+(.+)$/i);
    if (aboutMatch) {
      const who = (contactName ?? aboutMatch[1])
        .replace(VERB_PREFIX, "")
        .replace(ACTION_PREFIX, "")
        .trim();
      const subject = aboutMatch[2].trim();
      if (subject.length > 1) {
        return capitalize(who ? `${who} — ${subject}` : subject);
      }
    }

    t = t.replace(ACTION_PREFIX, "");
    const verbMatch = t.match(VERB_PREFIX);
    if (verbMatch) {
      const rest = t.replace(VERB_PREFIX, "").trim();
      if (contactName && rest.toLowerCase() === contactName.toLowerCase()) {
        return capitalize(`Follow up — ${contactName}`);
      }
      if (rest.length > 0) {
        return capitalize(
          `${verbMatch[0].trim()} ${rest}`.replace(/\s+/g, " "),
        );
      }
    }

    if (contactName && t.toLowerCase() === contactName.toLowerCase()) {
      return capitalize(`Follow up — ${contactName}`);
    }
  }

  t = t
    .replace(/^[,.\-–—]+\s*/, "")
    .replace(/\s*[,.\-–—]+$/, "")
    .trim();

  const who = contextContact ?? contactName;
  if (who && type === "follow-up") {
    const lower = t.toLowerCase();
    const whoLower = who.toLowerCase();
    if (!lower.startsWith(whoLower)) {
      return capitalize(`${who} — ${t}`);
    }
  }

  return capitalize(t);
}

export interface TaskValidityContext {
  dueAt?: string;
  contactName?: string;
  type?: ItemType;
}

export function isValidTask(
  line: string,
  title: string,
  ctx: TaskValidityContext = {},
): boolean {
  const t = title.trim().toLowerCase();
  if (t.length < 2) return false;
  if (JUNK_TITLES.has(t)) return false;
  if (/^(hmm?|um+|lol|ok\??|yes\.?|no\.?)$/.test(t)) return false;

  if (JUNK_LINE_RE.test(line.trim())) return false;
  if (/^(if|when|unless|although|because)\b/i.test(t)) return false;

  if (ctx.type === "note" || ctx.type === "follow-up") {
    return t.length >= 2;
  }

  const words = t.split(/\s+/).filter(Boolean);

  if (words.length === 1 && !ctx.dueAt && !ctx.contactName) {
    const okAlone =
      /^(groceries|rent|gym|laundry|dishes|taxes|passport|visa|dentist)$/i;
    if (!okAlone.test(t)) return false;
  }

  // Clause-y fragments with no substance
  if (
    words.length <= 2 &&
    /^(if they|if he|if she|when they|about the)$/i.test(t)
  ) {
    return false;
  }

  return true;
}

export function looksLikeTaskSegment(segment: string): boolean {
  const s = segment.trim();
  if (s.length < 4) return false;
  if (parseContextClause(s)) return false;
  if (/^(and|or|also|but|then|so)$/i.test(s)) return false;
  if (JUNK_LINE_RE.test(s)) return false;

  if (
    /\b(?:tomorrow|today|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i.test(
      s,
    )
  ) {
    return s.split(/\s+/).length >= 2;
  }

  return (
    /\b(email|call|submit|finish|send|pay|buy|book|prep|study|review|follow|meet|complete|write|read|fix|pack|return|schedule|apply|gym|homework|exam|rent)\b/i.test(
      s,
    ) || s.split(/\s+/).length >= 3
  );
}
