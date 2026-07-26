import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";

export default function Compose() {
  const [text, setText] = useState("");
  const [repoId, setRepoId] = useState("manual");
  const [result, setResult] = useState("");
  const [assisting, setAssisting] = useState(false);
  const [assistErr, setAssistErr] = useState("");

  const enqueue = async () => {
    const r = await fetch("/api/v1/outbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status_text: text,
        source: "compose-ui",
        repo_id: repoId,
      }),
    });
    setResult(JSON.stringify(await r.json(), null, 2));
    setText("");
  };

  const aiAssist = async () => {
    if (!text.trim()) return;
    setAssisting(true);
    setAssistErr("");
    try {
      const r = await fetch("/api/compose/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft: text,
          repo_id: repoId,
          goal: "Tighten for FLEET_PROMOTION: concrete, no hype, name MCP/Cursor if relevant.",
        }),
      });
      const j = await r.json();
      if (j.suggested) {
        setText(j.suggested);
      } else if (j.error) {
        setAssistErr(j.error);
      } else {
        setAssistErr("No suggestion returned — is Ollama running?");
      }
    } catch (e) {
      setAssistErr(e instanceof Error ? e.message : "Assist failed");
    } finally {
      setAssisting(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold mb-1">Compose</h1>
      <p className="text-sm text-zinc-500 mb-4">
        Enqueues to outbox — does not post directly.
      </p>

      <label className="text-sm text-zinc-400 block mb-1">repo_id</label>
      <input
        value={repoId}
        onChange={(e) => setRepoId(e.target.value)}
        className="w-full bg-zinc-950 border border-zinc-700 rounded-md px-3 py-1.5 text-sm mb-3 font-mono"
        placeholder="manual"
      />

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        className="w-full bg-zinc-950 border border-zinc-700 rounded-md p-3 text-sm mb-3"
        placeholder="Useful pointer, not hype…"
      />

      <div className="flex flex-wrap gap-2">
        <button
          onClick={aiAssist}
          disabled={!text.trim() || assisting}
          data-testid="compose-ai-assist"
          className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-md border border-violet-500/40 text-violet-300 hover:bg-violet-500/10 disabled:opacity-40"
        >
          {assisting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Sparkles size={14} />
          )}
          AI assist
        </button>
        <button
          onClick={enqueue}
          disabled={!text.trim()}
          className="px-3 py-2 text-sm rounded-md bg-violet-600 hover:bg-violet-500 disabled:opacity-40"
        >
          Enqueue to outbox
        </button>
      </div>

      {assistErr && <p className="text-sm text-amber-400 mt-3">{assistErr}</p>}
      {result && (
        <pre className="mt-4 text-xs text-zinc-500 whitespace-pre-wrap">
          {result}
        </pre>
      )}
    </div>
  );
}
