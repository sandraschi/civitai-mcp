import { Download, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type LogEntry = {
  id: string;
  timestamp: string;
  level: string;
  kind: string;
  detail: string;
};

const LEVELS = ["", "DEBUG", "INFO", "WARNING", "ERROR"];
const LEVEL_COLORS: Record<string, string> = {
  ERROR: "text-red-400 bg-red-950/40",
  WARNING: "text-yellow-400 bg-yellow-950/40",
  INFO: "text-violet-300 bg-violet-950/30",
  DEBUG: "text-zinc-500 bg-zinc-900/30",
};

export default function LoggerModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [level, setLevel] = useState("");
  const [search, setSearch] = useState("");
  const [tail, setTail] = useState(true);
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", "100");
    if (level) params.set("level", level);
    if (search) params.set("search", search);
    try {
      const r = await fetch(`/api/logs?${params}`);
      const d = await r.json();
      setEntries(d.entries || []);
    } catch {
      /* backend may not have log endpoint */
    } finally {
      setLoading(false);
    }
  }, [level, search]);

  useEffect(() => {
    if (!open) return;
    fetchLogs();
  }, [open, fetchLogs]);

  useEffect(() => {
    if (!tail || !open) return;
    const iv = setInterval(fetchLogs, 3000);
    return () => clearInterval(iv);
  }, [tail, open, fetchLogs]);

  useEffect(() => {
    if (tail && endRef.current)
      endRef.current.scrollIntoView({ behavior: "smooth" });
  }, [entries, tail]);

  const handleExport = () => {
    const lines = entries
      .map((e) => `[${e.timestamp}] ${e.level} ${e.kind}: ${e.detail}`)
      .join("\n");
    const blob = new Blob([lines], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `civitai-mcp-logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-[90vw] max-w-4xl h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-100">Logger</h2>
          <div className="flex items-center gap-2">
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="h-7 rounded border border-zinc-700 bg-zinc-800 px-2 text-sm text-zinc-300"
            >
              <option value="">All levels</option>
              {LEVELS.filter(Boolean).map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="h-7 w-40 rounded border border-zinc-700 bg-zinc-800 pl-7 pr-2 text-sm text-zinc-300 placeholder:text-zinc-500"
              />
            </div>
            <button
              onClick={() => setTail(!tail)}
              className={`h-7 rounded px-2 text-sm font-medium ${
                tail
                  ? "bg-violet-600 text-white"
                  : "border border-zinc-700 text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              LIVE
            </button>
            <button
              onClick={handleExport}
              className="p-1.5 rounded text-zinc-400 hover:text-white"
              title="Export"
            >
              <Download size={14} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded text-zinc-400 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-zinc-950 p-3 font-mono text-sm leading-relaxed">
          {entries.length === 0 && !loading && (
            <div className="text-zinc-600 text-center py-12">
              No log entries
            </div>
          )}
          {entries.map((e) => (
            <div
              key={e.id}
              className="flex gap-3 py-0.5 hover:bg-zinc-900/50 rounded px-1"
            >
              <span className="text-zinc-600 w-20 shrink-0">
                {e.timestamp?.split(".")[0]?.split("T")[1] || e.timestamp}
              </span>
              <span
                className={`w-14 shrink-0 text-center rounded text-[10px] font-bold ${LEVEL_COLORS[e.level] || "text-zinc-400"}`}
              >
                {e.level}
              </span>
              <span className="text-zinc-500 w-20 shrink-0 truncate">
                {e.kind}
              </span>
              <span className="text-zinc-300">{e.detail}</span>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </div>
    </div>
  );
}
