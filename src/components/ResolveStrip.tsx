import { format, parseISO } from "date-fns";
import { useEffect, useMemo, useState } from "react";

import { refineProposals } from "../lib/brain-dump/refine-proposals";
import { parseDumpWithRules, splitDumpLines } from "../lib/brain-dump/rules-parser";
import type { Category } from "../types";

import { useDebouncedValue } from "../hooks/useDebouncedValue";

interface Props {
  text: string;
  categories: Category[];
}

interface PreviewRow {
  id: string;
  title: string;
  rawHint: string;
  resolved: string;
}

function formatResolved(iso: string): string {
  return format(parseISO(iso), "EEE MMM d · h:mm a");
}

function guessRawHint(line: string, resolved: string): string {
  const lower = line.toLowerCase();
  const day = format(parseISO(resolved), "EEE").toLowerCase();
  const dayIdx = lower.indexOf(day.slice(0, 3));
  if (dayIdx >= 0) {
    const chunk = line.slice(dayIdx).split(/[,;]/)[0]?.trim();
    if (chunk && chunk.length < 40) return chunk;
  }
  const timeMatch = line.match(
    /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|tomorrow|today|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  );
  return timeMatch?.[0] ?? line.slice(0, 24).trim();
}

export function ResolveStrip({ text, categories }: Props) {
  const debounced = useDebouncedValue(text.trim(), 280);
  const [settled, setSettled] = useState(false);

  const rows = useMemo((): PreviewRow[] => {
    if (!debounced) return [];
    const lines = splitDumpLines(debounced);
    const parsed = parseDumpWithRules(debounced, categories);
    const refined = refineProposals(parsed.items, categories, lines);
    return refined
      .filter((item) => item.dueAt)
      .slice(0, 4)
      .map((item, index) => ({
        id: item.id,
        title: item.title,
        rawHint: guessRawHint(lines[index] ?? debounced, item.dueAt!),
        resolved: formatResolved(item.dueAt!),
      }));
  }, [debounced, categories]);

  useEffect(() => {
    if (!debounced || rows.length === 0) {
      setSettled(false);
      return;
    }
    setSettled(false);
    const timer = window.setTimeout(() => setSettled(true), 400);
    return () => window.clearTimeout(timer);
  }, [debounced, rows]);

  if (rows.length === 0) {
    return <div className="resolve-strip resolve-strip-empty" aria-hidden />;
  }

  return (
    <div className="resolve-strip" aria-live="polite" aria-label="Parsed schedule preview">
      {rows.map((row) => (
        <div
          key={row.id}
          className={`resolve-row ${settled ? "is-settled" : ""}`}
        >
          <span className="resolve-token-raw">{row.rawHint}</span>
          <span className="resolve-arrow" aria-hidden>
            →
          </span>
          <span className="resolve-token-done">{row.resolved}</span>
          <span className="resolve-title">{row.title}</span>
        </div>
      ))}
    </div>
  );
}
