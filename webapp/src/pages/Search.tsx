import { Search as SearchIcon } from "lucide-react";
import { useState } from "react";

type ModelHit = {
  id: number;
  name: string;
  type?: string;
  creator?: string;
  url?: string;
  tags?: string[];
  stats?: { downloadCount?: number };
  modelVersions?: { id: number; name: string; baseModel?: string }[];
};

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [types, setTypes] = useState("LORA");
  const [items, setItems] = useState<ModelHit[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const search = async () => {
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch(
        `/api/v1/models/search?q=${encodeURIComponent(query)}&types=${encodeURIComponent(types)}&limit=24`,
      );
      const j = await r.json();
      if (!j.success) {
        setMsg(j.error || "search failed");
        setItems([]);
      } else {
        setItems(j.items || []);
        setMsg(j.message || `${(j.items || []).length} hits`);
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "network error");
    } finally {
      setBusy(false);
    }
  };

  const enqueue = async (m: ModelHit) => {
    const ver = m.modelVersions?.[0]?.id;
    if (!ver) {
      setMsg("no version on this hit — open model on Civitai");
      return;
    }
    const r = await fetch("/api/v1/outbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status_text: `pin ${m.name} version_id=${ver}`,
        version_id: ver,
        model_id: m.id,
        model_type: m.type || types,
        repo_id: "civitai",
        source: "search-ui",
      }),
    });
    const j = await r.json();
    setMsg(
      j.success
        ? `Queued #${j.id} — approve on Queue (dry-run until token + DRY_RUN=0)`
        : j.error || "enqueue failed",
    );
  };

  return (
    <div className="p-6 max-w-5xl" data-testid="search-page">
      <div className="flex items-center gap-3 mb-1">
        <SearchIcon className="text-violet-400 w-6 h-6" />
        <h1 className="text-xl font-semibold">Search</h1>
      </div>
      <p className="text-sm text-zinc-500 mb-4">
        Discover checkpoints and LoRAs on Civitai. Queue a download for human
        approve — weights land in the Depot for comfyops.
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        <input
          data-testid="search-query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="illustrious, pony, style LoRA…"
          className="flex-1 min-w-[12rem] bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
        />
        <select
          data-testid="search-type"
          value={types}
          onChange={(e) => setTypes(e.target.value)}
          className="bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-2 text-sm"
        >
          <option value="LORA">LORA</option>
          <option value="Checkpoint">Checkpoint</option>
          <option value="VAE">VAE</option>
          <option value="TextualInversion">Embedding</option>
          <option value="ControlNet">ControlNet</option>
        </select>
        <button
          type="button"
          data-testid="search-submit"
          onClick={search}
          disabled={busy}
          className="px-4 py-2 text-sm rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium disabled:opacity-50"
        >
          {busy ? "Searching…" : "Search"}
        </button>
      </div>

      {msg && (
        <p className="text-sm text-violet-300 mb-3" data-testid="search-msg">
          {msg}
        </p>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {items.map((m) => (
          <div
            key={m.id}
            className="bg-zinc-900 border border-zinc-800 rounded-lg p-4"
            data-testid="search-hit"
          >
            <div className="flex justify-between gap-2 mb-1">
              <h2 className="text-sm font-medium text-zinc-100 line-clamp-2">
                {m.name}
              </h2>
              <span className="text-xs text-zinc-500 shrink-0">{m.type}</span>
            </div>
            <p className="text-xs text-zinc-500 mb-2">
              {m.creator || "unknown"} · ↓{" "}
              {m.stats?.downloadCount?.toLocaleString?.() ?? "—"}
            </p>
            <p className="text-xs text-zinc-600 mb-3 line-clamp-1">
              {(m.tags || []).slice(0, 6).join(", ")}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                data-testid="search-queue"
                onClick={() => enqueue(m)}
                className="px-3 py-1.5 text-xs rounded bg-zinc-800 hover:bg-zinc-700"
              >
                Queue download
              </button>
              {m.url && (
                <a
                  href={m.url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 text-xs rounded border border-zinc-700 hover:border-zinc-500 text-zinc-300"
                >
                  Open on Civitai
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {!busy && items.length === 0 && (
        <p className="text-sm text-zinc-600 mt-8 text-center">
          No results yet — search does not need an API token.
        </p>
      )}
    </div>
  );
}
