export async function readClipboardText(): Promise<string | null> {
  if (!navigator.clipboard?.readText) return null;
  try {
    const text = await navigator.clipboard.readText();
    return text.trim() || null;
  } catch {
    return null;
  }
}

/** Multi-line or bullet lists belong in Plot, not quick add. */
export function looksLikeMultiCapture(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const lines = trimmed.split(/\n+/).filter((l) => l.trim());
  if (lines.length > 1) return true;
  return /^[-•*]\s+/m.test(trimmed) || /^\d+[.)]\s+/m.test(trimmed);
}
