import { useEffect, useState } from "react";

import {
  checkWebGPU,
  getPlotEngineState,
  onPlotModelReady,
  type PlotEngineState,
} from "../lib/brain-dump/llm-engine";
import { SparkIcon } from "./icons";

export function OnDeviceAiBadge() {
  const [state, setState] = useState<PlotEngineState>("loading");

  useEffect(() => {
    const refresh = () => setState(getPlotEngineState());

    void checkWebGPU().then(() => refresh());
    const unsub = onPlotModelReady(refresh);
    const timer = window.setInterval(refresh, 1500);
    return () => {
      unsub();
      window.clearInterval(timer);
    };
  }, []);

  if (state === "unsupported") return null;

  const label = state === "ready" ? "On-device" : "Loading model…";

  return (
    <div
      className={`ai-badge ${state === "ready" ? "ai-badge-live" : "ai-badge-loading"}`}
      title="Runs locally in your browser"
    >
      <SparkIcon className="h-3.5 w-3.5 shrink-0" />
      <span>{label}</span>
    </div>
  );
}
