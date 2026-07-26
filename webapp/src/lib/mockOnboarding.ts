/**
 * Declared first-run mock content — shown only when instance is NOT configured.
 * Cleared automatically after successful onboarding (handle + app password).
 * See docs/ONBOARDING.md and ONBOARDING_STANDARD.md § Mock-until-onboarded.
 */

export const MOCK_BADGE = "MOCK";

export type MockNotification = {
  id: string;
  type: string;
  account: { display_name: string; acct: string };
  status: { content: string };
  created_at: string;
  _mock: true;
};

export const MOCK_INBOX: MockNotification[] = [
  {
    id: "mock-joe",
    type: "mention",
    account: { display_name: "Joe Mocky", acct: "joe.mocky" },
    status: {
      content:
        "[MOCK] Hey — nice MCP bridge. This notification is fake sample data until you finish onboarding.",
    },
    created_at: "2026-07-26T10:00:00Z",
    _mock: true,
  },
  {
    id: "mock-sandra",
    type: "follow",
    account: { display_name: "Sandra Mockinger", acct: "sandra.mockinger" },
    status: {
      content:
        "[MOCK] Followed you (sample). Real inbox appears after CIVITAI_HANDLE + app password are set.",
    },
    created_at: "2026-07-26T11:00:00Z",
    _mock: true,
  },
];

export const MOCK_KPIS = {
  pending: 3,
  approved: 1,
  published: 2,
  rejected: 0,
  total: 6,
};

export type MockOutboxRow = {
  id: number;
  status: string;
  repo_id: string;
  status_text: string;
  _mock: true;
};

export const MOCK_OUTBOX_RECENT: MockOutboxRow[] = [
  {
    id: -1,
    status: "pending",
    repo_id: "mixx-dj-mcp",
    status_text:
      "[MOCK] Sample fleet draft — AI-native DJ control. Cleared after onboarding.",
    _mock: true,
  },
  {
    id: -2,
    status: "approved",
    repo_id: "kicad-mcp",
    status_text:
      "[MOCK] Sample approved model — headless KiCad export via MCP.",
    _mock: true,
  },
];

export function isOnboarded(
  health:
    | {
        instance_configured?: boolean;
      }
    | null
    | undefined,
): boolean {
  return Boolean(health?.instance_configured);
}
