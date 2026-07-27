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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const ok = await checkWebGPU();
      if (cancelled || !ok) return;

      setLoading(true);
      const result = await fetchAiBriefing(items, briefing);
      if (cancelled) return;
      setLoading(false);
      if (result.source === "ai") setInsight(result.insight);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [items, briefing]);

  const showInsight = loading || insight;

  return (
    <div className="briefing-wrap">
      {showInsight && (
        <div
          className={`ai-insight ${loading ? "ai-insight-loading" : ""}`}
          aria-live="polite"
        >
          <SparkIcon className="text-block h-4 w-4 shrink-0" />
          <p className="text-primary text-sm leading-snug">
            {loading ? "Reading your day…" : insight}
          </p>
        </div>
      )}
      <DailyBriefingCard {...props} />
    </div>
  );
}
