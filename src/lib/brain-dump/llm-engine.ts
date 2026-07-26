import type { InitProgressCallback, MLCEngine } from "@mlc-ai/web-llm";

/** Small instruct model — ~200MB, runs on more devices than 1B+ variants. */
export const PLOT_MODEL_ID = "SmolLM2-360M-Instruct-q4f16_1-MLC";

type WebLLMModule = typeof import("@mlc-ai/web-llm");

let webLlmModule: WebLLMModule | null = null;
let enginePromise: Promise<MLCEngine> | null = null;
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

export async function loadPlotEngine(
  onProgress?: InitProgressCallback,
): Promise<MLCEngine> {
  const ok = await checkWebGPU();
  if (!ok) {
    throw new Error("On-device AI is not available on this device.");
  }

  latestProgress = onProgress;

  if (!enginePromise) {
    enginePromise = loadWebLLM()
      .then(({ CreateMLCEngine }) =>
        CreateMLCEngine(PLOT_MODEL_ID, {
          initProgressCallback: (report) => {
            latestProgress?.(report);
          },
        }),
      )
      .catch((err) => {
        enginePromise = null;
        throw err;
      });
  }

  return enginePromise;
}

export async function generateWithPlotModel(
  prompt: string,
  onProgress?: InitProgressCallback,
): Promise<string> {
  const engine = await loadPlotEngine(onProgress);

  const response = await engine.chat.completions.create({
    messages: [
      {
        role: "system",
        content: "Extract tasks as JSON only. No markdown.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.05,
    max_tokens: 280,
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
