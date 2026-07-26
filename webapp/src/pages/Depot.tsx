import { HardDrive } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

type LocalFile = {
  path: string;
  rel: string;
  size: number;
};

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function DepotPage() {
  const [items, setItems] = useState<LocalFile[]>([]);
  const [depot, setDepot] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/v1/local");
    const j = await r.json();
    setItems(j.items || []);
    setDepot(j.depot || "");
    setMsg(j.message || `${j.count ?? 0} files`);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="p-6 max-w-4xl" data-testid="depot-page">
      <div className="flex items-center gap-3 mb-1">
        <HardDrive className="text-violet-400 w-6 h-6" />
        <h1 className="text-xl font-semibold">Depot</h1>
      </div>
      <p className="text-sm text-zinc-500 mb-2">
        Local weights already on disk for ComfyUI / comfyops (
        <code className="text-xs text-zinc-400">checkpoints/</code>,{" "}
        <code className="text-xs text-zinc-400">loras/</code>, …). Not a Civitai
        inbox — just your pin folder.
      </p>
      {depot && (
        <p
          className="text-xs font-mono text-zinc-600 mb-4 break-all"
          data-testid="depot-path"
        >
          {depot}
        </p>
      )}

      <div className="flex gap-2 mb-4">
        <button
          type="button"
          data-testid="depot-refresh"
          onClick={load}
          className="px-3 py-1.5 text-sm rounded bg-zinc-800 hover:bg-zinc-700"
        >
          Refresh
        </button>
        <Link
          to="/search"
          className="px-3 py-1.5 text-sm rounded bg-violet-600 hover:bg-violet-500 text-white"
          data-testid="depot-to-search"
        >
          Find more models
        </Link>
      </div>

      {msg && <p className="text-sm text-zinc-400 mb-3">{msg}</p>}

      {items.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
          <p className="text-sm text-zinc-500 mb-2">Depot empty</p>
          <p className="text-xs text-zinc-600">
            Queue a download from Search (approve on Queue). Set{" "}
            <code className="text-zinc-400">CIVITAI_DEPOT_DIR</code> or{" "}
            <code className="text-zinc-400">COMFYOPS_MODELS_DIR</code> to your
            ComfyUI models tree.
          </p>
        </div>
      ) : (
        <ul className="space-y-2" data-testid="depot-list">
          {items.map((f) => (
            <li
              key={f.path}
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 flex justify-between gap-3"
            >
              <span className="text-sm text-zinc-200 font-mono break-all">
                {f.rel}
              </span>
              <span className="text-xs text-zinc-500 shrink-0">
                {fmtBytes(f.size)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
