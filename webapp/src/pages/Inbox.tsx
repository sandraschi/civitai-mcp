import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import clsx from "clsx";
import { motion } from "framer-motion";
import { Bell, Inbox as InboxIcon } from "lucide-react";
import { Link } from "react-router-dom";
import MockBadge from "../components/MockBadge";
import { isOnboarded, MOCK_INBOX } from "../lib/mockOnboarding";

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 15_000 } },
});

type Notification = {
  id?: string;
  type?: string;
  account?: { display_name?: string; acct?: string };
  status?: { content?: string };
  created_at?: string;
  _mock?: boolean;
};

function Inner() {
  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: () => fetch("/api/health").then((r) => r.json()),
    refetchInterval: 15_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetch("/api/v1/notifications").then((r) => r.json()),
    refetchInterval: 30_000,
    enabled: isOnboarded(health),
  });

  const onboarded = isOnboarded(health);
  const live: Notification[] = data?.notifications ?? [];
  const notifications: Notification[] = onboarded ? live : MOCK_INBOX;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 max-w-3xl"
      data-testid="inbox-page"
    >
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-100">Inbox</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Civitai notifications — mentions, follows, boosts.
        </p>
      </div>

      {!onboarded && (
        <div
          className="mb-4 rounded-xl border-2 border-dashed border-rose-500/50 bg-rose-950/30 p-4"
          data-testid="mock-data-banner"
        >
          <div className="flex items-center gap-2 mb-2">
            <MockBadge />
            <span className="text-sm font-medium text-rose-200">
              Sample inbox — Joe Mocky &amp; Sandra Mockinger
            </span>
          </div>
          <p className="text-sm text-rose-100/80 mb-3">
            These messages are fake and disappear after you connect a Civitai
            instance + token.
          </p>
          <Link
            to="/settings"
            className="inline-flex items-center justify-center rounded-lg bg-red-600 hover:bg-red-500 px-4 py-2.5 text-sm font-bold text-white"
            data-testid="onboarding-cue"
          >
            Complete onboarding
          </Link>
        </div>
      )}

      {onboarded && isLoading && (
        <p className="text-sm text-zinc-500">Loading notifications…</p>
      )}

      {onboarded && !isLoading && notifications.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-10 text-center">
          <Bell size={36} className="mx-auto mb-3 text-zinc-700" />
          <p className="text-sm text-zinc-500">No notifications yet.</p>
        </div>
      )}

      <div className="space-y-3">
        {notifications.map((n, i) => (
          <div
            key={n.id ?? i}
            className={clsx(
              "bg-zinc-900 border rounded-lg p-4",
              n._mock ? "border-rose-500/40 border-dashed" : "border-zinc-800",
            )}
            data-testid={n._mock ? "mock-inbox-item" : "inbox-item"}
          >
            <div className="flex items-center gap-2 mb-2 text-sm">
              {n._mock && <MockBadge />}
              <InboxIcon size={14} className="text-violet-400" />
              <span className="text-violet-300">
                {n.type ?? "notification"}
              </span>
              <span className="text-zinc-500 ml-auto">
                {n.created_at?.slice(0, 19) ?? ""}
              </span>
            </div>
            {n.account && (
              <p className="text-sm text-zinc-400 mb-1">
                @{n.account.acct ?? n.account.display_name}
                {n.account.display_name && (
                  <span className="text-zinc-500">
                    {" "}
                    ({n.account.display_name})
                  </span>
                )}
              </p>
            )}
            {n.status?.content && (
              <p className="text-sm text-zinc-300 whitespace-pre-wrap">
                {String(n.status.content).replace(/<[^>]+>/g, "")}
              </p>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default function Inbox() {
  return (
    <QueryClientProvider client={qc}>
      <Inner />
    </QueryClientProvider>
  );
}
