import type { ItemType } from "../../types";

const FILLER_PREFIX =
  /^(?:need to|remember to|remind me(?:\s+that)?(?:\s+I)?(?:\s+promised)?|don't forget(?:\s+to)?|dont forget(?:\s+to)?|have to|gotta|should|also|maybe|probably|I'?ve been putting this off forever but I really really need to|I really need to|I need to)\s+/i;

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
  /^(?:just\s+)?(?:finished|had|wrapped up|got off|completed)\s+(?:a\s+)?(?:call|meeting|chat|sync|demo|presentation)\s+with\s+(.+)$/i,
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

export function splitContextTaskLine(line: string): {
  taskLine: string;
  contextContact?: string;
} {
  if (!line.includes(CONTEXT_MERGE_SEP)) {
    return { taskLine: line };
  }
  const [contextPart, taskPart] = line.split(CONTEXT_MERGE_SEP, 2);
  const context = parseContextClause(contextPart.trim());
  if (!context || !taskPart?.trim()) {
    return { taskLine: line };
  }
  return { taskLine: taskPart.trim(), contextContact: context.contactName };
}

export function polishTitle(
  title: string,
  _raw: string,
  type: ItemType,
  contactName?: string,
  contextContact?: string,
  categoryNames: string[] = [],
): string {
  let t = title.trim();

  t = t.replace(FILLER_PREFIX, "");
  t = t.replace(STRAY_DATE_TOKENS, " ");
  t = t.replace(STRAY_WEEKDAY, " ");
  t = t.replace(TRAILING_TIME, "");
  t = t.replace(/\b(?:due|by)\s*$/i, "");
  t = t.replace(/\bby\s+next\s*$/i, "");
  t = t.replace(/\s+/g, " ").trim();

  const who = contextContact ?? contactName;
  if (who) {
    t = t.replace(/\b(them|they|him|her|it)\b/gi, who);
  }

  if (type === "follow-up") {
    const forSubject = t.match(/\bfor\s+(.+)$/i);
    if (forSubject && who) {
      const subject = forSubject[1].trim();
      const isArea = categoryNames.some(
        (name) => name.toLowerCase() === subject.toLowerCase(),
      );
      if (!isArea && subject.length > 1) {
        return capitalize(`${who} — ${subject}`);
      }
      t = t.replace(/\bfor\s+.+$/i, "").trim();
    }

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
    t = t.replace(/^with\s+/i, "").trim();
    if (
      who &&
      (!t || t.toLowerCase() === who.toLowerCase() || /^follow\s*up$/i.test(t))
    ) {
      return capitalize(`Follow up — ${who}`);
    }

    if (!who && t && !t.includes(" ") && type === "follow-up") {
      return capitalize(`Follow up — ${t}`);
    }

    if (type === "follow-up" && /^waiting\s+on\b/i.test(_raw)) {
      const waiting = _raw.match(/\bwaiting\s+on\s+([A-Za-z][\w\s.-]+)/i);
      const subject = _raw.match(/\bfor\s+(.+)$/i);
      if (waiting) {
        const whoName = waiting[1].trim();
        if (subject) {
          const subjectText = subject[1].trim();
          const subjectIsArea = categoryNames.some(
            (name) => name.toLowerCase() === subjectText.toLowerCase(),
          );
          if (!subjectIsArea && subjectText.length > 1) {
            return capitalize(`${whoName} — ${subjectText}`);
          }
        }
        return capitalize(`Waiting on ${whoName}`);
      }
    }

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

  // Venting / mood-only lines with no actionable verb
  if (
    /^(?:today was|i'?m so|super stressed|nothing matters|was a long day)/i.test(
      line.trim(),
    ) &&
    !/\b(?:email|call|pay|buy|submit|renew|book|send|follow|bump|schedule)\b/i.test(
      line,
    )
  ) {
    return false;
  }

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
    /\b(?:create|make|add|new)\s+(?:a\s+)?folder\b/i.test(s) ||
    /\b(?:need|want)\s+(?:a\s+)?folder\b/i.test(s)
  ) {
    return false;
  }

  if (
    /\b(?:schedule|book|renew|submit|sort out|bump|email|call|pay|buy|send)\b/i.test(
      s,
    )
  ) {
    return true;
  }

  if (
    /\b(?:tomorrow|today|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i.test(
      s,
    )
  ) {
    return s.split(/\s+/).length >= 2;
  }

  return (
    /\b(email|call|submit|finish|send|pay|buy|book|prep|study|review|follow|meet|complete|write|read|fix|pack|return|schedule|apply|gym|homework|exam|rent|check|waiting|bump|reach)\b/i.test(
      s,
    ) || s.split(/\s+/).length >= 3
  );
}
