import type { InitProgressCallback, MLCEngine } from "@mlc-ai/web-llm";

import { config } from "../../config";
import type { Category } from "../../types";

import { buildPlotLlmPrompt, estimatePlotMaxTokens } from "./llm-prompt";
import { PLOT_OUTPUT_SCHEMA, PLOT_SYSTEM_PROMPT } from "./llm-schema";
import type { ProposedItem } from "./types";

type WebLLMModule = typeof import("@mlc-ai/web-llm");

let webLlmModule: WebLLMModule | null = null;
let enginePromise: Promise<MLCEngine> | null = null;
let loadedModelId: string | null = null;
let latestProgress: InitProgressCallback | undefined;
let webgpuCache: boolean | null = null;

async function loadWebLLM(): Promise<WebLLMModule> {
  if (!webLlmModule) {
    webLlmModule = await import("@mlc-ai/web-llm");
  }
  return webLlmModule;
}

/** Sync hint for UI — real check is async via checkWebGPU(). */
export function isWebGPUSupported(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

export async function checkWebGPU(): Promise<boolean> {
  if (webgpuCache !== null) return webgpuCache;
  if (!isWebGPUSupported()) {
    webgpuCache = false;
    return false;
  }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    webgpuCache = adapter !== null;
    return webgpuCache;
  } catch {
    webgpuCache = false;
    return false;
  }
}

/** Pick the best on-device model this hardware can handle. */
export function pickPlotModelId(): string {
  const memory =
    typeof navigator !== "undefined"
      ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory
      : undefined;

  if (memory !== undefined) {
    if (memory >= 6) return config.plot.models.primary;
    if (memory >= 4) return config.plot.models.fallback;
    return config.plot.models.compact;
  }

  return config.plot.models.primary;
}

export function getLoadedPlotModelId(): string | null {
  return loadedModelId;
}

async function createEngine(
  modelId: string,
  onProgress?: InitProgressCallback,
): Promise<MLCEngine> {
  const { CreateMLCEngine } = await loadWebLLM();
  return CreateMLCEngine(modelId, {
    initProgressCallback: (report) => {
      latestProgress?.(report);
      onProgress?.(report);
    },
  });
}

export async function loadPlotEngine(
  onProgress?: InitProgressCallback,
): Promise<MLCEngine> {
  const ok = await checkWebGPU();
  if (!ok) {
    throw new Error("On-device AI is not available on this device.");
  }

  latestProgress = onProgress;
  const preferred = pickPlotModelId();
  const candidates = [
    preferred,
    ...config.plot.modelCandidates.filter((id) => id !== preferred),
  ];

  if (enginePromise && loadedModelId && candidates[0] === loadedModelId) {
    return enginePromise;
  }

  enginePromise = (async () => {
    let lastError: unknown;
    for (const modelId of candidates) {
      try {
        const engine = await createEngine(modelId, onProgress);
        loadedModelId = modelId;
        return engine;
      } catch (err) {
        lastError = err;
        console.warn(`Plot model ${modelId} failed to load`, err);
      }
    }
    enginePromise = null;
    loadedModelId = null;
    throw lastError instanceof Error
      ? lastError
      : new Error("Could not load any on-device Plot model.");
  })();

  return enginePromise;
}

export interface PlotLlmRequest {
  dump: string;
  categories: Category[];
  rulesPreview?: ProposedItem[];
  onProgress?: InitProgressCallback;
}

export async function generatePlotParse(
  request: PlotLlmRequest,
): Promise<string> {
  const engine = await loadPlotEngine(request.onProgress);
  const prompt = buildPlotLlmPrompt(
    request.dump,
    request.categories,
    request.rulesPreview ?? [],
  );

  const response = await engine.chat.completions.create({
    messages: [
      { role: "system", content: PLOT_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    temperature: 0.1,
    max_tokens: estimatePlotMaxTokens(request.dump),
    response_format: {
      type: "json_object",
      schema: PLOT_OUTPUT_SCHEMA,
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content?.trim()) {
    throw new Error("Model returned an empty response.");
  }

  return content;
}

/** @deprecated Use generatePlotParse */
export async function generateWithPlotModel(
  prompt: string,
  onProgress?: InitProgressCallback,
): Promise<string> {
  const engine = await loadPlotEngine(onProgress);
  const response = await engine.chat.completions.create({
    messages: [
      { role: "system", content: PLOT_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    temperature: 0.1,
    max_tokens: 320,
    response_format: {
      type: "json_object",
      schema: PLOT_OUTPUT_SCHEMA,
    },
  });
  const content = response.choices[0]?.message?.content;
  if (!content?.trim()) {
    throw new Error("Model returned an empty response.");
  }
  return content;
}

/** Pre-load model in the background so the first plot feels faster. */
export function warmupPlotEngine(): void {
  void checkWebGPU().then((ok) => {
    if (ok) void loadPlotEngine();
  });
}
