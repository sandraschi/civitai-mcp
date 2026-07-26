import clsx from "clsx";
import { Check, Send, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import MockBadge from "../components/MockBadge";
import { isOnboarded, MOCK_OUTBOX_RECENT } from "../lib/mockOnboarding";

type Item = {
  id: number;
  status: string;
  repo_id: string;
  campaign?: string;
  status_text: string;
  _mock?: boolean;
};

export default function OutboxPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [msg, setMsg] = useState("");
  const [onboarded, setOnboarded] = useState(true);

  const load = () =>
    fetch("/api/v1/outbox")
      .then((r) => r.json())
      .then((d) => setItems(d.items || []));

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((h) => setOnboarded(isOnboarded(h)));
    const t = setInterval(() => {
      fetch("/api/health")
        .then((r) => r.json())
        .then((h) => setOnboarded(isOnboarded(h)));
    }, 15_000);
    return () => clearInterval(t);
  }, []);

  const act = async (id: number, path: string) => {
    if (id < 0) return;
    const r = await fetch(`/api/v1/outbox/${id}/${path}`, { method: "POST" });
    const j = await r.json();
    setMsg(j.message || j.error || JSON.stringify(j));
    load();
  };

  const display: Item[] =
    !onboarded && items.length === 0 ? MOCK_OUTBOX_RECENT : items;

  return (
    <div className="p-6 max-w-3xl" data-testid="outbox-page">
      <h1 className="text-xl font-semibold mb-1">Outbox</h1>
      <p className="text-sm text-zinc-500 mb-4">
        Fleet-PR drafts land here. Approve, then publish (dry-run until
        CIVITAI_DRY_RUN=0).
      </p>

      {!onboarded && items.length === 0 && (
        <div
          className="mb-4 rounded-xl border-2 border-dashed border-rose-500/50 bg-rose-950/30 p-4"
          data-testid="mock-data-banner"
        >
          <div className="flex items-center gap-2 mb-2">
            <MockBadge />
            <span className="text-sm font-medium text-rose-200">
              Sample outbox drafts
            </span>
          </div>
          <p className="text-sm text-rose-100/80 mb-3">
            Fake rows for layout only — actions disabled. Cleared after
            onboarding (or when real drafts arrive).
          </p>
          <Link
            to="/settings"
            className="inline-flex rounded-lg bg-red-600 hover:bg-red-500 px-4 py-2.5 text-sm font-bold text-white"
            data-testid="onboarding-cue"
          >
            Complete onboarding
          </Link>
        </div>
      )}

      {msg && <p className="text-sm text-violet-300 mb-3">{msg}</p>}
      <div className="space-y-3">
        {display.map((it) => (
          <div
            key={it.id}
            className={clsx(
              "bg-zinc-900 border rounded-lg p-4",
              it._mock ? "border-rose-500/40 border-dashed" : "border-zinc-800",
            )}
          >
            <div className="flex justify-between text-sm mb-2">
              <span className="flex items-center gap-2">
                {it._mock && <MockBadge />}#{it.id}{" "}
                <span className="text-zinc-400">{it.repo_id}</span> ·{" "}
                {it.status}
              </span>
              <span className="text-zinc-600">{it.campaign}</span>
            </div>
            <pre className="text-sm whitespace-pre-wrap text-zinc-300 mb-3">
              {it.status_text}
            </pre>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => act(it.id, "approve")}
                disabled={
                  Boolean(it._mock) ||
                  it.status === "approved" ||
                  it.status === "published"
                }
                className="flex items-center gap-1 px-2.5 py-1.5 text-sm rounded bg-emerald-700/80 disabled:opacity-40"
              >
                <Check size={14} /> Approve
              </button>
              <button
                type="button"
                onClick={() => act(it.id, "publish")}
                disabled={Boolean(it._mock) || it.status !== "approved"}
                className="flex items-center gap-1 px-2.5 py-1.5 text-sm rounded border border-violet-500/40 text-violet-300 disabled:opacity-40"
              >
                <Send size={14} /> Publish
              </button>
              <button
                type="button"
                onClick={() => act(it.id, "reject")}
                disabled={Boolean(it._mock) || it.status === "published"}
                className="flex items-center gap-1 px-2.5 py-1.5 text-sm rounded border border-zinc-700 text-zinc-400 disabled:opacity-40"
              >
                <X size={14} /> Reject
              </button>
            </div>
          </div>
        ))}
      </div>
      {onboarded && items.length === 0 && (
        <p className="text-sm text-zinc-500 mt-6 text-center">
          Outbox empty — queue from fleet-PR or Compose.
        </p>
      )}
    </div>
  );
}
