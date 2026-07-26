import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  HardDrive,
  HelpCircle,
  LayoutDashboard,
  MessageSquare,
  Search,
  Settings,
  Terminal,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  NavLink,
  Route,
  Routes,
} from "react-router-dom";
import HelpModal from "./components/HelpModal";
import LoggerModal from "./components/LoggerModal";
import Chat from "./pages/Chat";
import Dashboard from "./pages/Dashboard";
import DepotPage from "./pages/Depot";
import HelpPage from "./pages/Help";
import QueuePage from "./pages/Queue";
import SearchPage from "./pages/Search";
import SettingsPage from "./pages/Settings";
import Skills from "./pages/Skills";
import Tools from "./pages/Tools";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/search", label: "Search", icon: Search },
  { to: "/depot", label: "Depot", icon: HardDrive },
  { to: "/queue", label: "Queue", icon: Download },
  { to: "/tools", label: "Tools", icon: Wrench },
  { to: "/skills", label: "Skills", icon: BookOpen },
  { to: "/chat", label: "Chat", icon: MessageSquare },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/help", label: "Help", icon: HelpCircle },
];

async function checkBackendHealth(): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch("/api/health");
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Network error",
    };
  }
}

export default function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [loggerOpen, setLoggerOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const refresh = useCallback(async () => {
    const h = await checkBackendHealth();
    setBackendOk(h.ok);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10_000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "l") {
        e.preventDefault();
        setLoggerOpen(true);
      }
      if (e.ctrlKey && e.key === "h") {
        e.preventDefault();
        setHelpOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <BrowserRouter>
      <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
        <motion.aside
          animate={{ width: collapsed ? 56 : 200 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col bg-zinc-900 border-r border-zinc-800 shrink-0 overflow-hidden"
        >
          <div className="flex items-center justify-between px-3 py-3 border-b border-zinc-800">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xl shrink-0">🐘</span>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="font-semibold text-violet-400 text-sm tracking-wide whitespace-nowrap truncate"
                >
                  Civitai MCP
                </motion.span>
              )}
            </div>
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <ChevronRight size={14} />
              ) : (
                <ChevronLeft size={14} />
              )}
            </button>
          </div>

          <nav className="flex-1 py-3 space-y-0.5 px-1.5 overflow-y-auto">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  clsx(
                    "flex items-center gap-3 px-2.5 py-2 rounded-md text-sm transition-colors",
                    isActive
                      ? "bg-violet-500/20 text-violet-300"
                      : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800",
                  )
                }
              >
                <Icon size={16} className="shrink-0" />
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="whitespace-nowrap"
                  >
                    {label}
                  </motion.span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="border-t border-zinc-800 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span
                data-testid="backend-dot"
                className={clsx(
                  "w-2 h-2 rounded-full shrink-0",
                  backendOk === null
                    ? "bg-zinc-500 animate-pulse"
                    : backendOk
                      ? "bg-green-500"
                      : "bg-red-500",
                )}
              />
              {!collapsed && (
                <span className="text-sm text-zinc-400">
                  {backendOk === null
                    ? "Connecting..."
                    : backendOk
                      ? "Backend online"
                      : "Backend offline"}
                </span>
              )}
            </div>
            {!collapsed && (
              <p className="text-[10px] text-zinc-600 mt-1.5">
                catalog · depot · comfyops
              </p>
            )}
          </div>
        </motion.aside>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="flex items-center justify-end gap-2 px-4 py-2 border-b border-zinc-800 bg-zinc-900/50 shrink-0">
            <button
              onClick={() => setLoggerOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              title="Logger (Ctrl+L)"
            >
              <Terminal size={14} />
              <span className="hidden sm:inline">Logs</span>
            </button>
            <button
              onClick={() => setHelpOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              title="Help (Ctrl+H)"
            >
              <HelpCircle size={14} />
              <span className="hidden sm:inline">Help</span>
            </button>
          </header>

          <main className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              <Routes>
                <Route path="/" element={<Dashboard backendOk={backendOk} />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/depot" element={<DepotPage />} />
                <Route path="/queue" element={<QueuePage />} />
                <Route
                  path="/outbox"
                  element={<Navigate to="/queue" replace />}
                />
                <Route
                  path="/timelines"
                  element={<Navigate to="/search" replace />}
                />
                <Route
                  path="/inbox"
                  element={<Navigate to="/depot" replace />}
                />
                <Route
                  path="/compose"
                  element={<Navigate to="/search" replace />}
                />
                <Route
                  path="/accounts"
                  element={<Navigate to="/settings" replace />}
                />
                <Route path="/tools" element={<Tools />} />
                <Route path="/skills" element={<Skills />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/help" element={<HelpPage />} />
              </Routes>
            </AnimatePresence>
          </main>
        </div>

        <LoggerModal open={loggerOpen} onClose={() => setLoggerOpen(false)} />
        <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      </div>
    </BrowserRouter>
  );
}
