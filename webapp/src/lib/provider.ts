export const LLM_PROVIDERS = [
  { name: "Ollama", port: 11434, probeUrl: "http://localhost:11434/api/tags" },
  {
    name: "LM Studio",
    port: 1234,
    probeUrl: "http://localhost:1234/v1/models",
  },
  { name: "vLLM", port: 8000, probeUrl: "http://localhost:8000/v1/models" },
];

export async function probeProviders(): Promise<
  Record<string, { detected: boolean; models?: string[] }>
> {
  const results: Record<string, { detected: boolean; models?: string[] }> = {};
  for (const p of LLM_PROVIDERS) {
    try {
      const r = await fetch(p.probeUrl, { signal: AbortSignal.timeout(2000) });
      if (r.ok) {
        const body = await r.json();
        const models =
          p.name === "Ollama"
            ? (body.models || []).map((m: { name?: string }) => m.name)
            : (body.data || []).map((m: { id?: string }) => m.id);
        results[p.name] = { detected: true, models };
      } else {
        results[p.name] = { detected: false };
      }
    } catch {
      results[p.name] = { detected: false };
    }
  }
  return results;
}

export async function detectFirstProvider(): Promise<{
  name: string;
  baseUrl: string;
  port: number;
} | null> {
  const results = await probeProviders();
  for (const p of LLM_PROVIDERS) {
    if (results[p.name]?.detected) {
      return {
        name: p.name,
        baseUrl: `http://localhost:${p.port}`,
        port: p.port,
      };
    }
  }
  return null;
}

export function portFromUrl(url: string | null): number {
  if (!url) return 11434;
  try {
    return parseInt(new URL(url).port, 10) || 11434;
  } catch {
    return 11434;
  }
}
