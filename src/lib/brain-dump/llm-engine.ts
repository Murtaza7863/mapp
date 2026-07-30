import type { InitProgressCallback, MLCEngine } from "@mlc-ai/web-llm";

import { config } from "../../config";
import type { Category, Item } from "../../types";

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

let modelReadyListeners = new Set<() => void>();

function notifyModelReady(): void {
  for (const listener of modelReadyListeners) listener();
}

export function onPlotModelReady(listener: () => void): () => void {
  modelReadyListeners.add(listener);
  return () => modelReadyListeners.delete(listener);
}

/** Human-readable model name for UI badges. */
export function friendlyModelLabel(modelId: string | null): string {
  if (!modelId) return "On-device AI";
  if (modelId.includes("Llama-3.2")) return "Llama 3.2";
  if (modelId.includes("SmolLM2-1.7B")) return "SmolLM2 1.7B";
  if (modelId.includes("SmolLM2-360M")) return "SmolLM2";
  return "Local LLM";
}

export type PlotEngineState = "unsupported" | "loading" | "ready";

export function getPlotEngineState(): PlotEngineState {
  if (webgpuCache === false) return "unsupported";
  if (loadedModelId) return "ready";
  if (enginePromise) return "loading";
  return webgpuCache === true ? "loading" : "unsupported";
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
        notifyModelReady();
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
  pendingItems?: Item[];
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
    new Date(),
    request.pendingItems ?? [],
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

export interface AiInsightRequest {
  briefing: {
    overdue: number;
    dueToday: number;
    needsNudge: number;
    urgentPrep: number;
  };
  topTasks: string[];
}

const BRIEFING_SYSTEM = `You are a concise planner on a user's phone. Write ONE short sentence (max 35 words) of specific, actionable advice based on their task stats. Focus on what to tackle next. Do not suggest scheduling time blocks or calendar slots. No greetings, no bullet points, no markdown.`;

export async function generateAiInsight(
  request: AiInsightRequest,
): Promise<string> {
  const engine = await loadPlotEngine();
  const { briefing, topTasks } = request;
  const user = `Stats: ${briefing.dueToday} due today, ${briefing.overdue} overdue, ${briefing.needsNudge} follow-ups to nudge, ${briefing.urgentPrep} event prep deadlines.
Top tasks: ${topTasks.length > 0 ? topTasks.join("; ") : "none"}.
One sentence of advice:`;

  const response = await engine.chat.completions.create({
    messages: [
      { role: "system", content: BRIEFING_SYSTEM },
      { role: "user", content: user },
    ],
    temperature: 0.35,
    max_tokens: 80,
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty AI briefing");
  return content.replace(/^["']|["']$/g, "");
}

export function getLoadedPlotModelId(): string | null {
  return loadedModelId;
}
