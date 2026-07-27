import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CheckCircle, Cpu, Loader2, Save, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LLM_PROVIDERS, probeProviders } from "../lib/provider";
import { useLLMStore } from "../store/llm";

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

type AppSettings = {
  api_token_set: boolean;
  dry_run: boolean;
  require_download_approval: boolean;
  depot_dir: string;
  nsfw: boolean;
  comfyops_backend_url: string;
  comfyops_frontend_url: string;
};

function Inner() {
  const queryClient = useQueryClient();
  const setOllamaUrl = useLLMStore((s) => s.setOllamaUrl);
  const [token, setToken] = useState("");
  const [form, setForm] = useState<AppSettings | null>(null);

  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: () => fetch("/api/health").then((r) => r.json()),
    refetchInterval: 30_000,
  });

  const { data: settingsData } = useQuery({
    queryKey: ["app-settings"],
    queryFn: () =>
      fetch("/api/settings")
        .then((r) => r.json())
        .then((j) => j.settings as AppSettings),
  });

  useEffect(() => {
    if (settingsData) setForm(settingsData);
  }, [settingsData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form) return;
      const r = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          api_token: token.trim() || undefined,
        }),
      });
      if (!r.ok) throw new Error("Save failed");
      return r.json();
    },
    onSuccess: () => {
      setToken("");
      queryClient.invalidateQueries();
    },
  });

  const { data: providers, isLoading: probing } = useQuery({
    queryKey: ["llm-providers"],
    queryFn: async () => {
      const results = await probeProviders();
      const first = LLM_PROVIDERS.find((p) => results[p.name]?.detected);
      if (first) setOllamaUrl(`http://localhost:${first.port}`);
      return { providers: results };
    },
    refetchInterval: 60_000,
  });

  const activeProvider = LLM_PROVIDERS.find(
    (p) => providers?.providers?.[p.name]?.detected,
  );

  const providerStatus = (name: string) => {
    const p = providers?.providers?.[name];
    if (!providers || probing)
      return { icon: Loader2, color: "text-zinc-500", label: "Probing..." };
    if (p?.detected)
      return {
        icon: CheckCircle,
        color: "text-green-400",
        label: `Detected (port ${LLM_PROVIDERS.find((x) => x.name === name)!.port})`,
      };
    return { icon: XCircle, color: "text-zinc-600", label: "Not found" };
  };

  const envRows: [string, string][] = [
    ["Depot", form?.depot_dir || health?.depot || "—"],
    ["Backend port", String(health?.ports?.backend ?? 11124)],
    ["Frontend port", String(health?.ports?.frontend ?? 11125)],
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 max-w-2xl"
    >
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Settings</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Civitai token, depot, and ComfyOps cross-connect
          </p>
        </div>
        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={!form || saveMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 disabled:opacity-50"
        >
          {saveMutation.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          Save
        </button>
      </div>

      {form && !form.api_token_set && (
        <div className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-sm font-medium text-amber-200 mb-1">
            CIVITAI_API_TOKEN missing
          </p>
          <p className="text-sm text-amber-100/80">
            Search works anonymously; live downloads need a token from{" "}
            <a
              href="https://civitai.com/user/account"
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-300 underline"
            >
              civitai.com/user/account
            </a>
            .
          </p>
        </div>
      )}

      {saveMutation.isSuccess && (
        <p className="mb-4 text-sm text-green-400">
          Settings saved and reloaded.
        </p>
      )}

      <div className="space-y-3 mb-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 flex items-center gap-3">
          {health ? (
            <CheckCircle size={16} className="text-green-400 shrink-0" />
          ) : (
            <Loader2
              size={16}
              className="text-zinc-500 animate-spin shrink-0"
            />
          )}
          <div>
            <p className="text-sm text-zinc-200">Backend</p>
            <p className="text-sm text-zinc-500">
              {health ? `${health.server} v${health.version}` : "Checking..."}
            </p>
          </div>
          <span
            className={`ml-auto text-sm px-2 py-0.5 rounded ${
              health?.dry_run
                ? "bg-amber-500/10 text-amber-400"
                : "bg-emerald-500/10 text-emerald-400"
            }`}
          >
            {health?.dry_run ? "dry-run" : "live"}
          </span>
        </div>
      </div>

      {form && (
        <div className="mb-8 space-y-4 bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <h2 className="text-sm font-medium text-violet-300">
            Civitai & ComfyOps
          </h2>
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-500">CIVITAI_API_TOKEN</label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={
                form.api_token_set
                  ? "Leave blank to keep current"
                  : "Paste token"
              }
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-500">
              Shared depot (CIVITAI_DEPOT_DIR)
            </label>
            <input
              type="text"
              value={form.depot_dir}
              onChange={(e) => setForm({ ...form, depot_dir: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-500">
                COMFYOPS_BACKEND_URL
              </label>
              <input
                type="text"
                value={form.comfyops_backend_url}
                onChange={(e) =>
                  setForm({ ...form, comfyops_backend_url: e.target.value })
                }
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-zinc-500">
                COMFYOPS_FRONTEND_URL
              </label>
              <input
                type="text"
                value={form.comfyops_frontend_url}
                onChange={(e) =>
                  setForm({ ...form, comfyops_frontend_url: e.target.value })
                }
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.dry_run}
                onChange={(e) =>
                  setForm({ ...form, dry_run: e.target.checked })
                }
              />
              Dry-run downloads
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.require_download_approval}
                onChange={(e) =>
                  setForm({
                    ...form,
                    require_download_approval: e.target.checked,
                  })
                }
              />
              Require queue approval
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.nsfw}
                onChange={(e) => setForm({ ...form, nsfw: e.target.checked })}
              />
              NSFW in search
            </label>
          </div>
          <p className="text-xs text-zinc-600">
            Depot should match{" "}
            <span className="font-mono">COMFYOPS_MODELS_DIR</span> in
            comfyops-mcp. See{" "}
            <Link to="/comfyops" className="text-violet-400">
              ComfyOps bridge
            </Link>
            .
          </p>
        </div>
      )}

      <div className="mb-8">
        <h2
          className="text-sm font-medium text-zinc-300 mb-3"
          data-testid="llm-providers-heading"
        >
          LLM Providers
        </h2>
        <div className="space-y-2">
          {LLM_PROVIDERS.map((p) => {
            const status = providerStatus(p.name);
            const Icon = status.icon;
            const models = providers?.providers?.[p.name]?.models;
            return (
              <div
                key={p.name}
                className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <Icon size={16} className={`${status.color} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200">{p.name}</p>
                    <p className="text-sm text-zinc-500">{status.label}</p>
                  </div>
                  {models && models.length > 0 && (
                    <span className="text-xs text-zinc-500 shrink-0">
                      {models.length} models
                    </span>
                  )}
                </div>
                {activeProvider?.name === p.name &&
                  models &&
                  models.length > 0 && (
                    <select
                      data-testid="llm-model-select"
                      className="mt-2 w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 font-mono"
                      defaultValue={models[0]}
                    >
                      {models.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  )}
              </div>
            );
          })}
        </div>

        {!activeProvider && providers && (
          <div className="mt-3 bg-amber-900/10 border border-amber-800/30 rounded-lg px-4 py-3 flex items-center gap-2">
            <Cpu size={16} className="text-amber-400 shrink-0" />
            <p className="text-sm text-amber-300">
              No local LLM detected. Install{" "}
              <a
                href="https://ollama.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-amber-200"
              >
                Ollama
              </a>{" "}
              or{" "}
              <a
                href="https://lmstudio.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-amber-200"
              >
                LM Studio
              </a>{" "}
              for Chat and Compose assist.
            </p>
          </div>
        )}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <h2 className="text-sm font-medium text-zinc-300 mb-3">Runtime</h2>
        <div className="space-y-2 text-sm font-mono">
          {envRows.map(([key, val]) => (
            <div key={key} className="flex gap-2">
              <span className="text-zinc-500 w-48 shrink-0">{key}</span>
              <span className="text-zinc-400 truncate">{val}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export default function SettingsPage() {
  return (
    <QueryClientProvider client={qc}>
      <Inner />
    </QueryClientProvider>
  );
}
