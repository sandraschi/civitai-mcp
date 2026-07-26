import { motion } from "framer-motion";
import { Bot, Download, Eraser, Loader2, Send, User } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { detectFirstProvider, portFromUrl } from "../lib/provider";
import { useLLMStore } from "../store/llm";

const STORAGE_KEY = "civitai-mcp-chat-history";
const PERSONALITY_KEY = "civitai-mcp-chat-personality";
const CUSTOM_PROMPT_KEY = "civitai-mcp-custom-prompt";

interface Message {
  role: "user" | "assistant";
  content: string;
  ts?: string;
}

type Personality = { id: string; label: string; prompt: string };

const PERSONALITIES: Personality[] = [
  {
    id: "compose-coach",
    label: "Compose Coach",
    prompt:
      "You help rewrite Civitai drafts for sandraschi fleet MCP repos. Follow FLEET_PROMOTION: useful pointer, concrete, no hype, no 'written by AI'. Suggest tight status text under 500 chars when possible.",
  },
  {
    id: "tone-linter",
    label: "Tone Linter",
    prompt:
      "You lint Civitai drafts against FLEET_PROMOTION rules. Flag banned hype (game-changer, 10x, revolution), AI-authorship theater, and vague claims. Return issues plus a fixed draft.",
  },
  {
    id: "outbox-triage",
    label: "Outbox Triage",
    prompt:
      "You triage outbox drafts: tag ready/needs-edit/reject, note repo_id fit, suggest approve or reject rationale for human reviewer.",
  },
  {
    id: "custom",
    label: "Custom",
    prompt: "",
  },
];

const EXAMPLE_PROMPTS = [
  "Tighten this draft for kicad-mcp — useful pointer only",
  "Lint my draft for FLEET_PROMOTION violations",
  "What should I approve in the outbox today?",
];

function loadHistory(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(messages: Message[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-100)));
  } catch {
    /* ignore */
  }
}

function loadPersonality(): string {
  try {
    return localStorage.getItem(PERSONALITY_KEY) || "compose-coach";
  } catch {
    return "compose-coach";
  }
}

