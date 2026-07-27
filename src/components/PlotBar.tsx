import { useEffect, useRef, useState } from "react";

import type { ParseDumpResult } from "../lib/brain-dump/types";
import type { Category } from "../types";

import {
  checkWebGPU,
  friendlyModelLabel,
  getLoadedPlotModelId,
  warmupPlotEngine,
} from "../lib/brain-dump/llm-engine";
import {
  parseRulesDump,
  refineDumpWithLlm,
  shouldUseLlm,
} from "../lib/brain-dump/parse-dump";
import { readClipboardText } from "../lib/clipboard";
import { isSpeechRecognitionSupported, listenForSpeech } from "../lib/speech";
import { MicIcon } from "./icons";
import { OnDeviceAiBadge } from "./OnDeviceAiBadge";
import { ParseConfirmSheet } from "./ParseConfirmSheet";
import { PlotDemoChips } from "./PlotDemoChips";
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
  const [listening, setListening] = useState(false);
  const [modelLabel, setModelLabel] = useState<string | null>(null);
  const userEditedRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stopListenRef = useRef<(() => void) | null>(null);
  const voiceBaseRef = useRef("");

  const speechSupported = isSpeechRecognitionSupported();

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

  useEffect(() => {
    return () => stopListenRef.current?.();
  }, []);

  const paste = async () => {
    const text = await readClipboardText();
    if (!text) return;
    setValue(text);
    setExpanded(true);
    inputRef.current?.focus();
  };

  const toggleVoice = () => {
    if (listening) {
      stopListenRef.current?.();
      stopListenRef.current = null;
      setListening(false);
      return;
    }

    voiceBaseRef.current = value.trim() ? `${value.trim()} ` : "";
    setListening(true);
    setError(null);
    setExpanded(true);

    stopListenRef.current = listenForSpeech({
      onPartial: (text) => setValue(voiceBaseRef.current + text),
      onFinal: (text) => {
        setValue(voiceBaseRef.current + text);
        setListening(false);
        stopListenRef.current = null;
        inputRef.current?.focus();
      },
      onError: (msg) => {
        setError(msg);
        setListening(false);
        stopListenRef.current = null;
      },
    });
  };

  const barBusy = phase === "loading";
  const canSubmit =
    value.trim().length > 0 && !barBusy && !saving && !listening;

  useEffect(() => {
    if (!barBusy) {
      setShowSpinner(false);
      return;
    }
    const timer = window.setTimeout(() => setShowSpinner(true), 200);
    return () => window.clearTimeout(timer);
  }, [barBusy]);

  const runPlot = async (textOverride?: string) => {
    const trimmed = (textOverride ?? value).trim();
    if (!trimmed || barBusy || saving) return;

    setError(null);
    setStatusText(null);
    userEditedRef.current = false;

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

      setModelLabel(friendlyModelLabel(getLoadedPlotModelId()));

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

  const tryDemo = (text: string) => {
    setValue(text);
    setExpanded(true);
    void runPlot(text);
  };

  return (
    <>
      <section className="capture-hero" aria-label="Add to calendar">
        <div className="capture-hero-header">
          <OnDeviceAiBadge />
        </div>

        <PlotDemoChips
          onSelect={tryDemo}
          disabled={barBusy || saving || listening}
        />

        <div className="compose-bar-wrap">
          <div
            className={`compose-bar ${expanded ? "compose-bar-expanded" : ""} ${barBusy ? "compose-bar-busy" : ""} ${listening ? "compose-bar-listening" : ""}`}
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
              placeholder={
                listening
                  ? "Listening…"
                  : "Dentist Tuesday 3pm, email Jake Friday…"
              }
              className="compose-bar-input"
              aria-label="Type a plan to add to calendar"
              disabled={barBusy || saving}
            />
            <div className="compose-bar-actions">
              {speechSupported && (
                <button
                  type="button"
                  onClick={toggleVoice}
                  className={`compose-bar-secondary compose-bar-mic ${listening ? "compose-bar-mic-active" : ""}`}
                  aria-label={listening ? "Stop listening" : "Voice input"}
                  disabled={barBusy || saving}
                >
                  <MicIcon className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => void paste()}
                className="compose-bar-secondary"
                aria-label="Paste from clipboard"
                disabled={barBusy || saving || listening}
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
          {listening && (
            <p className="compose-bar-status compose-bar-listening-label">
              Voice → Plot · on-device
            </p>
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
          modelLabel={modelLabel}
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
