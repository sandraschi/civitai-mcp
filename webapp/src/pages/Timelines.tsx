import { useState } from "react";

export default function Timelines() {
  const [data, setData] = useState<string>("");
  const [kind, setKind] = useState("home");

  const load = async () => {
    const r = await fetch(`/api/v1/timeline?kind=${kind}`);
    setData(JSON.stringify(await r.json(), null, 2));
  };

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-xl font-semibold mb-4">Timelines</h1>
      <div className="flex gap-2 mb-4">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-sm"
        >
          <option value="home">home</option>
          <option value="local">local</option>
          <option value="public">public</option>
        </select>
        <button
          onClick={load}
          className="px-3 py-1.5 text-sm rounded bg-zinc-800 hover:bg-zinc-700"
        >
          Fetch
        </button>
      </div>
      <pre className="text-xs text-zinc-400 whitespace-pre-wrap bg-zinc-900 border border-zinc-800 rounded p-3 max-h-[70vh] overflow-auto">
        {data || "Configure CIVITAI_INSTANCE + token, then Fetch."}
      </pre>
    </div>
  );
}
