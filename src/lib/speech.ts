interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultLike[];
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export interface SpeechListenOptions {
  onPartial?: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (message: string) => void;
}

/** One-shot voice capture — appends to existing Plot text. */
export function listenForSpeech(options: SpeechListenOptions): () => void {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    options.onError?.("Voice input is not supported in this browser.");
    return () => {};
  }

  const recognition = new Ctor();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  let finalText = "";

  recognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const chunk = event.results[i]?.[0]?.transcript ?? "";
      if (event.results[i]?.isFinal) {
        finalText += chunk;
      } else {
        interim += chunk;
      }
    }
    if (interim) options.onPartial?.(finalText + interim);
    if (finalText) options.onPartial?.(finalText);
  };

  recognition.onerror = () => {
    options.onError?.("Could not hear that — try again.");
  };

  recognition.onend = () => {
    if (finalText.trim()) {
      options.onFinal(finalText.trim());
    }
  };

  recognition.start();
  return () => {
    try {
      recognition.stop();
    } catch {
      /* ignore */
    }
  };
}
