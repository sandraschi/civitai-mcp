import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertCircle,
  BookMarked,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 60_000 } },
});

type SkillEntry = {
  name: string;
  content: string;
};

function Inner() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["skills"],
    queryFn: () => fetch("/api/skills").then((r) => r.json()),
  });

  const skills: SkillEntry[] = data?.skills ?? [];
  const [expanded, setExpanded] = useState<string | null>(
    skills[0]?.name ?? null,
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 max-w-4xl pb-8"
    >
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-100">Skills</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Bundled SKILL.md files exposed to MCP clients as{" "}
          <span className="font-mono text-zinc-400">skill://name/SKILL.md</span>
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-200 mb-4">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">Failed to load skills</p>
        </div>
      )}

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex items-center gap-3 mb-4">
          <BookMarked className="w-6 h-6 text-violet-400" />
          <p className="text-sm text-zinc-400">
            {data?.count ?? 0} skill(s) on server
          </p>
        </div>

        {isLoading && <p className="text-sm text-zinc-500">Loading skills…</p>}

        {!isLoading && skills.length === 0 && (
          <p className="text-sm text-zinc-500">
            No skills found under src/civitai_mcp/skills/
          </p>
        )}

        <ul className="space-y-3">
          {skills.map((s) => (
            <li
              key={s.name}
              className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setExpanded(expanded === s.name ? null : s.name)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-900 transition-colors text-left"
              >
                <span className="font-mono text-sm text-violet-300">
                  {s.name}
                </span>
                {expanded === s.name ? (
                  <ChevronDown className="w-4 h-4 text-zinc-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-zinc-500" />
                )}
              </button>
              {expanded === s.name && (
                <div className="px-4 pb-4 border-t border-zinc-800">
                  <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed mt-3 max-h-[60vh] overflow-y-auto">
                    {s.content}
                  </pre>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}

export default function Skills() {
  return (
    <QueryClientProvider client={qc}>
      <Inner />
    </QueryClientProvider>
  );
}
