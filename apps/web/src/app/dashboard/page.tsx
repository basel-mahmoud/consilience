import type { Metadata } from "next";
import { auth, currentUser } from "@clerk/nextjs/server";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Overview",
};

type GatewayStatus =
  | { state: "unconfigured" }
  | { state: "offline" }
  | { state: "error"; code: number }
  | { state: "ok"; userId: string };

/**
 * Proves the auth path end-to-end: the gateway independently verifies the
 * Clerk JWT against JWKS and answers with the identity it derived.
 */
async function getGatewayStatus(): Promise<GatewayStatus> {
  const url = process.env.NEXT_PUBLIC_GATEWAY_URL;
  if (!url) return { state: "unconfigured" };
  try {
    const { getToken } = await auth();
    const token = await getToken();
    const res = await fetch(`${url}/api/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return { state: "error", code: res.status };
    const me = (await res.json()) as { userId: string };
    return { state: "ok", userId: me.userId };
  } catch {
    return { state: "offline" };
  }
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const stats = [
  { label: "Research runs", value: "0" },
  { label: "Claims verified", value: "0" },
  { label: "Sources evaluated", value: "0" },
];

export default async function Overview() {
  const [user, gateway] = await Promise.all([currentUser(), getGatewayStatus()]);

  return (
    <main className="mx-auto w-full max-w-4xl space-y-10">
      <header className="space-y-1">
        <h1 className="font-display text-3xl tracking-tight">
          {greeting()}
          {user?.firstName ? `, ${user.firstName}` : ""}
        </h1>
        <p className="text-ink-muted">Your research workspace is ready.</p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-line bg-surface px-5 py-4"
          >
            <p className="font-mono text-2xl">{s.value}</p>
            <p className="mt-1 text-sm text-ink-muted">{s.label}</p>
          </div>
        ))}
      </div>

      <section className="flex flex-col items-center gap-5 rounded-lg border border-dashed border-line px-6 py-16 text-center">
        <Logo className="h-10 w-10 text-ink-muted/50" />
        <div className="space-y-2">
          <h2 className="text-lg font-medium">No research runs yet</h2>
          <p className="mx-auto max-w-sm text-sm leading-6 text-ink-muted">
            When you start a run, independent agents will gather sources,
            cross-check each other&apos;s claims, and converge on a report you
            can audit line by line.
          </p>
        </div>
        <button
          disabled
          className="cursor-not-allowed rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent opacity-45"
        >
          New research run
        </button>
        <p className="font-mono text-xs text-ink-muted">
          agent runtime ships in milestone 2
        </p>
      </section>

      <footer className="flex items-center gap-2 font-mono text-xs text-ink-muted">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            gateway.state === "ok"
              ? "bg-confidence-high"
              : gateway.state === "unconfigured"
                ? "bg-line"
                : "bg-confidence-mid"
          }`}
        />
        {gateway.state === "ok" && (
          <span>gateway session verified · {gateway.userId}</span>
        )}
        {gateway.state === "unconfigured" && (
          <span>gateway not configured — web-only mode</span>
        )}
        {gateway.state === "offline" && (
          <span>gateway unreachable — start services/gateway locally</span>
        )}
        {gateway.state === "error" && (
          <span>gateway rejected the session (HTTP {gateway.code})</span>
        )}
      </footer>
    </main>
  );
}
