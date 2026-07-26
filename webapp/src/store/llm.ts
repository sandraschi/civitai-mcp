import { create } from "zustand";

interface LLMState {
  ollamaUrl: string | null;
  checking: boolean;
  setOllamaUrl: (url: string | null) => void;
  setChecking: (v: boolean) => void;
}

export const useLLMStore = create<LLMState>((set) => ({
  ollamaUrl: null,
  checking: true,
  setOllamaUrl: (url) => set({ ollamaUrl: url, checking: false }),
  setChecking: (v) => set({ checking: v }),
}));
