import { useEffect, useRef, useState } from "react";

import type { ParseDumpResult } from "../lib/brain-dump/types";
import type { Category } from "../types";

import { checkWebGPU, warmupPlotEngine } from "../lib/brain-dump/llm-engine";
import { readClipboardText } from "../lib/clipboard";
import { parseBrainDump } from "../lib/brain-dump/parse-dump";
import { ParseConfirmSheet } from "./ParseConfirmSheet";
import { ResolveStrip } from "./ResolveStrip";

interface Props {
  categories: Category[];
  onParsed: (result: ParseDumpResult) => void;
  initialText?: string;
}

type Phase = "idle" | "loading-model" | "parsing" | "confirm";

export function PlotBar({ categories, onParsed, initialText }: Props) {
  const [value, setValue] = useState(initialText ?? "");
  const [expanded, setExpanded] = useState(Boolean(initialText));
  const [phase, setPhase] = useState<Phase>("idle");
  const [useLlm, setUseLlm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ParseDumpResult | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void checkWebGPU().then((ok) => {
      setUseLlm(ok);
      if (ok) warmupPlotEngine();
    });
  }, []);

  useEffect(() => {
    if (initialText) {
      setValue(initialText);
      setExpanded(true);
    }
  }, [initialText]);

  const paste = async () => {
    const text = await readClipboardText();
    if (!text) return;
    setValue(text);
    setExpanded(true);
    inputRef.current?.focus();
  };

  const busy = phase === "loading-model" || phase === "parsing";
  const canSubmit = value.trim().length > 0 && !busy;

  const runPlot = async () => {
    if (!canSubmit) return;
    setError(null);
    setPhase(useLlm ? "loading-model" : "parsing");

    try {
      const parsed = await parseBrainDump(value, {
        categories,
        preferLlm: useLlm,
        onModelProgress: () => setPhase("loading-model"),
      });

      if (parsed.items.length === 0 && parsed.actions.length === 0) {
        setError("Nothing found — try a task with a day or time.");
        setPhase("idle");
        return;
      }

      setResult(parsed);
      setPhase("confirm");
      setExpanded(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not parse that");
      setPhase("idle");
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void runPlot();
    }
  };

  return (
    <>
      <section className="capture-hero" aria-label="Add to calendar">
        <div className="compose-bar-wrap">
          <div
            className={`compose-bar ${expanded ? "compose-bar-expanded" : ""} ${busy ? "compose-bar-busy" : ""}`}
          >
            <textarea
              ref={inputRef}
              value={value}
              rows={expanded ? 4 : 2}
              onChange={(e) => {
                setValue(e.target.value);
                if (e.target.value.includes("\n")) setExpanded(true);
              }}
              onFocus={() => setExpanded(true)}
              onKeyDown={onKeyDown}
              placeholder="Dentist Tuesday 3pm, email Jake Friday…"
              className="compose-bar-input"
              aria-label="Type a plan to add to calendar"
            />
            <div className="compose-bar-actions">
              <button
                type="button"
                onClick={() => void paste()}
                className="compose-bar-secondary"
                aria-label="Paste from clipboard"
              >
                Paste
              </button>
              <button
                type="button"
                onClick={() => void runPlot()}
                disabled={!canSubmit}
                className="compose-bar-go"
                aria-label="Add to calendar"
              >
                {busy ? (
                  <span className="compose-bar-spinner" />
                ) : (
                  "Add to calendar"
                )}
              </button>
            </div>
          </div>
          {error && <p className="compose-bar-error">{error}</p>}
        </div>
        <ResolveStrip text={value} categories={categories} />
      </section>

      {phase === "confirm" && result && (
        <ParseConfirmSheet
          sourceText={value}
          items={result.items}
          actions={result.actions}
          clarifications={result.clarifications}
          source={result.source}
          categories={categories}
          onChangeItems={(items) => setResult({ ...result, items })}
          onChangeActions={(actions) => setResult({ ...result, actions })}
          onClose={() => {
            setPhase("idle");
            setResult(null);
          }}
          onConfirm={() => {
            onParsed(result);
            setValue("");
            setPhase("idle");
            setResult(null);
            setExpanded(false);
          }}
        />
      )}
    </>
  );
}
