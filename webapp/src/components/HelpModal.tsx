import { ExternalLink, X } from "lucide-react";

const HELP_ITEMS = [
  {
    title: "README",
    desc: "Install, ports, outbox handoff from fleet-PR",
    href: "https://github.com/sandraschi/civitai-mcp/blob/main/README.md",
  },
  {
    title: "PRD",
    desc: "Product requirements — outbox gate, dry-run, v0.1 scope",
    href: "https://github.com/sandraschi/civitai-mcp/blob/main/PRD.md",
  },
  {
    title: "llms.txt / llms-full.txt",
    desc: "LLM manifest for agents and Cursor",
    href: "https://github.com/sandraschi/civitai-mcp/blob/main/llms-full.txt",
  },
  {
    title: "FLEET_PROMOTION tone",
    desc: "Useful pointer, no hype, no 'written by AI' — mcp-central-docs/standards/FLEET_PROMOTION.md",
    href: "https://github.com/sandraschi/mcp-central-docs/blob/master/standards/FLEET_PROMOTION.md",
  },
  {
    title: "Outbox flow",
    desc: "fleet-PR Drafts → POST /api/v1/outbox → pending → approve → publish (dry-run until CIVITAI_DRY_RUN=0)",
  },
  {
    title: "Dry run default",
    desc: "CIVITAI_DRY_RUN=1 simulates publish — no live toot until you explicitly set 0 and approve",
  },
  {
    title: "civitai_models portmanteau",
    desc: "post, reply, boost, timeline, notifications, outbox_* — see Tools page",
  },
  {
    title: "Human approve gate",
    desc: "Never auto-post from scraper-mcp or CI. Sandra approves in Outbox or webapp.",
  },
];

export default function HelpModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-[90vw] max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 sticky top-0 bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-100">Help</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-zinc-400 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <h3 className="text-sm font-medium text-zinc-200 mb-1">
              Civitai MCP
            </h3>
            <p className="text-sm text-zinc-400">
              Civitai marketplace search + download into a comfyops / ComfyUI
              models depot. Human-approved download outbox; dry-run by default.
              Complements comfyops-mcp (generate there).
            </p>
          </div>

          <div className="space-y-2">
            {HELP_ITEMS.map((item) => (
              <div
                key={item.title}
                className="bg-zinc-800 rounded-lg px-3 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-200">
                    {item.title}
                  </span>
                  {item.href && (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-violet-400 hover:text-violet-300 shrink-0"
                    >
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
                <p className="text-sm text-zinc-500 mt-0.5">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="bg-violet-900/20 border border-violet-800/30 rounded-lg px-3 py-2.5 space-y-1">
            <p className="text-sm text-violet-300 font-medium">
              Ports & endpoints
            </p>
            <p className="text-sm text-violet-200/80">
              Backend <span className="font-mono">11124</span> · Frontend{" "}
              <span className="font-mono">11125</span>· MCP{" "}
              <span className="font-mono">/mcp</span> · REST{" "}
              <span className="font-mono">/api/*</span>
            </p>
            <p className="text-sm text-violet-200/60">
              Vite proxies <span className="font-mono">/api</span> → 11124.
              Outbox SQLite under repo data dir.
            </p>
          </div>

          <p className="text-xs text-zinc-600">
            Full documentation: Help page in sidebar, or INSTALL.md in the repo
            root.
          </p>
        </div>
      </div>
    </div>
  );
}
