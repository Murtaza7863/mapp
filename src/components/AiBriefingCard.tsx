import { useEffect, useState } from "react";

import type { DailyBriefing } from "../lib/briefing";
import type { Item } from "../types";

import { fetchAiBriefing } from "../lib/ai-briefing";
import { checkWebGPU } from "../lib/brain-dump/llm-engine";
import { DailyBriefingCard } from "./DailyBriefingCard";
import { SparkIcon } from "./icons";

interface Props {
  items: Item[];
  briefing: DailyBriefing;
  onFocusNudge?: () => void;
  onFocusOverdue?: () => void;
  onFocusPrep?: () => void;
  onWrapUp?: () => void;
  showWrapUp?: boolean;
}

export function AiBriefingCard(props: Props) {
  const { items, briefing } = props;
  const [insight, setInsight] = useState<string | null>(null);
  const [source, setSource] = useState<"ai" | "rules" | "loading">("loading");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const ok = await checkWebGPU();
      if (cancelled) return;

      if (!ok) {
        setSource("rules");
        setInsight(null);
        return;
      }

      setSource("loading");
      const result = await fetchAiBriefing(items, briefing);
      if (cancelled) return;
      setInsight(result.insight);
      setSource(result.source);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [items, briefing]);

  const showAiLine =
    source === "ai" && insight
      ? insight
      : source === "loading"
        ? "Reading your day on-device…"
        : null;

  return (
    <div className="ai-briefing-wrap">
      {showAiLine && (
        <div
          className={`ai-insight ${source === "loading" ? "ai-insight-loading" : ""}`}
          aria-live="polite"
        >
          <SparkIcon className="text-block h-4 w-4 shrink-0" />
          <p className="text-primary text-sm leading-snug">{showAiLine}</p>
          {source === "ai" && <span className="ai-insight-tag">AI brief</span>}
        </div>
      )}
      <DailyBriefingCard {...props} />
    </div>
  );
}
