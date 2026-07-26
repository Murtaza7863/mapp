/** Strip conversational filler so tasks/features survive rambles. */

const RAMBLE_PREFIX =
  /^(?:(?:ok\s+)?so(?:\s+(?:um|like))?|anyway|ugh|honestly|random\s+thought\s+but|brain\s+dump:)\s+/i;

const RAMBLE_TAIL =
  /\s+(?:lol|lmao|idk|if\s+that\s+makes\s+sense|when\s+i\s+have\s+time)\s*[.!?]*$/i;

const TRAILING_FILLER =
  /\s+(?:lol|lmao|idk)\b\s*[.!?]*$/i;

const BUT_NEED =
  /^.*?\bbut\s+(?:I\s+)?(?:(?:still|really)\s+)?(?:need\s+to|have\s+to|gotta)\s+/i;

const STILL_NEED_INLINE =
  /\bstill\s+need\s+to\s+(.+?)(?:[.!?]|$)/i;

const EVENTUALLY =
  /^.*?\b(?:not\s+urgent\s+but\s+)?eventually\s+/i;

const OH_AREA_PREFIX = /^oh\s+yeah\s+(.+?)\s*[—–-]\s*/i;

const TRAILING_WEEKDAY_CLAUSE =
  /\band\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\s+is\b/i;

/** Conversational lead-in before a real task clause. */
export function normalizePlotLine(line: string): string {
  let s = line.trim().replace(/\s+/g, " ");
  if (!s) return s;

  s = s.replace(OH_AREA_PREFIX, "");
  s = s.replace(RAMBLE_PREFIX, "");
  s = s.replace(RAMBLE_TAIL, "");
  s = s.replace(TRAILING_FILLER, "");

  const trailingDay = s.match(TRAILING_WEEKDAY_CLAUSE);
  if (trailingDay) {
    s = `${s.replace(TRAILING_WEEKDAY_CLAUSE, "")} ${trailingDay[1]}`.trim();
  }

  if (BUT_NEED.test(s)) {
    s = s.replace(BUT_NEED, "");
  } else if (EVENTUALLY.test(s)) {
    s = s.replace(EVENTUALLY, "");
  }

  const stillNeed = s.match(STILL_NEED_INLINE);
  if (stillNeed && s.split(STILL_NEED_INLINE).length > 1) {
    // keep full line — caller may split sentences
  }

  s = s.replace(/^also\s+/i, "");
  s = s.replace(/\s+also\s+/gi, " ; ");
  s = s.replace(/^[—–]\s*/, "");
  // Em/en dash only — do not touch hyphens in words like follow-up
  s = s.replace(/\s*[—–]\s*/g, " — ");

  return s.trim();
}

/** Split rambling multi-sentence dumps into processable lines. */
export function splitRambleSentences(text: string): string[] {
  const normalized = text.trim();
  if (!normalized) return [];

  if (normalized.includes("\n")) {
    return normalized
      .split(/\n+/)
      .flatMap((chunk) => splitRambleSentences(chunk));
  }

  const parts: string[] = [];

  const isListLine = /^\s*(?:[-*•]|\d+[.)])\s/.test(normalized);

  // "long day. also email landlord. also buy groceries."
  if (!isListLine) {
    const alsoSplit = normalized.split(
      /(?<!\d)\.\s*(?:also\s+)?|,\s*also\s+/i,
    );
    if (alsoSplit.length > 1) {
      for (const part of alsoSplit) {
        const p = part.trim().replace(/^[.!?]+\s*/, "");
        if (p) parts.push(p);
      }
      return parts.map(normalizePlotLine).filter(Boolean);
    }
  }

  // "Woke up late. Email prof. Still need passport."
  if (!isListLine) {
    const sentenceSplit = normalized.split(
      /\.\s+(?=[A-Z"']|\b(?:email|call|still|need|pay|buy|gym|submit|renew|book|follow|bump|remind)\b)/i,
    );
    if (sentenceSplit.length > 1) {
      return sentenceSplit
        .map((p) => p.trim().replace(/^[.!?]+\s*/, ""))
        .map(normalizePlotLine)
        .filter(Boolean);
    }
  }

  // Em-dash list: "three things — a, b, and c" (not "smubia — need a folder...")
  const dashList = normalized.match(/^(.+?)\s*[—–-]\s*(.+)$/);
  if (dashList && !/\bneed\s+a\s+folder\b/i.test(dashList[2])) {
    const right = dashList[2];
    if (right.includes(",") || /\band\b/i.test(right)) {
      const listParts = right
        .split(/,\s*(?:and\s+)?|\s+and\s+/i)
        .map((p) => p.trim())
        .filter(Boolean);
      if (listParts.length >= 2) {
        return listParts.map(normalizePlotLine).filter(Boolean);
      }
    }
  }

  return [normalizePlotLine(normalized)].filter(Boolean);
}

/** Compound folder ramble: need a folder for X and add Y */
export function parseFolderCompoundRamble(
  line: string,
): { folderName: string; taskTitle: string } | null {
  const text = normalizePlotLine(line);
  const match = text.match(
    /^(?:need|want)\s+(?:a\s+)?folder\s+(?:there\s+)?(?:for\s+)?(.+?)\s+and\s+(?:add\s+)?(.+)$/i,
  );
  if (!match) return null;
  const folderName = match[1].trim().replace(/\s+docs?$/i, " docs");
  const taskTitle = match[2].trim();
  if (!folderName || !taskTitle) return null;
  return { folderName: folderName.replace(/\s+docs$/i, " docs"), taskTitle };
}
