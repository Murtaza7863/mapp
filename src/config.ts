/** Central app configuration — single source for env and feature flags. */

export const APP_NAME = "mApp";
export const APP_TAGLINE = "A new way to stay organised.";
export const APP_DESCRIPTION =
  "Offline-first command center for areas, threads, routines, and natural-language Plot.";

const env = import.meta.env;

export const config = {
  app: {
    name: APP_NAME,
    tagline: APP_TAGLINE,
    description: APP_DESCRIPTION,
  },
  push: {
    apiUrl: (env.VITE_PUSH_API_URL as string | undefined)?.trim() ?? "",
    vapidPublicKey:
      (env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim() ?? "",
  },
  plot: {
    /** Best quality — ~800MB download, needs WebGPU + 4GB+ RAM */
    models: {
      primary: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
      fallback: "SmolLM2-1.7B-Instruct-q4f16_1-MLC",
      compact: "SmolLM2-360M-Instruct-q4f16_1-MLC",
    },
    modelCandidates: [
      "Llama-3.2-1B-Instruct-q4f16_1-MLC",
      "SmolLM2-1.7B-Instruct-q4f16_1-MLC",
      "SmolLM2-360M-Instruct-q4f16_1-MLC",
    ],
  },
} as const;

export function isPushConfigured(): boolean {
  return Boolean(config.push.apiUrl && config.push.vapidPublicKey);
}

export function isDev(): boolean {
  return env.DEV;
}

export function isProd(): boolean {
  return env.PROD;
}
