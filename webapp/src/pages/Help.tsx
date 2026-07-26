import { HelpCircle } from "lucide-react";
import { useState } from "react";

const TABS = [
  "Architecture",
  "Outbox flow",
  "Safety",
  "Ports",
  "Tools",
  "Env",
  "Troubleshooting",
] as const;

type Tab = (typeof TABS)[number];

const S = {
  h2: (t: string) =>
    `<h3 class="text-base font-bold text-zinc-100 mt-5 mb-2">${t}</h3>`,
  p: (t: string) => `<p class="text-zinc-300 leading-relaxed">${t}</p>`,
  ul: (items: string[]) =>
    `<ul class="space-y-1 list-disc list-inside text-zinc-300">${items.map((i) => `<li>${i}</li>`).join("")}</ul>`,
  code: (t: string) =>
    `<code class="text-violet-300 bg-zinc-800 px-1.5 py-0.5 rounded text-xs">${t}</code>`,
};

const TAB_CONTENT: Record<Tab, { title: string; html: string }> = {
  Architecture: {
    title: "Architecture",
    html: `
${S.h2("Overview")}
${S.p("civitai-mcp is a FastMCP bridge to Civitai (Civitai marketplace). It sits in the Comms lane of the sandraschi MCP fleet alongside discord-mcp. Primary job: hold a human-approved SQLite outbox for promotion drafts from fleet-public-relations-mcp, then publish when Sandra explicitly approves.")}
${S.h2("Components")}
${S.ul([
  `${S.code("server.py")} — FastAPI + FastMCP dual transport (stdio + HTTP /mcp)`,
  `${S.code("outbox.py")} — SQLite queue: pending → approved → published | rejected`,
  `${S.code("portmanteau.py")} — civitai_models unified operations`,
  `${S.code("webapp/")} — React dashboard on port 11125, proxies /api to 11124`,
])}
${S.h2("Data flow")}
${S.p("fleet-PR Drafts → POST /api/v1/outbox → webapp Outbox → approve → publish → Civitai API (or dry-run log). No direct posting from scraper-mcp, CI, or agents without human gate.")}
${S.h2("Docs")}
${S.ul([
  "README.md — install and quick start",
  "PRD.md — requirements and success metrics",
  "llms-full.txt — agent manifest",
  "mcp-central-docs/standards/FLEET_PROMOTION.md — tone rules",
])}
`,
  },
  "Outbox flow": {
    title: "Outbox flow",
    html: `
${S.h2("Enqueue")}
${S.p("Drafts arrive via POST /api/v1/outbox from fleet-public-relations-mcp (source, repo_id, campaign, status_text) or from the Compose page (source: compose-ui). New items start as pending.")}
${S.h2("Review")}
${S.p("Open Outbox in the webapp. Each card shows repo_id, campaign, status text, and current status. Read for FLEET_PROMOTION compliance before approving.")}
${S.h2("Approve")}
${S.p("POST /api/v1/outbox/{id}/approve moves item to approved. Rejected items stay in SQLite for audit.")}
${S.h2("Publish")}
${S.p("POST /api/v1/outbox/{id}/publish sends to Civitai when CIVITAI_DRY_RUN=0 and instance token is configured. With dry-run (default), publish succeeds but only logs — no live toot.")}
${S.h2("MCP equivalent")}
${S.p("civitai_models operations outbox_enqueue, outbox_approve, outbox_publish, outbox_reject, outbox_list mirror the REST API for Cursor agents.")}
`,
  },
  Safety: {
    title: "Safety",
    html: `
${S.h2("Dry run default")}
${S.p("CIVITAI_DRY_RUN=1 is the default. Publish calls validate the pipeline without hitting the fediverse. Set to 0 only when you intend live posting.")}
${S.h2("Human approve")}
${S.p("Never auto-post from fleet-PR, scraper-mcp, or CI. Sandra approves in Outbox or via explicit MCP/REST approve action.")}
${S.h2("FLEET_PROMOTION tone")}
${S.p("Useful pointer, not hype. Ban: game-changer, 10x, revolution, 'written by AI'. Name the MCP/repo concretely. fleet-PR lints at draft time; Compose assist and Tone Linter chat personality re-check here.")}
${S.h2("Private repo")}
${S.p("Repo stays private (.nopublish). No GitHub Actions CI on private repos per fleet standards.")}
${S.h2("No Civitai here")}
${S.p("Civitai marketplacecol / Civitai is a separate future repo — do not mix into civitai-mcp.")}
`,
  },
  Ports: {
    title: "Ports",
    html: `
${S.h2("Reserved ports")}
${S.ul([
  `${S.code("11124")} — Backend (FastAPI, /mcp, /api/*)`,
  `${S.code("11125")} — Frontend (Vite dev / built static)`,
])}
${S.h2("Proxy")}
${S.p("vite.config.ts proxies /api and /mcp to 127.0.0.1:11124. Start backend with .\\start.ps1 before npm run dev.")}
${S.h2("LLM probe ports (local, not civitai-mcp)")}
${S.ul([
  `${S.code("11434")} — Ollama`,
  `${S.code("1234")} — LM Studio`,
  `${S.code("8000")} — vLLM`,
])}
`,
  },
  Tools: {
    title: "Tools",
    html: `
${S.h2("civitai_models (portmanteau)")}
${S.p("Unified Civitai marketplace + outbox operations. Pass operation as first argument.")}
${S.ul([
  `${S.code("post")}, ${S.code("reply")}, ${S.code("boost")}, ${S.code("upload_media")}`,
  `${S.code("timeline")}, ${S.code("notifications")}`,
  `${S.code("outbox_list")}, ${S.code("outbox_enqueue")}, ${S.code("outbox_approve")}, ${S.code("outbox_publish")}, ${S.code("outbox_reject")}`,
  `${S.code("accounts_list")}`,
])}
${S.h2("Solo tools")}
${S.ul([
  `${S.code("civitai_help")} — Help and ports`,
  `${S.code("civitai_shutdown")} — Graceful shutdown ack`,
])}
${S.h2("Prefab")}
${S.ul([`${S.code("show_outbox_card")} — Outbox summary card for MCP clients`])}
${S.p("See Tools page for live list from GET /api/tools.")}
`,
  },
  Env: {
    title: "Env",
    html: `
${S.h2("Required for live Civitai")}
${S.ul([
  `${S.code("CIVITAI_INSTANCE")} — e.g. https://civitai.com`,
  `${S.code("CIVITAI_ACCESS_TOKEN")} — app token with write scope`,
])}
${S.h2("Safety")}
${S.ul([
  `${S.code("CIVITAI_DRY_RUN")} — 1 (default) simulate publish; 0 live toots`,
])}
${S.h2("Optional")}
${S.ul([
  `${S.code("CIVITAI_BACKEND_PORT")} — override 11124`,
  "See .env.example in repo root",
])}
${S.p("Settings page shows dry_run and instance_configured from GET /api/health — never exposes token values.")}
`,
  },
  Troubleshooting: {
    title: "Troubleshooting",
    html: `
${S.h2("Backend offline (red dot)")}
${S.p("Run .\\start.ps1 from repo root. Check port 11124 is free: Get-NetTCPConnection -LocalPort 11124. Ensure uv sync completed.")}
${S.h2("Outbox empty after fleet-PR draft")}
${S.p("Verify fleet-PR targets civitai-mcp URL (http://127.0.0.1:11124/api/v1/outbox). Check backend logs via Logger modal (GET /api/logs).")}
${S.h2("Publish does nothing")}
${S.p("Expected when CIVITAI_DRY_RUN=1 — response includes dry_run: true. Set CIVITAI_DRY_RUN=0 and restart backend for live posts. Item must be approved first.")}
${S.h2("Notifications / timeline empty")}
${S.p("Configure CIVITAI_INSTANCE + CIVITAI_ACCESS_TOKEN. Timelines page fetches /api/v1/timeline; Inbox uses /api/v1/notifications.")}
${S.h2("Chat / Compose assist fails")}
${S.p("Start Ollama (ollama serve) or LM Studio. Settings probes :11434, :1234, :8000. Chat uses POST /api/llm/chat proxy.")}
${S.h2("E2E tests")}
${S.p("uv run pytest tests/ -q and cd webapp; npm run test:e2e — backend must be on 11124 with dry_run enabled.")}
`,
  },
};

export default function Help() {
  const [tab, setTab] = useState<Tab>("Architecture");
  const content = TAB_CONTENT[tab];

  return (
    <div className="space-y-6 py-4 max-w-4xl p-6" data-testid="help-page">
      <div className="flex items-center gap-4">
        <HelpCircle className="text-violet-400 w-8 h-8" />
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">
            Help
          </h1>
          <p className="text-zinc-400 text-sm">
            Civitai MCP — outbox gate, FLEET_PROMOTION, ports 11124/11125
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-1">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={
              tab === t
                ? "px-4 py-2 text-sm font-medium text-violet-300 border-b-2 border-violet-400"
                : "px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-300"
            }
          >
            {t}
          </button>
        ))}
      </div>

      <div
        className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 space-y-3 text-sm text-zinc-300 [&_h3]:text-zinc-100 [&_h3]:font-bold [&_h3]:text-base [&_h3]:mt-5 [&_h3]:mb-2"
        dangerouslySetInnerHTML={{ __html: content.html }}
      />
    </div>
  );
}
