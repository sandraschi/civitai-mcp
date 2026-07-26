import clsx from "clsx";
import { Check, Download, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

type Item = {
  id: number;
  status: string;
  repo_id: string;
  status_text: string;
  version_id?: number;
  model_type?: string;
};

/**
 * Download approval queue — not a social outbox.
 * Backend still uses /api/v1/outbox for the SQLite gate.
 */
export default function QueuePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [msg, setMsg] = useState("");

  const load = () =>
    fetch("/api/v1/outbox")
      .then((r) => r.json())
      .then((d) => setItems(d.items || []));

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const act = async (id: number, path: string) => {
    const r = await fetch(`/api/v1/outbox/${id}/${path}`, { method: "POST" });
    const j = await r.json();
    setMsg(j.message || j.error || JSON.stringify(j));
    load();
  };

  return (
    <div className="p-6 max-w-3xl" data-testid="queue-page">
      <div className="flex items-center gap-3 mb-1">
        <Download className="text-violet-400 w-6 h-6" />
        <h1 className="text-xl font-semibold">Queue</h1>
      </div>
      <p className="text-sm text-zinc-500 mb-4">
        Pending weight downloads. Approve → download into Depot (dry-run until
        CIVITAI_DRY_RUN=0 and API token). Not messaging — Civitai comments stay
        on the website.
      </p>

      <Link
        to="/search"
        className="inline-flex mb-4 text-sm text-violet-400 hover:text-violet-300"
        data-testid="queue-to-search"
      >
        ← Back to Search
      </Link>

      {msg && <p className="text-sm text-violet-300 mb-3">{msg}</p>}

      <div className="space-y-3">
        {items.length === 0 && (
          <p className="text-sm text-zinc-600 text-center py-8">
            Queue empty — pin something from Search.
          </p>
        )}
        {items.map((it) => (
          <div
            key={it.id}
            className="bg-zinc-900 border border-zinc-800 rounded-lg p-4"
            data-testid="queue-item"
          >
            <div className="flex justify-between text-sm mb-2">
              <span className="font-mono text-zinc-500">#{it.id}</span>
              <span
                className={clsx(
                  "text-xs px-2 py-0.5 rounded",
                  it.status === "pending" && "bg-amber-500/20 text-amber-400",
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
            <p className="text-sm text-zinc-200 mb-3">{it.status_text}</p>
            {it.status === "pending" && (
              <div className="flex gap-2">
                <button
                  type="button"
                  data-testid="queue-approve"
                  onClick={() => act(it.id, "approve")}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-emerald-700 hover:bg-emerald-600"
                >
                  <Check size={14} /> Approve
                </button>
                <button
                  type="button"
                  data-testid="queue-reject"
                  onClick={() => act(it.id, "reject")}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-zinc-800 hover:bg-zinc-700"
                >
                  <X size={14} /> Reject
                </button>
              </div>
            )}
            {it.status === "approved" && (
              <button
                type="button"
                data-testid="queue-download"
                onClick={() => act(it.id, "publish")}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-violet-600 hover:bg-violet-500"
              >
                <Download size={14} /> Download now
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
