const CONTACT_RE =
  /(?:follow[- ]?up with|reach out to|email|call|text|contact|bump)\s+(.+?)(?:\s+(?:about|re:|regarding)|$)/i;

const FOLLOW_UP_BARE_RE = /\bfollow[- ]?up\s+([A-Za-z][\w\s.-]{1,38})\s*$/i;

const WAITING_ON_RE = /\bwaiting\s+on\s+([A-Za-z][\w\s.-]{1,38})\b/i;

const STRAY_DATE_INLINE =
  /\b(tomorrow|today|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi;

export function extractContact(line: string): string | undefined {
  const waiting = line.match(WAITING_ON_RE);
  if (waiting) {
    const name = waiting[1].replace(STRAY_DATE_INLINE, "").trim();
    if (name.length > 0 && name.length < 40) return name;
  }

  const bare = line.match(FOLLOW_UP_BARE_RE);
  if (bare) {
    const name = bare[1].replace(STRAY_DATE_INLINE, "").trim();
    if (name.length > 0 && name.length < 40) return name;
  }

  const match = line.match(CONTACT_RE);
  if (!match) return undefined;
  const name = match[1]
    .replace(STRAY_DATE_INLINE, "")
    .replace(/[!#].*$/, "")
    .trim();
  return name.length > 0 && name.length < 40 ? name : undefined;
}
