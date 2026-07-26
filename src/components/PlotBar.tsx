import { useEffect, useRef, useState } from "react";

import type { ParseDumpResult } from "../lib/brain-dump/types";
import type { Category } from "../types";

import { checkWebGPU, warmupPlotEngine } from "../lib/brain-dump/llm-engine";
import { readClipboardText } from "../lib/clipboard";
import { parseBrainDump } from "../lib/brain-dump/parse-dump";
import { ArrowRightIcon, SparkIcon } from "./icons";
import { ParseConfirmSheet } from "./ParseConfirmSheet";

interface Props {
  categories: Category[];
  onParsed: (result: ParseDumpResult) => void;
  initialText?: string;
}

type Phase = "idle" | "loading-model" | "parsing" | "confirm";

export function PlotBar({ categories, onParsed, initialText }: Props) {
  const [value, setValue] = useState(initialText ?? "");
  const [expanded, setExpanded] = useState(false);
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
        setError("Nothing to plot — try a task or app action per line.");
        setPhase("idle");
        return;
      }

      setResult(parsed);
      setPhase("confirm");
      setExpanded(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not plot that");
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
      <div className="compose-bar-wrap mb-3">
        <div
          className={`compose-bar ${expanded ? "compose-bar-expanded" : ""} ${busy ? "compose-bar-busy" : ""}`}
        >
          <SparkIcon className="compose-bar-icon h-4 w-4 shrink-0" />
          <textarea
            ref={inputRef}
            value={value}
            rows={expanded ? 3 : 1}
            onChange={(e) => {
              setValue(e.target.value);
              if (e.target.value.includes("\n")) setExpanded(true);
            }}
            onFocus={() => setExpanded(true)}
            onBlur={() => {
              if (!value.includes("\n") && value.length < 48)
                setExpanded(false);
            }}
            onKeyDown={onKeyDown}
            placeholder="Plot tasks, folders, threads…"
            className="compose-bar-input"
            aria-label="Plot tasks"
          />
          <button
            type="button"
            onClick={() => void paste()}
            className="compose-bar-go mr-1 opacity-70"
            aria-label="Paste from clipboard"
            title="Paste"
          >
            <span className="text-[10px] font-semibold">⌘V</span>
          </button>
          <button
            type="button"
            onClick={() => void runPlot()}
            disabled={!canSubmit}
            className="compose-bar-go"
            aria-label="Plot"
          >
            {busy ? (
              <span className="compose-bar-spinner" />
            ) : (
              <ArrowRightIcon className="h-4 w-4" />
            )}
          </button>
        </div>
        {error && <p className="compose-bar-error">{error}</p>}
      </div>

      {phase === "confirm" && result && (
        <ParseConfirmSheet
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
