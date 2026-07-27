import { useEffect, useRef, useState } from "react";

import type { ParseDumpResult } from "../lib/brain-dump/types";
import type { Category } from "../types";

import { checkWebGPU, warmupPlotEngine } from "../lib/brain-dump/llm-engine";
import {
  parseRulesDump,
  refineDumpWithLlm,
  shouldUseLlm,
} from "../lib/brain-dump/parse-dump";
import { readClipboardText } from "../lib/clipboard";
import { ParseConfirmSheet } from "./ParseConfirmSheet";
import { ResolveStrip } from "./ResolveStrip";

interface Props {
  categories: Category[];
  onParsed: (result: ParseDumpResult) => void | Promise<void>;
  initialText?: string;
}

type Phase = "idle" | "loading" | "confirm";

function modelStatusText(report: { text?: string; progress?: number }): string {
  if (report.text?.trim()) return report.text.trim();
  if (typeof report.progress === "number" && report.progress > 0) {
    return `Loading AI model… ${Math.round(report.progress * 100)}%`;
  }
  return "Loading AI model…";
}

export function PlotBar({ categories, onParsed, initialText }: Props) {
  const [value, setValue] = useState(initialText ?? "");
  const [expanded, setExpanded] = useState(Boolean(initialText));
  const [phase, setPhase] = useState<Phase>("idle");
  const [useLlm, setUseLlm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [result, setResult] = useState<ParseDumpResult | null>(null);
  const [refining, setRefining] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false);
  const userEditedRef = useRef(false);
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

  const barBusy = phase === "loading";
  const canSubmit = value.trim().length > 0 && !barBusy && !saving;

  useEffect(() => {
    if (!barBusy) {
      setShowSpinner(false);
      return;
    }
    const timer = window.setTimeout(() => setShowSpinner(true), 200);
    return () => window.clearTimeout(timer);
  }, [barBusy]);

  const runPlot = async () => {
    if (!canSubmit) return;
    setError(null);
    setStatusText(null);
    userEditedRef.current = false;

    const trimmed = value.trim();
    const rulesResult = parseRulesDump(trimmed, categories);
    const hasRules =
      rulesResult.items.length > 0 || rulesResult.actions.length > 0;
    const needsLlm =
      useLlm &&
      shouldUseLlm(
        trimmed,
        rulesResult.items.length,
        rulesResult.actions.length,
      );

    if (hasRules) {
      setResult(rulesResult);
      setPhase("confirm");
      setExpanded(false);
    } else if (needsLlm) {
      setPhase("loading");
      setStatusText("Loading AI model…");
    } else {
      setError("Nothing found — try a task with a day or time.");
      return;
    }

    if (!needsLlm) return;

    setRefining(hasRules);
    try {
      const llmResult = await refineDumpWithLlm(
        trimmed,
        categories,
        rulesResult,
        (report) => {
          setStatusText(modelStatusText(report));
        },
      );

      if (!hasRules) {
        if (
          !llmResult ||
          (llmResult.items.length === 0 && llmResult.actions.length === 0)
        ) {
          setError("Nothing found — try a task with a day or time.");
          setPhase("idle");
          setResult(null);
          return;
        }
        setResult(llmResult);
        setPhase("confirm");
        setExpanded(false);
        return;
      }

      if (llmResult && !userEditedRef.current) {
        setResult(llmResult);
      }
    } catch (err) {
      if (!hasRules) {
        setError(err instanceof Error ? err.message : "Could not parse that");
        setPhase("idle");
        setResult(null);
      }
    } finally {
      setRefining(false);
      setStatusText(null);
      if (hasRules) {
        setPhase("confirm");
      }
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void runPlot();
    }
  };

  const handleConfirm = async () => {
    if (!result || saving) return;
    setSaving(true);
    try {
      await onParsed({ ...result, items: result.items });
      setValue("");
      setPhase("idle");
      setResult(null);
      setExpanded(false);
    } catch {
      // Parent shows toast; keep sheet open for retry.
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <section className="capture-hero" aria-label="Add to calendar">
        <div className="compose-bar-wrap">
          <div
            className={`compose-bar ${expanded ? "compose-bar-expanded" : ""} ${barBusy ? "compose-bar-busy" : ""}`}
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
              disabled={barBusy || saving}
            />
            <div className="compose-bar-actions">
              <button
                type="button"
                onClick={() => void paste()}
                className="compose-bar-secondary"
                aria-label="Paste from clipboard"
                disabled={barBusy || saving}
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
                {showSpinner ? (
                  <span className="compose-bar-spinner" />
                ) : (
                  "Add to calendar"
                )}
              </button>
            </div>
          </div>
          {statusText && barBusy && (
            <p className="compose-bar-status">{statusText}</p>
          )}
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
          refining={refining}
          saving={saving}
          onChangeItems={(items) => {
            userEditedRef.current = true;
            setResult({ ...result, items });
          }}
          onChangeActions={(actions) => {
            userEditedRef.current = true;
            setResult({ ...result, actions });
          }}
          onClose={() => {
            if (saving) return;
            setPhase("idle");
            setResult(null);
            setRefining(false);
          }}
          onConfirm={() => void handleConfirm()}
        />
      )}
    </>
  );
}
