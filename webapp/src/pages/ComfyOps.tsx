import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import clsx from "clsx";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle,
  ExternalLink,
  Layers,
  RefreshCw,
  Workflow,
  XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15_000 } },
});

type Bridge = {
  depot_dir?: string;
  depot_exists?: boolean;
  local_model_count?: number;
  comfyops?: {
    reachable?: boolean;
    backend_url?: string;
    frontend_url?: string;
    error?: string;
    comfyui_online?: boolean;
    tool_count?: number;
  };
  agent_flow?: Array<{
    step: number;
    where: string;
    action: string;
    mcp: string;
  }>;
  recent_published?: Array<{
    id: number;
    status_text?: string;
    status?: string;
  }>;
};

function Inner() {
  const { data, isFetching, refetch, isLoading } = useQuery({
    queryKey: ["comfyops-bridge"],
    queryFn: () =>
      fetch("/api/comfyops/bridge").then((r) => r.json()) as Promise<Bridge>,
    refetchInterval: 20_000,
  });

  const co = data?.comfyops;
  const dashboardUrl = co?.frontend_url || "http://127.0.0.1:11088";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 max-w-4xl space-y-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Workflow className="text-violet-400" size={22} />
            ComfyOps bridge
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Pin weights here → generate in comfyops-mcp (shared models depot)
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border border-zinc-700 hover:bg-zinc-800 disabled:opacity-50"
        >
          <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">
            comfyops-mcp
          </p>
          <div className="flex items-center gap-2 mb-2">
            {co?.reachable ? (
              <CheckCircle size={18} className="text-green-400" />
            ) : (
              <XCircle size={18} className="text-red-400" />
            )}
            <span className="font-medium">
              {co?.reachable ? "Backend online" : "Backend unreachable"}
            </span>
          </div>
          <p className="text-xs text-zinc-500 font-mono break-all">
            {co?.backend_url}
          </p>
          {co?.error && <p className="text-xs text-red-400 mt-2">{co.error}</p>}
          <div className="flex flex-wrap gap-2 mt-3 text-xs">
            <span
              className={clsx(
                "px-2 py-0.5 rounded-full",
                co?.comfyui_online
                  ? "bg-green-500/15 text-green-400"
                  : "bg-zinc-800 text-zinc-500",
              )}
            >
              ComfyUI {co?.comfyui_online ? "up" : "down"}
            </span>
            {co?.tool_count != null && (
              <span className="px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300">
                {co.tool_count} MCP tools
              </span>
            )}
          </div>
          <a
            href={dashboardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-4 text-sm text-violet-400 hover:text-violet-300"
          >
            Open ComfyOps dashboard
            <ExternalLink size={14} />
          </a>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">
            Shared depot
          </p>
          <div className="flex items-center gap-2 mb-2">
            <Layers size={18} className="text-violet-400" />
            <span className="font-medium">
              {data?.local_model_count ?? 0} local weights
            </span>
          </div>
          <p className="text-xs text-zinc-500 font-mono break-all">
            {data?.depot_dir}
          </p>
          {!data?.depot_exists && (
            <p className="text-xs text-amber-400 mt-2">
              Depot path missing — set in Settings
            </p>
          )}
          <Link
            to="/depot"
            className="inline-flex items-center gap-1.5 mt-4 text-sm text-violet-400 hover:text-violet-300"
          >
            Browse depot
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-zinc-200 mb-3">
          Agentic handoff
        </h2>
        <ol className="space-y-3">
          {(data?.agent_flow ?? []).map((step) => (
            <li key={step.step} className="flex gap-3 text-sm">
              <span className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-300 flex items-center justify-center text-xs shrink-0">
                {step.step}
              </span>
              <div>
                <p className="text-zinc-200">
                  <span className="text-violet-400">{step.where}</span> —{" "}
                  {step.action}
                </p>
                <p className="text-xs text-zinc-500 font-mono mt-0.5">
                  {step.mcp}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-zinc-200">
            Recently pinned
          </h2>
          <Link
            to="/queue"
            className="text-xs text-violet-400 hover:text-violet-300"
          >
            Queue →
          </Link>
        </div>
        {isLoading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : (data?.recent_published?.length ?? 0) > 0 ? (
          <ul className="space-y-2">
            {data!.recent_published!.map((row) => (
              <li
                key={row.id}
                className="text-sm text-zinc-400 border border-zinc-800 rounded-lg px-3 py-2"
              >
                {row.status_text || `outbox #${row.id}`}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">
            No published pins yet.{" "}
            <Link to="/search" className="text-violet-400">
              Search Civitai
            </Link>{" "}
            and enqueue a download.
          </p>
        )}
      </section>
    </motion.div>
  );
}

export default function ComfyOpsPage() {
  return (
    <QueryClientProvider client={qc}>
      <Inner />
    </QueryClientProvider>
  );
}
