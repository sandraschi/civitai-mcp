import { useEffect, useState } from "react";

type Health = {
  instance_configured?: boolean;
  dry_run?: boolean;
};

export default function Accounts() {
  const [health, setHealth] = useState<Health | null>(null);
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth);
  }, []);
  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-xl font-semibold mb-4">Accounts</h1>
      <div className="border border-zinc-800 bg-zinc-900 rounded-lg p-4 text-sm space-y-2">
        <div>
          Instance configured: {health?.instance_configured ? "yes" : "no"}
        </div>
        <div>Dry run: {String(health?.dry_run)}</div>
        <div className="text-zinc-500">
          Instance profile above. Multi-account SQLite profiles: extend
          accounts_list when needed.
        </div>
      </div>
    </div>
  );
}
