/** Central app configuration — single source for env and feature flags. */

export const APP_NAME = "Plotline";
export const APP_TAGLINE = "Plot your day in plain English.";
export const APP_DESCRIPTION =
  "Offline planner for areas, deadlines, and natural-language capture. Your data stays on your device.";

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