function buildSystemPrompt(
  skillContent: string,
  personality: Personality,
): string {
  if (personality.id === "custom") {
    return (
      localStorage.getItem(CUSTOM_PROMPT_KEY) ||
      "You are a helpful Civitai compose assistant."
    );
  }
  if (skillContent) {
    const role =
      personality.prompt ||
      "You assist with Civitai outbox and fleet promotion.";
    return `${skillContent}\n\n---\n\n## Role\n${role}`;
  }
  return `${personality.prompt}\n\nYou assist with Civitai MCP outbox and FLEET_PROMOTION tone.`;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>(loadHistory);
  const [input, setInput] = useState("");
  const [model, setModel] = useState("qwen3:14b");
  const [loading, setLoading] = useState(false);
  const [personalityId, setPersonalityId] = useState(loadPersonality);
  const [skillContent, setSkillContent] = useState("");
  const [skillName, setSkillName] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const ollamaUrl = useLLMStore((s) => s.ollamaUrl);
  const checking = useLLMStore((s) => s.checking);
  const setOllamaUrl = useLLMStore((s) => s.setOllamaUrl);

  const personality =
    PERSONALITIES.find((p) => p.id === personalityId) || PERSONALITIES[0];

  useEffect(() => {
    detectFirstProvider().then((p) => {
      if (p) setOllamaUrl(p.baseUrl);
      else setOllamaUrl(null);
    });
  }, [setOllamaUrl]);

  useEffect(() => {
    fetch("/api/skills")
      .then((r) => (r.ok ? r.json() : { skills: [] }))
      .then((data) => {
        if (data.skills?.length > 0) {
          setSkillContent(data.skills[0].content);
          setSkillName(data.skills[0].name);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  useEffect(() => {
    localStorage.setItem(PERSONALITY_KEY, personalityId);
  }, [personalityId]);

  const send = useCallback(async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = {
      role: "user",
      content: input.trim(),
      ts: new Date().toISOString(),
    };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    const systemPrompt = buildSystemPrompt(skillContent, personality);
    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...next.map((m) => ({ role: m.role, content: m.content })),
    ];

    try {
      const providerPort = portFromUrl(ollamaUrl);
      const r = await fetch("/api/llm/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: chatMessages,
          model,
          provider_port: providerPort,
        }),
      });
      const data = await r.json();
      if (!data.success) {
        if (ollamaUrl && providerPort === 11434) {
          const direct = await fetch(`${ollamaUrl}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model,
              messages: chatMessages,
              stream: false,
            }),
          });
          if (!direct.ok)
            throw new Error(data.error || `Chat error ${r.status}`);
          const directData = await direct.json();
          setMessages((m) => [
            ...m,
            {
              role: "assistant",
              content: directData.message?.content ?? "(empty response)",
              ts: new Date().toISOString(),
            },
          ]);
          return;
        }
        throw new Error(data.error || `Chat error ${r.status}`);
      }
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: data.content ?? "(empty response)",
          ts: new Date().toISOString(),
        },
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: `Error: ${msg}`,
          ts: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, ollamaUrl, messages, model, personality, skillContent]);

  const handleExport = useCallback(() => {
    const lines = messages
      .map(
        (m) =>
          `[${m.ts || ""}] ${m.role === "user" ? "You" : "Assistant"}: ${m.content}`,
      )
      .join("\n");
    const blob = new Blob([lines], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `civitai-mcp-chat-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [messages]);

  const handleClear = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const canChat = Boolean(ollamaUrl);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col h-full p-6"
      data-testid="chat-page"
    >
      <div
        className="mb-4 flex items-center justify-between flex-wrap gap-3"
        data-testid="chat-controls"
      >
        <div>
          <h1 className="text-xl font-semibold">Chat</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Local LLM — compose & outbox assistant
            {skillName && (
              <span className="ml-2 text-xs text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded">
                skill:{skillName}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {checking ? (
            <span className="text-sm text-zinc-400 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Detecting LLM...
            </span>
          ) : ollamaUrl ? (
            <span className="text-sm text-green-400 bg-green-400/10 px-2 py-1 rounded flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> LLM on{" "}
              {ollamaUrl}
            </span>
          ) : (
            <span className="text-sm text-red-400 bg-red-400/10 px-2 py-1 rounded flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Not
              detected
            </span>
          )}
          <select
            data-testid="personality-select"
            value={personalityId}
            onChange={(e) => setPersonalityId(e.target.value)}
            className="bg-zinc-800 text-zinc-100 border border-zinc-600 rounded px-2 py-1 text-sm"
          >
            {PERSONALITIES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <button
            onClick={handleExport}
            disabled={messages.length === 0}
            data-testid="chat-export"
            title="Export chat"
            className="p-1.5 rounded text-zinc-400 hover:text-white disabled:opacity-30"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={handleClear}
            disabled={messages.length === 0}
            data-testid="chat-clear"
            title="Clear chat"
            className="p-1.5 rounded text-zinc-400 hover:text-white disabled:opacity-30"
          >
            <Eraser className="w-4 h-4" />
          </button>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="model name"
            className="bg-zinc-950 border border-zinc-700 rounded-md px-2 py-1 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-violet-500 w-40 font-mono"
          />
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto space-y-3 mb-4 min-h-0"
        data-testid="chat-messages"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-2">
            <Bot size={36} />
            <p className="text-sm">
              Chat about Civitai drafts, tone, and outbox triage
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className="flex gap-2 max-w-[80%]">
              {m.role === "assistant" && (
                <div className="h-7 w-7 rounded-full bg-violet-900/20 flex items-center justify-center border border-violet-800 shrink-0 mt-1">
                  <Bot className="h-3.5 w-3.5 text-violet-400" />
                </div>
              )}
              <div>
                <span
                  className={`text-sm ${m.role === "user" ? "text-violet-300" : "text-violet-400"} block mb-0.5`}
                >
                  {m.role === "user" ? "You" : "Civitai Assistant"}
                </span>
                <div
                  className={`px-4 py-2.5 rounded-xl text-sm whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-violet-500/20 text-violet-100"
                      : "bg-zinc-800 text-zinc-200"
                  }`}
                >
                  {m.content}
                </div>
              </div>
              {m.role === "user" && (
                <div className="h-7 w-7 rounded-full bg-zinc-700 flex items-center justify-center border border-zinc-600 shrink-0 mt-1">
                  <User className="h-3.5 w-3.5 text-zinc-300" />
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="flex gap-2">
              <div className="h-7 w-7 rounded-full bg-violet-900/20 flex items-center justify-center border border-violet-800">
                <Bot className="h-3.5 w-3.5 text-violet-400" />
              </div>
              <div className="bg-zinc-800 px-4 py-2.5 rounded-xl text-sm text-zinc-400 animate-pulse flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking...
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length === 0 && (
        <div
          className="flex flex-wrap gap-2 mb-3"
          data-testid="example-prompts"
        >
          {EXAMPLE_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => setInput(p)}
              className="text-sm px-3 py-1.5 rounded-full border border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <textarea
          data-testid="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={
            canChat
              ? "Message... (Enter to send)"
              : "Start Ollama/LM Studio to enable chat"
          }
          disabled={!canChat || loading}
          rows={2}
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 resize-none focus:outline-none focus:border-violet-500 disabled:opacity-40"
        />
        <button
          onClick={send}
          disabled={!canChat || !input.trim() || loading}
          className="px-3 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-lg transition-colors"
          data-testid="chat-send"
        >
          <Send size={16} />
        </button>
      </div>
    </motion.div>
  );
}
