import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import clsx from "clsx";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  CheckCircle,
  Inbox,
  Send,
  Shield,
  XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import MockBadge from "../components/MockBadge";
import {
  isOnboarded,
  MOCK_KPIS,
  MOCK_OUTBOX_RECENT,
} from "../lib/mockOnboarding";

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 10_000 } },
});

type OutboxItem = {
  id: number;
  status: string;
  repo_id: string;
  status_text: string;
  _mock?: boolean;
};

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  mock,
  ...rest
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  mock?: boolean;
  [key: string]: unknown;
}) {
  return (
    <div
      className={clsx(
        "bg-zinc-900 border rounded-lg p-4 relative",
        mock ? "border-rose-500/40 border-dashed" : "border-zinc-800",
      )}
      {...rest}
    >
      {mock && (
        <div className="absolute top-2 right-2">
          <MockBadge />
        </div>
      )}
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className={color} />
        <span className="text-sm text-zinc-400">{label}</span>
      </div>
      <div className="text-2xl font-bold text-zinc-100">{value}</div>
    </div>
  );
}

function Inner({ backendOk }: { backendOk: boolean | null }) {
  const { data: dash } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fetch("/api/dashboard").then((r) => r.json()),
    refetchInterval: 15_000,
  });

  const dryRun = dash?.dry_run ?? true;
  const onboarded = isOnboarded(dash);
  const kpis = onboarded
    ? {
        pending: dash?.pending ?? 0,
        approved: dash?.approved ?? 0,
        published: dash?.published ?? 0,
        rejected: dash?.rejected ?? 0,
        total: dash?.local_models ?? dash?.total ?? 0,
      }
    : MOCK_KPIS;

  const recent: OutboxItem[] = onboarded
    ? ((dash?.recent as OutboxItem[]) ?? [])
    : MOCK_OUTBOX_RECENT;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 max-w-5xl"
      data-testid="dashboard"
    >
      {/* HERO */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-violet-950/50 via-zinc-900 to-zinc-950 p-6 sm:p-8 mb-4">
        <div className="absolute top-0 right-0 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl" aria-hidden>
                🎨
              </span>
              <span className="text-sm font-medium text-violet-400 tracking-wide">
                civitai-mcp
              </span>
            </div>
            <h1 className="text-2xl font-bold text-zinc-100 mb-1">
              Civitai catalog → comfyops depot
            </h1>
            <p className="text-sm text-zinc-400 max-w-xl">
              Search checkpoints and LoRAs on Civitai, queue downloads with
              human approve, pin weights into ComfyUI / comfyops models folders.
              Graph execution stays in comfyops-mcp.
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span
                className={clsx(
                  "text-xs px-2 py-0.5 rounded font-medium",
                  dryRun
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-emerald-500/20 text-emerald-400",
                )}
                data-testid="dry-run-badge"
              >
                {dryRun ? "DRY RUN" : "LIVE DOWNLOADS"}
              </span>
              <span className="text-xs text-zinc-500">
                {onboarded ? "API token set" : "No Civitai API token yet"}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <Link
              to="/search"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
              data-testid="hero-cta-search"
            >
              Search models <ArrowRight size={16} />
            </Link>
            <Link
              to="/depot"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-zinc-700 hover:border-zinc-500 text-zinc-200 text-sm font-medium transition-colors"
              data-testid="hero-cta-depot"
            >
              Open Depot
            </Link>
          </div>
        </div>
      </div>

      {!onboarded && (
        <Link
          to="/settings"
          className="mb-8 flex w-full items-center justify-center gap-3 rounded-xl bg-red-600 px-6 py-4 text-lg font-bold text-white shadow-lg shadow-red-900/40 hover:bg-red-500 transition-colors border-2 border-red-400/50"
          data-testid="onboarding-cue"
        >
          Complete onboarding — connect Civitai
          <ArrowRight size={22} />
        </Link>
      )}

      {!onboarded && (
        <p
          className="text-sm text-rose-300/90 mb-3 flex items-center gap-2"
          data-testid="mock-data-banner"
        >
          <MockBadge /> Sample KPIs and lists below — cleared after you set
          instance + token.
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-8">
        <StatCard
          data-testid="kpi-pending"
          label="Queue"
          value={String(kpis.pending)}
          icon={Inbox}
          color="text-amber-400"
          mock={!onboarded}
        />
        <StatCard
          data-testid="kpi-approved"
          label="Approved"
          value={String(kpis.approved)}
          icon={CheckCircle}
          color="text-emerald-400"
          mock={!onboarded}
        />
        <StatCard
          data-testid="kpi-published"
          label="Downloaded"
          value={String(kpis.published)}
          icon={Send}
          color="text-violet-400"
          mock={!onboarded}
        />
        <StatCard
          data-testid="kpi-rejected"
          label="Rejected"
          value={String(kpis.rejected)}
          icon={XCircle}
          color="text-red-400"
          mock={!onboarded}
        />
        <StatCard
          data-testid="kpi-total"
          label="In depot"
          value={String(kpis.total)}
          icon={Archive}
          color="text-zinc-400"
          mock={!onboarded}
        />
        <StatCard
          data-testid="kpi-backend"
          label="Backend"
          value={backendOk === null ? "..." : backendOk ? "Online" : "Offline"}
          icon={backendOk ? Shield : AlertTriangle}
          color={backendOk ? "text-green-400" : "text-red-400"}
        />
      </div>

      {recent.length > 0 ? (
        <div>
          <h2 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
            Recent download queue
            {!onboarded && <MockBadge />}
          </h2>
          <div className="space-y-2">
            {recent.slice(0, 6).map((it) => (
              <div
                key={it.id}
                className={clsx(
                  "bg-zinc-900 border rounded-lg px-4 py-3",
                  it._mock
                    ? "border-rose-500/40 border-dashed"
                    : "border-zinc-800",
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  {it._mock && <MockBadge />}
                  <span className="text-xs font-mono text-zinc-500">
                    #{it.id}
                  </span>
                  <span className="text-xs text-zinc-400">{it.repo_id}</span>
                  <span
                    className={clsx(
                      "text-xs px-2 py-0.5 rounded ml-auto",
                      it.status === "pending" &&
                        "bg-amber-500/20 text-amber-400",
                      it.status === "approved" &&
                        "bg-emerald-500/20 text-emerald-400",
                      it.status === "published" &&
                        "bg-violet-500/20 text-violet-400",
                      it.status === "rejected" && "bg-red-500/20 text-red-400",
                    )}
                  >
                    {it.status}
                  </span>
                </div>
                <p className="text-sm text-zinc-300 line-clamp-2">
                  {it.status_text}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center">
          <Inbox size={32} className="mx-auto mb-3 text-zinc-700" />
          <p className="text-sm text-zinc-500">
            Queue empty — discover models on Search, then approve downloads.
          </p>
        </div>
      )}
    </motion.div>
  );
}

export default function Dashboard({
  backendOk,
}: {
  backendOk: boolean | null;
}) {
  return (
    <QueryClientProvider client={qc}>
      <Inner backendOk={backendOk} />
    </QueryClientProvider>
  );
}
