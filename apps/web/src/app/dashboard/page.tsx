import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { Logo } from "@/components/logo";
import { NewRunForm } from "@/components/new-run-form";
import { StatusPill } from "@/components/run-status";
import {
  isBackendAvailable,
  listRuns,
  type RunListItem,
} from "@/lib/gateway";

export const metadata: Metadata = {
  title: "Overview",
};

// Demo-mode research runs in the background (after()) of the createRun action,
// which executes in this route's function — give it room to finish.
export const maxDuration = 60;

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

async function loadRuns(): Promise<{ runs: RunListItem[]; reachable: boolean }> {
  if (!isBackendAvailable()) return { runs: [], reachable: false };
  try {
    return { runs: await listRuns(), reachable: true };
  } catch {
    return { runs: [], reachable: false };
  }
}

export default async function Overview() {
  const [user, { runs, reachable }] = await Promise.all([currentUser(), loadRuns()]);
  const configured = isBackendAvailable();

  return (
    <main className="mx-auto w-full max-w-4xl space-y-10">
      <header className="space-y-1">
        <h1 className="font-display text-3xl tracking-tight">
          {greeting()}
          {user?.firstName ? `, ${user.firstName}` : ""}
        </h1>
        <p className="text-ink-muted">
          Ask a question and watch the mesh gather, verify, and cite.
        </p>
      </header>

      <section className="rounded-lg border border-line bg-surface p-5">
        <NewRunForm disabled={!configured} />
      </section>

      {!configured && (
        <p className="rounded-md border border-dashed border-line px-4 py-3 text-sm text-ink-muted">
          The research gateway isn&apos;t configured in this environment, so new
          runs are disabled here. Run the gateway and mesh locally to try the
          full flow — see the project README.
        </p>
      )}
      {configured && !reachable && (
        <p className="rounded-md border border-dashed border-confidence-mid/40 px-4 py-3 text-sm text-confidence-mid">
          The research gateway is unreachable right now. Your existing runs will
          reappear once it&apos;s back.
        </p>
      )}

      <section className="space-y-4">
        <h2 className="font-mono text-xs uppercase tracking-widest text-ink-muted">
          Research runs
        </h2>
        {runs.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-line px-6 py-14 text-center">
            <Logo className="h-9 w-9 text-ink-muted/40" />
            <p className="max-w-sm text-sm leading-6 text-ink-muted">
              No runs yet. Your research history will appear here — each with its
              claims, confidence, and sources.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
            {runs.map((run) => (
              <li key={run.id}>
                <Link
                  href={`/dashboard/runs/${run.id}`}
                  className="flex items-center justify-between gap-4 bg-surface px-5 py-4 transition-colors hover:bg-line/30"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-medium">{run.question}</p>
                    <p className="font-mono text-xs text-ink-muted">
                      {run.claimCount} claims · {run.sourceCount} sources
                    </p>
                  </div>
                  <StatusPill status={run.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
