import { useEffect, useState } from "react";

import {
  checkWebGPU,
  friendlyModelLabel,
  getLoadedPlotModelId,
  getPlotEngineState,
  onPlotModelReady,
  type PlotEngineState,
} from "../lib/brain-dump/llm-engine";
import { CpuIcon, SparkIcon } from "./icons";

export function OnDeviceAiBadge() {
  const [state, setState] = useState<PlotEngineState>("loading");
  const [modelId, setModelId] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => {
      setModelId(getLoadedPlotModelId());
      setState(getPlotEngineState());
    };

    void checkWebGPU().then(() => refresh());
    const unsub = onPlotModelReady(refresh);
    const timer = window.setInterval(refresh, 1500);
    return () => {
      unsub();
      window.clearInterval(timer);
    };
  }, []);

  if (state === "unsupported") {
    return (
      <div className="ai-badge ai-badge-muted" title="Rules parser still works">
        <CpuIcon className="h-3.5 w-3.5 shrink-0" />
        <span>Smart parse · rules only</span>
      </div>
    );
  }

  const label =
    state === "ready"
      ? `${friendlyModelLabel(modelId)} · on-device`
      : "Loading on-device AI…";

  return (
    <div
      className={`ai-badge ${state === "ready" ? "ai-badge-live" : "ai-badge-loading"}`}
      title="Runs locally in your browser — nothing leaves your device"
    >
      <SparkIcon className="h-3.5 w-3.5 shrink-0" />
      <span>{label}</span>
      {state === "ready" && (
        <span className="ai-badge-pill" aria-hidden>
          Private
        </span>
      )}
    </div>
  );
}
