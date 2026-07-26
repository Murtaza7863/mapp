const CONTACT_RE =
  /(?:follow[- ]?up with|reach out to|email|call|text|contact|bump)\s+(.+?)(?:\s+(?:about|re:|regarding)|$)/i;

const STRAY_DATE_INLINE =
  /\b(tomorrow|today|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi;

export function extractContact(line: string): string | undefined {
  const match = line.match(CONTACT_RE);
  if (!match) return undefined;
  const name = match[1]
    .replace(STRAY_DATE_INLINE, "")
    .replace(/[!#].*$/, "")
    .trim();
  return name.length > 0 && name.length < 40 ? name : undefined;
}
